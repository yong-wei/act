#!/usr/bin/env bash
set -euo pipefail

issue_number="${1:-}"
archive_path="${2:-}"
pr_url="${3:-}"
if [[ -z "$issue_number" || -z "$archive_path" ]]; then
  echo "Usage: mark-achieved.sh <issue-number> <archive-path> [pr-url]" >&2
  exit 2
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$script_dir/set-status-label.sh" "$issue_number" "status:archived"

body="OpenSpec change archived at \`$archive_path\`."
if [[ -n "$pr_url" ]]; then
  body="$body\n\nMerged PR: $pr_url"
fi

gh issue comment "$issue_number" --body "$body"
