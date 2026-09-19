import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

/**
 * The auth contract, over HTTP, against the real local GoTrue.
 *
 * These are the behaviours the app leans on without ever saying so: a signup
 * returns a session immediately (no confirmation gate — the app does its own
 * verification), a ban is `ban_duration`, deleting a user cascades through
 * our tables, and the middleware renews an expired access token in place,
 * writing the new cookie to BOTH the in-flight request and the response.
 *
 * Unlike the SQL tests, nothing here is rolled back: GoTrue commits. Every user
 * created is removed in afterAll. The calls that count against GoTrue's
 * sign-in/sign-up rate limit (30 per 5 minutes per IP, supabase/config.toml)
 * are kept to a handful; most users are made with the admin API, which is not
 * limited.
 */

const API = inject("apiUrl");
const ANON = inject("anonKey");
const SERVICE = inject("serviceRoleKey");

const admin = createClient(API, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = () => createClient(API, ANON, { auth: { persistSession: false, autoRefreshToken: false } });

const created: string[] = [];
const PASSWORD = "rahasia-uji-123";
const email = () => `t-${crypto.randomUUID().slice(0, 8)}@test.local`;

async function adminUser(): Promise<{ id: string; email: string }> {
  const e = email();
  const { data, error } = await admin.auth.admin.createUser({ email: e, password: PASSWORD, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("createUser gagal");
  created.push(data.user.id);
  return { id: data.user.id, email: e };
}

afterAll(async () => {
  for (const id of created) await admin.auth.admin.deleteUser(id).catch(() => undefined);
});

describe("pendaftaran", () => {
  it("signup email langsung mendapat sesi — tidak ada gerbang konfirmasi", async () => {
    // mailer_autoconfirm=true in production, enable_confirmations=false here.
    // The app shows its own verification banner instead (lib/email-verify.ts);
    // a backend that starts gating login on e-mail confirmation would lock out
    // every new account.
    const e = email();
    const { data, error } = await anon().auth.signUp({
      email: e,
      password: PASSWORD,
      options: { data: { full_name: "Pendaftar" } },
    });
    expect(error).toBeNull();
    expect(data.session?.access_token).toBeTruthy();
    created.push(data.user!.id);

    const { data: profile } = await admin
      .from("lp_profiles")
      .select("full_name, account_type, email, email_verified_at")
      .eq("id", data.user!.id)
      .single();
    expect(profile).toEqual({ full_name: "Pendaftar", account_type: "customer", email: e, email_verified_at: null });
  });

  it("kata sandi di bawah 6 karakter ditolak", async () => {
    const { error } = await anon().auth.signUp({ email: email(), password: "12345" });
    expect(error?.message ?? "").toMatch(/password/i);
  });
});

describe("masuk & identitas", () => {
  it("kata sandi salah ditolak; yang benar memberi sesi; token itu dikenali getUser", async () => {
    const u = await adminUser();
    const wrong = await anon().auth.signInWithPassword({ email: u.email, password: "salah-sekali" });
    expect(wrong.error).not.toBeNull();

    const ok = await anon().auth.signInWithPassword({ email: u.email, password: PASSWORD });
    expect(ok.error).toBeNull();
    const who = await admin.auth.getUser(ok.data.session!.access_token);
    expect(who.data.user?.id).toBe(u.id);
  });

  it("token sampah tidak dikenali", async () => {
    const who = await admin.auth.getUser("bukan.token.sungguhan");
    expect(who.data.user).toBeNull();
    expect(who.error).not.toBeNull();
  });

  it("refresh token menghasilkan access token baru", async () => {
    const u = await adminUser();
    const client = anon();
    const { data } = await client.auth.signInWithPassword({ email: u.email, password: PASSWORD });
    const { data: refreshed, error } = await client.auth.refreshSession({
      refresh_token: data.session!.refresh_token,
    });
    expect(error).toBeNull();
    expect(refreshed.session?.access_token).toBeTruthy();
    expect(refreshed.session?.refresh_token).not.toBe(data.session!.refresh_token);
  });
});

describe("tindakan admin", () => {
  it("ban (ban_duration) menutup login; 'none' membukanya lagi — persis yang dikirim /api/admin/users", async () => {
    const u = await adminUser();
    await admin.auth.admin.updateUserById(u.id, { ban_duration: "876000h" });
    const banned = await anon().auth.signInWithPassword({ email: u.email, password: PASSWORD });
    expect(banned.error).not.toBeNull();

    await admin.auth.admin.updateUserById(u.id, { ban_duration: "none" });
    const back = await anon().auth.signInWithPassword({ email: u.email, password: PASSWORD });
    expect(back.error).toBeNull();
  });

  it("deleteUser lewat GoTrue: profil hilang, pembeliannya bertahan tanpa nama", async () => {
    const buyer = await adminUser();
    const seller = await adminUser();
    await admin.from("lp_profiles").update({ account_type: "agent" }).eq("id", seller.id);
    const { data: p } = await admin
      .from("lp_landing_pages")
      .insert({ title: "x", slug: `p-${crypto.randomUUID().slice(0, 8)}`, user_id: seller.id, price: 10_000 })
      .select("id")
      .single();
    const { data: purchase } = await admin
      .from("lp_purchases")
      .insert({ user_id: buyer.id, landing_page_id: p!.id, amount: 10_000 })
      .select("id")
      .single();

    const { error } = await admin.auth.admin.deleteUser(buyer.id);
    expect(error).toBeNull();

    const { data: profile } = await admin.from("lp_profiles").select("id").eq("id", buyer.id).maybeSingle();
    const { data: kept } = await admin.from("lp_purchases").select("user_id, amount").eq("id", purchase!.id).single();
    expect(profile).toBeNull();
    expect(kept).toEqual({ user_id: null, amount: 10_000 });

    await admin.from("lp_landing_pages").delete().eq("id", p!.id);
  });
});

// ---------------------------------------------------------------------------
// The middleware contract (lib/supabase/proxy.ts)
// ---------------------------------------------------------------------------

type Jar = { name: string; value: string }[];

/** Sign in the way the app does, and return the cookies @supabase/ssr writes. */
async function signedInCookies(emailAddr: string): Promise<Jar> {
  const jar = new Map<string, string>();
  const ssr = createServerClient(API, ANON, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (list) => list.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))),
    },
  });
  const { error } = await ssr.auth.signInWithPassword({ email: emailAddr, password: PASSWORD });
  if (error) throw error;
  return [...jar].map(([name, value]) => ({ name, value }));
}

