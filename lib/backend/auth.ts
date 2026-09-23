import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type pg from "pg";
import { pool } from "./pool";

/**
 * Accounts and sessions, without GoTrue (docs/plans/remove-supabase.md, fase 3).
 *
 * Users stay in auth.users — same rows, ids and bcrypt hashes GoTrue wrote — so
 * the 20 foreign keys and the lp_handle_new_user trigger never notice. What
 * changes is the session: an opaque 32-byte token in an httpOnly cookie, stored
 * here only as its sha256 (app_auth.sessions). There is no refresh token and no
 * JWT to verify; a session is valid exactly while its row says so, which makes
 * logout, ban and delete take effect on the very next request.
 *
 * Every query runs on the pool's own connection (the database owner), not
 * through withRls: these are the checks that DECIDE who the caller is, so there
 * is no caller yet to run them as.
 */

export type AuthUser = {
  id: string;
  email: string | null;
  user_metadata: Record<string, unknown> & { full_name?: string; phone?: string };
  app_metadata: Record<string, unknown>;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
};

export type AuthErrorCode =
  | "invalid_credentials"
  | "banned"
  | "weak_password"
  | "invalid_email"
  | "email_taken"
  | "rate_limited"
  | "oauth_failed";

/** Messages are shown to the visitor as-is (`/login?error=…`). */
const MESSAGES: Record<AuthErrorCode, string> = {
  invalid_credentials: "Email atau kata sandi salah.",
  banned: "Akun ini dinonaktifkan. Hubungi support.",
  weak_password: "Kata sandi minimal 6 karakter.",
  invalid_email: "Alamat email tidak valid.",
  email_taken: "Email ini sudah terdaftar. Silakan masuk.",
  rate_limited: "Terlalu banyak percobaan. Coba lagi beberapa menit lagi.",
  oauth_failed: "Gagal masuk dengan Google.",
};

export class AuthError extends Error {
  constructor(public code: AuthErrorCode) {
    super(MESSAGES[code]);
    this.name = "AuthError";
  }
}

export const SESSION_TTL_DAYS = 30;
/** How stale last_seen_at may get before a request slides the expiry forward. */
const SLIDE_AFTER_MS = 24 * 60 * 60 * 1000;
export const MIN_PASSWORD = 6;
/** GoTrue's cost, so hashes written before and after the move look alike. */
const BCRYPT_COST = 10;

const FAILURE_WINDOW = "15 minutes";
export const MAX_FAILURES_PER_IP = 20;
export const MAX_FAILURES_PER_EMAIL = 10;

const INSTANCE_ID = "00000000-0000-0000-0000-000000000000";
// Compared against when the email is unknown, so "no such user" costs the same
// bcrypt time as "wrong password" and response timing doesn't list accounts.
const DUMMY_HASH = bcrypt.hashSync("tidak-ada-akun-ini", BCRYPT_COST);

const sha256 = (s: string) => createHash("sha256").update(s).digest();

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const e = raw.trim().toLowerCase();
  return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

type UserRow = {
  id: string;
  email: string | null;
  raw_user_meta_data: Record<string, unknown> | null;
  raw_app_meta_data: Record<string, unknown> | null;
  created_at: Date;
  last_sign_in_at: Date | null;
  email_confirmed_at: Date | null;
};

const USER_COLS = "u.id, u.email, u.raw_user_meta_data, u.raw_app_meta_data, u.created_at, u.last_sign_in_at, u.email_confirmed_at";
// A user who may hold a session right now.
const USABLE = "(u.banned_until is null or u.banned_until <= now()) and u.deleted_at is null";

