#!/bin/bash
###############################################################################
# AI-OBE 平台启动脚本
# 功能：
#   - 清理日志文件内容（保留文件）
#   - 检查并启动必要的服务（PostgreSQL）
#   - 启动 Next.js 开发服务器
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
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOGS_DIR="$(dirname "$PROJECT_DIR")/.logs"
PIDS_DIR="$LOGS_DIR/pids"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  AI-OBE 船舶智控平台 - 启动脚本${NC}"
echo -e "${BLUE}========================================${NC}\n"

###############################################################################
# 步骤 1: 清理日志文件内容
###############################################################################
echo -e "${YELLOW}[1/5] 清理日志文件...${NC}"

# 确保目录存在
mkdir -p "$LOGS_DIR"
mkdir -p "$PIDS_DIR"

# 清空日志文件内容（不删除文件）
LOG_FILES=(
  "$LOGS_DIR/frontend.log"
  "$LOGS_DIR/backend.log"
  "$LOGS_DIR/database.log"
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
echo -e "${YELLOW}[2/5] 检查 PostgreSQL 数据库...${NC}"

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
# 步骤 3: 检查环境配置
###############################################################################
echo -e "${YELLOW}[3/5] 检查环境配置...${NC}"

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
# 步骤 4: 检查依赖
###############################################################################
echo -e "${YELLOW}[4/5] 检查依赖...${NC}"

if [ ! -d "node_modules" ]; then
  echo -e "  ${YELLOW}node_modules 不存在，安装依赖...${NC}"
  npm install
else
  echo -e "  ${GREEN}✓${NC} node_modules 已存在"
fi

echo ""

###############################################################################
# 步骤 5: 启动 Next.js 开发服务器
###############################################################################
echo -e "${YELLOW}[5/5] 启动 Next.js 开发服务器...${NC}"

# 检查是否已有进程在运行
if [ -f "$PIDS_DIR/frontend.pid" ]; then
  OLD_PID=$(cat "$PIDS_DIR/frontend.pid")
  if ps -p "$OLD_PID" > /dev/null 2>&1; then
    echo -e "  ${YELLOW}!${NC} 发现已运行的进程 (PID: $OLD_PID)"
    echo -e "  ${YELLOW}正在停止旧进程...${NC}"
    kill "$OLD_PID" 2>/dev/null || true
    sleep 1
    if ps -p "$OLD_PID" > /dev/null 2>&1; then
      kill -9 "$OLD_PID" 2>/dev/null || true
    fi
  fi
  rm -f "$PIDS_DIR/frontend.pid"
fi

# 启动开发服务器（后台运行）
echo -e "  ${BLUE}启动命令: npm run dev${NC}"
nohup npm run dev > "$LOGS_DIR/frontend.log" 2> "$LOGS_DIR/error.log" &
FRONTEND_PID=$!
echo "$FRONTEND_PID" > "$PIDS_DIR/frontend.pid"

echo -e "  ${GREEN}✓${NC} Next.js 开发服务器已启动 (PID: $FRONTEND_PID)"
echo -e "  ${BLUE}日志位置: $LOGS_DIR/frontend.log${NC}"

# 等待服务器启动
echo -e "\n  ${YELLOW}等待服务器启动...${NC}"
sleep 3

# 检查进程是否还在运行
if ps -p "$FRONTEND_PID" > /dev/null 2>&1; then
  echo -e "  ${GREEN}✓${NC} 服务器正在运行"
else
  echo -e "  ${RED}✗${NC} 服务器启动失败"
  echo -e "  ${YELLOW}查看错误日志: tail -f $LOGS_DIR/error.log${NC}"
  exit 1
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
echo -e "    • 前端: ${GREEN}http://localhost:3000${NC}"
echo ""
echo -e "  ${BLUE}日志位置:${NC}"
echo -e "    • 前端日志: ${YELLOW}$LOGS_DIR/frontend.log${NC}"
echo -e "    • 错误日志: ${YELLOW}$LOGS_DIR/error.log${NC}"
echo ""
echo -e "  ${BLUE}查看日志:${NC}"
echo -e "    ${YELLOW}tail -f $LOGS_DIR/frontend.log${NC}"
echo ""
echo -e "  ${BLUE}停止服务:${NC}"
echo -e "    ${YELLOW}./scripts/stop.sh${NC}"
echo ""
