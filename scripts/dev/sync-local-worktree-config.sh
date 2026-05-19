#!/usr/bin/env bash
set -euo pipefail

DEFAULT_SOURCE="/Users/YW/Documents/Site/act.just.edu.cn"
SOURCE="$DEFAULT_SOURCE"
TARGET=""
APPLY=0
NO_OVERWRITE=0
INCLUDE_CODEX_PLANS=0
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_ROOT=""

usage() {
  cat <<'USAGE'
Sync ignored local project configuration from the main checkout to a worktree.

Defaults:
  source: /Users/YW/Documents/Site/act.just.edu.cn
  target: current git repository root
  mode:   dry-run

Usage:
  scripts/dev/sync-local-worktree-config.sh [options]

Options:
  --source PATH              Source checkout path.
  --target PATH              Target worktree path.
  --apply                    Copy files. Without this flag, only print actions.
  --no-overwrite             Skip existing target files instead of overwriting.
  --include-codex-plans      Also sync .codex/plans.
  -h, --help                 Show this help.

Copied by default:
  .env
  .env.openspec-buddy
  .envrc
  AGENTS.md
  GEMINI.md
  .claude/settings.local.json
  .claude/commands/
  .claude/skills/
  .serena/project.yml
  .serena/memories/

Linked by default:
  node_modules -> <source>/node_modules

Never copied by this script:
  .next, node_modules, .cache, .tmp, .logs, .code-review-graph, Rust target,
  .serena/cache, .DS_Store, __pycache__, *.pyc.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source)
      SOURCE="${2:-}"
      shift 2
      ;;
    --target)
      TARGET="${2:-}"
      shift 2
      ;;
    --apply)
      APPLY=1
      shift
      ;;
    --no-overwrite)
      NO_OVERWRITE=1
      shift
      ;;
    --include-codex-plans)
      INCLUDE_CODEX_PLANS=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ -z "$TARGET" ]]; then
  if TARGET="$(git rev-parse --show-toplevel 2>/dev/null)"; then
    :
  else
    TARGET="$(pwd)"
  fi
fi

SOURCE="$(cd "$SOURCE" && pwd)"
TARGET="$(cd "$TARGET" && pwd)"
BACKUP_ROOT="$TARGET/.tmp/local-config-backups/$TIMESTAMP"

if [[ "$SOURCE" == "$TARGET" ]]; then
  echo "Source and target are the same path: $SOURCE" >&2
  exit 2
fi

if [[ ! -d "$SOURCE/.git" && ! -f "$SOURCE/.git" ]]; then
  echo "Source is not a git checkout: $SOURCE" >&2
  exit 2
fi

if [[ ! -d "$TARGET/.git" && ! -f "$TARGET/.git" ]]; then
  echo "Target is not a git checkout: $TARGET" >&2
  exit 2
fi

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Required command not found: $1" >&2
    exit 127
  fi
}

require_command rsync
require_command git

FILES=(
  ".env"
  ".env.openspec-buddy"
  ".envrc"
  "AGENTS.md"
  "GEMINI.md"
  ".claude/settings.local.json"
  ".serena/project.yml"
)

DIRS=(
  ".claude/commands"
  ".claude/skills"
  ".serena/memories"
)

DEPENDENCY_LINKS=(
  "node_modules"
)

if [[ "$INCLUDE_CODEX_PLANS" -eq 1 ]]; then
  DIRS+=(".codex/plans")
fi

print_mode() {
  if [[ "$APPLY" -eq 1 ]]; then
    echo "Mode: apply"
  else
    echo "Mode: dry-run"
  fi
}

ensure_parent_dir() {
  local dest="$1"
  mkdir -p "$(dirname "$dest")"
}

copy_file() {
  local rel="$1"
  local src="$SOURCE/$rel"
  local dest="$TARGET/$rel"

  if [[ ! -f "$src" ]]; then
    echo "skip missing file: $rel"
    return
  fi

  if [[ "$APPLY" -ne 1 ]]; then
    if [[ -e "$dest" ]]; then
      echo "would copy file with backup: $rel"
    else
      echo "would copy file: $rel"
    fi
    return
  fi

  ensure_parent_dir "$dest"
  if [[ -e "$dest" ]]; then
    if [[ "$NO_OVERWRITE" -eq 1 ]]; then
      echo "skip existing file: $rel"
      return
    fi
    mkdir -p "$(dirname "$BACKUP_ROOT/$rel")"
    cp -p "$dest" "$BACKUP_ROOT/$rel"
    echo "backup existing file: .tmp/local-config-backups/$TIMESTAMP/$rel"
  fi

  cp -p "$src" "$dest"
  echo "copied file: $rel"
}