function toUser(r: UserRow): AuthUser {
  return {
    id: r.id,
    email: r.email,
    user_metadata: (r.raw_user_meta_data ?? {}) as AuthUser["user_metadata"],
    app_metadata: r.raw_app_meta_data ?? {},
    created_at: r.created_at.toISOString(),
    last_sign_in_at: r.last_sign_in_at?.toISOString() ?? null,
    email_confirmed_at: r.email_confirmed_at?.toISOString() ?? null,
  };
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export type ClientMeta = { ip?: string | null; userAgent?: string | null };

export async function createSession(userId: string, meta: ClientMeta = {}): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await pool().query(
    `insert into app_auth.sessions (token_hash, user_id, expires_at, ip, user_agent)
     values ($1, $2, now() + make_interval(days => $3), $4, $5)`,
    [sha256(token), userId, SESSION_TTL_DAYS, meta.ip ?? null, meta.userAgent?.slice(0, 500) ?? null],
  );
  await pool().query("update auth.users set last_sign_in_at = now(), updated_at = now() where id = $1", [userId]);
  return token;
}

/** The user behind a session token, or null — expired, revoked, banned, deleted, or garbage. */
export async function validateSession(token: string | null | undefined): Promise<AuthUser | null> {
  if (!token || token.length > 128) return null;
  const { rows } = await pool().query<UserRow & { session_id: string; last_seen_at: Date }>(
    `select ${USER_COLS}, s.id as session_id, s.last_seen_at
       from app_auth.sessions s join auth.users u on u.id = s.user_id
      where s.token_hash = $1 and s.expires_at > now() and ${USABLE}`,
    [sha256(token)],
  );
  const row = rows[0];
  if (!row) return null;
  if (Date.now() - row.last_seen_at.getTime() > SLIDE_AFTER_MS) {
    await pool().query(
      "update app_auth.sessions set last_seen_at = now(), expires_at = now() + make_interval(days => $2) where id = $1",
      [row.session_id, SESSION_TTL_DAYS],
    );
  }
  return toUser(row);
}

/**
 * WHY a session did not authenticate — diagnostics only, never a decision.
 *
 * "I get logged out too quickly" is unanswerable from the outside, because
 * every cause produces the identical redirect to /login. This separates them:
 *
 *   no-cookie   the browser sent nothing. The session row may well be alive —
 *               the cookie was evicted, cleared, or never stored. Nothing
 *               server-side can extend a cookie the browser threw away.
 *   unknown     a token arrived that matches no row: signed out elsewhere, a
 *               ban revoking every session, or a different database.
 *   expired     the row exists and its 30 days ran out — a genuinely short
 *               session, and the only cause SESSION_TTL_DAYS could fix.
 *   locked      banned or deleted account.
 *
 * Runs only on the failing path, so the happy path costs nothing extra.
 */
export type SessionFailure = "no-cookie" | "unknown" | "expired" | "locked";

export async function sessionFailureReason(
  token: string | null | undefined,
): Promise<SessionFailure> {
  if (!token || token.length > 128) return "no-cookie";
  const { rows } = await pool().query<{ expired: boolean; usable: boolean }>(
    `select s.expires_at <= now() as expired,
            (${USABLE}) as usable
       from app_auth.sessions s join auth.users u on u.id = s.user_id
      where s.token_hash = $1`,
    [sha256(token)],
  );
  const row = rows[0];
  if (!row) return "unknown";
  if (!row.usable) return "locked";
  return row.expired ? "expired" : "unknown";
}

/**
 * A stable, non-reversible handle for one session, so two log lines can be tied
 * to the same cookie without the log ever holding a usable credential.
 */
export function sessionFingerprint(token: string | null | undefined): string {
  return token ? sha256(token).toString("hex").slice(0, 8) : "-";
}

export async function revokeSession(token: string | null | undefined): Promise<void> {
  if (!token || token.length > 128) return;
  await pool().query("delete from app_auth.sessions where token_hash = $1", [sha256(token)]);
}

export async function revokeUserSessions(userId: string): Promise<void> {
  await pool().query("delete from app_auth.sessions where user_id = $1", [userId]);
}

// ---------------------------------------------------------------------------
// Email + password
// ---------------------------------------------------------------------------

async function tooManyFailures(email: string, ip: string | null): Promise<boolean> {
  const { rows } = await pool().query<{ by_ip: number; by_email: number }>(
    `select count(*) filter (where $2::text is not null and ip = $2)::int as by_ip,
            count(*) filter (where email = $1)::int as by_email
       from app_auth.login_failures
      where created_at > now() - $3::interval and (email = $1 or ip = $2)`,
    [email, ip, FAILURE_WINDOW],
  );
  return rows[0].by_ip >= MAX_FAILURES_PER_IP || rows[0].by_email >= MAX_FAILURES_PER_EMAIL;
}

