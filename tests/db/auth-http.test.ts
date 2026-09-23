import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import {
  AuthError,
  MAX_FAILURES_PER_EMAIL,
  MAX_FAILURES_PER_IP,
  createSession,
  deleteUser,
  revokeSession,
  setBanned,
  signInWithGoogleClaims,
  signUpWithPassword,
  validateSession,
  verifyPassword,
} from "@/lib/backend/auth";
import { resetPool } from "@/lib/backend/pool";
import { SESSION_COOKIE } from "@/lib/auth/cookie";

/**
 * The auth contract, against the app's own accounts and sessions
 * (lib/backend/auth.ts, docs/plans/remove-supabase.md fase 3).
 *
 * Kept from the GoTrue version, because the app leans on them: a signup gets a
 * session at once and a `customer` profile that is not yet verified; short and
 * wrong passwords are refused; a ban closes login; deleting a user cascades
 * through our tables but keeps the money; /panel without a session goes to
 * /login; /login with one honours a SAFE ?next=; public pages don't touch the
 * session.
 *
 * Dropped on purpose: refresh-token rotation and in-place access-token renewal
 * in the proxy. An opaque session has neither. What replaces them is tested
 * instead: an expired session is gone, a revoked one (logout elsewhere, ban)
 * dies on the next request, and the expiry slides with use.
 *
 * New: an account made BY GOTRUE logs in with its old password — the one thing
 * that must hold for every user who signed up before this change. The hash is
 * a real one GoTrue wrote (captured from the local Supabase stack before it was
 * retired), not one made by bcryptjs.
 *
 * The code under test connects as `app` (appDbUrl) — the role production
 * gives the application — so a grant it lacks fails here.
 */

const DB = inject("dbUrl");
const APP_DB = inject("appDbUrl");

/** Written by GoTrue v2.194.0 for the password below. */
const GOTRUE_HASH = "$2a$10$KdpxcXjEDLhfuwxrK.BmUO8f.xUZXnYt7ezP1wQpmQeIZBhRmwmqW";
const GOTRUE_PASSWORD = "Sm0ke-pass-123";

let raw: pg.Client;
const created: string[] = [];
const PASSWORD = "rahasia-uji-123";
const email = () => `t-${crypto.randomUUID().slice(0, 8)}@test.local`;

async function ownUser(fullName = "Uji"): Promise<{ id: string; email: string }> {
  const e = email();
  const u = await signUpWithPassword({ email: e, password: PASSWORD, fullName });
  created.push(u.id);
  return { id: u.id, email: e };
}

async function codeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return "ok";
  } catch (e) {
    if (e instanceof AuthError) return e.code;
    throw e;
  }
}

beforeAll(async () => {
  await resetPool(APP_DB);
  process.env.DATABASE_URL = APP_DB;
  raw = new pg.Client({ connectionString: DB });
  await raw.connect();
});

afterAll(async () => {
  if (created.length) await raw.query("delete from auth.users where id = any($1)", [created]);
  await raw.end();
});

describe("pendaftaran", () => {
  it("signup langsung bisa dipakai — profil lahir customer, belum terverifikasi, nama tersimpan", async () => {
    const u = await ownUser("Pendaftar");
    const { rows } = await raw.query(
      "select full_name, is_platform, email, email_verified_at from lp_profiles where id = $1",
      [u.id],
    );
    expect(rows[0]).toEqual({ full_name: "Pendaftar", is_platform: false, email: u.email, email_verified_at: null });
    const token = await createSession(u.id);
    expect((await validateSession(token))?.id).toBe(u.id);
  });

  it("kata sandi di bawah 6 karakter ditolak; email tidak valid ditolak", async () => {
    expect(await codeOf(signUpWithPassword({ email: email(), password: "12345" }))).toBe("weak_password");
    expect(await codeOf(signUpWithPassword({ email: "bukan-email", password: PASSWORD }))).toBe("invalid_email");
  });

  it("email yang sudah terdaftar ditolak — tanpa peduli huruf besar-kecil", async () => {
    const u = await ownUser();
    expect(await codeOf(signUpWithPassword({ email: u.email.toUpperCase(), password: PASSWORD }))).toBe("email_taken");
  });
});

