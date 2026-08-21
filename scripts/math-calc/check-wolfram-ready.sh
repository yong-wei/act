#!/bin/sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
CALC_WLS="${MATH_CALC_CALC_WLS:-$SCRIPT_DIR/calc.wls}"
SMOKE_OUTPUT="${MATH_CALC_SMOKE_OUTPUT:-/tmp/wolfram-calc-smoke.json}"
SMOKE_PAYLOAD='{"expression":"1","operation":"laplace","variable":"t"}'

if [ -n "${MATH_CALC_WOLFRAMSCRIPT:-}" ]; then
  WOLFRAMSCRIPT="$MATH_CALC_WOLFRAMSCRIPT"
elif command -v wolframscript >/dev/null 2>&1; then
  WOLFRAMSCRIPT="$(command -v wolframscript)"
else
  for candidate in \
    /opt/wolframscript-bin/wolframscript \
    /usr/local/Wolfram/WolframScript/*/Executables/wolframscript \
    /usr/local/Wolfram/WolframEngine/*/Executables/wolframscript \
    /usr/local/Wolfram/*/Executables/wolframscript; do
    if [ -x "$candidate" ]; then
      WOLFRAMSCRIPT="$candidate"
      break
    fi
  done
fi

if [ -z "${WOLFRAMSCRIPT:-}" ] || [ ! -x "$WOLFRAMSCRIPT" ]; then
  echo "[wolfram-ready] ERROR: wolframscript 不存在；生产部署必须提供 Wolfram Engine 运行时。" >&2
  exit 1
fi

run_smoke() {
  "$WOLFRAMSCRIPT" -file "$CALC_WLS" "$SMOKE_PAYLOAD" >"$SMOKE_OUTPUT" 2>/dev/null
}

if run_smoke && grep -q '"status"[[:space:]]*:[[:space:]]*"ok"' "$SMOKE_OUTPUT"; then
  echo "[wolfram-ready] Wolfram 公式计算运行时可用。"
  exit 0
fi

activated=0
if [ -n "${WOLFRAMSCRIPT_ENTITLEMENTID:-}" ]; then
  export WOLFRAMSCRIPT_ENTITLEMENTID
  "$WOLFRAMSCRIPT" -entitlement "$WOLFRAMSCRIPT_ENTITLEMENTID" >/dev/null 2>&1 || true
  activated=1
fi
if [ -n "${WOLFRAM_ACTIVATION_EMAIL:-}" ] && [ -n "${WOLFRAM_ACTIVATION_PASSWORD:-}" ]; then
  printf '%s\n%s\n' "$WOLFRAM_ACTIVATION_EMAIL" "$WOLFRAM_ACTIVATION_PASSWORD" \
    | "$WOLFRAMSCRIPT" -activate >/dev/null 2>&1
  activated=1
elif [ -n "${WOLFRAM_ACTIVATION_CREDENTIALS_FILE:-}" ] && [ -r "$WOLFRAM_ACTIVATION_CREDENTIALS_FILE" ]; then
  email="$(sed -n '1p' "$WOLFRAM_ACTIVATION_CREDENTIALS_FILE")"
  password="$(sed -n '2p' "$WOLFRAM_ACTIVATION_CREDENTIALS_FILE")"
  printf '%s\n%s\n' "$email" "$password" \
    | "$WOLFRAMSCRIPT" -activate >/dev/null 2>&1
  activated=1
fi

if [ "$activated" = "1" ] && run_smoke && grep -q '"status"[[:space:]]*:[[:space:]]*"ok"' "$SMOKE_OUTPUT"; then
  echo "[wolfram-ready] Wolfram 公式计算运行时可用（已通过运行环境 secret 激活）。"
  exit 0
fi

echo "[wolfram-ready] ERROR: wolframscript 未激活或无法执行 calc.wls；拒绝启动。请提供运行环境激活 secret 或预激活 licensing 目录。" >&2
exit 1
