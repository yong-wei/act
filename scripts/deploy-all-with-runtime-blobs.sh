#!/usr/bin/env bash
set -euo pipefail

# Keep runtime and application deployment as two independent operations. The
# runtime command owns its immutable release arguments; application deployment
# uses the selected view without redistributing runtime content.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

bash "$ROOT_DIR/scripts/deploy-runtime-blob-release.sh" "$@"
bash "$ROOT_DIR/scripts/remote-deploy.sh" --app-only