describe("masuk", () => {
  it("akun buatan GoTrue masuk dengan sandi lamanya ($2a$10$ apa adanya)", async () => {
    const e = email();
    const { rows } = await raw.query(
      `insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                               raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
       values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
               $1, $2, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now())
       returning id`,
      [e, GOTRUE_HASH],
    );
    created.push(rows[0].id);

    expect((await verifyPassword(e, GOTRUE_PASSWORD)).id).toBe(rows[0].id);
    expect((await verifyPassword(e.toUpperCase(), GOTRUE_PASSWORD)).id).toBe(rows[0].id);
    expect(await codeOf(verifyPassword(e, "Sm0ke-pass-124"))).toBe("invalid_credentials");
  });

  it("sandi salah dan email tak dikenal ditolak dengan pesan yang sama", async () => {
    const u = await ownUser();
    expect(await codeOf(verifyPassword(u.email, "salah-sekali"))).toBe("invalid_credentials");
    expect(await codeOf(verifyPassword(email(), PASSWORD))).toBe("invalid_credentials");
  });

  it("akun Google-saja (hash kosong) tidak bisa masuk dengan sandi apa pun", async () => {
    const g = await signInWithGoogleClaims({ sub: `g-${crypto.randomUUID()}`, email: email(), email_verified: true });
    created.push(g.id);
    expect(await codeOf(verifyPassword(g.email, ""))).toBe("invalid_credentials");
    expect(await codeOf(verifyPassword(g.email, "apa-saja"))).toBe("invalid_credentials");
  });

  it(`gagal ${MAX_FAILURES_PER_EMAIL}× untuk satu email → sandi yang BENAR pun ditolak sementara`, async () => {
    const u = await ownUser();
    for (let i = 0; i < MAX_FAILURES_PER_EMAIL; i++) await codeOf(verifyPassword(u.email, "tebakan"));
    expect(await codeOf(verifyPassword(u.email, PASSWORD))).toBe("rate_limited");
    await raw.query("delete from app_auth.login_failures where email = $1", [u.email]);
    expect(await codeOf(verifyPassword(u.email, PASSWORD))).toBe("ok");
  });

  it(`gagal ${MAX_FAILURES_PER_IP}× dari satu IP → IP itu ditolak, IP lain tidak`, async () => {
    const ip = `203.0.113.${Math.floor(Math.random() * 250)}`;
    const victim = await ownUser();
    for (let i = 0; i < MAX_FAILURES_PER_IP; i++) await codeOf(verifyPassword(email(), "tebakan", ip));
    expect(await codeOf(verifyPassword(victim.email, PASSWORD, ip))).toBe("rate_limited");
    expect(await codeOf(verifyPassword(victim.email, PASSWORD, "198.51.100.7"))).toBe("ok");
    await raw.query("delete from app_auth.login_failures where ip = $1", [ip]);
  });
});

describe("sesi", () => {
  it("disimpan hanya sebagai sha256 — token aslinya tidak ada di database", async () => {
    const u = await ownUser();
    const token = await createSession(u.id);
    const { rows } = await raw.query("select token_hash from app_auth.sessions where user_id = $1", [u.id]);
    expect(rows).toHaveLength(1);
    expect(Buffer.from(rows[0].token_hash).equals(createHash("sha256").update(token).digest())).toBe(true);
    expect(JSON.stringify(rows)).not.toContain(token);
  });

  it("anon dan authenticated tidak bisa menyentuh app_auth sama sekali", async () => {
    for (const role of ["anon", "authenticated"]) {
      for (const sql of ["select 1 from app_auth.sessions", "select 1 from app_auth.login_failures"]) {
        await raw.query("begin");
        await raw.query(`set local role ${role}`);
        const err = await raw.query(sql).then(() => null, (e: { code: string }) => e.code);
        await raw.query("rollback");
        expect(err, `${role}: ${sql}`).toBe("42501");
      }
    }
  });

  it("token sampah, kosong, dan kepanjangan tidak dikenali", async () => {
    expect(await validateSession("bukan-token")).toBeNull();
    expect(await validateSession("")).toBeNull();
    expect(await validateSession(null)).toBeNull();
    expect(await validateSession("x".repeat(5000))).toBeNull();
  });

  it("logout mencabut sesi itu saja", async () => {
    const u = await ownUser();
    const a = await createSession(u.id);
    const b = await createSession(u.id);
    await revokeSession(a);
    expect(await validateSession(a)).toBeNull();
    expect((await validateSession(b))?.id).toBe(u.id);
  });

  it("kedaluwarsa = tidak berlaku", async () => {
    const u = await ownUser();
    const token = await createSession(u.id);
    await raw.query("update app_auth.sessions set expires_at = now() - interval '1 second' where user_id = $1", [u.id]);
    expect(await validateSession(token)).toBeNull();
  });

  it("masa berlaku bergeser saat dipakai (paling sering sekali sehari)", async () => {
    const u = await ownUser();
    const token = await createSession(u.id);
    await raw.query(
      "update app_auth.sessions set last_seen_at = now() - interval '2 days', expires_at = now() + interval '1 day' where user_id = $1",
      [u.id],
    );
    await validateSession(token);
    const { rows } = await raw.query("select expires_at > now() + interval '29 days' as slid from app_auth.sessions where user_id = $1", [u.id]);
    expect(rows[0].slid).toBe(true);
  });
});

