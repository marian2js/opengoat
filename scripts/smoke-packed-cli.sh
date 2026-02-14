#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <core-tgz> <cli-tgz>" >&2
  exit 1
fi

CORE_TGZ="$1"
CLI_TGZ="$2"

if [[ ! -f "$CORE_TGZ" ]]; then
  echo "Core tarball not found: $CORE_TGZ" >&2
  exit 1
fi

if [[ ! -f "$CLI_TGZ" ]]; then
  echo "CLI tarball not found: $CLI_TGZ" >&2
  exit 1
fi

TMP_DIR="$(mktemp -d)"
TMP_PROJECT="$TMP_DIR/smoke-project"
TMP_HOME="$TMP_DIR/opengoat-home"
START_LOG="$TMP_DIR/start.log"

cleanup() {
  if [[ -n "${START_PID:-}" ]]; then
    if kill -0 "$START_PID" >/dev/null 2>&1; then
      kill "$START_PID" >/dev/null 2>&1 || true
      wait "$START_PID" >/dev/null 2>&1 || true
    fi
  fi
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

mkdir -p "$TMP_PROJECT"
cd "$TMP_PROJECT"
npm init -y >/dev/null

# Install from packed artifacts to reproduce what users get from npm publish.
npm install --no-fund --no-audit "$CORE_TGZ" "$CLI_TGZ" >/dev/null

BIN="./node_modules/.bin/opengoat"
if [[ ! -x "$BIN" ]]; then
  echo "Installed opengoat binary not found at $BIN" >&2
  exit 1
fi

OPENGOAT_HOME="$TMP_HOME" "$BIN" --help >/dev/null

PORT=19189
OPENGOAT_HOME="$TMP_HOME" "$BIN" start --host 127.0.0.1 --port "$PORT" >"$START_LOG" 2>&1 &
START_PID=$!

sleep 6
if ! kill -0 "$START_PID" >/dev/null 2>&1; then
  echo "Packed CLI failed to keep UI server alive during smoke test." >&2
  cat "$START_LOG" >&2
  exit 1
fi

kill "$START_PID" >/dev/null 2>&1 || true
wait "$START_PID" >/dev/null 2>&1 || true
unset START_PID

grep -q "Starting OpenGoat UI at http://127.0.0.1:${PORT}" "$START_LOG"

echo "Packed CLI smoke test passed."
