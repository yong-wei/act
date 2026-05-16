# AI-OBE 船舶智控平台项目说明

## 文档定位

本文用于帮助读者、维护者和后续代理快速理解本项目的主要功能、架构边界与关键运行链路。它不是更新日志；阶段性变化、事故复盘和详细制作流程应分别沉淀到 `docs/` 专题文档、`docs/memory/` 或课程作者态目录中。

当前代码图谱已在 2026-05-11 更新。图谱覆盖 1480 个文件、8207 个代码节点和 80499 条关系边，主要社区集中在 `src/features`、`src/resources/simulations`、`src/lib`、课堂会话页面、runtime 脚本和测试守卫。

## 项目概览

AI-OBE 船舶智控平台是一个面向“自动控制原理”和船舶智能控制教学的 Next.js 单体应用。系统把课程内容、互动课堂、虚拟仿真、AI 辅学、竞技场评测和学习数据治理放在同一个教学平台中，服务学生、教师和管理员三类角色。

平台的核心目标不是单纯展示课件，而是形成可运行的教学闭环：

1. 教师基于预置教案或自建教案创建课堂。
2. 学生通过课堂码进入教师端同步的互动课堂。
3. 互动提交、仿真操作、AI 交互和竞技场评测被记录为学习事件。
4. 数据治理链路把高价值事件物化为学习事实，进一步生成学生能力画像、风险提示、班级洞察和个性化建议。
5. 课程作者态内容通过审查和导出进入 runtime，支撑独立课程入口、课堂页、讲义、知识卡和媒体资源。

## 技术栈

- 应用框架：Next.js 14、React 18、TypeScript。
- 样式与 UI：Tailwind CSS、Radix UI、lucide-react、Recharts、ECharts、React Three Fiber。
- 数据层：PostgreSQL、Prisma、NextAuth.js。
- 后台任务：Redis、BullMQ、数据治理 worker 与 scheduler。
- 数值内核：`rust/control-engine` 提供控制分析和虚拟仿真 WASM 运行时。
- AI 接入：Vercel AI SDK、可配置 LLM 供应商与模型管理。
- 验证体系：Vitest、Playwright、仓库内脚本测试、Prisma 校验、Next.js build。

## 角色与主要功能

### 学生端

学生端围绕学习、实践和反馈组织：

- `/interactive-learning`：互动学习总入口，包含章节组件、精品互动课、跨域探索和专项工具。
- `/interactive-learning/courses`：精品互动课列表，课程入口提供讲义、知识图谱、媒体资源、教师/学生入口和演示模式。
- `/classroom/student/[sessionId]` 与课程私有 student 路由：真实课堂学生页，承载教师同步进度、学生提交、答案揭示、知识卡片抽屉和 AI 上下文。
- `/simulations/*`：船舶虚拟仿真，包括驱逐舰、邮轮、挖泥船、半潜平台、破冰船、LNG 船和集装箱船等场景。
- `/arena`：控制竞技场，学生围绕对象、任务、允许方法和官方评测协议提交控制方案。
- `/assessment/adaptive-practice`：自适应练习与能力诊断入口。
- `/profile` 与 `/profile/growth`：学习活动、能力画像、风险摘要、成长记录和推荐资源。

学生学习体验由四类页面共同构成。第一类是课程入口页，学生可以在进入课堂前阅读讲义摘要、浏览知识图谱、打开知识卡片和查看导入视频、音频、PDF 等媒体资源。第二类是真实课堂页，学生跟随教师端的当前步骤完成前测、判断题、参数提交、文本作答、结构化工作区和后测。第三类是独立练习与仿真工具，学生可在非课堂场景中使用 PID、Bode、根轨迹、相平面、船舶仿真和跨域探索资源。第四类是个人中心，系统把课堂参与、资源访问、仿真训练、AI 使用、题目作答和 Arena 提交汇总为学习证据。