describe("tindakan admin", () => {
  it("ban menutup login DAN mematikan sesi yang sedang jalan; unban membuka login lagi", async () => {
    const u = await ownUser();
    const live = await createSession(u.id);
    await setBanned(u.id, true);
    expect(await validateSession(live)).toBeNull();
    expect(await codeOf(verifyPassword(u.email, PASSWORD))).toBe("banned");
    // A wrong password learns nothing about the ban.
    expect(await codeOf(verifyPassword(u.email, "salah"))).toBe("invalid_credentials");

    await setBanned(u.id, false);
    expect(await codeOf(verifyPassword(u.email, PASSWORD))).toBe("ok");
  });

  it("hapus user: profil & sesi hilang, pembeliannya bertahan tanpa nama", async () => {
    const buyer = await ownUser();
    const seller = await ownUser();
    // A seller is a business member since Fase 5 — lp_can_sell() reads that.
    await raw.query(
      `insert into lp_business_members (business_id, user_id, role)
       select id, $1, 'admin' from lp_businesses order by created_at limit 1
       on conflict do nothing`,
      [seller.id],
    );
    const p = await raw.query(
      "insert into lp_landing_pages (title, slug, user_id, price) values ('x', $1, $2, 10000) returning id",
      [`p-${crypto.randomUUID().slice(0, 8)}`, seller.id],
    );
    const purchase = await raw.query(
      "insert into lp_purchases (user_id, landing_page_id, amount) values ($1, $2, 10000) returning id",
      [buyer.id, p.rows[0].id],
    );
    const token = await createSession(buyer.id);

    await deleteUser(buyer.id);

    expect((await raw.query("select 1 from lp_profiles where id = $1", [buyer.id])).rows).toEqual([]);
    expect(await validateSession(token)).toBeNull();
    const kept = await raw.query("select user_id, amount from lp_purchases where id = $1", [purchase.rows[0].id]);
    expect(kept.rows[0]).toEqual({ user_id: null, amount: 10000 });
    await raw.query("delete from lp_landing_pages where id = $1", [p.rows[0].id]);
  });
});

describe("Google", () => {
  it("akun baru: provider google, dan alamatnya langsung terverifikasi (trigger lp_handle_new_user)", async () => {
    const e = email();
    const g = await signInWithGoogleClaims({ sub: `g-${crypto.randomUUID()}`, email: e, email_verified: true, name: "Gugel" });
    created.push(g.id);
    expect(g.app_metadata.provider).toBe("google");
    const { rows } = await raw.query("select full_name, email_verified_at is not null as verified from lp_profiles where id = $1", [g.id]);
    expect(rows[0]).toEqual({ full_name: "Gugel", verified: true });
  });

  it("identitas yang sama → akun yang sama", async () => {
    const sub = `g-${crypto.randomUUID()}`;
    const a = await signInWithGoogleClaims({ sub, email: email(), email_verified: true });
    created.push(a.id);
    const b = await signInWithGoogleClaims({ sub, email: email(), email_verified: true });
    expect(b.id).toBe(a.id);
  });

  it("email terverifikasi yang sama dengan akun email → ditautkan ke akun itu", async () => {
    const u = await ownUser();
    const g = await signInWithGoogleClaims({ sub: `g-${crypto.randomUUID()}`, email: u.email, email_verified: true });
    expect(g.id).toBe(u.id);
    expect(g.app_metadata.providers).toEqual(expect.arrayContaining(["email", "google"]));
  });

  it("email yang BELUM diverifikasi Google tidak pernah ditautkan ke akun yang ada", async () => {
    const u = await ownUser();
    expect(await codeOf(signInWithGoogleClaims({ sub: `g-${crypto.randomUUID()}`, email: u.email, email_verified: false }))).toBe(
      "oauth_failed",
    );
  });

  it("user Google yang di-ban ditolak", async () => {
    const sub = `g-${crypto.randomUUID()}`;
    const g = await signInWithGoogleClaims({ sub, email: email(), email_verified: true });
    created.push(g.id);
    await setBanned(g.id, true);
    expect(await codeOf(signInWithGoogleClaims({ sub, email: g.email!, email_verified: true }))).toBe("banned");
  });
});

