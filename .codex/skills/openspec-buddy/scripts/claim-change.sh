#!/usr/bin/env bash
set -euo pipefail

issue_number="${1:-}"
if [[ -z "$issue_number" ]]; then
  echo "Usage: claim-change.sh <issue-number>" >&2
  exit 2
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

issue_file="$tmp_dir/issue.json"
body_file="$tmp_dir/body.md"
metadata_file="$tmp_dir/metadata.json"
issues_file="$tmp_dir/issues.json"

gh issue view "$issue_number" --json number,title,labels,assignees,body,url > "$issue_file"
node -e 'const fs=require("fs"); const issue=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(issue.body || "");' "$issue_file" > "$body_file"
node "$script_dir/parse-issue-metadata.mjs" "$body_file" > "$metadata_file"

change_id="$(node -e 'const fs=require("fs"); const data=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(data.change_id);' "$metadata_file")"
claim_branch="$(node -e 'const fs=require("fs"); const data=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(data.claim_branch);' "$metadata_file")"
coupling_group="$(node -e 'const fs=require("fs"); const data=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(data.coupling_group);' "$metadata_file")"

if [[ "$change_id" != "$claim_branch" ]]; then
  echo "claim_branch must equal change_id." >&2
  exit 1
fi

if ! node -e 'const fs=require("fs"); const issue=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); const labels=issue.labels.map((l)=>l.name); process.exit(labels.includes("status:ready") ? 0 : 1);' "$issue_file"; then
  echo "Issue #$issue_number is not status:ready." >&2
  exit 1
fi

gh issue list --state open --limit 200 --json number,title,labels,body > "$issues_file"
node "$script_dir/find-coupling-conflicts.mjs" "$issues_file" "$issue_number" "$coupling_group" > /dev/null

viewer="$(gh api user --jq .login)"
gh issue edit "$issue_number" --add-assignee "$viewer"
"$script_dir/set-status-label.sh" "$issue_number" "status:claimed"

gh issue comment "$issue_number" --body "Claimed by @$viewer for change \`$change_id\` on branch \`$claim_branch\`."

gh issue view "$issue_number" --json labels,assignees > "$tmp_dir/claimed.json"
node -e '
const fs = require("fs");
const issue = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const viewer = process.argv[2];
const labels = issue.labels.map((label) => label.name);
const assignees = issue.assignees.map((assignee) => assignee.login);
if (!labels.includes("status:claimed") || !assignees.includes(viewer)) process.exit(1);
' "$tmp_dir/claimed.json" "$viewer"

printf 'Claimed issue #%s for change %s on branch %s\n' "$issue_number" "$change_id" "$claim_branch"
