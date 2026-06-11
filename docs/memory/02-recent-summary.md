# 最近摘要

状态: active
最后更新: 2026-06-11
摘要: 初始化时优先读取的最近上下文入口。当前项目已从早期精品互动课制作阶段，推进到依赖大版本迁移后的控制工作台、Arena、数据治理、控制校正学习路径和全课程智能助教协同建设阶段；主工作树固定用于 OpenSpec 提案与集成验证，功能实现应进入派生工作树。
上游:
- [00-index.md](00-index.md)
- [README.md](README.md)
下游:
- [10-project/10-current-state.md](10-project/10-current-state.md)
- [20-architecture/00-index.md](20-architecture/00-index.md)
- [30-operations/00-index.md](30-operations/00-index.md)
- [70-workflows/00-index.md](70-workflows/00-index.md)
相关:
- [docs/ProjectDescription.md](../ProjectDescription.md)

## 最近最重要的稳定变化

- 2026-06-04 项目依赖链已完成大版本迁移，当前基线是 Next.js 16、React 19、Prisma 7、Tailwind CSS 4、Vercel AI SDK 6、Vitest 4、Playwright 1.60。构建链路需要先构建 `rust/control-engine` WASM，再执行 `prisma generate` 与 Next build。涉及 R3F/Three 的组件不能在 App Router SSR 入口顶层静态导入。

- 2026-06-04 工作树职责已经固定：主工作树绑定 `integration`，用于 OpenSpec 提案、集成验证和协调登记；`act-dev1` 绑定 `dev1`，`act-dev2` 绑定 `dev2`，用于功能实现；`act-resource` 绑定 `resource`，用于课程资源制作。进入任一 act 工作树后，先确认当前分支和职责是否匹配。

- 2026-06-11 如果当前会话已经在 `act-dev1`、`act-dev2`、`act-resource` 或 Codex 派生出的永久隔离工作树中进行开发，不要再为同一 change 新建第二层临时 worktree；这些永久工作树本身就是隔离边界。只有在主协调工作树中需要保护当前分支、或用户明确要求额外隔离时，才创建新的临时 worktree。

- 2026-06-04 OpenSpec/Buddy 已成为功能推进主工作流。当前进行中主线包括控制校正学习路径系列和智能助教系列。Buddy issue 是跨工作树协调记录；一个可执行 change 对应一个 GitHub issue、一个 claim branch、一个 OpenSpec change 和一个 PR。提案批次需要父 issue、子 issue、Project 状态和依赖关系闭环。

- 2026-06-04 控制校正学习路径已进入实现推进阶段。已完成 `seed-control-correction-resource-path-graph`，并在 `origin/integration` 归档；当前仍有路径轮次持久化、证据缓存、专门化自适应中心、控灵路径辅导、终端仿真/Arena 验证、教师报告、模型供应商矩阵和 demo 包等 active changes。

- 2026-06-04 全课程智能助教系列已提出并推送到 `integration`。该系列覆盖 goal slice 注册、角色化诊断、多路径策略、学习证据 RAG、文档 rubric 批改工作台、教师备课增强包、Konling 多模式和智能助教演示包。MarkItDown 只作为 PDF/Office 到 Markdown 的转换适配器，不是评分系统或 PDF 阅读器。

- 2026-06-04 综合仿真工作台成为互动学习核心入口之一。首页导航已把个人中心入口调整为互动学习；`/interactive-learning/control-workbench` 承载经典四视图、复合校正、预测控制、黑箱辨识和 Arena/workbench 路由。Arena 任务、控制工作台和虚拟仿真需要区分本地预演与官方评测。

- 2026-06-04 Arena 已从单页竞技入口扩展为对象、任务、允许方法、评测协议、榜单规则和教师发布报告的统一评测层。正式排名只消费服务端官方评测写入的 `ArenaSubmission`；`LearningFact` 中的 Arena 上下文只能作为辅助证据。

