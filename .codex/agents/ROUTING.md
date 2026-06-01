# 子代理路由规则

## 授权原则

不得仅因 `.codex/agents/` 存在就启动子代理。只有用户明确授权当前任务、会话、分支或 review 使用子代理后，主代理才可按需调度。

有效授权包括：

- “按需使用子代理”
- “本任务允许使用子代理”
- “本会话允许你自主调度子代理”
- “spawn appropriate agents”
- “run the multi-agent workflow”

用户明确禁止时不得调用。授权含糊时，默认单代理执行；只有子代理是完成任务的必要条件时，才询问是否授权。

## 通用规则

1. 先写短任务 brief：目标、范围、可能涉及文件、验证命令和停止条件。
2. 使用最小有用代理集。普通任务 1-3 个，完整 PR/分支/架构/发布 review 才使用 4-6 个。
3. `agents.max_depth = 1`，子代理不得继续启动子代理。
4. 只读代理不得编辑文件；实现代理必须保持最小改动并报告全部修改文件。
5. 主代理负责最终判断。子代理输出是证据，不是权威。
6. 不机械合并冲突意见；必须说明取舍。
7. 声称完成前必须验证。验证无法运行时，说明原因和未验证事项。

## 基础路由

- 理解代码路径：`code-mapper`。
- 搜索、读扫、大文件摘要：`explorer-librarian`。
- 非平凡功能、重构、迁移计划：`code-mapper` + `spec-planner`。
- 范围清晰的实现：`patch-worker`；简单局部修补可用 `spark-coder`。
- 已知 bug：先 `code-mapper` + `test-engineer`，再 `patch-worker` 做最小修复；共享行为变更后用 `critical-reviewer`。
- 普通 review：`critical-reviewer`；按变更范围增加专门审查代理。

## 专门审查触发

- 认证、权限、密钥、shell/file/tool 执行、用户数据：`security-reviewer`。
- Prisma、数据库、高频 API、轮询、WebSocket、缓存、渲染性能：`performance-reviewer`。
- 页面、仪表盘、路由、交互、响应式布局、状态流：`ui-flow-reviewer`。
- 学习事件、学生画像、分析、推荐、教师/学生看板：`data-governance-reviewer`。
- 控制理论、仿真、Arena、虚拟实验、数值模型：`simulation-domain-reviewer`。
- 部署、迁移、环境变量、生产配置、发布说明：`release-sentinel`。
- 重复失败、代理输出矛盾、补丁反复出错：`retro-analyst`。

## 标准组合

### 只读探索

调用 `code-mapper` 追踪指定主题的真实代码路径，不编辑文件。主代理汇总入口、符号、运行路径和不确定点。

### 计划后实现

先并行调用 `code-mapper` 与 `spec-planner`。主代理合并为有边界计划后，再按需要调用 `patch-worker` 与 `test-engineer`。

### Bug 修复

先调用 `code-mapper` 定位失败路径，并调用 `test-engineer` 找最小复现或现有失败测试。随后由 `patch-worker` 做最小修复，最后运行相关验证。

### PR / 分支 Review

默认调用 `critical-reviewer`、`security-reviewer`、`performance-reviewer`、`test-engineer`。根据变更文件最多再增加两个领域代理：`ui-flow-reviewer`、`data-governance-reviewer`、`simulation-domain-reviewer`、`release-sentinel`。

### 互动课程 / 前端课堂 Review

调用 `ui-flow-reviewer`、`simulation-domain-reviewer`、`data-governance-reviewer`，聚焦学生端正确性、控制理论有效性、事件语义和教师/学生看板后果。

### 发布门禁

调用 `release-sentinel`、`critical-reviewer`、`performance-reviewer`，输出 go/no-go、必须修复项、验证命令、迁移风险和回滚说明。

### 失败复盘

调用 `retro-analyst` 分析最近失败尝试，给出错误假设、缺失验证和最小持久改进位置。

## 汇总输出契约

主代理汇总多代理审查时使用以下结构：

1. Decision：`pass`、`pass with fixes` 或 `block`。
2. Blocking issues：具体文件/符号、影响、复现或验证路径。
3. Non-blocking risks：真实但不阻断的问题。
4. Suggestions：有价值但可选的改进。
5. Validation run：已运行命令和结果。
6. Unverified assumptions：未检查事项。
7. Next action：最小下一步。

## 反模式

- 为琐碎编辑启动多个代理。
- 让每个代理都解决完整任务。
- 让审查代理写代码。
- 局部补丁足够时接受大范围重写。
- 把测试通过当作业务语义、数据语义或控制理论正确性的充分证明。
- 继续启动更多代理来回避主代理判断。