学生端的关键状态并不只存在于浏览器中。课堂提交写入 `StudentState`，资源与课堂事件写入 `InteractionLog`，高价值学习行为经数据治理链路进入 `LearningFact`，再形成 `StudentCompetencySnapshot`、成长记录、风险提示和推荐路径。

### 教师端

教师端围绕课堂组织、班级治理和学情诊断：

- `/teacher`：教师工作台。
- `/teacher/preset-lessons`：预置教案克隆入口。
- `/teacher/lesson-plans`：教案创建、编辑和管理。
- `/teacher/classes`：班级管理、学生导入、课堂记录和班级学情入口。
- `/teacher/classes/[classId]/analytics-v2`：班级学情总览，消费数据治理聚合结果。
- `/teacher/classes/[classId]/students/[studentId]`：学生个体学情与证据视图。
- `/teacher/arena`：教师侧 Arena 任务配置、预览、发布管理与发布报告入口。

教师工作流从教案与班级开始。教师可以直接使用系统预置教案，也可以创建或编辑自己的 `LessonPlan`；预置教案通过 `src/features/teacher/preset-lessons/presets` 维护，克隆后生成可授课的数据库教案。创建课堂时，系统生成 `ClassSession` 和 6 位课堂码，并记录课堂关联的 lesson version、manifest hash 和总步骤数。

课堂中，教师端负责推进步骤、释放题目、查看学生提交、聚合选择/文本/参数结果、展示答案和结束课堂。课堂结束后，系统可生成班级与学生的 session report，并把课堂提交和总结事件送入数据治理链路。教师端班级页并不直接拼装原始事件，而是通过 `/api/teacher/classes/[classId]/insights`、`/api/teacher/classes/[classId]/students/[studentId]/insights` 等接口消费治理后的能力、风险和证据摘要。

### 管理员端

管理员端用于平台配置、账号管理和运行态观察：

- `/admin`：管理入口。
- `/admin/users`：用户管理、导入、重置密码。
- `/admin/config`：平台配置、AI 供应商和模型配置。
- `/admin/states`：系统使用量统计。
- `/admin/data-governance`：数据治理状态、事实分布、队列健康、风险清单和快照明细。

管理员功能面向平台运行本身。用户管理支持账号创建、导入、删除、密码重置和角色管理；系统配置维护首页渲染策略、AI 供应商、模型显示名、模型 ID、备注、启用状态和响应测试；系统使用量统计聚合课堂、互动、仿真、知识图谱、Control Odyssey、Arena 等平台使用情况；数据治理页用于观察事件批次、事实物化、队列状态、风险记录和学生/班级快照是否持续产生。

管理员配置通常进入 `PlatformSetting` 或 AI 配置相关表；数据治理看板读取 `LearningEventBatch`、`LearningFact`、`StudentCompetencySnapshot`、`ClassCompetencySnapshot`、`StudentRiskFlag` 等治理表。它的定位是运行态管理和质量观察，不承担课程正文编辑职责。

## 功能模块细节

### 互动学习中心

互动学习中心位于 `/interactive-learning`，分为普通章节组件、精品互动课、跨域探索和专项工具。章节组件按 `InteractiveCategory` 分类，包括系统建模、时域分析、根轨迹分析、频域分析、系统校正、非线性和跨域探索。普通组件主要来自 `src/resources/interactive-learning/**`，通过资源注册表成为可编排教学资源。

精品互动课位于 `/interactive-learning/courses`。课程卡片来自 `src/features/interactive/learning-catalog.ts` 和各 `src/lib/unit-*-course.ts`，当前覆盖模块 2、模块 3、模块 4、模块 5 的多门单元课，并保留 L-sum、邮轮舒适度课堂和早期 lesson 入口。每门精品课通常具有三个入口：课程导学页、教师课堂页、学生课堂页。导学页服务课前预习和自由浏览；教师页服务同步授课；学生页服务课堂内提交和学习证据采集。

