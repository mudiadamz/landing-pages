---
name: run-local
description: >-
  Bring the whole app up on this machine and actually drive it: Docker (colima),
  the one Postgres container, pending migrations, `next dev`, a curl-ready
  session, and the per-domain row that decides which storefront template
  renders. Use when the user says "run local", "jalankan lokal", "start the dev
  server", "coba di lokal", asks to see a change working in the real app, wants
  to exercise a feature end to end (chat, checkout, reader, panel), or hits
  "password authentication failed for user app" / "lp_sites lookup failed" / a
  template that renders as the wrong theme.
---

# Running landing_pages locally

Walked on this machine on 2026-09-22 against the plain-Postgres stack (no
Supabase anywhere since docs/plans/remove-supabase.md). Follow it in order; half
the failure modes are "something further down was started before the thing
above it existed".

## 0. The two-minute version

```bash
colima start                   # Docker runtime; usually the thing that is off
pnpm db:up                     # one container: postgres:17 on 127.0.0.1:54329
pnpm db:migrate --seed         # db/migrations + app role login + db/seed.sql
pnpm dev                       # http://127.0.0.1:3000
```

Then open **`http://127.0.0.1:3000`** — not `localhost:3000`; see §3.

## 1. Docker

`colima` runs the container here (not Docker Desktop). The tell that it is down:

```
Cannot connect to the Docker daemon at unix:///Users/adam/.colima/default/docker.sock
```

`colima start` takes ~30 s; `colima status` says whether it is already up.

**Bind mounts only work under `/Users`** on colima. Nothing in `compose.dev.yml`
bind-mounts, but if you run `docker-compose.yml` from a copy under `/tmp` or
`/private/tmp` (a rehearsal), any `./path:/container/path` mount arrives empty.

## 2. Postgres

`compose.dev.yml` (project `lp-dev`, container `lp-dev-db-1`, database `lp`,
superuser `postgres`/`postgres`). psql lives in the container, not on the host:

```bash
docker compose -f compose.dev.yml exec db psql -U postgres -d lp
```

`pnpm db:migrate` (`scripts/migrate.mjs`, reads `.env.development.local`):

- applies what is missing from `db/migrations/`, one transaction per file,
  recorded in `migrations.applied`; `--status` lists without applying;
- then gives the `app` role LOGIN + `APP_DB_PASSWORD` (`app` locally) — every
  run, so "password authentication failed for user app" is always fixed by
  running it again;
- **refuses** a recorded migration whose file changed (checksum). Never edit an
  applied migration; add a new one. Locally, the way out is a fresh database:
  `… psql -U postgres -c "drop database lp with (force)" -c "create database lp"`
  then `pnpm db:migrate --seed` (that wipes the local data — it is local).

A `git pull` does not move the database; after pulling a new migration, run
`pnpm db:migrate`. `pnpm test:db` is independent of all this: it drops and
rebuilds its own `lp_test` database on the same server every run.

## 3. Use 127.0.0.1, never localhost

`NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000` is the canonical origin locally,
and admin screens are canonical-only (invariant I9). Cookies are per host: a
session on `127.0.0.1` does not exist on `localhost`. Pick `127.0.0.1:3000` and
stay on it.

## 4. Environment

`.env.development.local` (gitignored) overrides `.env.local` in dev only. It
should hold:

```
NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000
DATABASE_URL=postgresql://app:app@127.0.0.1:54329/lp            # the app, as role app
MIGRATE_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54329/lp
APP_DB_PASSWORD=app
STORAGE_SIGNING_SECRET=<random, ≥32 chars>
STORAGE_ROOT=.storage                                            # uploads, gitignored
```

Feature keys go in the same file. For the chat template the key already exists
in the sibling repo:

```bash
grep -m1 '^OPENROUTER_API_KEY=' ../mbahgpt/.env >> .env.development.local
```

Without it the chat page still renders and says "Chat belum aktif" — designed,
not broken. Google sign-in needs `GOOGLE_CLIENT_ID/SECRET`; without them the
button answers "belum dikonfigurasi". Email+password works with nothing extra.

## 5. Which storefront renders: the lp_sites row

The **host decides the template** (`lib/site-resolve.ts` → `lp_sites`). A fresh
database has no rows; give `127.0.0.1` the canonical one (the flag and
`NEXT_PUBLIC_SITE_URL` must name the same host, or `/panel` redirects to
production):

```bash
docker compose -f compose.dev.yml exec -T db psql -U postgres -d lp -c "
insert into lp_sites (host, name, template, is_canonical, active, locale)
values ('127.0.0.1', 'Lokal', 'default', true, true, 'id')
on conflict (host) do update set is_canonical = true, active = true;"
```

To exercise another template, `update lp_sites set template = 'mbahgpt' where
host = '127.0.0.1'` — keys in `lib/templates/registry.tsx` (`default`,
`pustaka`, `linkbio`, `mbahgpt`). No migration, no restart.

Locale: the row's `locale` is the default; a visitor's `lp_locale` cookie wins.
To see English with curl: `-H 'Cookie: lp_locale=en'`.

## 6. A session for curl (no browser)

