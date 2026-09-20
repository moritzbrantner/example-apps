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

github_pages_template_ref="7696672835b8a33eb31607ce000e650775e0f0b8"
template_root="${RUNNER_TEMP:-${TMPDIR:-/tmp}}/github-pages-template-$github_pages_template_ref"
rm -rf "$template_root"
mkdir -p "$template_root"
curl --fail --silent --show-error --location \
  "https://codeload.github.com/moritzbrantner/github-pages-template/tar.gz/$github_pages_template_ref" \
  | tar --extract --gzip --strip-components=1 --directory "$template_root"

node "$template_root/bin/github-pages-template.mjs" build \
  --config "$repo_root/pages/pages.config.json" \
  --out "$repo_root/dist" \
  --augment

rm -rf "$template_root"
touch dist/.nojekyll