互动页渲染分两种实现形态。较早课程保留课程私有 step panel；新课程优先使用 `interactive-manifest.json` 和共享 `manifest-runtime`。共享 runtime 支持标题模块、正文卡、公式组、图表区、显影内容、单选/多选、配对、表格构建、参数提交、总结统计和教师端聚合等常用结构。课程私有代码只负责确实难以通用化的面板，例如特定控制曲线、可行域、MASS 协同约束、黑箱数据预演等。

### 课程资源与知识图谱

课程资源由 `course-content/authoring` 进入 `course-content/runtime`。作者态保留讲义、BOPPPS、互动设计、互动契约、媒体和知识卡；运行态提供前端可读取的 `lesson.json`、`interactive-manifest.json`、讲义 Markdown、媒体索引、知识图谱覆盖层和知识卡内容。

知识图谱承担两个功能。第一，它为课程入口提供知识节点网络、先修/后继关系和本课关注节点。第二，它为课堂步骤和知识卡抽屉提供按步骤关联的概念解释。知识卡内容来自 runtime cards，入口页通常展示首页摘要，课堂内根据当前步骤展示相关知识点。

媒体资源通过每课的 `media/<lesson>-media.md` 组织，支持导入视频、音频、讲义 PDF、信息图等资源。课程入口页的媒体 hub 只读 runtime 媒体索引，避免前端直接依赖 authoring 目录。

### 教案、课堂与同步

平台课堂主线是 `TeachingResource -> LessonPlan/LessonItem -> ClassSession -> StudentPlayer/ResourceRenderer`。`TeachingResource` 表示可复用资源，`LessonPlan` 表示一次完整教案，`LessonItem` 把资源或知识节点放入 BOPPPS 环节，`ClassSession` 表示一次真实课堂会话。

课堂同步围绕教师端当前步骤和学生端提交状态展开。教师创建课堂后，学生通过课堂码加入；学生端根据 session 路由进入对应课程页面。课堂状态接口负责读取当前环节、当前资源、学生 state 和课堂状态。对精品互动课而言，`ClassSession` 同时记录 manifest 版本、哈希和总步数，便于后续判断课堂使用的是哪一版课程 runtime。

课堂事件包括进入课堂、打开资源、切换步骤、提交答案、重新提交、查看答案、AI 提问、课堂结束等。事件先进入 `/api/interactive/events`，再由同步物化或 worker/backfill 转成学习事实。带有 `clientEventId` 的事件具有幂等保护，异常 session 会被标记 `invalidContextReason`，避免错误上下文污染学生画像。

### 虚拟仿真与控制工具

虚拟仿真模块面向船舶控制工程场景。驱逐舰仿真强调航向控制、路径跟踪、舵角约束和高保真 MMG 步进；邮轮仿真强调舒适度、横摇、横向加速度、减摇鳍和滤波策略；挖泥船、半潜平台、破冰船等场景强调不同船型的动力学、执行器布局、环境扰动和任务评价。仿真页通常包含 3D 场景、HUD、控制面板、指标面板、轨迹/曲线和 AI 建议。

控制系统工具集中在 `src/resources/control-system` 和 `src/resources/interactive-learning`。它们提供阶跃响应、时域指标、Bode 图、Nyquist 图、根轨迹、零极点、可行域、参数滑块和多表征联动。图表使用 ECharts 和共享主题/轴配置；控制分析数据优先来自 Rust/WASM 或 runtime 数据，不应在每个页面各自实现不一致的计算逻辑。

Rust 内核 `rust/control-engine` 同时承担线性控制分析和虚拟仿真步进。前端通过 `src/resources/simulations/rust/control-engine-runtime.ts` 加载 WASM，并用 `compute_virtual_simulation_step` 根据 `modelId` dispatch 到对应模型。新增仿真时，界面代码应保持 UI 与状态管理职责，把数值积分、离散化和物理模型放入统一内核或 facade。

## 课程内容与 runtime 体系

课程内容采用作者态与运行态分层。

作者态位于 `course-content/authoring/lessons/<lesson>/`，通常包含：