async function recordFailure(email: string, ip: string | null): Promise<void> {
  await pool().query("insert into app_auth.login_failures (ip, email) values ($1, $2)", [ip, email]);
  // Keep the table small without a cron job.
  if (Math.random() < 0.02) {
    await pool().query("delete from app_auth.login_failures where created_at < now() - interval '1 day'");
  }
}

/** Checks the password and returns the user. Does NOT create a session. */
export async function verifyPassword(rawEmail: unknown, password: unknown, ip: string | null = null): Promise<AuthUser> {
  const email = normalizeEmail(rawEmail);
  if (!email || typeof password !== "string" || !password) throw new AuthError("invalid_credentials");
  if (await tooManyFailures(email, ip)) throw new AuthError("rate_limited");

  const { rows } = await pool().query<UserRow & { encrypted_password: string | null; banned: boolean }>(
    `select ${USER_COLS}, u.encrypted_password,
            (u.banned_until is not null and u.banned_until > now()) as banned
       from auth.users u where lower(u.email) = $1 and u.deleted_at is null`,
    [email],
  );
  const row = rows[0];
  // GoTrue hashes are $2a$; bcryptjs verifies them as they are. An OAuth-only
  // account has an empty hash and can never match.
  const hash = row?.encrypted_password?.startsWith("$2") ? row.encrypted_password : DUMMY_HASH;
  const ok = await bcrypt.compare(password, hash);
  if (!row || !ok || hash === DUMMY_HASH) {
    await recordFailure(email, ip);
    throw new AuthError("invalid_credentials");
  }
  // After the password, like GoTrue: a wrong guess learns nothing about bans.
  if (row.banned) throw new AuthError("banned");
  return toUser(row);
}

