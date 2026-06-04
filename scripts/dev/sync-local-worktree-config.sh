#!/usr/bin/env bash
set -euo pipefail

DEFAULT_SOURCE="/Users/YW/Documents/Site/act.just.edu.cn"
SOURCE="$DEFAULT_SOURCE"
TARGET=""
APPLY=0
NO_OVERWRITE=0
INCLUDE_CODEX_PLANS=0
LINK_CONFIG=0
LINK_ENV=0
REPLACE_EXISTING=0
INIT_GRAPHS=0
INSTALL_HOOKS=0
INSTALL_DEPS=0
BOOTSTRAP_DEV_ENV=0
LINK_OPENWOLF_KNOWLEDGE=0
GRAPH_ALIAS=""
ENV_LINKS=()
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_ROOT=""
MANAGED_HOOK_MARKER="# Managed by sync-local-worktree-config.sh"

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
  --apply                    Copy/link files. Without this flag, only print actions.
  --no-overwrite             Skip existing target files instead of overwriting.
  --include-codex-plans      Compatibility flag; .codex is now synced by default.
  --link-config              Symlink shared local config from source instead of copying it.
  --link-env                 Implies --link-config; also symlink .env, .env.*, .envrc,
                             and .codex/config.toml from source when present.
  --replace-existing         When linking, backup and replace existing target paths.
  --init-graphs              Initialize and build codegraph and code-review-graph for target.
  --install-hooks            Install or repair managed Git hooks for codegraph and CRG.
  --install-deps             Run npm ci in the target worktree.
  --link-openwolf-knowledge  Link long-lived .wolf knowledge files to the source
                             checkout while keeping runtime files local.
  --bootstrap-dev-env        Enable --link-config, --link-env, --install-hooks,
                             --install-deps, --init-graphs, and
                             --link-openwolf-knowledge.
  --graph-alias ALIAS        CRG alias to use with --init-graphs. Defaults to a target-based alias.
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
  .codex/
  .github/
  .serena/project.yml
  .serena/memories/

Linked with --link-config:
  AGENTS.md
  GEMINI.md
  .claude/settings.local.json
  .claude/commands/
  .claude/skills/
  .codex/agents/
  .codex/environments/
  .codex/skills/
  .github/
  .serena/project.yml
  .serena/memories/

Linked with --link-config --link-env:
  .env
  .env.*
  .envrc
  .codex/config.toml

Linked with --link-openwolf-knowledge:
  .wolf/OPENWOLF.md
  .wolf/identity.md
  .wolf/cerebrum.md
  .wolf/buglog.json
  .wolf/memory.md
  .wolf/config.json
  .wolf/reframe-frameworks.md
  .wolf/cron-manifest.json

Never copied by this script:
  .next, node_modules, .cache, .tmp, .logs, .code-review-graph, Rust target,
  .codegraph, .codex/cache, .codex/tmp, .serena/cache, .wolf/hooks/_session.json,
  .wolf/token-ledger.json, .wolf/cron-state.json, .DS_Store, __pycache__, *.pyc.
Dependencies are not copied or linked; use --install-deps to run npm ci in the target worktree.
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
    --link-config)
      LINK_CONFIG=1
      shift
      ;;
    --link-env)
      LINK_ENV=1
      shift
      ;;
    --replace-existing)
      REPLACE_EXISTING=1
      shift
      ;;
    --init-graphs)
      INIT_GRAPHS=1
      shift
      ;;
    --install-hooks)
      INSTALL_HOOKS=1
      shift
      ;;
    --install-deps)
      INSTALL_DEPS=1
      shift
      ;;
    --link-openwolf-knowledge)
      LINK_OPENWOLF_KNOWLEDGE=1
      shift
      ;;
    --bootstrap-dev-env)
      BOOTSTRAP_DEV_ENV=1
      shift
      ;;
    --graph-alias)
      GRAPH_ALIAS="${2:-}"
      shift 2
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

if [[ "$LINK_ENV" -eq 1 && "$LINK_CONFIG" -ne 1 ]]; then
  LINK_CONFIG=1
fi

