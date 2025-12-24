#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT_DIR/ai-obe-platform"
LOG_DIR="$ROOT_DIR/.logs"
PID_DIR="$LOG_DIR/pids"

CONSOLE_LOG="$LOG_DIR/console.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"
BACKEND_LOG="$LOG_DIR/backend.log"
DB_LOG="$LOG_DIR/database.log"

mkdir -p "$LOG_DIR" "$PID_DIR"
touch "$CONSOLE_LOG" "$FRONTEND_LOG" "$BACKEND_LOG" "$DB_LOG"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$CONSOLE_LOG"
}

run_detached() {
  local cmd="$1"
  local log_file="$2"

  if command -v setsid >/dev/null 2>&1; then
    setsid bash -c "$cmd" >>"$log_file" 2>&1 &
  else
    nohup bash -c "$cmd" >>"$log_file" 2>&1 &
  fi

  echo $!
}

start_postgres() {
  local container_name="act-just-postgres"
  local db_user="${POSTGRES_USER:-act_user}"
  local db_password="${POSTGRES_PASSWORD:-act_pass}"
  local db_name="${POSTGRES_DB:-act_obe}"
  local db_port="${POSTGRES_PORT:-5432}"
  local volume_name="${POSTGRES_VOLUME:-act-just-postgres-data}"

  if ! command -v docker >/dev/null 2>&1; then
    log "Docker is not installed or not on PATH; cannot start Postgres."
    return 1
  fi

  if docker ps --format '{{.Names}}' | grep -q "^${container_name}$"; then
    log "Postgres container already running (${container_name})."
  elif docker ps -a --format '{{.Names}}' | grep -q "^${container_name}$"; then
    log "Starting existing Postgres container (${container_name})."
    docker start "$container_name" >>"$DB_LOG" 2>&1
  else
    log "Starting new Postgres container (${container_name})."
    docker run -d \
      --name "$container_name" \
      -e POSTGRES_USER="$db_user" \
      -e POSTGRES_PASSWORD="$db_password" \
      -e POSTGRES_DB="$db_name" \
      -p "${db_port}:5432" \
      -v "${volume_name}:/var/lib/postgresql/data" \
      postgres:15 >>"$DB_LOG" 2>&1
  fi

  echo "$container_name" >"$PID_DIR/database.pid"
}

start_service() {
  local name="$1"
  local cmd="$2"
  local workdir="$3"
  local pid_file="${4:-$PID_DIR/${name}.pid}"

  if [ -z "$cmd" ]; then
    log "Skipping ${name}: no command configured."
    return 0
  fi

  if [ -f "$pid_file" ] && kill -0 "$(cat "$pid_file")" >/dev/null 2>&1; then
    log "${name} already running (pid $(cat "$pid_file"))."
    return 0
  fi

  log "Starting ${name}: ${cmd}"
  (
    cd "$workdir"
    run_detached "$cmd" "$BACKEND_LOG" >"$pid_file"
  )
}

start_frontend() {
  local pid_file="$PID_DIR/frontend.pid"
  local frontend_port="${NEXT_PORT:-3000}"

  if [ -f "$pid_file" ] && kill -0 "$(cat "$pid_file")" >/dev/null 2>&1; then
    log "Frontend already running (pid $(cat "$pid_file"))."
    log "Frontend dev URL: http://localhost:${frontend_port}"
    return 0
  fi

  if [ ! -f "$APP_DIR/.env.local" ]; then
    log "Missing $APP_DIR/.env.local. Copy from $APP_DIR/.env.example before login flows."
  fi

  log "Starting frontend (Next.js dev server)."
  (
    cd "$APP_DIR"
    run_detached "npm run dev" "$FRONTEND_LOG" >"$pid_file"
  )

  log "Frontend dev URL: http://localhost:${frontend_port}"
}

log "Startup initiated."
start_postgres
start_service "simulation" "${SIM_SERVICE_CMD:-}" "${SIM_SERVICE_DIR:-$ROOT_DIR}" "$PID_DIR/simulation.pid"
start_service "llm" "${LLM_SERVICE_CMD:-}" "${LLM_SERVICE_DIR:-$ROOT_DIR}" "$PID_DIR/llm.pid"
start_frontend
log "Startup completed."