// ---------------------------------------------------------------------------
// The proxy contract (lib/db/proxy.ts)
// ---------------------------------------------------------------------------

describe("proxy: sesi & pengalihan", () => {
  let updateSession: (req: NextRequest) => Promise<Response & { cookies: { getAll(): unknown[] } }>;
  let user: { id: string; email: string };

  beforeAll(async () => {
    ({ updateSession } = (await import("@/lib/db/proxy")) as never);
    user = await ownUser();
  });

  const req = (path: string, token?: string) =>
    new NextRequest(new URL(path, "http://127.0.0.1:3000"), {
      headers: token ? { cookie: `${SESSION_COOKIE}=${token}` } : {},
    });

  it("tanpa sesi, /panel dialihkan ke /login", async () => {
    const res = await updateSession(req("/panel"));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
  });

  it("tanpa sesi, /read/<slug> dialihkan ke /login dengan ?next= kembali ke buku", async () => {
    const loc = new URL((await updateSession(req("/read/buku-a"))).headers.get("location")!);
    expect(loc.pathname).toBe("/login");
    expect(loc.searchParams.get("next")).toBe("/read/buku-a");
  });

  it("dengan sesi, /panel lewat — dan membawa x-pathname untuk layout", async () => {
    const res = await updateSession(req("/panel/products", await createSession(user.id)));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-request-x-pathname")).toBe("/panel/products");
  });

  it("sudah masuk lalu membuka /login: ke ?next= yang aman, atau ke /panel", async () => {
    const token = await createSession(user.id);
    const to = async (path: string) => {
      const loc = new URL((await updateSession(req(path, token))).headers.get("location")!);
      // NextURL normalises 127.0.0.1 to localhost; any OTHER host is the leak.
      return loc.hostname === "localhost" ? loc.pathname : loc.href;
    };
    expect(await to("/login")).toBe("/panel");
    expect(await to("/login?next=/checkout/buku")).toBe("/checkout/buku");
    // An open redirect would go to evil.example. safeNextPath refuses it.
    expect(await to("/login?next=//evil.example/x")).toBe("/panel");
  });

  it("sesi yang dicabut (logout di tab lain, ban) berhenti berlaku di request berikutnya", async () => {
    const token = await createSession(user.id);
    expect((await updateSession(req("/panel", token))).status).toBe(200);
    await revokeSession(token);
    expect((await updateSession(req("/panel", token))).status).toBe(307);
  });

  it("halaman publik TIDAK menyentuh sesi — tidak ada cookie yang ditulis", async () => {
    const res = await updateSession(req("/", await createSession(user.id)));
    expect(res.status).toBe(200);
    expect(res.cookies.getAll()).toEqual([]);
  });
});

describe("permukaan Auth yang dipakai aplikasi", () => {
  const sources = async () => {
    const { readFileSync, readdirSync } = await import("node:fs");
    return ["app", "lib", "components"].flatMap((d) =>
      (readdirSync(d, { recursive: true }) as string[])
        .filter((f) => /\.tsx?$/.test(f))
        .map((f) => ({ f: `${d}/${f}`, src: readFileSync(`${d}/${f}`, "utf8") })),
    );
  };

  it("tidak ada lagi GoTrue: tidak satu pun file aplikasi meng-import @supabase/*", async () => {
    const hits = (await sources()).filter(({ src }) => /from\s+["']@supabase\//.test(src)).map(({ f }) => f);
    expect(hits).toEqual([]);
  });

  it("satu-satunya method .auth yang dipanggil adalah getUser()", async () => {
    const calls = new Set((await sources()).flatMap(({ src }) => [...src.matchAll(/\.auth\.([a-zA-Z.]+)\(/g)].map((m) => m[1])));
    expect([...calls]).toEqual(["getUser"]);
  });
});
