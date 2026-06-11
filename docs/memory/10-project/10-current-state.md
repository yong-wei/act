# 当前状态

状态: active
最后更新: 2026-06-11
摘要: 记录项目当前的重要现状，帮助跨会话快速回答“现在做到哪里了、最近重点在哪”；当前重点是依赖大版本迁移后的平台基线、控制工作台与 Arena 集成、控制校正学习路径、全课程智能助教提案、OpenSpec/Buddy 多工作树协作和数据治理口径。
上游:
- [00-overview.md](00-overview.md)
下游:
- [20-roadmap.md](20-roadmap.md)
相关:
- [docs/ProjectDescription.md](../../ProjectDescription.md)
- [../02-recent-summary.md](../02-recent-summary.md)
- [../30-operations/50-known-deploy-risks.md](../30-operations/50-known-deploy-risks.md)

## 当前高优先级现状

- 项目当前是 Next.js 16、React 19、Prisma 7、Tailwind CSS 4、Vercel AI SDK 6 的单体应用。依赖链已大版本迁移，后续新增功能必须留意 SSR、R3F、Prisma generate、Tailwind source 边界和测试脚本噪声。
- 基线分支为 `integration`，发布分支为 `main`。主工作树绑定 `integration`，职责是 OpenSpec 提案、集成验证和协调登记；功能实现默认进入 `act-dev1` 或 `act-dev2`，课程资源制作进入 `act-resource`。
- 永久工作树本身就是隔离边界。如果当前会话已经在 `act-dev1`、`act-dev2`、`act-resource` 或 Codex 派生出的永久隔离工作树中开发，不要再为同一 change 新建第二层临时 worktree；只有主协调工作树需要保护当前分支，或用户明确要求额外隔离时，才创建临时 worktree。
- OpenSpec/Buddy 是功能推进主线。进行中能力不应只看代码，还要看 `openspec/changes/`、`openspec/specs/`、GitHub issue 父子关系、blockedBy 依赖和 Project 状态。
- 互动学习入口已经以控制工作台、互动课程、跨域探索和互动组件为主；首页保留控制工作台入口，并把原个人中心链接调整为互动学习。
- 综合仿真工作台 `/interactive-learning/control-workbench` 已承载经典四视图、复合校正、预测控制、黑箱辨识等控制设计流，并与 Arena 路由和提交面板衔接。
- Arena 已形成对象、任务、允许方法、评测协议、榜单规则、教师发布和班级报告链路。正式排名以 `ArenaSubmission` 为准，不能用前端预览或 `LearningFact` 上下文替代官方提交。
- 数据治理从课堂事件回放推进到 session data quality、evidence source coverage、学生证据特征缓存、互动提交重算和报告指标口径。画像与报告排障必须分清原始事件、学习事实、特征缓存、快照和页面聚合。
- 控制校正学习路径是当前自适应能力的首个目标切片。`control-correction` 是 canonical goal slice，资源节点图已实现并归档；后续 active changes 继续处理路径轮次、证据缓存、专门化中心、控灵辅导、终端验证、教师报告和 demo 包。
- 全课程智能助教系列已经提出并登记，目标是把控制校正样例扩展为全课程能力：goal slice registry、角色化诊断、多路径策略、学习证据 RAG、文档 rubric 批改、教师备课包、Konling 多模式和演示验收。

## 近期已落地的关键事实

