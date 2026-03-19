#!/bin/bash
###############################################################################
# AI-OBE 平台启动脚本
# 功能：
#   - 清理日志文件内容（保留文件）
#   - 检查并启动必要的服务（PostgreSQL / Redis）
#   - 启动 scheduler、worker 与 Next.js 开发服务器
#   - 记录进程 PID
###############################################################################

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 目录定义
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOGS_DIR="$PROJECT_DIR/.logs"
PIDS_DIR="$LOGS_DIR/pids"
REDIS_URL="${REDIS_URL:-redis://localhost:6379}"
FRONTEND_PORT="${FRONTEND_PORT:-3001}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  AI-OBE 船舶智控平台 - 启动脚本${NC}"
echo -e "${BLUE}========================================${NC}\n"

kill_pid_tree() {
  local pid=$1

  if [ -z "$pid" ] || ! ps -p "$pid" > /dev/null 2>&1; then
    return 0
  fi

  local child_pids
  child_pids=$(pgrep -P "$pid" 2>/dev/null || true)
  if [ -n "$child_pids" ]; then
    while read -r child_pid; do
      [ -n "$child_pid" ] && kill_pid_tree "$child_pid"
    done <<< "$child_pids"
  fi

  kill "$pid" 2>/dev/null || true
  sleep 1
  if ps -p "$pid" > /dev/null 2>&1; then
    kill -9 "$pid" 2>/dev/null || true
  fi
}

free_frontend_port() {
  local port=$1
  local port_pids
  port_pids=$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)

  if [ -z "$port_pids" ]; then
    return 0
  fi

  echo -e "  ${YELLOW}!${NC} 发现占用 ${port} 端口的进程: $(echo "$port_pids" | tr '\n' ' ' | xargs)"
  while read -r port_pid; do
    [ -n "$port_pid" ] && kill_pid_tree "$port_pid"
  done <<< "$port_pids"

  sleep 1
  if lsof -tiTCP:"$port" -sTCP:LISTEN > /dev/null 2>&1; then
    echo -e "  ${RED}✗${NC} 端口 ${port} 仍被占用"
    lsof -nP -iTCP:"$port" -sTCP:LISTEN || true
    exit 1
  fi

  echo -e "  ${GREEN}✓${NC} 端口 ${port} 已释放"
}

###############################################################################
# 步骤 1: 清理日志文件内容
###############################################################################
echo -e "${YELLOW}[1/10] 清理日志文件...${NC}"

# 确保目录存在
mkdir -p "$LOGS_DIR"
mkdir -p "$PIDS_DIR"

# 清空日志文件内容（不删除文件）
LOG_FILES=(
  "$LOGS_DIR/frontend.log"
  "$LOGS_DIR/backend.log"
  "$LOGS_DIR/database.log"
  "$LOGS_DIR/redis.log"
  "$LOGS_DIR/worker.log"
  "$LOGS_DIR/scheduler.log"
  "$LOGS_DIR/console.log"
  "$LOGS_DIR/error.log"
)

for log_file in "${LOG_FILES[@]}"; do
  if [ -f "$log_file" ]; then
    > "$log_file"
    echo -e "  ${GREEN}✓${NC} 清空: $(basename "$log_file")"
  else
    touch "$log_file"
    echo -e "  ${GREEN}✓${NC} 创建: $(basename "$log_file")"
  fi
done

echo ""

###############################################################################
# 步骤 2: 检查 PostgreSQL 数据库
###############################################################################
echo -e "${YELLOW}[2/10] 检查 PostgreSQL 数据库...${NC}"

if command -v pg_isready &> /dev/null; then
  if pg_isready -h localhost -p 5432 &> /dev/null; then
    echo -e "  ${GREEN}✓${NC} PostgreSQL 已运行"
  else
    echo -e "  ${RED}✗${NC} PostgreSQL 未运行"
    echo -e "  ${YELLOW}尝试启动 PostgreSQL...${NC}"

    # 尝试使用 brew services 启动（macOS）
    if command -v brew &> /dev/null; then
      brew services start postgresql@14 2>&1 | tee -a "$LOGS_DIR/database.log" || true
      sleep 2
      if pg_isready -h localhost -p 5432 &> /dev/null; then
        echo -e "  ${GREEN}✓${NC} PostgreSQL 启动成功"
      else
        echo -e "  ${RED}✗${NC} PostgreSQL 启动失败，请手动启动"
        exit 1
      fi
    else
      echo -e "  ${RED}✗${NC} 请手动启动 PostgreSQL"
      exit 1
    fi
  fi
