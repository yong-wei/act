# AI-OBE 船舶智控平台 - 快速开始指南

## 🚀 快速启动

### 一键启动

```bash
npm run startup
```

访问 http://localhost:3001

### 一键停止

```bash
npm run shutdown
```

## 📋 首次安装步骤

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 到 `.env` 并配置：

```env
# 数据库配置
DATABASE_URL="postgresql://act_user:act_pass@localhost:5432/act_obe?schema=public"

# NextAuth 配置
NEXTAUTH_URL="http://localhost:3001"
NEXTAUTH_SECRET="your-secret-key-here"

# 硅基流动 AI 配置
SILICONFLOW_API_URL="https://api.siliconflow.cn/v1"
SILICONFLOW_API_KEY="sk-your-api-key"
SILICONFLOW_MODEL="deepseek-ai/DeepSeek-V4-Flash"
```

### 3. 创建数据库

```bash
# 连接到 PostgreSQL
psql -U postgres

# 创建用户和数据库
CREATE USER act_user WITH PASSWORD 'act_pass';
CREATE DATABASE act_obe OWNER act_user;

# 授予权限
GRANT ALL PRIVILEGES ON DATABASE act_obe TO act_user;
\c act_obe
GRANT ALL ON SCHEMA public TO act_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO act_user;
```

### 4. 推送数据库架构

```bash
npx prisma db push
```

### 5. 填充初始数据

```bash
# 填充 7 个学习任务
npm run seed:missions

# 创建演示账号（可选）
npm run seed:demo
```

### 6. 启动服务

```bash
npm run startup
```

## 📚 核心功能

### 1. 用户认证

- **注册**: http://localhost:3000/register
- **登录**: http://localhost:3000/login
- **演示账号**: `demo` / `DemoStudent@Just2026!`

### 2. 学生仪表板

- **访问**: http://localhost:3000/dashboard
- 查看学习进度
- 快速进入仿真和任务

### 3. 任务大厅

- **访问**: http://localhost:3000/missions
- 7 个渐进式学习任务
- 完成任务解锁下一关
- 查看学习路径和进度

### 4. 个人中心

- **访问**: http://localhost:3000/profile
- 五维能力雷达图
- 学习统计和最近活动
- 任务完成进度

### 5. 驱逐舰仿真

- **访问**: http://localhost:3000/simulations/destroyer
- 3D 可视化船舶控制
- 支持 4 种控制模式：
  - 手动控制
  - P 控制器
  - PD 控制器
  - PID 控制器
- 伦理熔断系统
- 实时性能监控

### 6. AI 虚拟总工

- **访问**: http://localhost:3000/ai/copilot
- 智能问答系统
- 仿真状态分析
- PID 调参建议
- 参数自动优化

## 🛠️ 开发命令

| 命令 | 说明 |
|------|------|
| `npm run startup` | 启动完整服务（推荐） |
| `npm run shutdown` | 停止所有服务 |
| `npm run dev` | 前台启动开发服务器 |
| `npm run build` | 构建生产版本 |
| `npm run start` | 启动生产服务器 |
| `npm run lint` | 代码检查 |
| `npm test` | 冒烟测试 |
| `npm run test:integration` | 集成测试 |
| `npm run seed:missions` | 填充任务数据 |
| `npm run seed:demo` | 创建演示账号 |
| `npm run logs` | 查看前端日志 |
| `npm run logs:error` | 查看错误日志 |

## 📊 学习任务列表

1. **初识航向控制** (EASY)
   - 手动控制舵角
   - 平静海面 90° 转向
   - 航迹误差 < 500m

2. **P 控制器入门** (EASY)
   - 使用比例控制器
   - 观察 Kp 参数影响
   - 航迹误差 < 300m

3. **PD 控制器进阶** (MEDIUM)
   - 加入微分项
   - 减少超调
   - 航迹误差 < 200m

4. **PID 控制器精通** (MEDIUM)
   - 完整 PID 控制
   - 消除稳态误差
   - 航迹误差 < 100m

5. **海况挑战：中浪** (HARD)
   - 3 级海况
   - 测试鲁棒性
   - 航迹误差 < 150m

6. **海况挑战：大浪** (HARD)
   - 4 级海况
   - 舵角速度 < 5°/s
   - 横摇角度 < 15°

7. **综合评估：专家认证** (EXPERT)
   - 5 级海况
   - 复杂航向变化
   - AI 总工认证

## 🔧 故障排查

### 端口被占用

```bash
# 查看占用进程
lsof -ti:3000

# 使用停止脚本清理
npm run shutdown
```

### 数据库连接失败

```bash
# 检查 PostgreSQL 状态
pg_isready -h localhost -p 5432

# 启动 PostgreSQL (macOS)
brew services start postgresql@14
```

### 查看日志

```bash
# 实时查看前端日志
npm run logs

# 查看错误日志
npm run logs:error

# 或直接查看
tail -f ../.logs/frontend.log
tail -f ../.logs/error.log
```

### 重置数据库

```bash
# 停止服务
npm run shutdown

# 重置数据库
npx prisma db push --force-reset

# 重新填充数据
npm run seed:missions
npm run seed:demo

# 重新启动
npm run startup
```

## 📖 更多文档

- **脚本使用**: [scripts/README.md](scripts/README.md)
- **开发计划**: [docs/Developmant.md](../docs/Developmant.md)
- **项目说明**: [CLAUDE.md](CLAUDE.md)

## 🎯 技术架构

- **前端**: Next.js 14 + TypeScript + Tailwind CSS
- **3D 渲染**: React Three Fiber + Three.js
- **图表**: Recharts
- **UI 组件**: shadcn/ui + Radix UI
- **认证**: NextAuth.js
- **数据库**: PostgreSQL + Prisma ORM
- **AI**: 硅基流动 API + Qwen 模型

## 💡 常见问题

### Q: 如何修改 AI 模型？

编辑 `src/lib/ai-client.ts`，修改 `modelId` 参数。

### Q: 如何添加新任务？

运行 `scripts/db/seed-missions.mjs`，或手动在数据库中添加。

### Q: 如何查看数据库内容？

```bash
npx prisma studio
```

### Q: 如何部署到生产环境？

```bash
npm run build
npm run start
```

## 📞 支持

- **问题反馈**: [GitHub Issues](https://github.com/yong-wei/act/issues)
- **开发文档**: [CLAUDE.md](CLAUDE.md)
- **脚本文档**: [scripts/README.md](scripts/README.md)
