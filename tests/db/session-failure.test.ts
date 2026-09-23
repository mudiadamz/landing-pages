import pg from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { resetPool } from "@/lib/backend/pool";
import {
  createSession,
  revokeSession,
  sessionFailureReason,
  sessionFingerprint,
  validateSession,
} from "@/lib/backend/auth";

/**
 * Why a session stopped authenticating.
 *
 * "I get logged out too quickly" was unanswerable because every cause lands on
 * the same redirect to /login. These tests hold the four apart, and one of them
 * is the whole point: a session the browser forgot ("no-cookie") is ALIVE on the
 * server, so no amount of raising SESSION_TTL_DAYS would have helped — and that
 * is the difference nothing in the app could previously report.
 */

const DB = inject("dbUrl");
const APP_DB = inject("appDbUrl");

let raw: pg.Client;
let userId: string;

const uid = () => crypto.randomUUID().slice(0, 8);

async function makeUser(): Promise<string> {
  const { rows } = await raw.query<{ id: string }>(
    `insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at,
                             raw_app_meta_data, raw_user_meta_data)
     values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
             $1, 'x', now(), now(), '{"provider":"email"}', '{}')
     returning id`,
    [`sess-${uid()}@test.local`],
  );
  return rows[0].id;
}

beforeAll(async () => {
  await resetPool(APP_DB);
  raw = new pg.Client({ connectionString: DB });
  await raw.connect();
  userId = await makeUser();
});

afterAll(async () => {
  await raw.query("delete from auth.users where id = $1", [userId]);
  await raw.end();
  await resetPool();
});

describe("sessionFailureReason", () => {
  it("tanpa cookie sama sekali → no-cookie (dan TIDAK menyentuh database)", async () => {
    expect(await sessionFailureReason(null)).toBe("no-cookie");
    expect(await sessionFailureReason("")).toBe("no-cookie");
  });

  it("token sampah / kepanjangan → no-cookie, bukan query", async () => {
    expect(await sessionFailureReason("x".repeat(200))).toBe("no-cookie");
  });

  it("token yang tidak dikenal → unknown", async () => {
    expect(await sessionFailureReason("tidak-pernah-ada-token-ini")).toBe("unknown");
  });

  it("sesudah sign-out → unknown: barisnya memang dihapus", async () => {
    const token = await createSession(userId);
    expect(await validateSession(token)).not.toBeNull();
    await revokeSession(token);
    expect(await sessionFailureReason(token)).toBe("unknown");
  });

  it("baris ada tapi lewat 30 hari → expired", async () => {
    const token = await createSession(userId);
    await raw.query("update app_auth.sessions set expires_at = now() - interval '1 day' where user_id = $1", [userId]);
    expect(await validateSession(token)).toBeNull();
    expect(await sessionFailureReason(token)).toBe("expired");
    await raw.query("delete from app_auth.sessions where user_id = $1", [userId]);
  });

  it("akun di-ban → locked, bukan expired", async () => {
    const token = await createSession(userId);
    await raw.query("update auth.users set banned_until = now() + interval '1 day' where id = $1", [userId]);
    expect(await sessionFailureReason(token)).toBe("locked");
    await raw.query("update auth.users set banned_until = null where id = $1", [userId]);
    await raw.query("delete from app_auth.sessions where user_id = $1", [userId]);
  });

  it("sesi yang MASIH HIDUP tidak pernah dilaporkan gagal", async () => {
    // The case that matters: if the browser drops the cookie, the row is still
    // here. Reporting that as "expired" would send anyone debugging it straight
    // to SESSION_TTL_DAYS, which is not the problem.
    const token = await createSession(userId);
    expect(await validateSession(token)).not.toBeNull();
    expect(await sessionFailureReason(null)).toBe("no-cookie");
    await raw.query("delete from app_auth.sessions where user_id = $1", [userId]);
  });
});

describe("sessionFingerprint", () => {
  it("stabil untuk token yang sama, beda untuk token lain", async () => {
    expect(sessionFingerprint("abc")).toBe(sessionFingerprint("abc"));
    expect(sessionFingerprint("abc")).not.toBe(sessionFingerprint("abd"));
  });

  it("pendek, hex, dan BUKAN tokennya — log tidak boleh memuat kredensial", () => {
    const token = "rahasia-sekali";
    const fp = sessionFingerprint(token);
    expect(fp).toMatch(/^[0-9a-f]{8}$/);
    expect(fp).not.toContain(token);
  });

  it("tanpa token → '-'", () => {
    expect(sessionFingerprint(null)).toBe("-");
  });
});