- `design/handout.md`：学生讲义。
- `design/boppps.md`：BOPPPS 课堂组织。
- `design/interactive-page.md`：互动页作者态设计。
- `design/interactive-contract.yaml`：机读互动契约。
- `media/raw`、`media/processed`：媒体源文件、提示词、代码直出图和审查后产物。
- `graph`、`notes`：知识图谱、知识卡和制作说明。

运行态位于 `course-content/runtime/`，由导出脚本和审查脚本生成，供前端直接读取：

- `course-content/runtime/lessons/<lesson>/lesson.json`
- `course-content/runtime/lessons/<lesson>/interactive-manifest.json`
- `course-content/runtime/lessons/<lesson>/<lesson>-handout.md`
- `course-content/runtime/lessons/<lesson>/media/<lesson>-media.md`
- `course-content/runtime/knowledge/graph/*`
- `course-content/runtime/knowledge/cards/*`

运行态是学生端和课堂端的主要内容真源。前端通过 `src/lib/course-runtime.ts` 读取 lesson bundle、讲义、知识图谱覆盖层、知识卡和媒体索引。正式页面应优先读取 runtime 路径，而不是回读 authoring 路径。

## 课堂主干架构

统一课堂框架采用 DB BOPPPS 主干：

- `TeachingResource`：可编排资源，包含静态文本、媒体、互动组件、仿真应用和伦理场景。
- `LessonPlan`：教案，按 BOPPPS 环节组织课堂。
- `LessonItem`：教案环节，引用资源或知识节点，并允许通过 `overrideConfig` 做环节级配置覆盖。
- `ClassSession`：课堂会话，保存课堂码、教师、班级、状态、当前环节、manifest 版本与总步数。
- `StudentState`：学生在课堂内的提交、草稿、进度和交互状态。
- `InteractionLog`：互动事件原始日志。

课堂创建通常从预置教案开始：教师在课程入口或预置教案页克隆 `presetKey`，再调用 `/api/session` 创建课堂。学生通过 `/api/session/join` 或课堂码进入对应 student 路由。课堂页使用 `/api/session/[sessionId]`、`/api/session/[sessionId]/state` 和相关课程私有状态管理完成进度同步、提交保存与教师聚合。

## 精品互动课体系

精品互动课由 `src/features/interactive`、`src/lib/unit-*-course.ts`、`src/lib/unit-*-ai-contexts.ts`、`src/features/teacher/preset-lessons/presets` 和 `course-content/runtime/lessons` 共同支撑。

当前课程总览已经覆盖模块 2、模块 3、模块 4 和模块 5 的多门单元课，并保留早期精品课和普通 lesson 入口。多数新课遵循 runtime-first 模式：

- 课程入口复用 `PremiumLessonEntryPage`。
- 入口页展示 runtime 讲义摘要、知识图谱、知识卡片与媒体资源。
- 教师页和学生页按 `interactive-manifest.json` 渲染步骤。
- 步骤级 AI 上下文在 `src/lib/unit-*-ai-contexts.ts` 或课程级上下文中注册。
- 课堂事件接入统一互动埋点。

共享 manifest runtime 位于 `src/features/interactive/shared/manifest-runtime/`，负责按布局、内容模块和活动模块渲染 runtime manifest。课程私有页面只应承载确有必要的专用面板、数据适配和图表逻辑；通用题型、显影、提交状态、知识卡抽屉、讲义入口和媒体入口应优先复用共享组件。

## 教学资源注册边界

所有可编排互动资源和仿真应用应通过 `src/lib/resource-registry.tsx` 注册。教案只引用 `registryId`，不直接保存组件路径。

目录边界如下：

- `src/app/`：Next.js 路由、页面和 API。
- `src/features/`：平台业务域，包括 admin、ai、arena、assessment、dashboard、ethics、interactive、knowledge、lesson-engine、mission、teacher。
- `src/resources/`：教学资源本体，包括互动学习组件、控制系统图表、虚拟仿真和资源级 hooks/lib/types。
- `src/components/`：平台级基础 UI、共享组件和 Provider。
- `src/lib/`：平台通用服务、数据治理、课程 runtime、AI 上下文、鉴权、Prisma 等。
- `src/hooks/`：平台通用 hooks。
- `src/types/`：平台通用类型。

