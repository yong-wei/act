#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT_DIR/.logs"
PID_DIR="$LOG_DIR/pids"

CONSOLE_LOG="$LOG_DIR/console.log"
DB_LOG="$LOG_DIR/database.log"

mkdir -p "$LOG_DIR" "$PID_DIR"
touch "$CONSOLE_LOG" "$DB_LOG"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$CONSOLE_LOG"
}

stop_pid() {
  local name="$1"
  local pid_file="$PID_DIR/${name}.pid"

  if [ ! -f "$pid_file" ]; then
    log "No pid file found for ${name}."
    return 0
  fi

  local pid
  pid="$(cat "$pid_file")"

  if kill -0 "$pid" >/dev/null 2>&1; then
    log "Stopping ${name} (pid ${pid})."
    kill -TERM "-$pid" >/dev/null 2>&1 || true

    if command -v pkill >/dev/null 2>&1; then
      pkill -TERM -P "$pid" >/dev/null 2>&1 || true
    fi

    for _ in {1..10}; do
      if kill -0 "$pid" >/dev/null 2>&1; then
        sleep 1
      else
        break
      fi
    done

    if kill -0 "$pid" >/dev/null 2>&1; then
      log "Force killing ${name} (pid ${pid})."
      kill -KILL "-$pid" >/dev/null 2>&1 || true
      if command -v pkill >/dev/null 2>&1; then
        pkill -KILL -P "$pid" >/dev/null 2>&1 || true
      fi
      kill -KILL "$pid" >/dev/null 2>&1 || true
    fi
  else
    log "${name} is not running (stale pid ${pid})."
  fi

  rm -f "$pid_file"
}

stop_postgres() {
  local container_name="act-just-postgres"
  local pid_file="$PID_DIR/database.pid"

  if ! command -v docker >/dev/null 2>&1; then
    log "Docker is not installed or not on PATH; cannot stop Postgres."
    return 0
  fi

  if [ -f "$pid_file" ]; then
    container_name="$(cat "$pid_file")"
  fi

  if docker ps --format '{{.Names}}' | grep -q "^${container_name}$"; then
    log "Stopping Postgres container (${container_name})."
    docker stop "$container_name" >>"$DB_LOG" 2>&1 || true
  fi

  if docker ps -a --format '{{.Names}}' | grep -q "^${container_name}$"; then
    docker rm "$container_name" >>"$DB_LOG" 2>&1 || true
  fi

  rm -f "$pid_file"
}

log "Shutdown initiated."
stop_pid "frontend"
stop_pid "simulation"
stop_pid "llm"
stop_postgres
log "Shutdown completed."
