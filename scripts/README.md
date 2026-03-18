# 脚本使用说明

## 📋 目录

- [目录结构](#目录结构)
- [启动和停止脚本](#启动和停止脚本)
- [数据种子脚本](#数据种子脚本)
- [测试脚本](#测试脚本)
- [日志管理](#日志管理)

## 🗂️ 目录结构

脚本按职责分层，避免所有文件堆在 `scripts/` 根目录：

```text
scripts/
├── analysis/   # 分析与诊断脚本
├── db/         # 数据迁移、种子与数据修复脚本
├── ops/        # 启停、日志、运维辅助脚本
├── tests/      # 各类测试与校验脚本
├── build.sh    # 统一镜像构建入口
└── README.md
```

## 🚀 启动和停止脚本

### 启动服务

使用以下任一方式启动完整服务：

```bash
# 方式 1: 直接运行脚本
./scripts/ops/start.sh

# 方式 2: 使用 npm 命令
npm run startup
```

**启动脚本会自动执行：**

1. ✅ 清理日志文件内容（保留文件）
2. ✅ 检查 PostgreSQL 数据库是否运行
3. ✅ 检查 Redis 是否运行，必要时尝试本地拉起
4. ✅ 检查环境配置（.env）
5. ✅ 检查依赖（node_modules）
6. ✅ 执行 `npm run seed:knowledge`
7. ✅ 执行 `npm run seed:fixed-passwords`
8. ✅ 执行 `npm run worker:scheduler` 初始化周期任务
9. ✅ 启动 `npm run worker:dev` 数据治理 worker
10. ✅ 启动 Next.js 开发服务器（后台运行）并记录 PID 到 `.logs/pids/`

### 停止服务

使用以下任一方式停止所有服务：

```bash
# 方式 1: 直接运行脚本
./scripts/ops/stop.sh

# 方式 2: 使用 npm 命令
npm run shutdown
```

**停止脚本会自动执行：**

1. ✅ 优雅停止数据治理 worker、scheduler、Next.js 与本地 Redis（若由脚本拉起）
2. ✅ 清理占用 3001 端口的进程
3. ✅ 清理所有 Next.js 相关进程
4. ✅ 删除 PID 文件
5. ✅ 如果优雅停止失败，强制终止（SIGKILL）

### 仅启动开发服务器

如果只需要启动开发服务器（前台运行）：

```bash
npm run dev
```

## 📊 数据种子脚本

### 填充任务数据

导入 7 个学习任务到数据库：

```bash
# 首次导入
node scripts/db/seed-missions.mjs

# 或使用 npm 命令
npm run seed:missions

# 强制覆盖现有数据
node scripts/db/seed-missions.mjs --force
```

**任务列表：**
1. 初识航向控制（EASY）
2. P控制器入门（EASY）
3. PD控制器进阶（MEDIUM）
4. PID控制器精通（MEDIUM）
5. 海况挑战：中浪（HARD）
6. 海况挑战：大浪（HARD）
7. 综合评估：专家认证（EXPERT）

### 创建演示用户

创建测试账号：

```bash
npm run seed:demo
```

**演示账号信息：**
- 账号: `demo`
- 密码: `DemoStudent@Just2026!`
- 角色: STUDENT

## 🧪 测试脚本

### 冒烟测试

快速验证系统是否正常：

```bash
npm test
```

### 集成测试

运行 Playwright 端到端测试：

```bash
npm run test:integration
```

## 📝 日志管理

### 日志位置

所有日志存储在 `.logs/` 目录：

```
.logs/
├── frontend.log      # Next.js 前端日志
├── backend.log       # 后端 API 日志
├── database.log      # 数据库日志
├── redis.log         # Redis 启动日志
├── worker.log        # 数据治理 worker 日志
├── scheduler.log     # 周期任务初始化日志
├── console.log       # 控制台输出
├── error.log         # 错误日志
└── pids/            # 进程 PID 文件
    ├── frontend.pid
    ├── worker.pid
    ├── scheduler.pid
    └── redis.pid
```

### 查看日志

实时查看日志：

```bash
# 查看前端日志
npm run logs

# 或直接使用 tail
tail -f .logs/frontend.log

# 查看错误日志
npm run logs:error

# 或直接使用 tail
tail -f .logs/error.log
```

### 清理日志

启动脚本会自动清空日志内容（不删除文件）。

手动清理：

```bash
node scripts/ops/clear-logs.mjs
```

## 🔧 故障排查

### 服务无法启动

1. **检查端口占用：**
   ```bash
   lsof -ti:3001
   ```

2. **查看错误日志：**
   ```bash
   cat .logs/error.log
   ```

3. **清理进程并重启：**
   ```bash
   ./scripts/ops/stop.sh
   ./scripts/ops/start.sh
   ```

### PostgreSQL 连接失败

1. **检查数据库状态：**
   ```bash
   pg_isready -h localhost -p 5432
   ```

2. **启动 PostgreSQL：**
   ```bash
   # macOS (Homebrew)
   brew services start postgresql@14

   # Linux
   sudo systemctl start postgresql
   ```

3. **验证环境配置：**
   ```bash
   grep DATABASE_URL .env
   ```

### 进程遗留问题

如果停止脚本无法清理所有进程：

```bash
# 查看所有相关进程
ps aux | grep -E 'next|node'

# 手动终止进程
kill -9 <PID>

# 或使用 pkill
pkill -f "next dev"
```

## 📚 常用命令速查

| 命令 | 功能 |
|------|------|
| `npm run startup` | 启动完整服务 |
| `npm run shutdown` | 停止所有服务 |
| `npm run dev` | 前台启动开发服务器 |
| `npm run worker:dev` | 单独启动数据治理 worker |
| `npm run worker:scheduler` | 单次初始化 BullMQ 周期任务 |
| `npm run build` | 构建生产版本 |
| `npm run lint` | 代码检查 |
| `npm test` | 冒烟测试 |
| `npm run seed:missions` | 填充任务数据 |
| `npm run seed:demo` | 创建演示账号 |
| `npm run logs` | 查看前端日志 |
| `npm run logs:error` | 查看错误日志 |

## 🎯 开发工作流

### 日常开发

```bash
# 1. 启动服务
npm run startup

# 2. 开发调试（浏览器访问 http://localhost:3001）

# 3. 查看日志（另一个终端）
npm run logs

# 4. 停止服务
npm run shutdown
```

### 测试流程

```bash
# 1. 停止现有服务
npm run shutdown

# 2. 运行测试
npm test

# 3. 运行集成测试
npm run test:integration

# 4. 重新启动
npm run startup
```

### 数据重置

```bash
# 1. 停止服务
npm run shutdown

# 2. 重置数据库
npx prisma db push --force-reset

# 3. 填充数据
npm run seed:missions
npm run seed:demo

# 4. 重新启动
npm run startup
```

## 📖 相关文档

- [开发计划](../docs/Developmant.md)
- [项目说明](../CLAUDE.md)
- [Prisma 文档](https://www.prisma.io/docs)
- [Next.js 文档](https://nextjs.org/docs)
