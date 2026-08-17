---
name: run-local
description: >-
  Bring the whole app up on this machine and actually drive it: Docker (colima),
  the local Supabase stack, pending migrations, `next dev`, a browser session,
  and the per-domain row that decides which storefront template renders. Use when
  the user says "run local", "jalankan lokal", "start the dev server", "coba di
  lokal", asks to see a change working in the real app, wants to exercise a
  feature end to end (chat, checkout, reader, panel), or hits "fetch failed" /
  "lp_sites lookup failed" / a template that renders as the wrong theme.
---

# Running landing_pages locally

Every step here was walked on this machine on 2026-08-18 and worked. Follow it in
order; the order matters more than it looks, because half the failure modes are
"something further down was started before the thing above it existed".

## 0. The three-minute version

```bash
colima start                       # Docker runtime; usually the thing that is off
npx supabase start                 # 8 containers: db, auth, rest, storage, …
npx supabase migration up --local  # the local DB is almost always behind
npm run dev                        # http://127.0.0.1:3000
```

Then open **`http://127.0.0.1:3000`** — not the `localhost:3000` the README
prints. Either works until you need to be signed in; see §3.

## 1. Docker

The stack is containers, and `colima` is what runs them here (not Docker
Desktop). The tell that it is down:

```
Cannot connect to the Docker daemon at unix:///Users/adam/.colima/default/docker.sock
```

`colima start` takes ~30 s. `colima status` says whether it is already up.

## 2. Supabase

```bash
npx supabase start          # idempotent; prints URLs and keys
npx supabase status         # what is running
```

**The local database is usually many migrations behind**, because it only moves
when someone runs it forward — a `git pull` does not touch it. Check for the
tables your work needs rather than trusting the CLI:

```bash
# What the DB actually believes it has applied:
docker exec supabase_db_landing_pages psql -U postgres -d postgres -tAc \
  "select count(*), max(version) from supabase_migrations.schema_migrations"

# Whether a table you need exists at all:
docker exec supabase_db_landing_pages psql -U postgres -d postgres -tAc \
  "select tablename from pg_tables where tablename like 'lp_chat%'"
```

> `npx supabase migration list --local` prints migration FILES in the "Local"
> column, which reads as "applied" and is not. It showed versions the database
> had never run. Trust `schema_migrations` and `pg_tables`.

Apply what is missing:

```bash
npx supabase migration up --local
```

`NOTICE … does not exist, skipping` lines are normal — they come from the
`drop policy if exists` guards migrations open with.

**Do not reach for `supabase db reset` first**, even though the README's Option A
names it. It rebuilds from zero and takes the local test user and every fixture
with it; `migration up` has been enough every time so far. Reset is for a
database whose state you no longer trust.

## 3. Use 127.0.0.1, never localhost

`supabase/config.toml` pins `site_url = "http://127.0.0.1:3000"`, so every auth
redirect lands there. Cookies are per-host: a session established on `127.0.0.1`
does not exist on `localhost`, and vice versa. Pick `127.0.0.1:3000` and stay on
it for the whole session.

## 4. Environment

`.env.development.local` overrides `.env.local` **in dev only**, and already
points at the local stack:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=…   # the demo anon key, same on every machine
SUPABASE_SERVICE_ROLE_KEY=…       # the demo service key
```

Feature keys go in the same file — it is gitignored (`.gitignore: .env*.local`).
For the chat template the key already exists in the sibling repo:

```bash
grep -m1 '^OPENROUTER_API_KEY=' ../mbahgpt/.env >> .env.development.local
```

Without it the chat page still renders and says "Chat belum aktif" — that is the
designed behaviour, not a broken setup.

**Two more lines you want locally**, or the admin panel is unreachable from this
machine:

```
NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000
```

`canonicalOrigin()` reads that variable, and admin screens are canonical-only
(invariant I9). Left pointing at production, opening `/panel/plans` on 127.0.0.1
redirects the browser to **https://admuiux.com/login** — which looks like a
broken session and is actually the multi-domain rule working. The matching half
is in the database: the local `lp_sites` row for `127.0.0.1` is the canonical one
(`is_canonical = true`, with `admuiux.com` set false), because the flag and the
env var have to name the same host.

## 5. Which storefront renders: the lp_sites row

One deployment serves several storefronts, and the **host decides the template**
(`lib/site-resolve.ts` → `lp_sites`). An unknown host falls back to the canonical
site, so `127.0.0.1` renders the *marketplace* theme unless you say otherwise.

To exercise a specific template locally, give the host its own row:

```bash
docker exec supabase_db_landing_pages psql -U postgres -d postgres -c "
insert into lp_sites (host, name, tagline, template, palette, is_canonical, active, locale)
values ('127.0.0.1', 'MbahGPT', 'Chatbox lokal', 'mbahgpt', 'jade', false, true, 'id')
on conflict (host) do update set template = excluded.template, active = true;"
```

Template keys live in `lib/templates/registry.tsx` (`default`, `pustaka`,
`linkbio`, `mbahgpt`). Switching one is an UPDATE on that row — no migration, no
restart of `next dev`.

Locale: the row's `locale` is the storefront default; a visitor's own choice
lives in the `lp_locale` cookie and wins. To see English without clicking, send
`-H 'Cookie: lp_locale=en'` with curl.

## 6. Signing in without a password

Most surfaces worth driving need a session, and **do not create accounts or type
passwords** to get one. There is already a test user in the local DB:

```bash
docker exec supabase_db_landing_pages psql -U postgres -d postgres -tAc \
  "select email from auth.users"