平台域不要直接侵入资源实现细节；资源相关逻辑应保持在 `src/resources/**`，平台只通过注册表、配置和公共接口编排。

## 虚拟仿真与控制数值内核

虚拟仿真集中在 `src/resources/simulations/`，控制分析与图表集中在 `src/resources/control-system/`。系统提供多船型仿真、PID/DP/舵角/轨迹等任务配置、AI 建议面板、指标评估和安全约束提示。

控制数值能力分为两层：

- 前端资源层负责界面、任务参数、状态显示、曲线与交互。
- Rust/WASM 层负责控制分析和物理步进，入口包括 `compute_virtual_simulation_step`、控制分析函数和虚拟仿真模型 dispatch。

`npm run build` 会先执行 `npm run wasm:build:control-engine`，再生成 Prisma 客户端并构建 Next.js。新增或改造仿真应遵守 `docs/Simulation_Guidelines.md`：固定步长时钟、线性模型 Tustin 离散化、非线性模型走内置积分器接口，避免在页面内直接手写漂移的数值步进。

## Arena 控制竞技场

Arena 是统一评测与排行榜层，不是单一控制方法工作台。基本单元是：

对象 + 任务 + 允许方法 + 评测协议 + 榜单规则。

相关代码位于 `src/features/arena/` 与 `/arena`、`/api/arena/*`。当前核心结构包括：

- 对象与任务种子：`src/features/arena/data/seed-challenges`。
- 挑战大厅与详情页：`arena-hall.tsx`、`challenge-detail.tsx`。
- 控制器工件：`ArenaControllerArtifact`，记录方法、参数和 hash。
- 官方评测：`ArenaEvaluationRun`，按 `taskId + artifactHash + protocolVersion` 复用结果。
- 提交记录：`ArenaSubmission`，支持主榜、方法榜、指标榜、Pareto、班级和赛季范围。
- 黑箱实验：`ArenaBlackBoxExperiment`，学生通过实验接口生成本人数据集，不暴露隐藏模型。
- 虚拟仿真预演：`ArenaVirtualSimulationRun`，用于将黑箱控制器工件导入虚拟仿真预演，不直接进入正式榜单。

白箱评测器支持 PID、串联校正、复合校正、参数化 MPC 和优化调参模板等固定结构。黑箱链路要求数据集归属和辨识模型来源可验证。正式排名只消费官方 `/api/arena/evaluate` 写入的真实提交记录。

Arena 的功能分为大厅、挑战详情、工作台、官方评测和榜单。大厅负责按对象来源、模型公开程度、章节、难度和方法筛选任务；挑战详情负责展示对象说明、任务目标、允许方法、评价指标、提交入口和排行榜预览；工作台根据任务类型进入多表征联动、框图工作台、黑箱辨识、预测控制或 Control Odyssey 模式；官方评测在服务端重新计算指标，不信任客户端自报结果；榜单根据真实 `ArenaSubmission` 生成主榜、方法榜、指标榜、Pareto 榜、班级榜和赛季榜。

Arena 对象来源包括典型对象、作业对象、Control Odyssey 对象、虚拟仿真对象和前沿挑战对象。模型可见性分为白箱、灰箱和黑箱。白箱对象可公开传递函数或状态模型；黑箱对象只暴露实验接口、数据集 hash、预算和官方评测接口。控制器方法包括串联校正、PID、优化 PID、复合校正、MPC、黑箱控制和代码型控制器，其中生产提交只开放已经有服务端评测器和边界校验的方法。

黑箱任务强调所有权和来源校验。学生先通过 `/api/arena/blackbox-experiments` 生成本人数据集，再基于数据集保存辨识模型或控制器工件；虚拟仿真预演写入 `ArenaVirtualSimulationRun`，用于观察闭环轨迹、安全违反、控制能量和平滑度，但不会直接进入正式排名。只有 `/api/arena/evaluate` 创建的官方提交才进入 `ArenaSubmission`。