else
  echo -e "  ${YELLOW}!${NC} 未找到 pg_isready，跳过 PostgreSQL 检查"
fi

echo ""

###############################################################################
# 步骤 3: 检查 Redis
###############################################################################
echo -e "${YELLOW}[3/10] 检查 Redis...${NC}"

if command -v redis-cli &> /dev/null && redis-cli -u "$REDIS_URL" ping &> /dev/null; then
  echo -e "  ${GREEN}✓${NC} Redis 已运行"
else
  echo -e "  ${YELLOW}!${NC} Redis 未运行，尝试启动..."

  if command -v redis-server &> /dev/null; then
    if [ -f "$PIDS_DIR/redis.pid" ]; then
      OLD_PID=$(cat "$PIDS_DIR/redis.pid")
      if ps -p "$OLD_PID" > /dev/null 2>&1; then
        kill "$OLD_PID" 2>/dev/null || true
        sleep 1
      fi
      rm -f "$PIDS_DIR/redis.pid"
    fi

    nohup redis-server --port 6379 --save "" --appendonly no --pidfile "$PIDS_DIR/redis.pid" > "$LOGS_DIR/redis.log" 2>&1 &
    sleep 1
  elif command -v podman-compose &> /dev/null && [ -f "$PROJECT_DIR/podman-compose.yml" ]; then
    podman-compose -f "$PROJECT_DIR/podman-compose.yml" up -d redis >> "$LOGS_DIR/redis.log" 2>&1 || true
    sleep 2
  fi

  if command -v redis-cli &> /dev/null && redis-cli -u "$REDIS_URL" ping &> /dev/null; then
    echo -e "  ${GREEN}✓${NC} Redis 已就绪"
  else
    echo -e "  ${RED}✗${NC} Redis 启动失败，请先启动 Redis 后重试"
    exit 1
  fi
fi

echo ""

###############################################################################
# 步骤 4: 检查环境配置
###############################################################################
echo -e "${YELLOW}[4/10] 检查环境配置...${NC}"

cd "$PROJECT_DIR"

if [ ! -f ".env" ]; then
  echo -e "  ${RED}✗${NC} .env 文件不存在"
  if [ -f ".env.example" ]; then
    echo -e "  ${YELLOW}复制 .env.example 到 .env...${NC}"
    cp .env.example .env
    echo -e "  ${YELLOW}!${NC} 请配置 .env 文件后重新运行"
    exit 1
  else
    echo -e "  ${RED}✗${NC} 请创建 .env 文件"
    exit 1
  fi
fi

echo -e "  ${GREEN}✓${NC} .env 文件存在"

# 检查必要的环境变量
if grep -q "DATABASE_URL" .env && grep -q "NEXTAUTH_SECRET" .env; then
  echo -e "  ${GREEN}✓${NC} 必要的环境变量已配置"
else
  echo -e "  ${RED}✗${NC} 缺少必要的环境变量"
  exit 1
fi

echo ""

###############################################################################
# 步骤 5: 检查依赖
###############################################################################
echo -e "${YELLOW}[5/10] 检查依赖...${NC}"

if [ ! -d "node_modules" ]; then
  echo -e "  ${YELLOW}node_modules 不存在，安装依赖...${NC}"
  npm install
else
  echo -e "  ${GREEN}✓${NC} node_modules 已存在"
fi

echo ""

###############################################################################
# 步骤 6: 同步预置知识点
###############################################################################
echo -e "${YELLOW}[6/10] 同步预置知识点...${NC}"

npm run seed:knowledge >> "$LOGS_DIR/database.log" 2>&1
echo -e "  ${GREEN}✓${NC} 知识点同步完成"