**This repo is not verified through a browser** (docs/architecture.md §6), so
the session is built for curl. A session is just a row in `app_auth.sessions`
holding the sha256 of a random token; the cookie carries the token. So make a
local user (no password — nothing to type) and a session for it, in SQL:

```bash
TOK=$(openssl rand -base64 32 | tr '+/' '-_' | tr -d '=')
docker compose -f compose.dev.yml exec -T db psql -U postgres -d lp -v ON_ERROR_STOP=1 -v tok="$TOK" <<'SQL'
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change)
values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'uji@local.test', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Uji Lokal"}',
  now(), now(), '', '', '', '')
on conflict do nothing;
update lp_profiles set account_type = 'company' where email = 'uji@local.test';
insert into app_auth.sessions (token_hash, user_id, expires_at)
select sha256(convert_to(:'tok', 'UTF8')), id, now() + interval '30 days'
  from auth.users where email = 'uji@local.test';
SQL

curl -s -H "Cookie: lp_session=$TOK" http://127.0.0.1:3000/api/auth/user
# → {"user":{"id":"…","email":"uji@local.test"}}
```

The trigger `lp_handle_new_user` makes the profile; the `update` makes it a
Company so the whole panel opens (use `agent` / `customer` to test those). Over
HTTP the cookie is `lp_session`; behind HTTPS it would be `__Host-lp_session`.

To go through the real login form instead (e.g. to test the login action
itself), the form posts to a Server Action whose id is in the HTML:

```bash
ID=$(curl -s http://127.0.0.1:3000/login | python3 -c "
import re,sys; s=sys.stdin.read()
f=[x for x in re.findall(r'<form.*?</form>', s, re.S) if 'name=\"password\"' in x][0]
print(re.search(r'ACTION_ID_(\w+)', f).group(1))")
curl -s -D - -o /dev/null -X POST -H 'Origin: http://127.0.0.1:3000' \
  -F "\$ACTION_ID_$ID=" -F email=… -F password=… http://127.0.0.1:3000/login | grep -iE '^location|set-cookie'
```

The signup form also needs its `ts` hidden field and at least 2.5 s between
fetching and posting (lib/signup-guard.ts), or it lands on "check_email"
silently. Actions called from client components (e.g. `signOut`) have no id in
the HTML; take it from `.next/dev/…/server-reference-manifest.json` (the one
under `.next/dev`, not a stale `.next/server` from a production build).

## 7. Prove it — from the server, not from a screen

```bash
curl -s http://127.0.0.1:3000/ | grep -o 'data-template="[a-z]*"' | head -1
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' http://127.0.0.1:3000/panel   # 307 → /login
curl -s -o /dev/null -w '%{http_code}\n' -H "Cookie: lp_session=$TOK" http://127.0.0.1:3000/panel  # 200
curl -s -X POST http://127.0.0.1:3000/api/mbahgpt/chat \
  -H 'Content-Type: application/json' -d '{"content":"halo"}'   # → 401 without a session
```

Then confirm the write landed — the half a screenshot could never show:

```bash
docker compose -f compose.dev.yml exec -T db psql -U postgres -d lp -c \
  "select role, left(content,40), coalesce(length(reasoning),0) as reasoning,
          coalesce(jsonb_array_length(sources),0) as sources
     from lp_chat_messages order by created_at"
```

Uploads land on disk under `.storage/<bucket>/<path>`; public ones are served at
`/storage/v1/object/public/<bucket>/<path>`.

Costs real money: each chat turn calls OpenRouter on the key in
`.env.development.local`, and a web search adds ~$0.007. Say so when reporting.

## 8. Things that look broken and are not

| Symptom | Reality |
|---|---|
| `password authentication failed for user "app"` | The `app` role has no login/password yet on this server — run `pnpm db:migrate` (§2). |
| `lp_sites lookup failed … ECONNREFUSED 127.0.0.1:54329` | The Postgres container is down (`pnpm db:up`) or colima is (§1). |
| `/panel` redirects to https://admuiux.com/login | No canonical `lp_sites` row for 127.0.0.1, or `NEXT_PUBLIC_SITE_URL` points elsewhere (§3, §5). |
| `… sudah diterapkan tapi isinya berubah` from db:migrate | An applied migration file was edited. Revert it and add a new one (§2). |
| The chat says "Chat belum aktif" | `OPENROUTER_API_KEY` is unset (§4). |
| The homepage renders the marketplace theme | The `lp_sites` row for this host says `default` (§5). |
| A thinking model sits silent for 60 s+ | Normal. The "Berpikir… Ns" counter exists for exactly this. |
| Tawk's `Cannot read properties of undefined (reading '$el')` | Third-party widget, not ours. |
| `.next/dev/types/validator.ts` errors about a deleted page | Stale generated types. `rm -rf .next/dev/types` and re-run. |
| `Failed to find Server Action "…"` from curl | The id came from a stale build manifest; use the one under `.next/dev` (§6). |

## 9. Teardown

```bash
pkill -f "next dev"
docker compose -f compose.dev.yml stop     # keeps the volume; data survives
colima stop
```

`docker compose -f compose.dev.yml down -v` deletes the local database — only
when you mean it. Leave the local `lp_sites` row and `.env.development.local`
keys; they save the next session the setup.