教师发布报告基于持久化 `ArenaSubmission` 与班级花名册生成，不从前端榜单重建统计。报告按 publication、class 与教师/管理员授权范围聚合参与、有效率、分数分布、硬约束失败、薄弱指标、方法分布、未提交学生、个人最佳和优秀方案；学生提交面板则复用统一反馈规则解释正式排名、硬约束失败、个人最佳变化和黑箱聚合弱项，不暴露隐藏场景参数、顺序或轨迹。

## 数据治理与学习画像

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

数据进入路径包括 API 同步物化、worker 异步处理和历史回放脚本。课堂提交、session finalize、Arena 官方评测、仿真记录、题目作答和 AI 交互均可进入证据链，但只有高价值事件才应转成能力画像贡献。

学生画像和教师班级洞察会消费后端生成的 Arena 摘要。个人中心展示学生 Arena 最佳分、有效提交率、近期挑战、薄弱指标、方法偏好和提升次数；班级洞察按班级范围展示 Arena 达成率、平均分、硬约束失败分布、薄弱指标、方法分布和未提交人数。官方分数与有效性以 `ArenaSubmission` 为准，`LearningFact` 中的 Arena 上下文只作为辅助证据。

学生能力模型是六维结构：控制建模与分析、参数设计与调优、跨域迁移与联动、工程决策与约束、探究反思与提示词、自主学习进展。不同事件类型映射到不同维度，例如仿真指标主要影响参数设计和工程约束，题目作答主要影响控制建模与自主学习，AI 交互和提示词评价影响探究反思，设计类任务影响目标-行为-结果一致性和跨域迁移。

数据治理不是简单计数。`LearningFact` 记录事实类型、结果、得分、耗时、能力贡献和来源事件；`StudentCompetencySnapshot` 聚合事实并保存分数、趋势、置信度和证据数量；`StudentProfileSummary` 面向个人中心和 AI 助手提供可读摘要；`StudentRiskFlag` 用于记录需要关注的风险；`ClassCompetencySnapshot` 面向教师端提供班级层面的能力结构和整体趋势。

课堂提交的答题事实源已经从浏览器最终状态扩展到持久化的 `StudentStepResponse`。它用于保存关键互动步骤的提交版本、摘要、状态和可信 `sourceLogId`，避免只依赖 `StudentState.responses` 或客户端上报的日志 ID。4-4 数据治理回写脚本以该表为定向补数目标，并保持幂等：已回写记录会跳过，缺少可信原始日志或答案不完整的记录会被归入治理摘要，而不是伪造事实来源。

`ClassSessionReport` 同时保留 legacy event type 和 canonical event type 统计。同步错误、提交、重提交和结课事件应按 canonical 口径进入报告摘要；课堂参与人数、产生事实人数、提交人数和快照更新人数则写入 `sessionGovernanceSummary`，避免把长期画像中的 `activeStudentCount` 误读为单次课堂活跃人数。

后台处理由 API、worker、scheduler 和回放脚本共同完成。API 适合处理课堂核心提交等必须即时可见的事件；worker 适合处理批量事件、快照计算和治理任务；scheduler 负责定期生成学生和班级快照；backfill 脚本用于把历史事件重新物化为学习事实。排查画像异常时，应先区分原始事件、学习事实、快照和页面聚合接口属于哪一层。

## AI 能力

AI 功能不是单独聊天入口，而是嵌入多个教学场景：

- `/api/ai/chat`：通用 AI 对话接口。
- `/api/ai/konling-context`：控灵助手上下文。
- `src/lib/course-ai-contexts.ts` 与 `src/lib/unit-*-ai-contexts.ts`：课程、步骤和知识点级 AI 上下文。
- `src/features/ai/companion`：仿真与学习过程中的伴学和干预。
- 管理员 `/admin/config`：AI 供应商、模型、启用状态与响应测试。

