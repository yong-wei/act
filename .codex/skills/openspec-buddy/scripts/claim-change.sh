#!/usr/bin/env bash
set -euo pipefail

issue_number="${1:-}"
if [[ -z "$issue_number" ]]; then
  echo "Usage: claim-change.sh <issue-number>" >&2
  exit 2
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
tmp_dir="$(mktemp -d)"
created_branch_lock=""

cleanup() {
  if [[ -n "$created_branch_lock" ]]; then
    git push origin ":refs/heads/$created_branch_lock" >/dev/null 2>&1 || true
  fi
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

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
base_branch="$(node -e 'const fs=require("fs"); const data=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(data.base_branch);' "$metadata_file")"

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

git fetch origin "$base_branch" >/dev/null
base_sha="$(git rev-parse "origin/$base_branch")"
if git ls-remote --exit-code --heads origin "$claim_branch" >/dev/null 2>&1; then
  echo "Remote claim branch already exists: $claim_branch" >&2
  exit 1
fi
git push origin "$base_sha:refs/heads/$claim_branch" >/dev/null
created_branch_lock="$claim_branch"

viewer="$(gh api user --jq .login)"
claim_id="$(uuidgen 2>/dev/null || node -e 'console.log(crypto.randomUUID())')"
lease_until="$(node -e 'const hours=Number(process.env.OPENSPEC_BUDDY_CLAIM_TTL_HOURS || 6); console.log(new Date(Date.now()+hours*3600*1000).toISOString())')"
gh issue edit "$issue_number" --add-assignee "$viewer"
"$script_dir/set-status-label.sh" "$issue_number" "status:claimed"

gh issue comment "$issue_number" --body "$(cat <<EOF
OpenSpec Buddy Claim

claim_id: $claim_id
agent: @$viewer
change_id: $change_id
branch: $claim_branch
base_branch: $base_branch
base_sha: $base_sha
lease_until: $lease_until
EOF
)"

gh issue view "$issue_number" --json labels,assignees > "$tmp_dir/claimed.json"
node -e '
const fs = require("fs");
const issue = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const viewer = process.argv[2];
const labels = issue.labels.map((label) => label.name);
const assignees = issue.assignees.map((assignee) => assignee.login);
if (!labels.includes("status:claimed") || !assignees.includes(viewer)) process.exit(1);
' "$tmp_dir/claimed.json" "$viewer"

created_branch_lock=""
printf 'Claimed issue #%s for change %s on branch %s with claim %s\n' "$issue_number" "$change_id" "$claim_branch" "$claim_id"
