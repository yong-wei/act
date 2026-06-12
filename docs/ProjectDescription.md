# AI-OBE 船舶智控平台项目说明

## 文档定位

本文用于帮助维护者、协作代理和外部审阅者快速理解本项目当前的产品形态、架构边界、主要运行链路和近期工程重点。它不是提交日志；具体变更应以 `openspec/changes/`、`openspec/specs/`、专题设计文档和 `docs/memory/` 为准。

当前项目已经从“精品互动课 + 基础画像”的阶段，推进到“统一平台壳层、标准互动课、控制仿真、Arena、学习路径、智能助教和数据治理共同构成教学闭环”的阶段。控制校正与智能助教系列中多项能力已经进入 `openspec/specs/`、Prisma 模型和数据治理实现；当前仍在推进的 OpenSpec 重点主要是 React Doctor 错误清理和统一 UI 治理门禁。后续判断项目现状时，应优先使用本文、`docs/memory/02-recent-summary.md`、`docs/memory/10-project/10-current-state.md`、当前 `openspec list --json` 和已归档 specs，而不是早期课程制作记录。

## 项目概览

AI-OBE 船舶智控平台是面向“自动控制原理”和船舶智能控制教学的 Next.js 单体应用。平台同时服务学生、教师和管理员三类角色，将课程内容、互动课堂、控制系统工具、虚拟仿真、Arena 竞技评测、AI 伴学、自适应学习与数据治理放在一个可运行的教学系统内。

平台的核心目标是形成可复审的教学闭环：

1. 课程内容从作者态导出到 runtime，作为讲义、知识图谱、知识卡、媒体和互动 manifest 的真源。
2. 教师基于预置或自建教案创建课堂，学生通过课堂码进入同步课堂或独立学习入口。
3. 互动答题、仿真操作、Arena 提交、资源访问、控灵问答和作业批改进入学习事件链路。
4. 数据治理把高价值事件物化为学习事实、能力画像、路径证据、班级诊断和报告指标。
5. 自适应路径、控灵解释、教师报告、智能批改和备课增强包从同一证据层派生。

## 技术栈

- 应用框架：Next.js 16、React 19、TypeScript。
- 样式与 UI：Tailwind CSS 4、Radix UI、lucide-react、Recharts、ECharts、React Three Fiber。
- 数据层：PostgreSQL、Prisma 7、NextAuth.js。
- 后台任务：Redis、BullMQ、数据治理 worker 与 scheduler。
- 数值内核：`rust/control-engine` 提供控制分析和虚拟仿真 WASM 运行时。
- AI 接入：Vercel AI SDK 6、OpenAI-compatible provider、后续模型供应商兼容矩阵。
- 验证体系：Vitest、Playwright、仓库脚本测试、Prisma generate、Next build、OpenSpec strict validation。

依赖链已经经过一轮大版本迁移。新增前端、构建或 SSR 相关能力时，需要确认 Tailwind/Turbopack 扫描边界、React 19/R3F SSR 边界、Prisma 7 客户端生成和 `npm ci` 后的本地 artifacts。

## 主要角色

### 学生端

学生端围绕学习、实践、反馈和个人画像组织：

- `/interactive-learning`：互动学习入口，包含控制工作台、互动课程、跨域探索和互动组件。
- `/interactive-learning/courses`：精品互动课列表，课程入口提供讲义、知识图谱、知识卡、媒体资源和课堂入口。
- `/interactive-learning/control-workbench`：综合仿真工作台，承载经典四视图、复合校正、预测控制、黑箱辨识等控制设计流程。
- `/classroom/student/[sessionId]` 与课程私有 student 路由：真实课堂学生页，承载教师同步进度、学生提交、答案揭示、知识卡抽屉和 AI 上下文。
- `/arena` 与 `/arena/challenges/[taskId]`：控制竞技场大厅、挑战详情、官方评测与榜单。
- `/assessment/adaptive-practice`：自适应题库与诊断入口。
- `/assessment/document-feedback`：文档作业反馈入口，服务 rubric 批改、教师审核和学生反馈链路。
- `/data-center`：学生与教师均可进入的数据中心入口，承载学习证据、报告和平台级状态视图。
- `/profile`、`/profile/growth`：学习活动、能力画像、风险摘要、Arena 概览、成长记录和推荐资源。

学生端状态不只存在于浏览器。课堂提交进入 `StudentState` 和关键步骤持久化记录；资源与课堂事件进入 `InteractionLog`；高价值行为经数据治理进入 `LearningFact`、`StudentCompetencySnapshot`、`StudentProfileSummary` 和推荐链路。

### 教师端

教师端围绕课程组织、班级治理、Arena 发布和学情诊断：

