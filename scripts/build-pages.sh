#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$BASH_SOURCE")/.." && pwd)"
cd "$repo_root"

rm -rf dist
mkdir -p dist/assets dist/apps
cp pages/index.html dist/index.html
cp pages/styles.css dist/styles.css
bun build pages/src/main.ts --outfile dist/assets/main.js --target browser --minify

for app in expo/*; do
  if [[ ! -f "$app/package.json" ]]; then
    continue
  fi

  slug="$(basename "$app")"
  echo "::group::export $slug"
  rm -rf "$app/dist"
  (
    cd "$app"
    EXPO_PUBLIC_GITHUB_PAGES_BASE_URL="/example-apps/apps/$slug" bun run build
  )
  mkdir -p "dist/apps/$slug"
  cp -R "$app/dist/." "dist/apps/$slug/"
  echo "::endgroup::"
done

bunx @moritzbrantner/github-pages-template@0.1.0 build \
  --config ./pages/pages.config.json \
  --out ./dist \
  --augment

touch dist/.nojekyll
