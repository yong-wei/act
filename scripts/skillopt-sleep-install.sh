#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_ROOT="${SKILLOPT_SLEEP_RUNTIME_ROOT:-$PROJECT_ROOT/.skillopt-sleep}"
BOOTSTRAP_PYTHON="${SKILLOPT_SLEEP_PYTHON:-python3}"
VENV="$RUNTIME_ROOT/venv"
REQUIREMENTS="$PROJECT_ROOT/tools/skillopt-sleep/requirements.txt"
CONFIG="$PROJECT_ROOT/tools/skillopt-sleep/config.json"

if ! command -v "$BOOTSTRAP_PYTHON" >/dev/null 2>&1; then
  echo "[skillopt-sleep] Python executable not found: $BOOTSTRAP_PYTHON" >&2
  exit 1
fi

mkdir -p "$RUNTIME_ROOT"
if [ ! -x "$VENV/bin/python" ]; then
  "$BOOTSTRAP_PYTHON" -m venv "$VENV"
fi

"$VENV/bin/python" -m pip install --requirement "$REQUIREMENTS"

mkdir -p "$RUNTIME_ROOT/home/.skillopt-sleep"
cp "$CONFIG" "$RUNTIME_ROOT/home/.skillopt-sleep/config.json"

"$VENV/bin/python" - <<'PY'
import skillopt_sleep

assert skillopt_sleep.__version__ == "0.2.0", skillopt_sleep.__version__
print(f"SkillOpt-Sleep ready: {skillopt_sleep.__version__}")
PY

echo "[skillopt-sleep] runtime: $RUNTIME_ROOT"
echo "[skillopt-sleep] config: $RUNTIME_ROOT/home/.skillopt-sleep/config.json"