- `/teacher`：教师工作台。
- `/teacher/preset-lessons`：预置教案克隆入口。
- `/teacher/lesson-plans`：教案创建、编辑和管理。
- `/teacher/classes`：班级管理、学生导入、课堂记录和班级学情入口。
- `/teacher/classes/[classId]/analytics-v2`：班级学情总览。
- `/teacher/classes/[classId]/students/[studentId]`：学生个体学情与证据视图。
- `/teacher/arena`：Arena 任务配置、预览、发布管理和发布报告。
- `/teacher/grading-workbench`：文档 rubric 批改与反馈工作台。

教师创建课堂后，系统生成 `ClassSession`、课堂码、lesson version、manifest hash 和总步骤数。课堂结束后，session report、提交事件和治理摘要进入教师报告链路。班级洞察不应从前端状态重建，而应消费治理后的能力、证据和报告指标。

### 管理员端

管理员端面向平台运行与配置：

- `/admin`：管理入口。
- `/admin/users`：用户管理、导入、重置密码。
- `/admin/config`：平台配置、AI 供应商和模型配置。
- `/admin/states`：系统使用量统计。
- `/admin/data-governance`：数据治理状态、事实分布、队列健康、风险清单和快照明细。

管理员配置进入 `PlatformSetting` 或 AI 配置相关表；数据治理看板读取 `LearningEventBatch`、`LearningFact`、`StudentCompetencySnapshot`、`ClassCompetencySnapshot`、`StudentRiskFlag` 等治理表。管理员端不承担课程正文编辑职责。

## 平台壳层与 UI 治理

平台 UI 正在从分散页面改为以 `AppShell`、角色导航、证据状态组件和页面族治理为主的统一壳层。核心文件包括 `src/components/platform/app-shell.tsx`、`src/components/platform/platform-ui-contracts.ts`、`src/components/platform/status-and-evidence.tsx`、`src/components/platform/visual-world-assets.ts` 和 `src/lib/platform-role-navigation.ts`。

统一壳层当前覆盖数据中心、教师治理工作台、任务空间、Arena/控制工作台入口和若干课程入口。`AppShell` 在测试中会被纯函数调用，因此顶层不能直接引入会依赖运行时 hook 的逻辑；需要运行态上下文时，应放到子组件或可选上下文边界内。

当前 active OpenSpec 中，`harden-unified-ui-governance-gates` 负责把商业化 UI 契约、页面族导航、状态证据组件和回归门禁继续固化。React Doctor 系列中，server、aria role、shared state/effect 和 interactive state/effect 已归档；resource state/effect 仍按错误族限域推进。

## 课程内容与 runtime

课程内容采用作者态与运行态分层。

作者态位于 `course-content/authoring/lessons/<lesson>/`，通常包含讲义、BOPPPS、互动设计、互动契约、媒体、知识卡和制作说明。运行态位于 `course-content/runtime/`，供前端正式读取：

- `course-content/runtime/lessons/<lesson>/lesson.json`
- `course-content/runtime/lessons/<lesson>/interactive-manifest.json`
- `course-content/runtime/lessons/<lesson>/<lesson>-handout.md`
- `course-content/runtime/lessons/<lesson>/media/<lesson>-media.md`
- `course-content/runtime/knowledge/graph/*`
- `course-content/runtime/knowledge/cards/*`

正式页面应读取 runtime，不直接回读 authoring。互动课程实现优先使用 `src/features/interactive/shared/manifest-runtime/`，只有确实无法标准化的控制曲线、可行域、黑箱数据预演或专用工作区才保留课程私有实现。

互动课程正在从“课程私有组件变体”迁移到“标准模块框架”。新课应使用注册过的模块和 manifest 契约；未注册模块、未声明题型或无法治理的提交结构应被测试闸门拦截。

`1-1` 单元当前已经按“系统全貌”定位完成标准互动课首轮实现，入口路由为 `/interactive-learning/courses/unit-1-1-see-the-full-picture`，学生与教师课堂页位于该路由下的私有 `[sessionId]` 子路由。实现文件包括 `src/lib/unit-1-1-course.ts`、`src/lib/lesson-1-1-ai-contexts.ts` 和 `src/features/interactive/unit-1-1-see-the-full-picture/*`。作者态材料、互动契约和 acceptance 已齐备，manifest audit 已达到 15 steps、91 modules、0 issues。当前剩余工程口径是把 `1-1` 纳入严格实现契约注册，避免后续标准课被旧的 migrated-lesson 语义遗漏。

## 课堂与资源编排

统一课堂主线是：

`TeachingResource -> LessonPlan/LessonItem -> ClassSession -> StudentPlayer/ResourceRenderer`

