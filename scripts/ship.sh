#!/usr/bin/env bash
# The after-code routine, in one command:
#   0. refuse if the database is behind db/migrations
#   1. rebuild + restart the running service, doing the least work needed
#      (scripts/redeploy.sh: REBUILD / RESTART / NOOP)
#   2. commit — the pre-commit hook bumps package.json's version automatically,
#      so "increase the version" happens here; author is Adam, no Claude trailer
#   3. push to origin with retry/backoff on network errors
#
#   scripts/ship.sh "commit message"
#
# Order matters: the rebuild runs FIRST and `set -e` stops the whole routine if
# it fails, so a broken build is never committed or pushed. If there is nothing
# to commit it still (re)deploys and pushes any commits already ahead of origin.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

MSG="${1:-}"
if [ -z "$MSG" ]; then
  echo "usage: scripts/ship.sh \"commit message\"" >&2
  exit 2
fi

# 0. Migration gate — FIRST, before the new code starts serving.
#
# On 2026-09-23 a phase shipped whose migration had never been applied here:
# production ran new code against an old schema for seven hours. It happened to
# be harmless, which is exactly why it went unnoticed — the failure mode is a
# 500 on whichever request first touches the new column, not a broken deploy.
#
# Deliberately a REFUSAL, not an auto-apply: a migration can drop a column, and
# the one thing worse than shipping without one is a deploy script quietly
# running a destructive statement on production because a file appeared.
#
# SKIP_MIGRATE_CHECK=1 overrides it — a gate nobody can get past in an emergency
# is a gate that gets deleted instead of used.
if [ "${SKIP_MIGRATE_CHECK:-0}" = "1" ]; then
  echo "==> migration gate SKIPPED (SKIP_MIGRATE_CHECK=1)"
elif ! pnpm --silent db:check; then
  echo "!! refusing to ship: the database is behind db/migrations (see above)." >&2
  echo "   run 'pnpm db:migrate' then 'pnpm test:db', or set SKIP_MIGRATE_CHECK=1 to override." >&2
  exit 1
fi

# 1. Rebuild + restart as needed (fails loud, before any commit).
scripts/redeploy.sh

# 1b. Health gate: never commit/push a build that isn't actually serving. This
# catches the case where redeploy was a NOOP (e.g. state seeded) but the running
# build is broken or missing — a non-async 'use server' export, say, that tsc
# passes but the production build rejects.
health=""
for _ in 1 2 3 4 5 6 7 8 9 10; do
  health="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 http://localhost:3000/ || true)"
  [ "$health" = "200" ] && break
  sleep 1
done
if [ "$health" != "200" ]; then
  echo "!! app is not serving 200 on localhost:3000 (got '${health:-none}') — refusing to commit a broken build" >&2
  exit 1
fi

# 2. Commit. The .githooks/pre-commit hook bumps the version and stages it.
git add -A
if git diff --cached --quiet; then
  echo "==> nothing new to commit"
else
  git -c user.email=mudi.adamz@gmail.com -c user.name=mudiadamz commit -m "$MSG"
  echo "==> committed as $(node -p "require('./package.json').version")"
fi

# 3. Push with exponential backoff (2s, 4s, 8s, 16s) on transient failures.
branch="$(git rev-parse --abbrev-ref HEAD)"
for delay in 0 2 4 8 16; do
  [ "$delay" -ne 0 ] && { echo "==> push retry in ${delay}s"; sleep "$delay"; }
  if git push -u origin "$branch"; then
    echo "==> pushed $branch to origin"
    exit 0
  fi
done
echo "!! push failed after retries — check credentials (gh auth / PAT / SSH key)" >&2
exit 1
