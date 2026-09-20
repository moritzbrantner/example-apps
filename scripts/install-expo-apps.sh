#!/usr/bin/env bash
set -euo pipefail

for app in expo/*; do
  if [[ ! -f "$app/package.json" ]]; then
    continue
  fi
  test -f "$app/bun.lock"
  echo "::group::install $app"
  (cd "$app" && bun install --frozen-lockfile)
  echo "::endgroup::"
done
