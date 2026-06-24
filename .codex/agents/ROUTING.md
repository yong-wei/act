# Codex 子代理路由规则

## 授权原则

不得仅因 `.codex/agents/` 存在就启动子代理。只有用户明确授权当前任务、会话、分支或 review 使用子代理后，主线程才可按需调度。

有效授权包括：

- “按需使用子代理”
- “本任务允许使用子代理”
- “本会话允许你自主调度子代理”
- “spawn appropriate agents”
- “run the multi-agent workflow”

用户明确禁止时不得调用。授权含糊时，默认单代理执行；只有子代理是完成任务的必要条件时，才询问是否授权。

## 通用规则

1. 派发前先写任务 brief：目标、范围内/外、可能涉及文件、允许权限、禁止事项、输出格式、验证命令和停止条件。
2. 使用最小充分代理集。普通任务 0-2 个，非平凡功能、重构或 bug 修复 2-4 个，完整 PR/分支/架构/发布 review 才使用 4-6 个。
3. `agents.max_depth = 1`，子代理不得继续启动子代理。
4. 读代理可以并行，写代理原则上串行。不得让两个 `workspace-write` 代理同时修改同一工作树。
5. 只读代理不得编辑文件；实现代理必须保持最小改动并报告全部修改文件。
6. 主线程负责最终判断。子代理输出是证据，不是权威。
7. 不机械合并冲突意见；必须说明取舍。
8. 声称完成前必须验证。验证无法运行时，说明原因和未验证事项。
9. `critical-reviewer` 的 `xhigh` 只用于高风险终审、发布门禁、架构回归和用户明确要求的严格审查。

## 是否先调用 agent-router

只有以下情况优先调用 `agent-router`：

- 任务跨两个以上领域，主线程不确定代理组合。
- 可能需要 3 个以上子代理。
- 任务涉及完整分支、PR、发布、架构 review 或复杂迁移。
- 用户明确要求“让子代理选择子代理”或“先拆分代理任务”。

以下情况不要调用 `agent-router`：

- 单文件小改动。
- 明确 bug 路径和验证命令已经给出。
- 只需读一个文档或改一段文案。
- 主线程已经能确定最小代理集。

## 风险驱动路由表

| 任务类型 | 默认处理 | 可选升级 |
| --- | --- | --- |
| 小文案、单文件局部配置、无风险文档 | 主线程或 `spark-coder` | 不调用 reviewer，除非影响 AGENTS/配置 |
| 路径不清、调用链不清 | `code-mapper` | 大文件材料加 `explorer-librarian` |
| 非平凡功能/重构/迁移 | `agent-router` → `code-mapper` + `spec-planner` | 计划通过后再 `patch-worker` |
| 已知 bug | `code-mapper` + `test-engineer` → `patch-worker` | 修复后 `critical-reviewer` 或对应领域 reviewer |
| 精品互动课/课程 runtime | `course-pedagogy-reviewer` + `ui-flow-reviewer` | 涉控制内容加 `simulation-domain-reviewer`，涉事件加 `data-governance-reviewer` |
| 仿真 / Rust/WASM / Arena | `simulation-domain-reviewer` + `test-engineer` | 涉榜单/学习事实加 `data-governance-reviewer` |
| AI 上下文 / 伴学 / 模型配置 | `ai-context-reviewer` | 涉学生画像加 `data-governance-reviewer`，涉密钥加 `security-reviewer` |
| 认证/权限/密钥/API 安全 | `security-reviewer` | 高风险加 `critical-reviewer` |
| Prisma/schema/backfill/画像 | `data-governance-reviewer` + `test-engineer` | 生产迁移加 `release-sentinel` |
| 高频 API/轮询/渲染/队列 | `performance-reviewer` | 涉生产加 `release-sentinel` |
| 发布/部署/远端环境 | `release-sentinel` | 重大发布加 `critical-reviewer` + `performance-reviewer` |
| 反复失败/代理冲突/流程缺口 | `retro-analyst` | 需要改规则时由主线程或 `patch-worker` 修改文档 |

## 标准组合

### 只读探索

调用 `code-mapper` 追踪指定主题的真实代码路径。必要时并行调用 `explorer-librarian` 整理长文档或支持材料。主线程汇总入口、符号、运行路径和不确定点。

### 计划后实现

先并行调用 `code-mapper` 与 `spec-planner`。主线程合并为有边界计划后，再串行调用 `patch-worker` 与 `test-engineer`。

### Bug 修复

先调用 `code-mapper` 定位失败路径，并调用 `test-engineer` 找最小复现或现有失败测试。随后由 `patch-worker` 做最小修复，最后运行相关验证。共享行为变更后调用 `critical-reviewer` 或对应专门审查代理。

### 精品互动课程 Review

默认调用 `course-pedagogy-reviewer`、`ui-flow-reviewer`。若涉及控制理论、仿真、Arena 或自动控制解释，增加 `simulation-domain-reviewer`。若涉及课堂事件、画像或看板，增加 `data-governance-reviewer`。

### AI 能力 Review

默认调用 `ai-context-reviewer`。若涉及学生画像、推荐或事实物化，增加 `data-governance-reviewer`。若涉及 provider、密钥、权限或文件/工具调用，增加 `security-reviewer`。

### PR / 分支 Review

默认调用 `critical-reviewer`、`test-engineer`。根据变更范围增加专门审查代理：`security-reviewer`、`performance-reviewer`、`ui-flow-reviewer`、`course-pedagogy-reviewer`、`simulation-domain-reviewer`、`data-governance-reviewer`、`ai-context-reviewer`、`release-sentinel`。总数不超过 6。

### 发布门禁

调用 `release-sentinel`、`critical-reviewer`、`performance-reviewer`，输出 go/no-go、必须修复项、验证命令、迁移风险和回滚说明。

### 失败复盘

调用 `retro-analyst` 分析最近失败尝试，给出错误假设、缺失验证和最小持久改进位置。

## 汇总输出契约

主线程汇总多代理审查时使用以下结构：

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
- 继续启动更多代理来回避主线程判断。
- 让 `agent-router` 代替主线程做最终裁决。