if [[ "$BOOTSTRAP_DEV_ENV" -eq 1 ]]; then
  LINK_CONFIG=1
  LINK_ENV=1
  INSTALL_HOOKS=1
  INSTALL_DEPS=1
  INIT_GRAPHS=1
  LINK_OPENWOLF_KNOWLEDGE=1
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
  ".codex"
  ".github"
  ".serena/memories"
)

CONFIG_LINKS=(
  "AGENTS.md"
  "GEMINI.md"
  ".claude/settings.local.json"
  ".claude/commands"
  ".claude/skills"
  ".codex/agents"
  ".codex/environments"
  ".codex/skills"
  ".github"
  ".serena/project.yml"
  ".serena/memories"
)

OPENWOLF_KNOWLEDGE_LINKS=(
  ".wolf/OPENWOLF.md"
  ".wolf/identity.md"
  ".wolf/cerebrum.md"
  ".wolf/buglog.json"
  ".wolf/memory.md"
  ".wolf/config.json"
  ".wolf/reframe-frameworks.md"
  ".wolf/cron-manifest.json"
)

OPENWOLF_LOCAL_SEED_FILES=(
  ".wolf/anatomy.md"
  ".wolf/token-ledger.json"
  ".wolf/cron-state.json"
  ".wolf/designqc-report.json"
  ".wolf/suggestions.json"
)

if [[ "$INCLUDE_CODEX_PLANS" -eq 1 ]]; then
  :
fi

print_mode() {
  if [[ "$APPLY" -eq 1 ]]; then
    echo "Mode: apply"
  else
    echo "Mode: dry-run"
  fi
  if [[ "$LINK_CONFIG" -eq 1 ]]; then
    echo "Config sync: symlink"
  else
    echo "Config sync: copy"
  fi
  if [[ "$INIT_GRAPHS" -eq 1 ]]; then
    echo "Graph init: enabled"
  fi
  if [[ "$INSTALL_HOOKS" -eq 1 ]]; then
    echo "Git hooks: enabled"
  fi
  if [[ "$INSTALL_DEPS" -eq 1 ]]; then
    echo "Dependency install: enabled"
  fi
  if [[ "$LINK_OPENWOLF_KNOWLEDGE" -eq 1 ]]; then
    echo "OpenWolf knowledge links: enabled"
  fi
}

sanitize_graph_alias() {
  local raw="$1"
  printf '%s' "$raw" | tr -cs '[:alnum:]_-' '-' | sed -E 's/^-+//; s/-+$//'
}

default_graph_alias() {
  local repo_name
  local tail
  local worktree_id

  repo_name="$(basename "$TARGET")"
  case "$TARGET" in
    */.codex/worktrees/*/*)
      tail="${TARGET#*/.codex/worktrees/}"
      worktree_id="${tail%%/*}"
      sanitize_graph_alias "$repo_name-$worktree_id"
      ;;
    *)
      sanitize_graph_alias "$repo_name"
      ;;
  esac
}

resolve_graph_alias() {
  if [[ -n "$GRAPH_ALIAS" ]]; then
    sanitize_graph_alias "$GRAPH_ALIAS"
  else
    default_graph_alias
  fi
}

ensure_parent_dir() {
  local dest="$1"
  mkdir -p "$(dirname "$dest")"
}

path_in_list() {
  local needle="$1"
  shift
  local item
  for item in "$@"; do
    if [[ "$needle" == "$item" ]]; then
      return 0
    fi
  done
  return 1
}

skip_copy_for_link_mode() {
  local rel="$1"

  if [[ "$LINK_CONFIG" -eq 1 ]] && path_in_list "$rel" "${CONFIG_LINKS[@]}"; then
    return 0
  fi

  if [[ "$LINK_CONFIG" -eq 1 && "$rel" == ".codex" ]]; then
    return 0
  fi

  if [[ "$LINK_ENV" -eq 1 ]]; then
    case "$rel" in
      .env|.env.*|.envrc|.codex|.codex/config.toml)
        return 0
        ;;
    esac
  fi

  return 1
}

