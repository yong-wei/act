#!/usr/bin/env bash
set -euo pipefail

ACTIVATE_SCRIPT="${ACT_RUNTIME_ACTIVATE_SCRIPT:-/home/projects/act/scripts/activate-runtime-release.sh}"
[[ -x "$ACTIVATE_SCRIPT" ]] || { echo "ERROR: activation script is unavailable: $ACTIVATE_SCRIPT" >&2; exit 1; }

release_id=""
expected_active_release=""
verification_receipt=""
ram_role=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --release-id) release_id="$2"; shift 2 ;;
    --expected-active-release) expected_active_release="$2"; shift 2 ;;
    --verification-receipt) verification_receipt="$2"; shift 2 ;;
    --ram-role) ram_role="$2"; shift 2 ;;
    *) echo "ERROR: unknown argument: $1" >&2; exit 1 ;;
  esac
done

exec "$ACTIVATE_SCRIPT" \
  --release-id "$release_id" \
  --expected-active-release "$expected_active_release" \
  --verification-receipt "$verification_receipt" \
  --ram-role "$ram_role"
