# Codex 命名子代理路由

本文只补充 ACT 项目角色路由；通用授权、模型层级和审查循环服从全局 `AGENTS.md`。

Sol 命名 reviewer 默认使用 `medium`；只有 `critical-reviewer` 在高风险终审时使用 `high`，常设 Sol 角色不使用 `xhigh`。

## 派发入口

1. 用户已授权子代理后，先选择最小充分命名角色。
2. 存在匹配角色时不得使用自由派发。
3. 派发后核对 `agent_role`、模型与推理强度；不匹配时停止，不让自由代理继续消耗上下文。
4. 写任务优先下放给命名写代理，主线程保留需求、证据、决策和最终裁决上下文。
5. 只有角色组合不明确、任务跨多个领域或可能需要三个以上代理时才调用 `agent-router`。

## 执行路由

| 任务 | 首选角色 | 升级条件 |
| --- | --- | --- |
| 小配置、局部修补、样板补全 | `spark-coder` | 扩展为常规实现时切换 `patch-worker` |
| 常规功能、多文件改动、普通重构 | `patch-worker` | Luna 无法承载长上下文时先让 investigator 收集证据 |
| 测试生成、复现与回归验证 | `test-engineer` | 不得借测试角色修改生产逻辑 |
| 路径不清、调用链不清 | `code-mapper` | 大量长文件或跨域历史加 `long-context-investigator` |
| 范围明确的复杂排障 | `deep-debugger` | 上下文规模成为瓶颈时加 `long-context-investigator` |
| 仓库级探索、长历史、大文件联合审阅 | `long-context-investigator` | 仅在说明 Luna 不足理由后使用 |
| 非平凡规划、架构取舍 | `spec-planner` | 高风险架构终审加 `critical-reviewer` |

## 审查路由

| 变更范围 | 独立审查 | 追加领域审查 |
| --- | --- | --- |
| 普通代码产出 | `independent-reviewer` | 按实际领域追加，不自动升配 |
| UI 行为与流程 | `independent-reviewer` + `ui-flow-reviewer` | 课程页面再加课程 reviewer |
| 课程作者态/runtime | `independent-reviewer` | `course-pedagogy-reviewer` |
| AI 上下文、伴学、模型配置 | `independent-reviewer` | `ai-context-reviewer`；涉画像再加数据治理 |
| 学习事件、画像、Prisma/backfill | `independent-reviewer` | `data-governance-reviewer`；生产迁移再加发布门禁 |
| 仿真、Rust/WASM、Arena | `independent-reviewer` | `simulation-domain-reviewer` |
| 认证、权限、密钥、文件或 shell | `independent-reviewer` | `security-reviewer` |
| 高频 API、轮询、队列、渲染 | `independent-reviewer` | `performance-reviewer` |
| 发布、部署、迁移 | `independent-reviewer` | `release-sentinel`；高风险再加 `critical-reviewer` |

## 写权限路由

- `spark-coder`：简单、局部、易回滚改动；发现范围扩张立即停止。
- `patch-worker`：范围明确后的常规实现；允许有边界的多文件改动和普通重构。
- `test-engineer`：测试与验证文件；不得顺便修生产逻辑。
- `deep-debugger`：诊断性写入；不得承担正式修复。
- 同一工作树一次只允许一个写代理运行。

## 停止与升级

- 已有最小充分证据或明确修复路径时停止继续 fan-out。
- Luna 任务不能仅因“复杂”升级 Terra；必须证明瓶颈是上下文规模。
- 普通审查不升级 `critical-reviewer`；只有高风险、架构回归、安全敏感或发布关键任务才使用它。
- reviewer 发现问题后由新的写代理修复，再由新的独立 reviewer 复核。
