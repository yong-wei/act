#!/usr/bin/env bash
set -euo pipefail

pr_ref="${1:-}"
target_base="integration"

if [[ -z "$pr_ref" ]]; then
  echo "Usage: ensure-pr-base.sh <pr-number-or-url>" >&2
  exit 2
fi

base_ref="$(gh pr view "$pr_ref" --json baseRefName --jq '.baseRefName')"

if [[ "$base_ref" == "$target_base" ]]; then
  printf 'PR %s already targets %s.\n' "$pr_ref" "$target_base"
  exit 0
fi

if [[ "$base_ref" == "main" ]]; then
  gh pr edit "$pr_ref" --base "$target_base"
  base_ref="$(gh pr view "$pr_ref" --json baseRefName --jq '.baseRefName')"
  if [[ "$base_ref" == "$target_base" ]]; then
    printf 'PR %s base changed from main to %s.\n' "$pr_ref" "$target_base"
    exit 0
  fi
fi

echo "PR $pr_ref targets $base_ref; expected $target_base. Stop before review or merge." >&2
exit 1