echo ""

###############################################################################
# 步骤 7: 同步固定测试账号口令
###############################################################################
echo -e "${YELLOW}[7/10] 同步固定测试账号口令...${NC}"

npm run seed:fixed-passwords >> "$LOGS_DIR/database.log" 2>&1
echo -e "  ${GREEN}✓${NC} 固定测试账号口令同步完成"

echo ""

###############################################################################
# 步骤 8: 初始化 scheduler
###############################################################################
echo -e "${YELLOW}[8/10] 初始化 scheduler...${NC}"

if [ -f "$PIDS_DIR/scheduler.pid" ]; then
  OLD_PID=$(cat "$PIDS_DIR/scheduler.pid")
  if ps -p "$OLD_PID" > /dev/null 2>&1; then
    kill "$OLD_PID" 2>/dev/null || true
    sleep 1
  fi
  rm -f "$PIDS_DIR/scheduler.pid"
fi

echo -e "  ${BLUE}启动命令: npm run worker:scheduler${NC}"
nohup npm run worker:scheduler > "$LOGS_DIR/scheduler.log" 2>> "$LOGS_DIR/error.log" &
SCHEDULER_PID=$!
echo "$SCHEDULER_PID" > "$PIDS_DIR/scheduler.pid"
echo -e "  ${GREEN}✓${NC} scheduler 已触发 (PID: $SCHEDULER_PID)"

echo ""

###############################################################################
# 步骤 9: 启动数据治理 worker
###############################################################################
echo -e "${YELLOW}[9/10] 启动数据治理 worker...${NC}"

if [ -f "$PIDS_DIR/worker.pid" ]; then
  OLD_PID=$(cat "$PIDS_DIR/worker.pid")
  if ps -p "$OLD_PID" > /dev/null 2>&1; then
    echo -e "  ${YELLOW}!${NC} 发现已运行的 worker (PID: $OLD_PID)"
    kill "$OLD_PID" 2>/dev/null || true
    sleep 1
    if ps -p "$OLD_PID" > /dev/null 2>&1; then
      kill -9 "$OLD_PID" 2>/dev/null || true
    fi
  fi
  rm -f "$PIDS_DIR/worker.pid"
fi

echo -e "  ${BLUE}启动命令: npm run worker:dev${NC}"
nohup npm run worker:dev > "$LOGS_DIR/worker.log" 2>> "$LOGS_DIR/error.log" &
WORKER_PID=$!
echo "$WORKER_PID" > "$PIDS_DIR/worker.pid"
sleep 1

if ps -p "$WORKER_PID" > /dev/null 2>&1; then
  echo -e "  ${GREEN}✓${NC} 数据治理 worker 已启动 (PID: $WORKER_PID)"
else
  echo -e "  ${RED}✗${NC} 数据治理 worker 启动失败"
  echo -e "  ${YELLOW}查看日志: tail -f $LOGS_DIR/worker.log${NC}"
  exit 1
fi

echo ""

###############################################################################
# 步骤 10: 启动 Next.js 开发服务器
###############################################################################
echo -e "${YELLOW}[10/10] 启动 Next.js 开发服务器...${NC}"

# 检查是否已有进程在运行
if [ -f "$PIDS_DIR/frontend.pid" ]; then
  OLD_PID=$(cat "$PIDS_DIR/frontend.pid")
  if ps -p "$OLD_PID" > /dev/null 2>&1; then
    echo -e "  ${YELLOW}!${NC} 发现已运行的进程 (PID: $OLD_PID)"
    echo -e "  ${YELLOW}正在停止旧进程...${NC}"
    kill_pid_tree "$OLD_PID"
  fi
  rm -f "$PIDS_DIR/frontend.pid"
fi

free_frontend_port "$FRONTEND_PORT"