copy_file() {
  local rel="$1"
  local src="$SOURCE/$rel"
  local dest="$TARGET/$rel"

  if skip_copy_for_link_mode "$rel"; then
    echo "skip copy; selected for symlink: $rel"
    return
  fi

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
    --exclude "tmp/"
  )

  if skip_copy_for_link_mode "$rel"; then
    echo "skip sync; selected for symlink: $rel/"
    return
  fi

  if [[ ! -d "$src" ]]; then
    echo "skip missing dir: $rel"
    return
  fi

  if [[ "$NO_OVERWRITE" -eq 1 ]]; then
    rsync_args+=(--ignore-existing)
  else
    rsync_args+=(--backup "--suffix=.bak.$TIMESTAMP" "--backup-dir=$BACKUP_ROOT/$rel")
  fi

  if [[ "$APPLY" -ne 1 ]]; then
    echo "would sync dir: $rel/"
    rsync_args+=(--dry-run --itemize-changes)
  else
    ensure_parent_dir "$dest"
    mkdir -p "$dest"
    if [[ "$NO_OVERWRITE" -ne 1 ]]; then
      mkdir -p "$BACKUP_ROOT/$rel"
    fi
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
  if [[ "$exclude_file" != /* ]]; then
    exclude_file="$TARGET/$exclude_file"
  fi

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

same_link_target() {
  local dest="$1"
  local src="$2"
  local current_target

  if [[ ! -L "$dest" ]]; then
    return 1
  fi

  current_target="$(readlink "$dest")"
  if [[ "$current_target" == "$src" ]]; then
    return 0
  fi

  if [[ "$current_target" != /* ]]; then
    current_target="$(cd "$(dirname "$dest")" && cd "$(dirname "$current_target")" && pwd)/$(basename "$current_target")"
  fi

  [[ "$current_target" == "$src" ]]
}

backup_existing_path() {
  local rel="$1"
  local dest="$TARGET/$rel"
  local backup="$BACKUP_ROOT/$rel"

  mkdir -p "$(dirname "$backup")"
  mv "$dest" "$backup"
  echo "backup existing path: .tmp/local-config-backups/$TIMESTAMP/$rel"
}

path_has_tracked_content() {
  local rel="$1"
  [[ -n "$(git -C "$TARGET" ls-files -- "$rel" "$rel/" ":(glob)$rel/**")" ]]
}

link_config_path() {
  local rel="$1"
  local src="$SOURCE/$rel"
  local dest="$TARGET/$rel"

  if [[ ! -e "$src" ]]; then
    echo "skip missing link source: $rel"
    return
  fi

  if same_link_target "$dest" "$src"; then
    echo "config link already exists: $rel -> $src"
    ensure_local_exclude "$rel"
    return
  fi

  if [[ -e "$dest" || -L "$dest" ]]; then
    if path_has_tracked_content "$rel"; then
      echo "skip tracked config path: $rel"
      return
    fi

    if [[ "$REPLACE_EXISTING" -ne 1 ]]; then
      echo "skip existing config path: $rel"
      ensure_local_exclude "$rel"
      return
    fi

    if [[ "$APPLY" -ne 1 ]]; then
      echo "would backup and link config path: $rel -> $src"
      ensure_local_exclude "$rel"
      return
    fi

    backup_existing_path "$rel"
  elif [[ "$APPLY" -ne 1 ]]; then
    echo "would link config path: $rel -> $src"
    ensure_local_exclude "$rel"
    return
  fi

  ensure_parent_dir "$dest"
  ln -s "$src" "$dest"
  echo "linked config path: $rel -> $src"
  ensure_local_exclude "$rel"
}

target_worktree_id() {
  local tail
  case "$TARGET" in
    */.codex/worktrees/*/*)
      tail="${TARGET#*/.codex/worktrees/}"
      printf '%s\n' "${tail%%/*}"
      ;;
    *)
      sanitize_graph_alias "$(basename "$TARGET")"
      ;;
  esac
}

target_branch_name() {
  local branch
  branch="$(git -C "$TARGET" branch --show-current 2>/dev/null || true)"
  if [[ -n "$branch" ]]; then
    printf '%s\n' "$branch"
    return
  fi
  git -C "$TARGET" rev-parse --short HEAD 2>/dev/null || printf '%s\n' "unknown"
}

openwolf_source_label() {
  printf '%s:%s\n' "$(target_branch_name)" "$(target_worktree_id)"
}

