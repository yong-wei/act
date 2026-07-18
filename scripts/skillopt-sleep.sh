#!/usr/bin/env bash
set -euo pipefail

SCRIPT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_ROOT="${SKILLOPT_SLEEP_PROJECT_ROOT:-$SCRIPT_ROOT}"
RUNTIME_ROOT="${SKILLOPT_SLEEP_RUNTIME_ROOT:-$SCRIPT_ROOT/.skillopt-sleep}"
PYTHON="$RUNTIME_ROOT/venv/bin/python"
CONFIG="${SKILLOPT_SLEEP_CONFIG_PATH:-$SCRIPT_ROOT/tools/skillopt-sleep/config.json}"
TARGET_SKILL_PATH="${SKILLOPT_SLEEP_TARGET_SKILL_PATH:-.agents/skills/openspec-buddy-auto/SKILL.md}"

if [ ! -x "$PYTHON" ]; then
  echo "[skillopt-sleep] runtime is not installed; run: rtk bash scripts/skillopt-sleep-install.sh" >&2
  exit 2
fi

ACTION="${1:-status}"
if [ "$#" -gt 0 ]; then
  shift
fi

ORIGINAL_HOME="${HOME:-$(cd ~ && pwd)}"
CODEX_HOME_PATH="${CODEX_HOME:-$ORIGINAL_HOME/.codex}"
LOCAL_HOME="$RUNTIME_ROOT/home"
CODEX_BIN="${SKILLOPT_SLEEP_CODEX_PATH:-}"
if [ -z "$CODEX_BIN" ]; then
  CODEX_BIN="$(command -v codex || true)"
fi

mkdir -p "$LOCAL_HOME/.skillopt-sleep"
cp "$CONFIG" "$LOCAL_HOME/.skillopt-sleep/config.json"
export CODEX_HOME="$CODEX_HOME_PATH"
if [ -n "$CODEX_BIN" ]; then
  export SKILLOPT_SLEEP_CODEX_PATH="$CODEX_BIN"
fi
export HOME="$LOCAL_HOME"

exec "$PYTHON" -m skillopt_sleep "$ACTION" \
  --project "$PROJECT_ROOT" \
  --source codex \
  --codex-home "$CODEX_HOME_PATH" \
  --claude-home "$LOCAL_HOME/.claude" \
  --target-skill-path "$TARGET_SKILL_PATH" \
  "$@"