# 启动开发服务器（后台运行）
echo -e "  ${BLUE}启动命令: npm run dev -- --hostname 127.0.0.1 --port ${FRONTEND_PORT}${NC}"
nohup npm run dev -- --hostname 127.0.0.1 --port "$FRONTEND_PORT" < /dev/null > "$LOGS_DIR/frontend.log" 2> "$LOGS_DIR/error.log" &
FRONTEND_PID=$!
echo "$FRONTEND_PID" > "$PIDS_DIR/frontend.pid"

echo -e "  ${GREEN}✓${NC} Next.js 开发服务器已启动 (PID: $FRONTEND_PID)"
echo -e "  ${BLUE}日志位置: $LOGS_DIR/frontend.log${NC}"

# 等待服务器启动
echo -e "\n  ${YELLOW}等待服务器启动...${NC}"
sleep 1

# 检查进程是否还在运行
if ps -p "$FRONTEND_PID" > /dev/null 2>&1; then
  echo -e "  ${GREEN}✓${NC} 服务器正在运行"
else
  echo -e "  ${RED}✗${NC} 服务器启动失败"
  echo -e "  ${YELLOW}查看错误日志: tail -f $LOGS_DIR/error.log${NC}"
  exit 1
fi

wait_for_page() {
  local label=$1
  local url=$2
  local marker=$3
  local attempts=${4:-40}
  local interval=${5:-1}
  local body=""

  echo -e "  ${YELLOW}等待 $label 页面就绪...${NC}"

  for ((i=1; i<=attempts; i++)); do
    if ! ps -p "$FRONTEND_PID" > /dev/null 2>&1; then
      echo -e "  ${RED}✗${NC} Next.js 进程提前退出"
      echo -e "  ${YELLOW}查看错误日志: tail -f $LOGS_DIR/error.log${NC}"
      exit 1
    fi

    body=$(curl -fsS "$url" 2>/dev/null || true)
    if [[ -n "$body" && "$body" == *"$marker"* ]]; then
      echo -e "  ${GREEN}✓${NC} $label 页面已就绪"
      return 0
    fi
    sleep "$interval"
  done

  echo -e "  ${RED}✗${NC} $label 页面未在预期时间内就绪"
  echo -e "  ${YELLOW}目标地址: $url${NC}"
  echo -e "  ${YELLOW}目标标记: $marker${NC}"
  echo -e "  ${YELLOW}查看错误日志: tail -f $LOGS_DIR/error.log${NC}"
  exit 1
}

wait_for_page "登录" "http://127.0.0.1:${FRONTEND_PORT}/login" "账号登录"
wait_for_page "互动课程入口" "http://127.0.0.1:${FRONTEND_PORT}/interactive-learning/courses/l2d-three-domain-linkage-practice" "输入课堂码加入课堂"

LISTEN_PID=$(lsof -tiTCP:"$FRONTEND_PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)
if [ -n "$LISTEN_PID" ]; then
  echo "$LISTEN_PID" > "$PIDS_DIR/frontend.pid"
  echo -e "  ${GREEN}✓${NC} 已记录前端监听进程 PID: $LISTEN_PID"
fi

###############################################################################
# 启动完成
###############################################################################
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  启动完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "  ${BLUE}访问地址:${NC}"
echo -e "    • 前端: ${GREEN}http://localhost:${FRONTEND_PORT}${NC}"
echo ""
echo -e "  ${BLUE}日志位置:${NC}"
echo -e "    • 前端日志: ${YELLOW}$LOGS_DIR/frontend.log${NC}"
echo -e "    • Redis 日志: ${YELLOW}$LOGS_DIR/redis.log${NC}"
echo -e "    • Worker 日志: ${YELLOW}$LOGS_DIR/worker.log${NC}"
echo -e "    • Scheduler 日志: ${YELLOW}$LOGS_DIR/scheduler.log${NC}"
echo -e "    • 错误日志: ${YELLOW}$LOGS_DIR/error.log${NC}"
echo ""
echo -e "  ${BLUE}查看日志:${NC}"
echo -e "    ${YELLOW}tail -f $LOGS_DIR/frontend.log${NC}"
echo ""
echo -e "  ${BLUE}停止服务:${NC}"
echo -e "    ${YELLOW}./scripts/ops/stop.sh${NC}"
echo ""