replace_path_with_link() {
  local rel="$1"
  local src="$2"
  local dest="$TARGET/$rel"

  if [[ ! -e "$src" ]]; then
    echo "skip missing OpenWolf knowledge source: $rel"
    return
  fi

  if same_link_target "$dest" "$src"; then
    echo "OpenWolf knowledge link already exists: $rel -> $src"
    ensure_local_exclude "$rel"
    return
  fi

  if [[ -e "$dest" || -L "$dest" ]]; then
    if path_has_tracked_content "$rel"; then
      echo "skip tracked OpenWolf knowledge path: $rel"
      return
    fi
    if [[ "$NO_OVERWRITE" -eq 1 ]]; then
      echo "skip existing OpenWolf knowledge file: $rel"
      ensure_local_exclude "$rel"
      return
    fi
  fi

  if [[ "$APPLY" -ne 1 ]]; then
    if [[ -e "$dest" || -L "$dest" ]]; then
      echo "would backup and link OpenWolf knowledge file: $rel -> $src"
    else
      echo "would link OpenWolf knowledge file: $rel -> $src"
    fi
    ensure_local_exclude "$rel"
    return
  fi

  ensure_parent_dir "$dest"
  if [[ -e "$dest" || -L "$dest" ]]; then
    backup_existing_path "$rel"
  fi

  ln -s "$src" "$dest"
  echo "linked OpenWolf knowledge file: $rel -> $src"
  ensure_local_exclude "$rel"
}

seed_openwolf_local_file() {
  local rel="$1"
  local src="$SOURCE/$rel"
  local dest="$TARGET/$rel"

  if [[ -e "$dest" || -L "$dest" ]]; then
    echo "OpenWolf local file already exists: $rel"
    ensure_local_exclude "$rel"
    return
  fi

  if [[ ! -f "$src" ]]; then
    echo "skip missing OpenWolf local seed: $rel"
    return
  fi

  if [[ "$APPLY" -ne 1 ]]; then
    echo "would seed OpenWolf local file: $rel"
    ensure_local_exclude "$rel"
    return
  fi

  ensure_parent_dir "$dest"
  cp -p "$src" "$dest"
  echo "seeded OpenWolf local file: $rel"
  ensure_local_exclude "$rel"
}

sync_openwolf_hooks_dir() {
  local src="$SOURCE/.wolf/hooks"
  local dest="$TARGET/.wolf/hooks"
  local rsync_args=(
    -a
    --exclude "_session.json"
    --exclude "*.tmp"
  )

  if [[ ! -d "$src" ]]; then
    echo "skip missing OpenWolf hooks source: .wolf/hooks"
    return
  fi

  if [[ "$APPLY" -ne 1 ]]; then
    echo "would sync OpenWolf local hooks: .wolf/hooks/"
    ensure_local_exclude ".wolf/hooks"
    return
  fi

  mkdir -p "$dest"
  rsync "${rsync_args[@]}" "$src/" "$dest/"
  echo "synced OpenWolf local hooks: .wolf/hooks/"
  ensure_local_exclude ".wolf/hooks"
}

write_openwolf_source_identity() {
  local identity_file="$TARGET/.wolf/worktree-source.json"
  local state_file="$TARGET/.wolf/source-stamp-state.json"
  local memory_file="$TARGET/.wolf/memory.md"
  local memory_size="0"

  if [[ "$APPLY" -ne 1 ]]; then
    echo "would write OpenWolf worktree source identity: .wolf/worktree-source.json"
    echo "would initialize OpenWolf source stamp state: .wolf/source-stamp-state.json"
    ensure_local_exclude ".wolf/worktree-source.json"
    ensure_local_exclude ".wolf/source-stamp-state.json"
    return
  fi

  mkdir -p "$TARGET/.wolf"
  if [[ -f "$memory_file" ]]; then
    memory_size="$(wc -c < "$memory_file" | tr -d '[:space:]')"
  fi

  cat > "$identity_file" <<EOF
{
  "id": "$(target_worktree_id)",
  "branch": "$(target_branch_name)",
  "label": "$(openwolf_source_label)",
  "path": "$TARGET",
  "sharedWolf": "$SOURCE/.wolf"
}
EOF

  cat > "$state_file" <<EOF
{
  "memorySize": $memory_size,
  "updatedAt": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
}
EOF

  echo "wrote OpenWolf worktree source identity: .wolf/worktree-source.json"
  echo "initialized OpenWolf source stamp state: .wolf/source-stamp-state.json"
  ensure_local_exclude ".wolf/worktree-source.json"
  ensure_local_exclude ".wolf/source-stamp-state.json"
}

