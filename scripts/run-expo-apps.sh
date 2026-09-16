#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: $0 <test|typecheck|build>" >&2
  exit 2
fi

command="$1"
case "$command" in
  test|typecheck|build) ;;
  *)
    echo "unsupported Expo app command: $command" >&2
    exit 2
    ;;
esac

for app in expo/*; do
  if [[ ! -f "$app/package.json" ]]; then
    continue
  fi

  echo "::group::$command $app"
  (
    cd "$app"
    bun run "$command"
  )
  echo "::endgroup::"
done
