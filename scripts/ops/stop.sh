#!/bin/bash
###############################################################################
# AI-OBE 平台停止脚本
# 功能：
#   - 停止所有运行中的服务
#   - 清理 PID 文件
#   - 确保没有遗留进程
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

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  AI-OBE 船舶智控平台 - 停止脚本${NC}"
echo -e "${BLUE}========================================${NC}\n"

# 计数器
STOPPED_COUNT=0
FAILED_COUNT=0

###############################################################################
# 函数: 停止进程
###############################################################################
stop_process() {
  local service_name=$1
  local pid_file=$2

  echo -e "${YELLOW}停止 $service_name...${NC}"

  if [ ! -f "$pid_file" ]; then
    echo -e "  ${YELLOW}!${NC} PID 文件不存在，跳过"
    return 0
  fi

  PID=$(cat "$pid_file")

  # 检查进程是否存在
  if ! ps -p "$PID" > /dev/null 2>&1; then
    echo -e "  ${YELLOW}!${NC} 进程不存在 (PID: $PID)"
    rm -f "$pid_file"
    return 0
  fi

  # 尝试优雅停止（SIGTERM）
  echo -e "  ${BLUE}发送 SIGTERM 信号到进程 $PID...${NC}"
  kill "$PID" 2>/dev/null || true

  # 等待进程结束（最多 5 秒）
  local count=0
  while ps -p "$PID" > /dev/null 2>&1; do
    if [ $count -ge 5 ]; then
      echo -e "  ${YELLOW}!${NC} 进程未响应，强制终止..."
      kill -9 "$PID" 2>/dev/null || true
      sleep 1
      break
    fi
    sleep 1
    count=$((count + 1))
  done

  # 验证进程已停止
  if ps -p "$PID" > /dev/null 2>&1; then
    echo -e "  ${RED}✗${NC} 停止失败 (PID: $PID)"
    FAILED_COUNT=$((FAILED_COUNT + 1))
    return 1
  else
    echo -e "  ${GREEN}✓${NC} 已停止 (PID: $PID)"
    rm -f "$pid_file"
    STOPPED_COUNT=$((STOPPED_COUNT + 1))
    return 0
  fi
}

###############################################################################
# 停止主要后台服务
###############################################################################
stop_process "数据治理 worker" "$PIDS_DIR/worker.pid"
stop_process "scheduler" "$PIDS_DIR/scheduler.pid"
stop_process "Next.js 开发服务器" "$PIDS_DIR/frontend.pid"
stop_process "本地 Redis" "$PIDS_DIR/redis.pid"

###############################################################################
# 停止可能存在的其他相关进程
###############################################################################
echo -e "\n${YELLOW}检查其他相关进程...${NC}"

# 查找占用 3001 端口的进程
PORT_3001_PID=$(lsof -ti:3001 2>/dev/null || true)
if [ -n "$PORT_3001_PID" ]; then
  echo -e "  ${YELLOW}!${NC} 发现占用 3001 端口的进程 (PID: $PORT_3001_PID)"
  kill "$PORT_3001_PID" 2>/dev/null || true
  sleep 1
  if lsof -ti:3001 > /dev/null 2>&1; then
    kill -9 "$PORT_3001_PID" 2>/dev/null || true
    echo -e "  ${GREEN}✓${NC} 已强制终止"
  else
    echo -e "  ${GREEN}✓${NC} 已停止"
  fi
  STOPPED_COUNT=$((STOPPED_COUNT + 1))
fi

# 查找 node 进程中包含 "next dev" 的进程
NEXT_PIDS=$(pgrep -f "next dev" 2>/dev/null || true)
if [ -n "$NEXT_PIDS" ]; then
  echo -e "  ${YELLOW}!${NC} 发现 Next.js 相关进程:"
  echo "$NEXT_PIDS" | while read -r pid; do
    if ps -p "$pid" > /dev/null 2>&1; then
      echo -e "    ${YELLOW}停止 PID: $pid${NC}"
      kill "$pid" 2>/dev/null || true
      sleep 0.5
      if ps -p "$pid" > /dev/null 2>&1; then
        kill -9 "$pid" 2>/dev/null || true
      fi
      STOPPED_COUNT=$((STOPPED_COUNT + 1))
    fi
  done
  echo -e "  ${GREEN}✓${NC} 已清理所有 Next.js 进程"
fi

###############################################################################
# 清理 PID 目录中的所有文件
###############################################################################
echo -e "\n${YELLOW}清理 PID 文件...${NC}"

if [ -d "$PIDS_DIR" ]; then
  PID_FILES=$(find "$PIDS_DIR" -name "*.pid" 2>/dev/null || true)
  if [ -n "$PID_FILES" ]; then
    echo "$PID_FILES" | while read -r pid_file; do
      rm -f "$pid_file"
      echo -e "  ${GREEN}✓${NC} 删除: $(basename "$pid_file")"
    done
  else
    echo -e "  ${YELLOW}!${NC} 没有 PID 文件需要清理"
  fi
else
  echo -e "  ${YELLOW}!${NC} PID 目录不存在"
fi

###############################################################################
# 停止完成
###############################################################################
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  停止完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "  ${BLUE}统计信息:${NC}"
echo -e "    • 停止进程数: ${GREEN}$STOPPED_COUNT${NC}"
if [ $FAILED_COUNT -gt 0 ]; then
  echo -e "    • 停止失败数: ${RED}$FAILED_COUNT${NC}"
fi
echo ""

if [ $FAILED_COUNT -gt 0 ]; then
  echo -e "  ${YELLOW}!${NC} 部分进程可能仍在运行，请手动检查"
  echo -e "    ${YELLOW}查看进程: ps aux | grep -E 'next|node'${NC}"
  exit 1
fi