AI 设计原则是读取课程 runtime、课堂状态、学生证据和任务上下文后给出教学反馈；它不应绕过官方评测器、课程契约或数据治理事实口径。

平台内的 AI 能力主要分为四类。第一类是课程内 AI，上下文来自当前课程、当前步骤、知识节点、学生提交和课堂状态，服务于概念解释、推理提示和答疑。第二类是仿真伴学 AI，读取当前仿真状态、控制器参数、指标和安全约束，给出参数调整或现象解释。第三类是数据治理 AI 摘要，面向个人中心、教师学情和推荐路径，把学习事实转成可读建议。第四类是管理员可配置的模型供应层，用于切换供应商、模型 ID 和启用状态。

AI 接口必须遵守两个边界。它可以解释、提示、总结和建议，但不能伪造学习事实、不能代替官方评测器给出 Arena 成绩、不能跳过课堂契约直接改变课程步骤。课程级 AI 上下文应从 `src/lib/course-ai-contexts.ts`、`src/lib/unit-*-ai-contexts.ts` 和 runtime 内容读取，而不是在组件中硬编码大段课程知识。

## 自适应练习与评价

自适应练习位于 `/assessment/adaptive-practice`，后端接口包括诊断、下一题、生成题目、提交答案和能力报告。它用于把学生在题目中的表现转成薄弱点、推荐关注方向和能力报告。题目与诊断结果可以进入数据治理链路，成为控制建模、自主学习和跨域迁移能力的证据。

评价模块还包含提示词质量评估和一致性追踪。`src/features/evaluation/prompt-quality.ts` 会从完整性、精确性、结构化、可执行性等维度分析学生提示词，并记录历史表现。该模块服务于“探究反思与提示词”能力维度，不应被混同为通用聊天评分。

## 伦理与安全约束

伦理与安全模块位于 `src/features/ethics` 和仿真资源中。早期功能包括伦理场景、伦理沙盒、违规弹窗和结果面板；在仿真与 Arena 中，安全约束更多体现为舵角、横摇、安全区域、执行器饱和、控制能耗、鲁棒隐藏场景和硬约束门槛。

伦理事件与安全违规可以进入 `EthicalLog`、`EthicsDecision` 或学习事实链路，影响工程决策与约束维度。平台在此处关注的是工程判断和风险识别，而不是单独展示道德说教页面。

## 部署与运行

项目采用本地开发、容器化部署和远端 Podman 运行方式。

常用命令：

```bash
npm run startup
npm run shutdown
npm run dev
npm run build
npm run start
npm run lint
npm run test
npm run test:integration
```

镜像构建默认使用：

```bash
bash scripts/build.sh
```

远端部署主要通过：

```bash
bash scripts/remote-deploy.sh
```

运行时课程资源通常不打包进镜像，而是同步 `course-content/runtime/` 到服务器并以只读挂载方式供容器读取。容器启动时默认执行 Prisma 迁移；生产排障需同时检查应用容器、worker、scheduler、PostgreSQL、Redis、systemd 服务和 `/api/readyz`。

## 维护入口

高频维护入口如下：

- 项目说明：`docs/ProjectDescription.md`
- 统一课程框架：`docs/Unified_Lesson_Framework.md`
- 仿真规范：`docs/Simulation_Guidelines.md`
- Arena 设计：`docs/arena.md`
- 课程作者态：`course-content/authoring/lessons/`
- 课程运行态：`course-content/runtime/`
- 项目长期记忆：`docs/memory/`
- 项目技能：`.codex/skills/`
- 运行日志：`.logs/`
- 数据模型：`prisma/schema.prisma`

修改核心功能后，应按改动范围运行定向测试、`npm run lint`、`npm run test` 和 `npm run build`。涉及 Rust/WASM、Prisma schema、课堂同步、数据治理、Arena 或课程 runtime 的变更，还应补充对应的定向 Vitest、脚本测试或 Playwright 验收。
