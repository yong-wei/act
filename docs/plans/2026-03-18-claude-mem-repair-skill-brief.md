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

脚本包含以下功能：
- 诊断检测
- 模型修复
- 服务重启
- 健康验证

### 4. Skill.md 设计

定义技能触发词、修复工作流程、可用免费模型列表、手动命令参考。

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
