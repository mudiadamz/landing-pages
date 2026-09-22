---
name: landing-redeploy
description: >-
  Redeploy the running landing_pages app on this host doing the least work
  needed: rebuild + restart only when source, dependencies, config, or a
  NEXT_PUBLIC_* value changed; restart only when a runtime env var changed;
  nothing at all when nothing that affects the running app changed. Use when the
  user says "redeploy", "rebuild", "restart the app/site", "apply my changes",
  "deploy landing-page", "push the env change live", "terapkan perubahan", or
  after editing code / .env.local and wanting mbahgpt.com to reflect it.
---

# Redeploying landing_pages on this host

This app runs as a **systemd service** on port 3000, fronted by a Cloudflare
Tunnel serving `https://mbahgpt.com` (and `www`). One command decides and does
the least work needed — you rarely need to think about build vs restart:

```bash
cd /home/adam/work/landing-pages
scripts/redeploy.sh
```

## What it decides (and why)

`scripts/redeploy.sh` hashes the tree and env, compares to the last deploy
(`.deploy-state/`, git-ignored), and picks one:

| Decision | When | Action |
|---|---|---|
| **REBUILD** | source / `package.json` / lockfile / build config changed, **or** a `NEXT_PUBLIC_*` value changed, **or** `.next` is missing | `pnpm build` → `systemctl restart` |
| **RESTART** | only **runtime** env changed (`DATABASE_URL`, secrets, `OPENROUTER_*`, …), or the service is down | `systemctl restart` — **no rebuild** |
| **NOOP** | nothing that affects the running app changed | do nothing |

The `NEXT_PUBLIC_*` split is the important subtlety: those are **inlined at
build time** (see `CLAUDE.md`), so changing one needs a rebuild, while changing
`DATABASE_URL` or `OPENROUTER_API_KEY` only needs a restart. The script draws
that line for you — don't hand-decide it.

Hashing is by **content**, not mtime: touching a file or a doc-only / test-only
change (`docs/`, `tests/`, `*.md`) is correctly a NOOP.

## Flags

```bash
scripts/redeploy.sh --check   # print the decision, change nothing (dry run)
scripts/redeploy.sh --force   # force a full rebuild + restart
scripts/redeploy.sh --seed    # mark current tree/env as already-deployed
                              #   (run once after a manual `pnpm build`)
```

Overrides: `SERVICE=` (default `landing-pages`), `APP_DIR=` (default the repo).

## After it runs

It waits for `http://localhost:3000` to answer `200` and prints the code. To
confirm the public site end-to-end:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://mbahgpt.com
```

## Prerequisites / gotchas

- **Database must be up.** Postgres runs in Docker (`compose.dev.yml`, container
  `lp-dev-db-1`, `restart: unless-stopped`, so it returns on boot). If the app
  logs `password authentication failed for user app`, run `pnpm db:migrate`.
- **Restart needs sudo** (`sudo systemctl restart landing-pages`); passwordless
  sudo is configured on this host.
- **Runtime env lives in `.env.local`** (loaded in every mode). `next build`
  does **not** read `.env.development.local` — that one is only for
  `pnpm db:migrate`.
- **Migrations are not part of redeploy.** If you added a migration, run
  `pnpm db:migrate` (and `pnpm test:db`) first, then redeploy.

## Service management

```bash
sudo systemctl status landing-pages      # state
sudo journalctl -u landing-pages -f      # live logs
sudo systemctl restart landing-pages     # manual restart
```

Related: the **run-local** skill covers a fresh from-zero dev bring-up
(Docker + Postgres + migrations + `next dev`); this skill is for redeploying the
already-installed always-on service.