async function insertUser(
  client: pg.PoolClient,
  u: { email: string; passwordHash: string; appMeta: object; userMeta: (id: string) => object },
): Promise<string> {
  const { rows } = await client.query<{ id: string }>("select gen_random_uuid() as id");
  const id = rows[0].id;
  // Token columns get '' rather than NULL: GoTrue scans them into Go strings
  // and fails on NULL, and until Supabase is gone it still reads this table.
  await client.query(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                             raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                             confirmation_token, recovery_token, email_change_token_new, email_change)
     values ($1, $2, 'authenticated', 'authenticated', $3, $4, now(), $5, $6, now(), now(), '', '', '', '')`,
    [INSTANCE_ID, id, u.email, u.passwordHash, JSON.stringify(u.appMeta), JSON.stringify(u.userMeta(id))],
  );
  return id;
}

async function insertIdentity(client: pg.PoolClient, userId: string, provider: string, providerId: string, data: object) {
  await client.query(
    `insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
     values ($1, $2, $3, $4, now(), now(), now())`,
    [providerId, userId, JSON.stringify(data), provider],
  );
}

async function tx<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("begin");
    const out = await fn(client);
    await client.query("commit");
    return out;
  } catch (e) {
    await client.query("rollback").catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}

async function userById(id: string): Promise<AuthUser> {
  const { rows } = await pool().query<UserRow>(`select ${USER_COLS} from auth.users u where u.id = $1`, [id]);
  return toUser(rows[0]);
}

/**
 * A new email account. Confirmed at once, as with mailer_autoconfirm: ownership
 * of the address is proven separately (lp_profiles.email_verified_at, set by
 * lib/email-verify.ts) and the account works in the meantime.
 */
export async function signUpWithPassword(input: { email: unknown; password: unknown; fullName?: string }): Promise<AuthUser> {
  const email = normalizeEmail(input.email);
  if (!email) throw new AuthError("invalid_email");
  if (typeof input.password !== "string" || input.password.length < MIN_PASSWORD) throw new AuthError("weak_password");
  // bcrypt reads only 72 bytes; anything past that would be silently ignored.
  if (Buffer.byteLength(input.password) > 72) throw new AuthError("weak_password");
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);

  try {
    const id = await tx(async (c) => {
      const id = await insertUser(c, {
        email,
        passwordHash,
        appMeta: { provider: "email", providers: ["email"] },
        userMeta: (id) => ({ full_name: input.fullName ?? "", sub: id, email, email_verified: false, phone_verified: false }),
      });
      await insertIdentity(c, id, "email", id, { sub: id, email, email_verified: false, phone_verified: false });
      return id;
    });
    return userById(id);
  } catch (e) {
    if ((e as { code?: string }).code === "23505") throw new AuthError("email_taken");
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Google
// ---------------------------------------------------------------------------

export type GoogleClaims = {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

/**
 * The account for a Google identity: the one already linked to it; else an
 * email account with the same VERIFIED address, which gets the identity linked
 * (what GoTrue did); else a new account. An unverified Google address never
 * links to an existing account — that would let anyone who can make a Google
 * account with your address walk into yours.
 */
export async function signInWithGoogleClaims(claims: GoogleClaims): Promise<AuthUser> {
  if (!claims.sub) throw new AuthError("oauth_failed");
  const email = normalizeEmail(claims.email);
  const identity = {
    iss: "https://accounts.google.com",
    sub: claims.sub,
    email: email ?? undefined,
    email_verified: claims.email_verified === true,
    name: claims.name,
    full_name: claims.name,
    picture: claims.picture,
    avatar_url: claims.picture,
    provider_id: claims.sub,
    phone_verified: false,
  };

  const id = await tx(async (c) => {
    const linked = await c.query<{ user_id: string }>(
      "select user_id from auth.identities where provider = 'google' and provider_id = $1",
      [claims.sub],
    );
    if (linked.rows[0]) {
      await c.query("update auth.identities set last_sign_in_at = now(), identity_data = $2 where provider = 'google' and provider_id = $1", [
        claims.sub,
        JSON.stringify(identity),
      ]);
      return linked.rows[0].user_id;
    }
    if (!email) throw new AuthError("oauth_failed");

    const existing = await c.query<{ id: string }>("select id from auth.users where lower(email) = $1 and deleted_at is null", [email]);
    if (existing.rows[0]) {
      if (identity.email_verified !== true) throw new AuthError("oauth_failed");
      const uid = existing.rows[0].id;
      await insertIdentity(c, uid, "google", claims.sub, identity);
      await c.query(
        `update auth.users set raw_app_meta_data = jsonb_set(coalesce(raw_app_meta_data, '{}'), '{providers}',
           (select to_jsonb(array(select distinct p from jsonb_array_elements_text(coalesce(raw_app_meta_data->'providers', '[]')) p
                                  union select 'google'))))
         where id = $1`,
        [uid],
      );
      return uid;
    }

    const uid = await insertUser(c, {
      email,
      passwordHash: "",
      appMeta: { provider: "google", providers: ["google"] },
      userMeta: () => identity,
    });
    await insertIdentity(c, uid, "google", claims.sub, identity);
    return uid;
  });

  const { rows } = await pool().query<{ banned: boolean }>(
    "select (banned_until is not null and banned_until > now()) as banned from auth.users where id = $1",
    [id],
  );
  if (rows[0]?.banned) throw new AuthError("banned");
  return userById(id);
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

/**
 * Ban or unban. Unlike GoTrue — which only refused NEW logins and let a banned
 * user's access token live out its hour — a ban ends every session now.
 */
export async function setBanned(userId: string, banned: boolean): Promise<void> {
  await pool().query(
    "update auth.users set banned_until = case when $2 then now() + interval '100 years' else null end, updated_at = now() where id = $1",
    [userId, banned],
  );
  if (banned) await revokeUserSessions(userId);
}

/** Deletes the account; identities, sessions and every lp_ row follow their FKs. */
export async function deleteUser(userId: string): Promise<void> {
  await pool().query("delete from auth.users where id = $1", [userId]);
}