- `seed-control-correction-resource-path-graph` 已进入 `origin/integration` 并归档，新增了 `src/lib/control-correction-resource-seed.ts` 以及资源节点注册、路径规划验证和终端验证约束。
- 控制校正资源 seed 不允许使用占位 `/course-runtime` 媒体路径；应指向真实 runtime handout、knowledge-card markdown、已注册资源或真实 App Router 动态路由。
- 控制校正路径中的 `terminal-validation` 必须是主路径终点，且节点类型必须是 simulation 或 arena_task。路径中途出现验证节点后再接非验证资源时，仍应 fallback 并报告缺失原因。
- 智能助教系列提案已推送到 `integration`，提交为 `b8bff30f docs: propose intelligent teaching assistant series`。该提交经过 `critical-reviewer` 初审阻断、修复、复审通过后提交。
- `docs/proposals/2026-06-04-teaching-assistant.md` 是智能助教实施的重要分析报告；对应 OpenSpec change 包括 `generalize-adaptive-goal-slice-registry`、`materialize-role-based-diagnosis-views`、`extend-adaptive-path-policy-families`、`build-learning-evidence-rag-corpus`、`add-document-rubric-grading-workbench`、`generate-teacher-prep-pack-workflow`、`expand-konling-teaching-assistant-modes`、`package-intelligent-teaching-assistant-demo`。
- 文档 rubric 批改工作台中，MarkItDown 只承担 PDF/Office 到 Markdown 的转换适配器职责；评分、教师审核、学生反馈、证据定位和画像回写需要平台契约与 UI 工作台。
- 子代理配置以 `.codex/agents/*.toml` 和 `.codex/agents/README.md`、`ROUTING.md`、`HARNESS.md` 为真源。代码类提交需要高推理审查时，修复后必须复审，直到没有重大问题。
- `multi_agent_v1.spawn_agent` 不能同时传 `fork_context: true` 和 `agent_type`/模型/推理强度覆盖。需要角色代理时不要 full-history fork；需要 fork 时不要覆盖角色。
- OpenWolf 多工作树共享采用“长期知识文件软链接、运行态本地化”的策略。不要把派生工作树的 `.wolf/` 整体软链接到主工作树。

## 当前主要风险

- Active OpenSpec change 数量较多，后续实现时容易把系列依赖误解成线性依赖。实际依赖应以 issue `blockedBy` 和 change metadata 为准。
- 控制校正学习路径与全课程智能助教存在继承关系。智能助教设计应默认未来未完成的控制校正 change 会实现，但不应复制其目标切片专用逻辑。
- `openspec list --json` 若出现已归档 change 的 `no-tasks` 幽灵项，通常是本地空目录残留；先查文件，再清理空目录，避免误判 active 状态。
- `git diff --check` 不覆盖未跟踪文件。新增文档提案在 staging 前需要用 `rg` 或 `git diff --no-index --check` 检查 citation token 和行尾空格，staging 后再跑 `git diff --cached --check`。
- 依赖大版本迁移后，全量 tsc 可能仍暴露既有仓库债务；提交前应按改动风险选择最小充分验证，不要把历史 tsc 债务混同为本次改动失败。
- Tailwind/Turbopack source 边界必须只覆盖业务代码和必要 helper，不要扫描系统环境配置、缓存、工作树运行态或外部同步目录。
- 生产运行问题不能只看配置文件。优先查 `.logs/`、端口监听、`/api/readyz`、worker/scheduler 日志、Prisma generate、容器和 systemd 状态。

## 建议下一跳

- 做 OpenSpec 提案：先查当前 active changes 和 `openspec/specs/`，再生成 proposal/design/tasks/spec delta，最后用 `rtk openspec validate --changes --strict`。
- 执行 OpenSpec change：先 claim 对应 GitHub issue，确认工作树职责与分支，再按 change 边界实现，不要跨系列顺手改。
- 在永久隔离工作树执行 OpenSpec change 时，直接使用当前工作树完成开发闭环；不要再创建嵌套临时 worktree。
- 改控制工作台或 Arena：先读 `src/features/control-workbench/`、`src/features/arena/` 和相关测试；注意官方评测与本地预演边界。
- 改数据治理或画像：先定位数据层级，明确原始事件、学习事实、特征缓存、快照和页面 DTO 各自职责。
- 改智能助教：先读 `docs/proposals/2026-06-04-teaching-assistant.md` 和智能助教 OpenSpec 系列，不要把控灵聊天框当作唯一入口。
- 改课程内容或互动课：继续遵循 authoring -> review/export -> runtime 的边界，正式页面只读 runtime。