install_openwolf_source_stamp_hooks() {
  local hooks_json="$TARGET/.codex/hooks.json"
  local source_hooks_json="$SOURCE/.codex/hooks.json"
  local stamp_command="node scripts/dev/openwolf-source-stamp.mjs"

  if [[ ! -f "$hooks_json" ]]; then
    if [[ "$APPLY" -ne 1 ]]; then
      echo "would seed Codex hooks config for OpenWolf source stamp: .codex/hooks.json"
      echo "would install OpenWolf source stamp Codex hooks"
      return
    fi
    mkdir -p "$(dirname "$hooks_json")"
    if [[ -f "$source_hooks_json" ]]; then
      cp -p "$source_hooks_json" "$hooks_json"
      echo "seeded Codex hooks config from source: .codex/hooks.json"
    else
      printf '{\n  "hooks": {}\n}\n' > "$hooks_json"
      echo "created minimal Codex hooks config: .codex/hooks.json"
    fi
  fi

  if [[ "$APPLY" -ne 1 ]]; then
    echo "would install OpenWolf source stamp Codex hooks"
    return
  fi

  require_command node
  node - "$hooks_json" "$stamp_command" <<'NODE'
const fs = require('node:fs');
const [hooksPath, stampCommand] = process.argv.slice(2);
const data = JSON.parse(fs.readFileSync(hooksPath, 'utf8'));
data.hooks ||= {};

function commandFor(eventName) {
  return `${stampCommand} ${eventName}`;
}

function stripExisting(groups) {
  return (groups || []).map((group) => ({
    ...group,
    hooks: (group.hooks || []).filter((hook) => !String(hook.command || '').includes('openwolf-source-stamp.mjs')),
  })).filter((group) => (group.hooks || []).length > 0);
}

function addGroup(eventName, group) {
  data.hooks[eventName] = stripExisting(data.hooks[eventName]);
  data.hooks[eventName].push(group);
}

addGroup('SessionStart', {
  matcher: 'startup|resume',
  hooks: [{ type: 'command', command: commandFor('session-start'), timeout: 5 }],
});

addGroup('PostToolUse', {
  matcher: '^Write$|^Edit$|^MultiEdit$|^functions\\.apply_patch$',
  hooks: [{ type: 'command', command: commandFor('post-write'), timeout: 5 }],
});

addGroup('Stop', {
  hooks: [{ type: 'command', command: commandFor('stop'), timeout: 5 }],
});

fs.writeFileSync(hooksPath, `${JSON.stringify(data, null, 2)}\n`);
NODE
  echo "installed OpenWolf source stamp Codex hooks"
}

link_openwolf_knowledge() {
  local rel

  echo
  echo "OpenWolf knowledge links:"
  if [[ ! -d "$SOURCE/.wolf" ]]; then
    echo "skip missing OpenWolf source directory: $SOURCE/.wolf"
    return
  fi

  if [[ -L "$TARGET/.wolf" ]]; then
    if [[ "$APPLY" -ne 1 ]]; then
      echo "would backup existing .wolf directory symlink before creating local .wolf directory"
    else
      backup_existing_path ".wolf"
      mkdir -p "$TARGET/.wolf"
      echo "created local OpenWolf directory: .wolf/"
    fi
  elif [[ ! -e "$TARGET/.wolf" ]]; then
    if [[ "$APPLY" -ne 1 ]]; then
      echo "would create local OpenWolf directory: .wolf/"
    else
      mkdir -p "$TARGET/.wolf"
      echo "created local OpenWolf directory: .wolf/"
    fi
  elif [[ ! -d "$TARGET/.wolf" ]]; then
    if [[ "$APPLY" -ne 1 ]]; then
      echo "would backup existing non-directory .wolf before creating local .wolf directory"
    else
      backup_existing_path ".wolf"
      mkdir -p "$TARGET/.wolf"
      echo "created local OpenWolf directory: .wolf/"
    fi
  fi

  for rel in "${OPENWOLF_KNOWLEDGE_LINKS[@]}"; do
    replace_path_with_link "$rel" "$SOURCE/$rel"
  done

  for rel in "${OPENWOLF_LOCAL_SEED_FILES[@]}"; do
    seed_openwolf_local_file "$rel"
  done

  sync_openwolf_hooks_dir
  write_openwolf_source_identity
  install_openwolf_source_stamp_hooks
}