/** The same session, with its access token declared already expired. */
function expire(jar: Jar): Jar {
  expect(jar.length, "sesi uji harus muat dalam satu cookie").toBe(1);
  const [{ name, value }] = jar;
  const json = JSON.parse(Buffer.from(value.replace(/^base64-/, ""), "base64url").toString());
  json.expires_at = Math.floor(Date.now() / 1000) - 60;
  return [{ name, value: "base64-" + Buffer.from(JSON.stringify(json)).toString("base64url") }];
}

const accessToken = (value: string) =>
  JSON.parse(Buffer.from(value.replace(/^base64-/, ""), "base64url").toString()).access_token as string;

describe("middleware: sesi & pengalihan", () => {
  let updateSession: (req: NextRequest) => Promise<Response & { cookies: { getAll(): Jar } }>;
  let user: { id: string; email: string };

  beforeAll(async () => {
    // proxy.ts (and lib/missing-record.ts) read these at import time.
    process.env.NEXT_PUBLIC_SUPABASE_URL = API;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ANON;
    ({ updateSession } = (await import("@/lib/supabase/proxy")) as never);
    user = await adminUser();
  });

  const req = (path: string, jar: Jar = []) =>
    new NextRequest(new URL(path, "http://127.0.0.1:3000"), {
      headers: jar.length ? { cookie: jar.map((c) => `${c.name}=${c.value}`).join("; ") } : {},
    });

  it("tanpa sesi, /panel dialihkan ke /login", async () => {
    const res = await updateSession(req("/panel"));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
  });

  it("dengan sesi, /panel lewat — dan membawa x-pathname untuk layout", async () => {
    const res = await updateSession(req("/panel/products", await signedInCookies(user.email)));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-request-x-pathname")).toBe("/panel/products");
  });

  it("sudah masuk lalu membuka /login: ke ?next= yang aman, atau ke /panel", async () => {
    const jar = await signedInCookies(user.email);
    const to = async (path: string) => {
      const loc = new URL((await updateSession(req(path, jar))).headers.get("location")!);
      // NextURL normalises 127.0.0.1 to localhost; any OTHER host is the leak.
      return loc.hostname === "localhost" ? loc.pathname : loc.href;
    };
    expect(await to("/login")).toBe("/panel");
    expect(await to("/login?next=/checkout/buku")).toBe("/checkout/buku");
    // An open redirect would go to evil.example. safeNextPath refuses it.
    expect(await to("/login?next=//evil.example/x")).toBe("/panel");
  });

  it("access token kedaluwarsa + refresh token sah: diperbarui di tempat, tidak ditendang ke /login", async () => {
    // The renewed session has to be written to the RESPONSE (so the browser
    // keeps it) — and to the REQUEST, so the server components rendering this
    // same page see the user. Getting either half wrong is a session that
    // works on the second click only.
    const stale = expire(await signedInCookies(user.email));
    const res = await updateSession(req("/panel", stale));
    expect(res.status).toBe(200);

    const renewed = res.cookies.getAll().find((c) => c.name === stale[0].name);
    expect(renewed, "cookie sesi baru di response").toBeTruthy();
    expect(accessToken(renewed!.value)).not.toBe(accessToken(stale[0].value));

    // Compare the DECODED token: every session cookie starts with the same
    // base64 of `{"access_token":"eyJhbGciOi…`, so a prefix match would pass
    // with the stale cookie still in place (it did, until a mutation test
    // removed the request-side write and this stayed green).
    const forwarded = res.headers.get("x-middleware-request-cookie") ?? "";
    const sent = forwarded
      .split(/;\s*/)
      .map((kv) => [kv.slice(0, kv.indexOf("=")), kv.slice(kv.indexOf("=") + 1)] as const)
      .find(([k]) => k === stale[0].name)?.[1];
    expect(sent, "cookie sesi ikut diteruskan ke server components").toBeTruthy();
    expect(accessToken(sent!), "yang diteruskan adalah token BARU").toBe(accessToken(renewed!.value));
  });

  it("halaman publik TIDAK menyentuh sesi — sesi kedaluwarsa tidak diperbarui di sana", async () => {
    // Deliberate (a round trip saved on every storefront view), and a real
    // constraint on any replacement: public pages only renew a session if the
    // page itself happens to ask for the user.
    const stale = expire(await signedInCookies(user.email));
    const res = await updateSession(req("/", stale));
    expect(res.status).toBe(200);
    expect(res.cookies.getAll()).toEqual([]);
  });
});

describe("permukaan Auth yang dipakai aplikasi", () => {
  it("tidak ada lagi admin.listUsers — email diambil dari lp_profiles", async () => {
    // listUsers({ perPage: 1000 }) silently stopped at the 1001st user, and was
    // one more GoTrue admin call for a replacement backend to reproduce.
    const { readFileSync, readdirSync } = await import("node:fs");
    const files = ["app", "lib", "components"].flatMap((d) =>
      (readdirSync(d, { recursive: true }) as string[]).filter((f) => /\.tsx?$/.test(f)).map((f) => `${d}/${f}`),
    );
    const hits = files.filter((f) => /auth\.admin\.listUsers\(/.test(readFileSync(f, "utf8")));
    expect(hits).toEqual([]);
  });
});

