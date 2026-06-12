# 最近摘要

状态: active
最后更新: 2026-06-13
摘要: 初始化时优先读取的最近上下文入口。当前项目已经从早期精品互动课制作阶段，推进到统一平台壳层、标准互动课、控制工作台、Arena、数据治理、智能助教和 React Doctor 治理并行建设阶段；`act-resource` 是永久资源工作树，不再为同一任务嵌套创建工作树。
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

- 2026-06-12 当前工作树 `act-resource` 绑定本地 `resource` 分支并跟踪 `origin/integration`，用于课程资源制作和资源相关开发。它是永久隔离工作树，在其中工作时不要再为同一任务创建第二层 worktree。

- 2026-06-13 React Doctor 错误清理系列已归档到 specs，覆盖 server、aria role、shared state/effect、interactive state/effect 和 resource state/effect；AppShell 折叠导航合同 #413 已归档，桌面收起态为 72px 图标栏，展开态为 248px，light/dark 视觉证据已进入 `artifacts/commercial-ui/app-shell-collapsed-navigation-413/`。学生二级路线壳层迁移 #414 已归档，覆盖互动学习入口、课程目录、章节组件、跨域探索和自适应练习，视觉证据位于 `artifacts/commercial-ui/student-secondary-routes-414/`。知识图谱壳层迁移 #415 已完成实现，`/knowledge` 使用可收起 AppShell，章节目录、关系筛选、图例和资源面板保持图谱局部工具语义，视觉证据位于 `artifacts/commercial-ui/knowledge-map-unified-shell-415/`。当前 active OpenSpec 主要剩余数据中心角色可见性和二级导航视觉治理。控制校正与智能助教系列中的多项能力已经进入 specs 和实现。

- 2026-06-12 平台 UI 已从分散页面推进到 `AppShell`、角色导航、状态证据组件和页面族治理。`src/lib/platform-role-navigation.ts` 现在覆盖课程、任务空间、数据中心、教师治理、Arena/控制工作台等入口。`AppShell` 在测试中会被纯函数调用，顶层不要直接引入 runtime hook；桌面折叠导航应使用注册图标、aria/title 标签和 72px 窄栏，不再使用首字截断文本。

- 2026-06-12 `1-1` 标准互动课的当前路由是 `/interactive-learning/courses/unit-1-1-see-the-full-picture`，不再使用旧的 `unit-1-1-laplace-transfer-function` 记忆。作者态材料、互动契约和 acceptance 已齐备，manifest audit 已达到 15 steps、91 modules、0 issues；后续重点是严格实现契约注册和互动课程验收。

- 2026-06-12 数据治理与智能助教能力已经包含角色化诊断、学习证据 RAG、文档 rubric 批改、教师备课增强包、智能助教 demo、控制校正诊断画像、教师报告和评估 demo。Prisma 模型已包含 `DiagnosisReportSnapshot`、`CourseEnhancementPack`、路径执行/偏差/干预和证据 outbox 相关表。

- 2026-06-04 项目依赖链已完成大版本迁移，当前基线是 Next.js 16、React 19、Prisma 7、Tailwind CSS 4、Vercel AI SDK 6、Vitest 4、Playwright 1.60。构建链路需要先构建 `rust/control-engine` WASM，再执行 `prisma generate` 与 Next build。涉及 R3F/Three 的组件不能在 App Router SSR 入口顶层静态导入。

- 2026-06-04 综合仿真工作台成为互动学习核心入口之一。`/interactive-learning/control-workbench` 承载经典四视图、复合校正、预测控制、黑箱辨识和 Arena/workbench 路由。Arena 任务、控制工作台和虚拟仿真需要区分本地预演与官方评测。

- 2026-06-04 Arena 已从单页竞技入口扩展为对象、任务、允许方法、评测协议、榜单规则和教师发布报告的统一评测层。正式排名只消费服务端官方评测写入的 `ArenaSubmission`；`LearningFact` 中的 Arena 上下文只能作为辅助证据。

- 2026-06-04 子代理工作流已经迁移到项目级 `.codex/agents/*.toml` 与 `.codex/agents/README.md`、`ROUTING.md`、`HARNESS.md`。未获用户显式授权时，不要因为配置存在就启动子代理。

- 2026-06-04 OpenWolf 知识文件在多工作树间共享，派生工作树只链接长期知识文件，运行态文件保留本地。不要把派生工作树的 `.wolf/` 整体软链接到主工作树。

## 当前需要优先记住的运行事实

- 本项目基线分支是 `integration`，发布分支是 `main`。只说“提交”默认本地提交；明确“推送”才推送；明确“当前所有变动”才按整棵当前工作树处理。
- OpenSpec 校验默认使用 `rtk openspec validate --changes --strict`；仓库级 `--all` 可能混入旧债，不作为普通提案或实现的默认门槛。
- 新建或修复派生工作树时，优先使用 `scripts/dev/sync-local-worktree-config.sh`，并开启依赖安装、Prisma generate、Git hooks、CodeGraph/CRG 和 OpenWolf 知识链接等显式选项。
- 已经进入永久隔离工作树执行功能开发时，直接在该工作树完成 claim、实现、验证、提交和 PR，不要再嵌套创建临时隔离工作树。
- Tailwind/Turbopack 扫描边界只应覆盖业务代码与必要 helper，不能把系统环境配置、缓存或工作树运行态带入扫描。
- 处理控制校正 goal slice 时，目标归属必须来自显式 canonical scope，例如 `goalId`/`goal`/`targetGoal`/`learningGoal` 等于 `control-correction`，不要用中文“校正”或英文 `correction` 关键词猜测。
- 处理 1-1 内容链路时，`sync_runtime_knowledge.py --check` 的 legacy `concepts/*.mdx` 缺失不等于当前 1-1 authoring、runtime 或 manifest 未就绪。
- 生产和本地运行问题优先查 `.logs/`、端口监听、`/api/readyz`、Prisma generate、worker/scheduler 日志和容器状态，不要只看配置文件。
- Next dev 视觉证据和交互验收优先使用 `http://localhost:<port>`。当前环境中 `127.0.0.1:3001` 可能走代理路径，导致 HMR WebSocket 失败、客户端 hydration 不执行，进而把可收起导航或图谱加载误判为页面问题。

## 初始化后的建议下一跳

- 想快速了解项目现状：读 [10-project/10-current-state.md](10-project/10-current-state.md) 和 [docs/ProjectDescription.md](../ProjectDescription.md)。
- 要做 OpenSpec 提案或实现：先查 `openspec/changes/`、`openspec/specs/` 和相关 GitHub issue；使用 `rtk openspec validate --changes --strict`。
- 要继续 1-1 互动课程制作：先读 `course-content/authoring/lessons/1-1`、`course-content/runtime/lessons/1-1`、`src/lib/unit-1-1-course.ts` 和 `src/features/interactive/unit-1-1-see-the-full-picture/*`。
- 要改平台 UI 壳层：先读 `src/components/platform/*`、`src/lib/platform-role-navigation.ts` 和 `openspec/changes/harden-unified-ui-governance-gates`。
- 要改 Arena 或控制工作台：先读 `src/features/arena/`、`src/features/control-workbench/`、`src/app/interactive-learning/control-workbench/page.tsx`。
- 要排查部署、依赖、启动或工作树环境：先读 [30-operations/00-index.md](30-operations/00-index.md) 和 `scripts/dev/sync-local-worktree-config.sh`。
