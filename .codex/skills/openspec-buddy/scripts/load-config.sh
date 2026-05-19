#!/usr/bin/env bash

# Shared OpenSpec Buddy configuration. Source this file from shell helpers before
# reading any OPENSPEC_BUDDY_* value.

openspec_buddy_missing_config=()

openspec_buddy_require_var() {
  local name="$1"
  local value="${!name:-}"
  if [[ -z "$value" ]]; then
    openspec_buddy_missing_config+=("$name")
  fi
}

openspec_buddy_print_missing_and_exit() {
  if [[ "${#openspec_buddy_missing_config[@]}" -eq 0 ]]; then
    return 0
  fi

  {
    echo "Missing OpenSpec Buddy configuration:"
    for name in "${openspec_buddy_missing_config[@]}"; do
      echo "- $name"
    done
    echo
    echo "Provide these environment variables for this project, then rerun."
  } >&2
  exit 2
}

openspec_buddy_apply_optional_defaults() {
  export OPENSPEC_BUDDY_PROJECT_STATUS_FIELD="${OPENSPEC_BUDDY_PROJECT_STATUS_FIELD:-Status}"
  export OPENSPEC_BUDDY_PROJECT_STATUS_TODO="${OPENSPEC_BUDDY_PROJECT_STATUS_TODO:-Todo}"
  export OPENSPEC_BUDDY_PROJECT_STATUS_IN_PROGRESS="${OPENSPEC_BUDDY_PROJECT_STATUS_IN_PROGRESS:-In Progress}"
  export OPENSPEC_BUDDY_PROJECT_STATUS_DONE="${OPENSPEC_BUDDY_PROJECT_STATUS_DONE:-Done}"
  export OPENSPEC_BUDDY_PROJECT_START_FIELD="${OPENSPEC_BUDDY_PROJECT_START_FIELD:-Start}"
  export OPENSPEC_BUDDY_PROJECT_END_FIELD="${OPENSPEC_BUDDY_PROJECT_END_FIELD:-End}"
  export OPENSPEC_BUDDY_CLAIM_TTL_HOURS="${OPENSPEC_BUDDY_CLAIM_TTL_HOURS:-12}"
  export OPENSPEC_BUDDY_REVIEW_WAIT_SECONDS="${OPENSPEC_BUDDY_REVIEW_WAIT_SECONDS:-300}"
  export OPENSPEC_BUDDY_REVIEW_QUIET_CHECKS="${OPENSPEC_BUDDY_REVIEW_QUIET_CHECKS:-3}"
  export OPENSPEC_BUDDY_COMMAND_PREFIX="${OPENSPEC_BUDDY_COMMAND_PREFIX:-}"
}

openspec_buddy_require_core_config() {
  openspec_buddy_missing_config=()
  openspec_buddy_apply_optional_defaults
  openspec_buddy_require_var OPENSPEC_BUDDY_BASE_BRANCH
  openspec_buddy_require_var OPENSPEC_BUDDY_RELEASE_BRANCH
  openspec_buddy_require_var OPENSPEC_BUDDY_PROJECT_OWNER
  openspec_buddy_require_var OPENSPEC_BUDDY_PROJECT_NUMBER
  openspec_buddy_require_var OPENSPEC_BUDDY_PROJECT_TITLE
  openspec_buddy_print_missing_and_exit
}

openspec_buddy_require_auto_config() {
  openspec_buddy_require_core_config
  openspec_buddy_missing_config=()
  openspec_buddy_require_var OPENSPEC_BUDDY_PR_REVIEW_REQUEST
  openspec_buddy_print_missing_and_exit
}