# → uji.2539@example.com
```

Mint a single-use token for that existing user, then let the page redeem it and
write the cookie the SSR client reads:

```bash
SR=$(grep -m1 '^SUPABASE_SERVICE_ROLE_KEY=' .env.development.local | cut -d= -f2-)
curl -s -X POST 'http://127.0.0.1:54321/auth/v1/admin/generate_link' \
  -H "apikey: $SR" -H "Authorization: Bearer $SR" -H 'Content-Type: application/json' \
  -d '{"type":"magiclink","email":"uji.2539@example.com"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['hashed_token'])"
```

Then, in the page (browser JS), with the token pasted in:

```js
const ANON = "<NEXT_PUBLIC_SUPABASE_ANON_KEY>";
const s = await fetch("http://127.0.0.1:54321/auth/v1/verify", {
  method: "POST",
  headers: { apikey: ANON, "Content-Type": "application/json" },
  body: JSON.stringify({ type: "magiclink", token_hash: "<hashed_token>" }),
}).then((r) => r.json());

const session = {
  access_token: s.access_token, token_type: s.token_type,
  expires_in: s.expires_in, expires_at: s.expires_at,
  refresh_token: s.refresh_token, user: s.user,
};
// @supabase/ssr's cookie format: "base64-" + b64(session), chunked at 3180 chars
// into name.0 / name.1 when it does not fit. The name's middle segment is the
// FIRST LABEL OF THE SUPABASE HOST — "127" for 127.0.0.1, a project ref in prod.
const bytes = new TextEncoder().encode(JSON.stringify(session));
let bin = ""; bytes.forEach((b) => { bin += String.fromCharCode(b); });
const value = "base64-" + btoa(bin);
const name = "sb-127-auth-token";
const parts = [];
for (let i = 0; i < value.length; i += 3180) parts.push(value.slice(i, i + 3180));
parts.length === 1
  ? (document.cookie = `${name}=${parts[0]}; path=/; max-age=3600; samesite=lax`)
  : parts.forEach((p, i) => { document.cookie = `${name}.${i}=${p}; path=/; max-age=3600; samesite=lax`; });
```

Reload; the sidebar and composer come alive.

**What does NOT work, and why** — worth knowing before rediscovering it:

- The `action_link` from `generate_link` redirects with tokens in the URL
  **hash** (implicit flow). `@supabase/ssr`'s browser client is PKCE-based and
  ignores that hash, so you land on the page still signed out.
- `app/auth/callback` only accepts `?code=` (PKCE). The admin API does not mint
  one.

If the user would rather sign in themselves, that is always fine — hand them the
URL and stop.

## 7. Drive it

Launching proves the entrypoint resolves. Drive the surface the change touched:

```bash
curl -s http://127.0.0.1:3000/ | grep -o 'data-template="[a-z]*"' | head -1
curl -s -X POST http://127.0.0.1:3000/api/mbahgpt/chat \
  -H 'Content-Type: application/json' -d '{"content":"halo"}'   # → 401 without a session
```

In the browser: type a message, press Return, screenshot, **look at it**. Then
confirm the write landed rather than trusting the screen:

```bash
docker exec supabase_db_landing_pages psql -U postgres -d postgres -c \
  "select role, left(content,40), coalesce(length(reasoning),0) as reasoning,
          coalesce(jsonb_array_length(sources),0) as sources
     from lp_chat_messages order by created_at"

docker exec supabase_db_landing_pages psql -U postgres -d postgres -tAc \
  "select coalesce(answering_at::text,'NULL') from lp_chat_sessions"
```

`answering_at` back to NULL is how you know the per-session answer lock released.
A row with empty content but non-zero reasoning/sources is the partial-answer
path — expected after pressing stop.

Costs real money: each chat turn calls OpenRouter on the key in
`.env.development.local`, and a web search adds a flat ~$0.007. Say so when
reporting; do not loop turns for fun.

## 8. Things that look broken and are not

| Symptom | Reality |
|---|---|
| `lp_sites lookup failed for localhost: TypeError: fetch failed` | The Supabase stack is not running (§2), or you are on `localhost` (§3). |
| The chat says "Chat belum aktif" | `OPENROUTER_API_KEY` is unset (§4). |
| The homepage renders the marketplace theme | No `lp_sites` row for this host (§5). |
| A thinking model sits silent for 60 s+ | Normal. The "Berpikir… Ns" counter exists for exactly this. |
| Tawk's `Cannot read properties of undefined (reading '$el')` in the console | Third-party widget, not ours. It is suppressed on full-screen template homepages anyway. |
| `.next/dev/types/validator.ts` errors about a deleted page | Stale generated types. `rm -rf .next/dev/types` and re-run. |
| A search query that mixes the session's opening message into the new question | `expandQuery` folds the opener into short follow-ups (`lib/mbahgpt/web-search.ts`). Gated since 2026-08-18 — it only fires when the new message shares a word, points back, or names no subject. Still fires on all-lower-case questions, which read as subject-less. |

## 9. Teardown

```bash
pkill -f "next dev"
npx supabase stop      # keeps the volume; data survives
colima stop
```

Leave the local `lp_sites` rows and the key in `.env.development.local` — both
are local-only and save the next session the setup.