- `TeachingResource`：可编排资源，包含静态文本、媒体、互动组件、仿真应用和伦理场景。
- `LessonPlan`：教案，按 BOPPPS 环节组织课堂。
- `LessonItem`：教案环节，引用资源或知识节点，并允许环节级配置覆盖。
- `ClassSession`：课堂会话，保存课堂码、教师、班级、状态、当前环节、manifest 版本与总步数。
- `StudentState`：学生提交、草稿、进度和交互状态。
- `InteractionLog`：互动事件原始日志。

可编排资源通过 `src/lib/resource-registry.tsx` 注册。教案引用 `registryId`，不保存组件路径。配置合并顺序为 registry 默认配置、`TeachingResource.config`、`LessonItem.overrideConfig`。

## 综合仿真工作台与数值内核

综合仿真工作台位于 `/interactive-learning/control-workbench`。当前工作台已经承担多种控制设计体验：

- 经典四视图：模型、响应、频域、根轨迹等基础表征联动。
- 复合校正：前置滤波、前馈、反馈、扰动补偿和限幅模板。
- 预测控制：有界线性 MPC 与优化辅助 PID 参数化模板。
- 黑箱辨识：数据集、辨识模型、控制器预演与官方评测边界。

控制数值能力分为两层：

- 前端资源层负责界面、任务参数、状态显示、曲线和交互。
- Rust/WASM 层负责控制分析和物理步进，入口包括 `compute_virtual_simulation_step`、控制分析函数和虚拟仿真模型 dispatch。

新增或改造仿真应遵守 `docs/Simulation_Guidelines.md`：固定步长时钟、线性模型 Tustin 离散化、非线性模型走内置积分器接口，避免在页面内直接手写漂移的数值步进。参与 SSR 的页面不能静态导入会触发 React/R3F 浏览器运行时依赖的 3D 预览组件。

## Arena 控制竞技场

Arena 是统一评测与排行榜层，不是单一控制方法工作台。基本单元是：

对象 + 任务 + 允许方法 + 评测协议 + 榜单规则。

核心代码位于 `src/features/arena/`、`src/features/control-workbench/` 与 `/api/arena/*`。当前能力包括：

- 挑战大厅、挑战详情、筛选和排行榜。
- 白箱对象、灰箱对象和黑箱对象。
- PID、串联校正、复合校正、MPC、黑箱控制和优化调参模板。
- `ArenaControllerArtifact`、`ArenaEvaluationRun`、`ArenaSubmission`、`ArenaBlackBoxExperiment`、`ArenaVirtualSimulationRun` 等持久化链路。
- 教师发布、班级范围报告、学生个人反馈和官方评测复用。

正式排名只消费服务端官方评测写入的 `ArenaSubmission`。`LearningFact` 中的 Arena 上下文只作为辅助证据，不代表官方提交。黑箱任务必须校验数据集归属、hash、预算和隐藏模型边界。

## 数据治理、学习路径与智能助教

数据治理位于 `src/lib/data-governance/`，负责把互动日志和后台事件转成可解释的学习证据。

主要数据表与链路：

- `InteractionLog`：课堂、资源、知识卡、Arena 和交互组件的原始事件。
- `LearningEventBatch`：二级事件批处理存储。
- `EventDictionary`：核心事件词典和能力映射。
- `LearningFact`：从事件中物化的统一学习事实。
- `StudentCompetencySnapshot`：学生六维能力画像快照。
- `StudentProfileSummary`：面向 AI 和页面展示的学生画像摘要。
- `ClassCompetencySnapshot`：班级能力画像。
- `StudentRiskFlag`、`GrowthRecord`、`LearningRecommendation`：风险、成长和推荐链路。

学生能力模型是六维结构：控制建模与分析、参数设计与调优、跨域迁移与联动、工程决策与约束、探究反思与提示词、自主学习进展。

控制校正学习路径与全课程智能助教已经从提案推进到多项实现和归档 specs。当前稳定能力包括 goal slice 注册、角色化诊断、学习证据 RAG 语料、文档 rubric 批改工作台、教师备课增强包、智能助教 demo 包、控制校正诊断画像、教师报告和评估 demo。近期 Prisma 模型已经包含 `DiagnosisReportSnapshot`、`CourseEnhancementPack` 以及与路径执行、偏差、干预、证据缓存相关的表。

后续继续扩展智能助教时，应把控制校正作为可验证样例，把全课程助教作为泛化平台能力，而不是复制某个目标切片的专用逻辑。

智能助教设计的关键不是单独聊天框，而是同一事实源驱动的闭环：

