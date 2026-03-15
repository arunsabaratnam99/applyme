#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/deploy.sh <target>

Targets:
  api:local       Run API locally (wrangler dev with wrangler.local.toml)
  api:remote      Run API remote dev (wrangler dev --remote with wrangler.toml)
  api:prod        Deploy API to Cloudflare (wrangler deploy)
  web:preview     Deploy Web to Vercel preview (vercel)
  web:prod        Deploy Web to Vercel production (vercel --prod)
  all:prod        Deploy API + Web to production

Notes:
  - Requires pnpm
  - API targets require wrangler auth (wrangler login)
  - Web targets require Vercel auth (vercel login)
EOF
}

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

TARGET="${1:-}"
if [[ -z "$TARGET" ]]; then
  usage
  exit 1
fi

need_cmd pnpm

run_api_local() {
  ( cd "$ROOT_DIR" && pnpm --filter @applyme/api dev )
}

run_api_remote() {
  ( cd "$ROOT_DIR" && pnpm --filter @applyme/api dev:remote )
}

deploy_api_prod() {
  need_cmd wrangler
  ( cd "$ROOT_DIR" && pnpm --filter @applyme/api deploy )
}

deploy_web_preview() {
  need_cmd vercel
  ( cd "$ROOT_DIR/apps/web" && pnpm build )
  ( cd "$ROOT_DIR/apps/web" && vercel )
}

deploy_web_prod() {
  need_cmd vercel
  ( cd "$ROOT_DIR/apps/web" && pnpm build )
  ( cd "$ROOT_DIR/apps/web" && vercel --prod )
}

case "$TARGET" in
  api:local)
    run_api_local
    ;;
  api:remote)
    run_api_remote
    ;;
  api:prod)
    deploy_api_prod
    ;;
  web:preview)
    deploy_web_preview
    ;;
  web:prod)
    deploy_web_prod
    ;;
  all:prod)
    deploy_api_prod
    deploy_web_prod
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    echo "Unknown target: $TARGET" >&2
    usage
    exit 1
    ;;
esac
