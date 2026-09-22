#!/usr/bin/env bash
# The after-code routine, in one command:
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

# 1. Rebuild + restart as needed (fails loud, before any commit).
scripts/redeploy.sh

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