- 2026-06-04 数据治理当前重点已从简单事实回放转向 evidence source coverage、session data quality、学生证据特征缓存、互动提交评分迁移和报告指标口径。后续处理画像、报告或学习路径时，先区分原始事件、学习事实、特征缓存、快照和页面聚合接口。

- 2026-06-04 子代理工作流已经迁移到项目级 `.codex/agents/*.toml` 与 `.codex/agents/README.md`、`ROUTING.md`、`HARNESS.md`。代码类提交前若用户要求或任务有实际风险，应使用高推理审查代理；修复后复审，直到无重大问题。注意 `multi_agent_v1.spawn_agent` 不能同时传 `fork_context: true` 和 `agent_type`。

- 2026-06-04 OpenWolf 知识文件在多工作树间共享，派生工作树只链接长期知识文件，运行态文件保留本地。不要把派生工作树的 `.wolf/` 整体软链接到主工作树。

## 当前需要优先记住的运行事实

- 本项目基线分支是 `integration`，发布分支是 `main`。只说“提交”默认本地提交；明确“推送”才推送；明确“当前所有变动”才按整棵当前工作树处理。
- OpenSpec 校验默认使用 `rtk openspec validate --changes --strict`；仓库级 `--all` 可能混入旧债，不作为普通提案或实现的默认门槛。
- 新建或修复派生工作树时，优先使用 `scripts/dev/sync-local-worktree-config.sh`，并开启依赖安装、Prisma generate、Git hooks、CodeGraph/CRG 和 OpenWolf 知识链接等显式选项。
- 已经进入永久隔离工作树执行功能开发时，直接在该工作树完成 claim、实现、验证、提交和 PR，不要再嵌套创建临时隔离工作树。
- Tailwind/Turbopack 扫描边界只应覆盖业务代码与必要 helper，不能把系统环境配置、缓存或工作树运行态带入扫描。
- 处理控制校正 goal slice 时，目标归属必须来自显式 canonical scope，例如 `goalId`/`goal`/`targetGoal`/`learningGoal` 等于 `control-correction`，不要用中文“校正”或英文 `correction` 关键词猜测。
- 控制校正路径中的 `terminal-validation` 必须是主路径终点，且资源类型必须是 simulation 或 arena_task，不能只按标签判断。
- 处理 OpenSpec Buddy dependency 时，`link-issue-dependencies.sh` 参数必须按 `<blocked-issue> <blocking-issue>` 成对传入；一个 issue 有多个 blocker 时要重复 blocked issue。
- 生产和本地运行问题优先查 `.logs/`、端口监听、`/api/readyz`、Prisma generate、worker/scheduler 日志和容器状态，不要只看配置文件。

## 初始化后的建议下一跳

- 想快速了解项目现状：读 [10-project/10-current-state.md](10-project/10-current-state.md) 和 [docs/ProjectDescription.md](../ProjectDescription.md)。
- 要做 OpenSpec 提案或实现：先查 `openspec/changes/`、`openspec/specs/` 和相关 GitHub issue；使用 `rtk openspec validate --changes --strict`。
- 要继续控制校正学习路径：先查 `openspec/changes/*control-correction*`、`src/lib/adaptive-learning-path-planner.ts`、`src/lib/control-correction-resource-seed.ts` 和 `src/lib/data-governance/adaptive-learner-state-service.ts`。
- 要继续智能助教：先读 `docs/proposals/2026-06-04-teaching-assistant.md` 与 `openspec/changes/*teaching-assistant*` 系列。
- 要改 Arena 或控制工作台：先读 `src/features/arena/`、`src/features/control-workbench/`、`src/app/interactive-learning/control-workbench/page.tsx`。
- 要排查部署、依赖、启动或工作树环境：先读 [30-operations/00-index.md](30-operations/00-index.md) 和 `scripts/dev/sync-local-worktree-config.sh`。