学习证据采集 -> 能力画像更新 -> 定性/定量诊断 -> 多路径推荐 -> 资源执行 -> 作业/试题批改 -> 下次课增强包 -> 控灵伴学解释与追踪。

文档/PDF 批改能力应把 MarkItDown 视为 PDF/Office 到 Markdown 的转换适配器，不把它当作评分系统或高保真 PDF 阅读器。评分、教师审核、学生反馈、证据引用和画像回写需要独立契约。

## AI 与控灵

AI 能力嵌入多个教学场景：

- `/api/ai/chat`：通用 AI 对话接口。
- `/api/ai/konling-context`：控灵助手上下文。
- `src/lib/course-ai-contexts.ts`、`src/lib/unit-*-ai-contexts.ts`：课程、步骤和知识点级 AI 上下文。
- `src/lib/konling-agent-runtime.ts`：控灵模式、工具、上下文与引用约束。
- `src/features/ai/companion`：仿真与学习过程中的伴学和干预。
- 管理员 `/admin/config`：AI 供应商、模型、启用状态与响应测试。

AI 可以解释、提示、总结和建议，但不能伪造学习事实、不能代替官方评测器给出 Arena 成绩、不能跳过课堂契约直接改变课程步骤。未来 Konling 模式需要按诊断、路径建议、资源辅导、批改反馈、班级摘要和备课共创分别声明上下文、工具、引用类别、隐私边界和 fallback。

## OpenSpec 与工作树协作

本项目使用 OpenSpec 管理功能开发。已完成变更会归档到 `openspec/specs/`，进行中变更位于 `openspec/changes/`。新功能、治理、UI 重构、依赖迁移和智能助教能力都应先形成 proposal、design、tasks 和 spec delta，再进入实现。当前 active changes 主要是：

- `eliminate-react-doctor-resource-state-effect-errors`
- `harden-unified-ui-governance-gates`

当前固定工作树职责：

- 主工作树绑定 `integration`，用于 OpenSpec 提案、集成验证和协调登记。
- `act-dev1` 绑定 `dev1`，用于功能实现。
- `act-dev2` 绑定 `dev2`，用于另一条功能实现。
- `act-resource` 绑定 `resource`，用于课程资源制作和资源相关开发；该永久工作树跟踪 `origin/integration`，在其中工作时不再创建第二层工作树。

Buddy issue 是跨工作树协调记录。一个可执行 change 对应一个 GitHub issue、一个 claim branch、一个 OpenSpec change 和一个 PR。提案批次应设置父 issue、子 issue、Project 状态和依赖关系；实现批次应在 claim 成功后按 issue 边界执行。

## 部署与运行

常用命令：

```bash
rtk npm run startup
rtk npm run shutdown
rtk npm run dev
rtk npm run build
rtk npm run lint
rtk npm run test
rtk npm run test:unit
rtk npm run test:integration
rtk npm run test:data-governance
```

构建链路会先执行控制内核 WASM 构建，再执行 Prisma generate 和 Next build。工作树同步脚本会安装依赖、生成 Prisma client，并可安装 Git hooks、初始化 CodeGraph/CRG 与 OpenWolf 知识链接。

远端部署主要通过：

```bash
rtk bash scripts/build.sh
rtk bash scripts/remote-deploy.sh
```

生产排障需同时检查应用容器、worker、scheduler、PostgreSQL、Redis、systemd 服务和 `/api/readyz`。运行时课程资源通常以 `course-content/runtime/` 只读挂载方式供容器读取。

## 维护入口

- 项目说明：`docs/ProjectDescription.md`
- ChatGPT/GitHub 连接器入口：`docs/memory/CHATGPT_CONTEXT.md`
- 长期记忆索引：`docs/memory/00-index.md`
- 最近摘要：`docs/memory/02-recent-summary.md`
- 渐进读取地图：`docs/memory/01-reading-map.md`
- OpenSpec：`openspec/changes/` 与 `openspec/specs/`
- 课程作者态：`course-content/authoring/lessons/`
- 课程运行态：`course-content/runtime/`
- 仿真规范：`docs/Simulation_Guidelines.md`
- 统一课程框架：`docs/Unified_Lesson_Framework.md`
- 运行日志：`.logs/`
- 数据模型：`prisma/schema.prisma`

修改核心功能后，应按改动范围运行定向测试、`rtk npm run lint`、`rtk npm run test`、`rtk npm run test:unit` 和 `rtk npm run build`。涉及 Rust/WASM、Prisma schema、课堂同步、数据治理、Arena、课程 runtime 或 OpenSpec 的变更，还应补充对应的定向 Vitest、脚本测试、Playwright 验收或 `rtk openspec validate --changes --strict`。