collect_env_links() {
  local src
  local rel

  ENV_LINKS=()
  for rel in ".env" ".envrc" ".codex/config.toml"; do
    if [[ -e "$SOURCE/$rel" ]]; then
      ENV_LINKS+=("$rel")
    fi
  done

  for src in "$SOURCE"/.env.*; do
    if [[ ! -e "$src" ]]; then
      continue
    fi
    rel="${src#$SOURCE/}"
    if ! path_in_list "$rel" "${ENV_LINKS[@]}"; then
      ENV_LINKS+=("$rel")
    fi
  done
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

initialize_graphs() {
  local alias
  alias="$(resolve_graph_alias)"

  echo
  echo "Graph initialization:"
  if [[ "$APPLY" -ne 1 ]]; then
    echo "would initialize codegraph: $TARGET"
    echo "would register CRG: $TARGET (alias: $alias)"
    echo "would build CRG: $TARGET"
    return
  fi

  require_command codegraph
  require_command code-review-graph

  codegraph init --index "$TARGET"
  echo "initialized codegraph: $TARGET"
  code-review-graph register "$TARGET" --alias "$alias"
  echo "registered CRG: $TARGET (alias: $alias)"
  code-review-graph build --repo "$TARGET"
  echo "built CRG: $TARGET"
}

hook_path() {
  local path
  path="$(git -C "$TARGET" rev-parse --git-path "hooks/$1")"
  if [[ "$path" == /* ]]; then
    printf '%s\n' "$path"
  else
    printf '%s/%s\n' "$TARGET" "$path"
  fi
}

hook_can_replace() {
  local path="$1"

  if [[ ! -e "$path" ]]; then
    return 0
  fi
  if grep -Fq "$MANAGED_HOOK_MARKER" "$path" 2>/dev/null; then
    return 0
  fi
  [[ "$REPLACE_EXISTING" -eq 1 ]]
}

write_managed_hook() {
  local name="$1"
  local content="$2"
  local path

  path="$(hook_path "$name")"

  if [[ "$APPLY" -ne 1 ]]; then
    if [[ -e "$path" ]]; then
      if hook_can_replace "$path"; then
        echo "would install managed Git hook with backup: $name"
      else
        echo "would skip existing non-managed Git hook: $name"
      fi
    else
      echo "would install managed Git hook: $name"
    fi
    return
  fi

  mkdir -p "$(dirname "$path")"
  if [[ -e "$path" ]]; then
    if ! hook_can_replace "$path"; then
      echo "skip existing non-managed Git hook: $name"
      return
    fi
    mkdir -p "$BACKUP_ROOT/.git/hooks"
    cp -p "$path" "$BACKUP_ROOT/.git/hooks/$name"
    echo "backup existing Git hook: .tmp/local-config-backups/$TIMESTAMP/.git/hooks/$name"
  fi

  printf '%s\n' "$content" > "$path"
  chmod +x "$path"
  echo "installed managed Git hook: $name"
}

install_git_hooks() {
  local pre_commit
  local post_commit
  local post_checkout
  local post_merge
  local post_rewrite
  local crg_lib
  local codegraph_lib

  echo
  echo "Git hooks:"

  read -r -d '' pre_commit <<'HOOK' || true
#!/bin/sh
# Managed by sync-local-worktree-config.sh
# Detect graph-relevant changes before commit; graph indexes are updated after commit.
if command -v code-review-graph >/dev/null 2>&1; then
    code-review-graph detect-changes --brief || true
fi
HOOK

  read -r -d '' post_commit <<'HOOK' || true
#!/bin/sh
# Managed by sync-local-worktree-config.sh
# Update local code graphs after each successful commit.

. "$(git rev-parse --git-path hooks/crg-hook-lib.sh)"
crg_run update

. "$(git rev-parse --git-path hooks/codegraph-hook-lib.sh)"
codegraph_run sync
HOOK

  read -r -d '' post_checkout <<'HOOK' || true
#!/bin/sh
# Managed by sync-local-worktree-config.sh
# Rebuild local code graphs after branch checkouts.

if [ "$3" != "1" ]; then
    exit 0
fi

. "$(git rev-parse --git-path hooks/crg-hook-lib.sh)"
crg_run build

. "$(git rev-parse --git-path hooks/codegraph-hook-lib.sh)"
codegraph_run sync
HOOK

  read -r -d '' post_merge <<'HOOK' || true
#!/bin/sh
# Managed by sync-local-worktree-config.sh
# Rebuild local code graphs after merges.

. "$(git rev-parse --git-path hooks/crg-hook-lib.sh)"
crg_run build

. "$(git rev-parse --git-path hooks/codegraph-hook-lib.sh)"
codegraph_run sync
HOOK

  read -r -d '' post_rewrite <<'HOOK' || true
#!/bin/sh
# Managed by sync-local-worktree-config.sh
# Rebuild local code graphs after commit rewrites.

. "$(git rev-parse --git-path hooks/crg-hook-lib.sh)"
crg_run build

. "$(git rev-parse --git-path hooks/codegraph-hook-lib.sh)"
codegraph_run sync
HOOK

  read -r -d '' crg_lib <<'HOOK' || true
#!/bin/sh
# Managed by sync-local-worktree-config.sh

crg_repo_root() {
  git rev-parse --show-toplevel 2>/dev/null
}

crg_run() {
  mode="$1"
  repo="$(crg_repo_root)"
  if [ -z "$repo" ]; then
    return 0
  fi

  tool_path="$(command -v code-review-graph || true)"
  if [ -z "$tool_path" ]; then
    return 0
  fi

  graph_dir="$repo/.code-review-graph"
  mkdir -p "$graph_dir"
  log_file="$graph_dir/hooks.log"
  lock_dir="$graph_dir/hook.lock"

  if ! mkdir "$lock_dir" 2>/dev/null; then
    printf '%s [%s] skipped: another code-review-graph hook is running\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$mode" >> "$log_file"
    return 0
  fi

  crg_cleanup() {
    rmdir "$lock_dir" 2>/dev/null || true
  }
  trap crg_cleanup EXIT INT TERM

  crg_command() {
    "$@" >> "$log_file" 2>&1
    status="$?"
    if [ "$status" -ge 128 ]; then
      printf '%s [%s] command exit_status=%s signal=%s: %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$mode" "$status" "$((status - 128))" "$*" >> "$log_file"
    else
      printf '%s [%s] command exit_status=%s: %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$mode" "$status" "$*" >> "$log_file"
    fi
    return 0
  }

  printf '%s [%s] start tool=%s repo=%s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$mode" "$tool_path" "$repo" >> "$log_file"
  case "$mode" in
    update)
      crg_command "$tool_path" update --repo "$repo"
      ;;
    build)
      crg_command "$tool_path" build --repo "$repo"
      ;;
    *)
      printf '%s [%s] unknown mode\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$mode" >> "$log_file"
      ;;
  esac
  printf '%s [%s] end\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$mode" >> "$log_file"
  crg_cleanup
  trap - EXIT INT TERM
}
HOOK

  read -r -d '' codegraph_lib <<'HOOK' || true
#!/bin/sh
# Managed by sync-local-worktree-config.sh

codegraph_repo_root() {
  git rev-parse --show-toplevel 2>/dev/null
}

codegraph_run() {
  mode="$1"
  repo="$(codegraph_repo_root)"
  if [ -z "$repo" ]; then
    return 0
  fi

  tool_path="$(command -v codegraph || true)"
  if [ -z "$tool_path" ]; then
    return 0
  fi

  graph_dir="$repo/.codegraph"
  mkdir -p "$graph_dir"
  log_file="$graph_dir/hooks.log"
  lock_dir="$graph_dir/hook.lock"

  if ! mkdir "$lock_dir" 2>/dev/null; then
    printf '%s [%s] skipped: another codegraph hook is running\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$mode" >> "$log_file"
    return 0
  fi

  codegraph_cleanup() {
    rmdir "$lock_dir" 2>/dev/null || true
  }
  trap codegraph_cleanup EXIT INT TERM

  codegraph_command() {
    "$@" >> "$log_file" 2>&1
    status="$?"
    if [ "$status" -ge 128 ]; then
      printf '%s [%s] command exit_status=%s signal=%s: %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$mode" "$status" "$((status - 128))" "$*" >> "$log_file"
    else
      printf '%s [%s] command exit_status=%s: %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$mode" "$status" "$*" >> "$log_file"
    fi
    return 0
  }

  printf '%s [%s] start tool=%s repo=%s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$mode" "$tool_path" "$repo" >> "$log_file"
  case "$mode" in
    sync)
      if [ -f "$graph_dir/codegraph.db" ]; then
        codegraph_command "$tool_path" sync --quiet "$repo"
      else
        codegraph_command "$tool_path" index --quiet "$repo"
      fi
      ;;
    *)
      printf '%s [%s] unknown mode\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$mode" >> "$log_file"
      ;;
  esac
  printf '%s [%s] end\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$mode" >> "$log_file"
  codegraph_cleanup
  trap - EXIT INT TERM
}
HOOK

  write_managed_hook "pre-commit" "$pre_commit"
  write_managed_hook "post-commit" "$post_commit"
  write_managed_hook "post-checkout" "$post_checkout"
  write_managed_hook "post-merge" "$post_merge"
  write_managed_hook "post-rewrite" "$post_rewrite"
  write_managed_hook "crg-hook-lib.sh" "$crg_lib"
  write_managed_hook "codegraph-hook-lib.sh" "$codegraph_lib"
}

install_dependencies() {
  echo
  echo "Dependency installation:"
  if [[ "$APPLY" -ne 1 ]]; then
    echo "would run npm ci in target: $TARGET"
    return
  fi

  require_command npm
  (cd "$TARGET" && npm ci)
  echo "installed dependencies in target: $TARGET"
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

if [[ "$LINK_CONFIG" -eq 1 ]]; then
  echo
  echo "Config links:"
  for rel in "${CONFIG_LINKS[@]}"; do
    link_config_path "$rel"
  done

  if [[ "$LINK_ENV" -eq 1 ]]; then
    collect_env_links
    echo
    echo "Environment links:"
    for rel in "${ENV_LINKS[@]}"; do
      link_config_path "$rel"
    done
  fi
fi

if [[ "$LINK_OPENWOLF_KNOWLEDGE" -eq 1 ]]; then
  link_openwolf_knowledge
fi

echo
echo "Ignore/tracking check:"
if [[ "$LINK_CONFIG" -eq 1 && "$LINK_ENV" -eq 1 ]]; then
  collect_env_links
fi
TRACKING_CHECK_PATHS=("${FILES[@]}" "${DIRS[@]}" "${CONFIG_LINKS[@]}")
if [[ ${#ENV_LINKS[@]} -gt 0 ]]; then
  TRACKING_CHECK_PATHS+=("${ENV_LINKS[@]}")
fi
if [[ "$LINK_OPENWOLF_KNOWLEDGE" -eq 1 ]]; then
  TRACKING_CHECK_PATHS+=("${OPENWOLF_KNOWLEDGE_LINKS[@]}" "${OPENWOLF_LOCAL_SEED_FILES[@]}" ".wolf/hooks" ".wolf/worktree-source.json" ".wolf/source-stamp-state.json")
fi
for rel in "${TRACKING_CHECK_PATHS[@]}"; do
  warn_if_not_ignored_or_tracked "$rel"
done

if [[ "$INSTALL_DEPS" -eq 1 ]]; then
  install_dependencies
fi

if [[ "$INIT_GRAPHS" -eq 1 ]]; then
  initialize_graphs
fi

if [[ "$INSTALL_HOOKS" -eq 1 ]]; then
  install_git_hooks
fi

echo
echo "Follow-up commands for a new long-lived worktree:"
echo "  scripts/dev/sync-local-worktree-config.sh --apply --bootstrap-dev-env --target \"$TARGET\" --graph-alias \"$(resolve_graph_alias)\""