copy_dir() {
  local rel="$1"
  local src="$SOURCE/$rel"
  local dest="$TARGET/$rel"
  local rsync_args=(
    -a
    --exclude ".DS_Store"
    --exclude "__pycache__/"
    --exclude "*.pyc"
    --exclude "cache/"
  )

  if [[ ! -d "$src" ]]; then
    echo "skip missing dir: $rel"
    return
  fi

  if [[ "$NO_OVERWRITE" -eq 1 ]]; then
    rsync_args+=(--ignore-existing)
  else
    rsync_args+=(--backup "--suffix=.bak.$TIMESTAMP")
  fi

  if [[ "$APPLY" -ne 1 ]]; then
    echo "would sync dir: $rel/"
    rsync_args+=(--dry-run --itemize-changes)
  else
    ensure_parent_dir "$dest"
    mkdir -p "$dest"
  fi

  rsync "${rsync_args[@]}" "$src/" "$dest/"

  if [[ "$APPLY" -eq 1 ]]; then
    echo "synced dir: $rel/"
  fi
}

ensure_local_exclude() {
  local rel="$1"
  local exclude_file
  exclude_file="$(git -C "$TARGET" rev-parse --git-path info/exclude)"

  if grep -Fxq "$rel" "$exclude_file" 2>/dev/null; then
    return
  fi

  if [[ "$APPLY" -ne 1 ]]; then
    echo "would add local exclude: $rel"
    return
  fi

  mkdir -p "$(dirname "$exclude_file")"
  printf '%s\n' "$rel" >> "$exclude_file"
  echo "added local exclude: $rel"
}

link_dependency_dir() {
  local rel="$1"
  local src="$SOURCE/$rel"
  local dest="$TARGET/$rel"
  local current_target=""

  if [[ ! -d "$src" ]]; then
    echo "skip missing dependency dir: $rel"
    return
  fi

  if [[ -L "$dest" ]]; then
    current_target="$(readlink "$dest")"
    if [[ "$current_target" == "$src" ]]; then
      echo "dependency link already exists: $rel -> $src"
      ensure_local_exclude "$rel"
      return
    fi
  elif [[ -e "$dest" ]]; then
    echo "skip existing dependency path: $rel"
    ensure_local_exclude "$rel"
    return
  fi

  if [[ "$APPLY" -ne 1 ]]; then
    if [[ -L "$dest" ]]; then
      echo "would relink dependency dir: $rel -> $src"
    else
      echo "would link dependency dir: $rel -> $src"
    fi
    ensure_local_exclude "$rel"
    return
  fi

  if [[ -L "$dest" ]]; then
    rm "$dest"
  fi

  ln -s "$src" "$dest"
  echo "linked dependency dir: $rel -> $src"
  ensure_local_exclude "$rel"
}

warn_if_not_ignored_or_tracked() {
  local rel="$1"
  if git -C "$TARGET" ls-files --error-unmatch "$rel" >/dev/null 2>&1; then
    return
  fi
  if git -C "$TARGET" check-ignore -q "$rel" >/dev/null 2>&1; then
    return
  fi
  echo "warning: $rel is neither tracked nor ignored in target"
}

echo "Source: $SOURCE"
echo "Target: $TARGET"
print_mode

echo
echo "Files:"
for rel in "${FILES[@]}"; do
  copy_file "$rel"
done

echo
echo "Directories:"
for rel in "${DIRS[@]}"; do
  copy_dir "$rel"
done

echo
echo "Dependency links:"
for rel in "${DEPENDENCY_LINKS[@]}"; do
  link_dependency_dir "$rel"
done

echo
echo "Ignore/tracking check:"
for rel in "${FILES[@]}" "${DIRS[@]}" "${DEPENDENCY_LINKS[@]}"; do
  warn_if_not_ignored_or_tracked "$rel"
done

echo
echo "Follow-up commands for a new long-lived worktree:"
echo "  scripts/dev/sync-local-worktree-config.sh --apply --target \"$TARGET\""
echo "  rtk code-review-graph register \"$TARGET\" --alias <alias>"
echo "  rtk code-review-graph build --repo \"$TARGET\""
