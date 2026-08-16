# 最近摘要

状态: active
最后更新: 2026-07-28
摘要: 初始化时优先读取的最近上下文入口。当前平台主线已经覆盖统一壳层、标准互动课、控制工作台、Arena、资源语义治理、知识图谱、数据治理和智能助教；Issue #1125 已完成 CTKG 0.2 聚合协议变基的实现与文档同步，候选底座锁定 `control-theory-engineering-v0.2`，Legacy 仍为生产权威。
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

- 2026-08-16 生产 runtime 已切到 OSS v2 blob-view。`deploy:app` / `remote-deploy.sh` 默认 `ossfs-blob-view`，只绑定已物化 view，不再 rsync `course-content/runtime`。runtime 内容更新走 `deploy:runtime`。`legacy-rsync` 仅显式可用，且存在 OSS active receipt 时失败关闭。

- 2026-07-28 Issue #1125 `adopt-ctkg-0-2-aggregate-release-contract` 已完成实现与验证：候选权威知识底座锁定 CTKG 0.2 聚合工程包 `control-theory-engineering-v0.2`（841 release entries、744 投影节点、97 投影关系、1302 条唯一上游 crosswalk、九种谓词），候选 Repository、三项投影、候选图谱与候选态控灵绑定同一聚合 ReleaseSet、`projectionDigest` 与 `sourceDatasetHash`。公共 bundle 字节级往返成立；私有 CTKGDataset 明确不可用且不得重建；CTKG 0.1 仅历史可审计；Legacy 仍是生产权威；旧 inventory/crosswalk/candidate/decision/binding 仅 historical/stale。干净 Git HEAD 上的 PostgreSQL 迁移、导入、幂等、冲突回滚、字节往返、Repository、部署 CLI 与 canonical binding shadow 全流程通过；下游 CourseCoverage/ACT crosswalk、资源教学角色、RAG/KAQ/SAR、路径、学习事实与生产切换仍受后续依赖门禁。

- 2026-07-18 `openspec list --json` 中的四项 change 均已完成任务：知识图谱根节点气泡与 inspector 持久化、评估检查点资源语义、教师审核与学生反馈闭环、互动课组件样式统一。它们尚未全部归档，因此“目录仍在 `openspec/changes/`”不等于仍有未实现任务。

- 2026-07-18 资源语义闭环已经覆盖完整资源 readiness、可追踪语义审核和评估检查点权威边界。消费端应保持 fail-closed，并按阶段和权威来源解释证据；不要恢复仅凭字段存在或宽松默认值判定资源就绪的旧行为。

- 2026-07-18 知识图谱已完成根节点气泡布局、形状感知边界几何、请求与清理归属、inspector 状态持久化等治理。图谱后续改动应继续使用 canonical domain validation 和明确的请求生命周期。

- 2026-06-17 `1-2` 新主线互动课当前路由是 `/interactive-learning/courses/unit-1-2-modeling-from-object-to-system`，预设键是 `unit-1-2-modeling-from-object-to-system-v1`，资源键是 `unit-1-2-modeling-from-object-to-system`。该实现以 `course-content/runtime/lessons/1-2/interactive-manifest.json` 为真源，14 步 manifest-first 闭环已完成；第 9 步通过共享 `static-surface-3d` 显示三维幅值曲面，第 10/11 步通过共享 `interactive-figure` 保持交互节点，不恢复旧版 `unit-1-2-block-diagram-simplification`。实现合同位于 `course-content/authoring/lessons/1-2/notes/interactive-implementation-acceptance.json`，浏览器证据位于 `artifacts/interactive-learning/unit-1-2-implementation-acceptance-2026-06-17/`。

- 2026-06-19 教材 RAG 真源开始进入主工作树本地 `course-content/authoring/resources/textbooks/`。Dorf/Bishop《Modern Control Systems》前三章已按 `dorf-modern-control-systems/chapter-XX/textbook.md + assets/` 结构导入，根 manifest 位于 `course-content/authoring/resources/textbooks/dorf-modern-control-systems/manifest.json`；该教材数据目录通过主工作树 `.git/info/exclude` 本地排除，不进入 Git 跟踪。具体导出规则见 [70-workflows/textbook-rag-resource-export.md](70-workflows/textbook-rag-resource-export.md)。

- 2026-06-12 曾建立永久资源工作树用于课程资源制作。该记录只说明“永久工作树内不再嵌套 worktree”的原则；当前可用工作树和分支必须以任务授权与 Git 实际状态为准。

- 2026-06-13 React Doctor 错误清理系列已归档到 specs，覆盖 server、aria role、shared state/effect、interactive state/effect 和 resource state/effect；AppShell 折叠导航合同 #413、学生二级路线壳层迁移 #414、知识图谱壳层迁移 #415 和数据中心角色可见性 #416 均已完成。相关视觉证据保存在 `artifacts/commercial-ui/`；这些项目不再是当前待实现事项。

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
- 主工作树主要用于 OpenSpec 提案生成和集成测试；在本工作树完成提案后，默认流程是先审核、提交并推送到 `integration`，之后再创建或登记 GitHub issue，避免 issue 指向未进入远端集成基线的本地工件。
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
- 要改平台 UI 壳层：先读 `src/components/platform/*`、`src/lib/platform-role-navigation.ts` 和 `openspec/changes/archive/2026-06-12-harden-unified-ui-governance-gates/`。
- 要改 Arena 或控制工作台：先读 `src/features/arena/`、`src/features/control-workbench/`、`src/app/interactive-learning/control-workbench/page.tsx`。
- 要排查部署、依赖、启动或工作树环境：先读 [30-operations/00-index.md](30-operations/00-index.md) 和 `scripts/dev/sync-local-worktree-config.sh`。
