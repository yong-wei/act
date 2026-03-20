# Claude-mem 修复技能开发计划

## 背景与目标

基于本次修复经历，创建一个可复用的 skill，用于自动诊断和修复 claude-mem 常见问题：
- OpenRouter 模型限速/失效
- Chroma 向量数据库未运行
- Worker 服务异常

## 技能架构设计

### 1. 技能存放位置
```
/Users/YW/.claude/plugins/cache/thedotmack/claude-mem/10.2.3/skills/repair/
├── SKILL.md              # 技能主定义
├── repair.sh             # 修复脚本（Bash）
└── models.json           # 可用免费模型列表缓存
```

### 2. 核心功能模块

#### 模块 A: 诊断检测 (Diagnose)
- 读取 `~/.claude-mem/settings.json` 获取当前配置
- 检查 Worker 进程是否在运行 (端口 37777)
- 检查 Chroma 进程是否在运行 (端口 8000)
- 测试当前模型 API 可用性
- 返回诊断报告

#### 模块 B: 模型管理 (Model Manager)
- 从 OpenRouter API 获取最新免费模型列表
- 按优先级排序：Nvidia Nemotron > MiniMax > StepFun > Qwen > 其他
- 测试模型可用性（排除被限速的）
- 更新 settings.json 中的模型配置

#### 模块 C: 服务管理 (Service Manager)
- 停止现有 Worker 进程
- 启动新 Worker (bun worker-service.cjs)
- 启动 Chroma (chroma run)
- 等待服务就绪

#### 模块 D: 健康验证 (Health Check)
- 验证 Worker 端口监听
- 验证 Chroma 端口监听
- 测试搜索 API
- 测试向量存储 API

### 3. 修复脚本 (repair.sh) 设计

```bash
#!/bin/bash
# claude-mem repair script

# 配置
SETTINGS_FILE="$HOME/.claude-mem/settings.json"
WORKER_PORT=37777
CHROMA_PORT=8000
OPENROUTER_API_KEY=$(jq -r '.CLAUDE_MEM_OPENROUTER_API_KEY' "$SETTINGS_FILE")

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 功能函数
log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

check_worker() { lsof -Pi :$WORKER_PORT -sTCP:LISTEN >/dev/null 2>&1; }
check_chroma() { curl -s "http://127.0.0.1:$CHROMA_PORT/api/v2/tenants/default_tenant/databases/default_database/collections" >/dev/null 2>&1; }
test_model() { ... }
get_free_models() { ... }
update_model_config() { ... }
restart_services() { ... }

# 主流程
main() {
    log_info "开始 claude-mem 诊断..."

    # 1. 诊断
    local worker_ok=$(check_worker && echo "yes" || echo "no")
    local chroma_ok=$(check_chroma && echo "yes" || echo "no")
    local current_model=$(jq -r '.CLAUDE_MEM_MODEL' "$SETTINGS_FILE")
    local model_ok=$(test_model "$current_model" && echo "yes" || echo "no")

    # 2. 修复模型
    if [[ "$model_ok" == "no" ]]; then
        log_warn "当前模型 $current_model 不可用，寻找替代模型..."
        local new_model=$(get_working_model)
        update_model_config "$new_model"
    fi

    # 3. 重启服务
    if [[ "$worker_ok" == "no" ]] || [[ "$chroma_ok" == "no" ]]; then
        restart_services
    fi

    # 4. 验证
    verify_health
}
```

### 4. Skill.md 设计

```yaml
---
name: claude-mem-repair
description: Diagnose and repair claude-mem issues including rate-limited models, stopped Chroma DB, and worker service failures.
triggers:
  - "claude-mem 坏了"
  - "修复 claude-mem"
  - "memory 搜索不能用"
  - "rate limited"
  - "chroma not running"
---

# Claude-mem Repair Skill

## When to Use

- 用户报告 memory 搜索功能异常
- OpenRouter 模型被限速 (HTTP 429)
- Chroma 向量数据库未运行
- Worker 服务进程异常

## Repair Workflow

### Step 1: Diagnose
使用 repair.sh 脚本或手动检查：
1. 检查 Worker 进程: `lsof -Pi :37777`
2. 检查 Chroma 进程: `lsof -Pi :8000`
3. 测试当前模型: `curl -H "Authorization: Bearer $KEY" https://openrouter.ai/api/v1/models`

### Step 2: Fix Model (if rate-limited)
调用 `repair.sh --fix-model` 自动：
1. 获取可用免费模型列表
2. 按优先级选择新模型
3. 更新 settings.json

### Step 3: Restart Services (if needed)
调用 `repair.sh --restart-services`：
1. 停止旧 Worker 进程
2. 启动新 Worker
3. 启动 Chroma (如配置为本地模式)

### Step 4: Verify
调用 `repair.sh --verify`：
1. 检查端口监听
2. 测试 API 响应

## Available Free Models (优先级排序)

1. `nvidia/nemotron-3-super-120b-a12b:free` - 首选
2. `nvidia/nemotron-3-nano-30b-a3b:free` - 备用
3. `minimax/minimax-m2.5:free`
4. `stepfun/step-3.5-flash:free`
5. `arcee-ai/trinity-large-preview:free`
6. `qwen/qwen3-next-80b-a3b-instruct:free`

## Manual Commands

```bash
# 查看当前配置
cat ~/.claude-mem/settings.json | jq '.CLAUDE_MEM_MODEL, .CLAUDE_MEM_CHROMA_MODE'

# 测试模型可用性
curl -s -H "Authorization: Bearer $API_KEY" \
  https://openrouter.ai/api/v1/chat/completions \
  -d '{"model":"MODEL_ID","messages":[{"role":"user","content":"hi"}]}'

# 重启 Worker
kill $(lsof -t -i:37777) 2>/dev/null
bun ~/.claude/plugins/cache/thedotmack/claude-mem/10.2.3/scripts/worker-service.cjs &

# 启动 Chroma
chroma run --host 127.0.0.1 --port 8000 &
```
```

## 实施步骤

1. 创建技能目录结构
2. 编写 repair.sh 脚本
3. 编写 SKILL.md 文档
4. 测试脚本功能
5. 创建全局 skill 软链接

## 关键文件路径

| 文件 | 路径 |
|------|------|
| settings.json | `~/.claude-mem/settings.json` |
| Worker 脚本 | `~/.claude/plugins/cache/thedotmack/claude-mem/10.2.3/scripts/worker-service.cjs` |
| Worker 日志 | `~/.claude-mem/worker.log` |
| 技能目录 | `~/.claude/plugins/cache/thedotmack/claude-mem/10.2.3/skills/repair/` |

## 验证方法

1. 脚本可执行: `chmod +x repair.sh && ./repair.sh --help`
2. 诊断功能: `./repair.sh --diagnose`
3. 完整修复: `./repair.sh --full`
4. 验证服务: `curl http://localhost:37777/health` 和 Chroma API

## 注意事项

- 免费模型有速率限制，可能需要多次尝试
- Chroma 本地模式需要 Python 环境
- Worker 使用 Bun 运行时
- 保持原有配置备份
