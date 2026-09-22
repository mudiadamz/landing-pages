#!/usr/bin/env bash
# Smart local redeploy for the landing_pages service on this machine.
#
# Decides the least work needed and does it:
#   REBUILD  — source / deps / config / a NEXT_PUBLIC_* env var changed
#              (NEXT_PUBLIC_* is inlined at build time) OR .next is missing
#              => `pnpm build` then restart the service.
#   RESTART  — only runtime env changed (DATABASE_URL, secrets, OPENROUTER_*, …)
#              or the service is not running => restart, no rebuild.
#   NOOP     — nothing that affects the running app changed => do nothing.
#
# Flags:
#   --check   print the decision and exit 0, change nothing (dry run)
#   --force   force a full rebuild + restart regardless of hashes
#   --seed    record the current tree/env as already-deployed and exit; use once
#             after a manual `pnpm build` so the next run can report NOOP
#
# Env overrides: SERVICE (default landing-pages), APP_DIR (default this repo).
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
SERVICE="${SERVICE:-landing-pages}"
STATE_DIR="$APP_DIR/.deploy-state"
BUILD_HASH_FILE="$STATE_DIR/build.hash"
ENV_HASH_FILE="$STATE_DIR/runtime-env.hash"
CHECK=0
FORCE=0
SEED=0
for a in "$@"; do
  case "$a" in
    --check) CHECK=1 ;;
    --force) FORCE=1 ;;
    --seed)  SEED=1 ;;
    *) echo "unknown flag: $a" >&2; exit 2 ;;
  esac
done

cd "$APP_DIR"
mkdir -p "$STATE_DIR"

# --- hashes ------------------------------------------------------------------
# Files that change the built output: tracked + untracked-but-not-ignored,
# minus docs / tests / editor config / markdown. Env files are git-ignored, so
# they never appear here; their NEXT_PUBLIC_* lines are folded in separately.
source_manifest() {
  { git ls-files; git ls-files --others --exclude-standard; } 2>/dev/null \
    | grep -vE '^(docs/|tests/|scripts/|\.githooks/|\.claude/|\.cursor/|\.github/|\.deploy-state/)' \
    | grep -vE '(\.md|\.test\.[jt]sx?|\.spec\.[jt]sx?)$' \
    | sort -u
}
nextpublic_env() {
  cat .env.local .env.production.local 2>/dev/null \
    | grep -E '^[[:space:]]*NEXT_PUBLIC_' | sort || true
}
runtime_env() {
  cat .env.local .env.production.local 2>/dev/null \
    | grep -vE '^[[:space:]]*(#|NEXT_PUBLIC_|$)' | sort || true
}
build_hash() {
  { source_manifest | tr '\n' '\0' | xargs -0 -r sha256sum; nextpublic_env; } \
    | sha256sum | awk '{print $1}'
}
runtime_env_hash() { runtime_env | sha256sum | awk '{print $1}'; }

BH="$(build_hash)"
RH="$(runtime_env_hash)"
PREV_BH="$(cat "$BUILD_HASH_FILE" 2>/dev/null || echo none)"
PREV_RH="$(cat "$ENV_HASH_FILE" 2>/dev/null || echo none)"

if [ "$SEED" = 1 ]; then
  printf '%s' "$BH" > "$BUILD_HASH_FILE"
  printf '%s' "$RH" > "$ENV_HASH_FILE"
  echo "seeded deploy state; next run reports NOOP until something changes"
  exit 0
fi

# --- decide ------------------------------------------------------------------
need_build=0
need_restart=0
reasons=()

if [ "$FORCE" = 1 ]; then need_build=1; reasons+=("forced"); fi
if [ ! -d "$APP_DIR/.next" ]; then need_build=1; reasons+=("no .next build present"); fi
if [ "$BH" != "$PREV_BH" ]; then need_build=1; reasons+=("source/deps/config or NEXT_PUBLIC_* changed"); fi
if [ "$RH" != "$PREV_RH" ]; then need_restart=1; reasons+=("runtime env changed"); fi
if ! systemctl is-active --quiet "$SERVICE"; then need_restart=1; reasons+=("service not running"); fi
[ "$need_build" = 1 ] && need_restart=1

if [ "$need_build" = 1 ]; then action=REBUILD
elif [ "$need_restart" = 1 ]; then action=RESTART
else action=NOOP; fi

printf 'decision: %s\n' "$action"
if [ "${#reasons[@]}" -gt 0 ]; then
  printf '  - %s\n' "${reasons[@]}"
fi

if [ "$CHECK" = 1 ]; then exit 0; fi

# --- act ---------------------------------------------------------------------
case "$action" in
  REBUILD)
    echo "==> pnpm build"
    pnpm build
    echo "==> restart $SERVICE"
    sudo systemctl restart "$SERVICE"
    printf '%s' "$BH" > "$BUILD_HASH_FILE"
    printf '%s' "$RH" > "$ENV_HASH_FILE"
    ;;
  RESTART)
    echo "==> restart $SERVICE (no rebuild)"
    sudo systemctl restart "$SERVICE"
    printf '%s' "$RH" > "$ENV_HASH_FILE"
    # keep build hash in sync in case this is the first run after a manual build
    printf '%s' "$BH" > "$BUILD_HASH_FILE"
    ;;
  NOOP)
    echo "==> nothing to do; $SERVICE is current and running"
    ;;
esac

# --- verify ------------------------------------------------------------------
if [ "$action" != "NOOP" ]; then
  for i in $(seq 1 20); do
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 http://localhost:3000 || true)"
    [ "$code" = "200" ] && break
    sleep 1
  done
  echo "local http://localhost:3000 -> ${code:-000}"
fi
