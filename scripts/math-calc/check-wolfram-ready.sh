#!/bin/sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
ROOT_DIR="$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)"
CALC_WLS="${MATH_CALC_CALC_WLS:-$SCRIPT_DIR/calc.wls}"
CHECK_SCRIPT="$SCRIPT_DIR/check-wolfram-cloud-mcp.ts"

if [ ! -f "$CALC_WLS" ]; then
  echo "[wolfram-ready] ERROR: 缺少 calc.wls；拒绝启动。" >&2
  exit 1
fi

if [ ! -f "$CHECK_SCRIPT" ]; then
  echo "[wolfram-ready] ERROR: 缺少 Wolfram Cloud MCP 探测脚本；拒绝启动。" >&2
  exit 1
fi

if [ -x "$ROOT_DIR/node_modules/.bin/tsx" ]; then
  TSX="$ROOT_DIR/node_modules/.bin/tsx"
elif command -v tsx >/dev/null 2>&1; then
  TSX="$(command -v tsx)"
else
  echo "[wolfram-ready] ERROR: 缺少 tsx，无法探测 Wolfram Cloud MCP。" >&2
  exit 1
fi

cd "$ROOT_DIR"
"$TSX" "$CHECK_SCRIPT"
