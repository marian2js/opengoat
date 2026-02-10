#!/usr/bin/env sh
set -eu

mkdir -p "${OPENGOAT_HOME:-/data/opengoat}"

mode="${1:-ui}"
if [ "$#" -gt 0 ]; then
  shift
fi

case "$mode" in
  ui)
    exec node /app/packages/ui/dist/server/index.js "$@"
    ;;
  cli)
    exec /app/bin/opengoat "$@"
    ;;
  shell)
    exec /bin/sh "$@"
    ;;
  *)
    exec "$mode" "$@"
    ;;
esac
