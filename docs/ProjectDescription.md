# AI-OBE 船舶智控平台项目说明

## 文档定位

本文用于帮助维护者、协作代理和外部审阅者快速理解本项目当前的产品形态、架构边界、主要运行链路和近期工程重点。它不是提交日志；具体变更应以 `openspec/changes/`、`openspec/specs/`、专题设计文档和 `docs/memory/` 为准。

当前项目已经从“精品互动课 + 基础画像”的阶段，推进到“统一平台壳层、标准互动课、控制仿真、Arena、学习路径、智能助教和数据治理共同构成教学闭环”的阶段。控制校正、智能助教、React Doctor 治理、统一壳层、资源语义闭环和知识图谱交互治理已经进入 `openspec/specs/`、Prisma 模型、数据治理实现或 UI 验收证据。2026-07-18 的 `openspec list --json` 没有未完成任务；列表中的四个 change 均已完成任务，尚未全部归档。后续判断项目现状时，应优先使用本文、`docs/memory/02-recent-summary.md`、`docs/memory/10-project/10-current-state.md`、当前 OpenSpec 状态和已归档 specs，而不是早期课程制作或 PR 执行记录。

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
- `/profile`、`/profile/evidence`、`/profile/growth`：学习活动、证据复盘、能力画像、风险摘要、Arena 概览、成长记录和推荐资源。

学生端状态不只存在于浏览器。课堂提交进入 `StudentState` 和关键步骤持久化记录；资源与课堂事件进入 `InteractionLog`；高价值行为经数据治理进入 `LearningFact`、`StudentCompetencySnapshot`、`StudentProfileSummary` 和推荐链路。

### 教师端

教师端围绕课程组织、班级治理、Arena 发布和学情诊断：

- `/teacher`：教师工作台。
- `/teacher/preset-lessons`：预置教案克隆入口。
- `/teacher/lesson-plans`：教案创建、编辑和管理。
- `/teacher/classes`：班级管理、学生导入、课堂记录和班级学情入口。
- `/teacher/classes/[classId]/analytics-v2`：班级学情总览。
- `/teacher/classes/[classId]/students/[studentId]`：学生个体学情与证据视图。
- 班级与学生学情页提供持久化诊断报告历史；正式生成前以当前生成器可读取的风险、能力快照和知识进度执行确定性预检。普通生成在输入与版本均未变化时被阻止，教师强制生成必须填写理由，并将前序报告、证据截止点、输入摘要和规则版本写入审计链。
- 固定诊断版本可形成教师交付版和学生安全版；服务端按报告、投影版本、角色版本和学生受众建立稳定 PDF 制品身份，并为每次成功导出保留操作人和时间。学生安全版只接受学生范围报告，排除同伴数据、教师内部说明和原始证据标识。教师可以进入既有学生、备课和已注册资源页面，并以追加式事件记录查看、待处理、已安排干预和已完成处置；这些状态不修改诊断风险、成绩、画像或趋势。
- `/teacher/assignments`：作业列表、单页编辑工作台、受治理题库选题、评分项编排、保存状态与发布校验入口。
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

统一壳层当前覆盖教师/管理员数据中心、教师治理工作台、任务空间、Arena/控制工作台入口和若干课程入口。`AppShell` 在测试中会被纯函数调用，因此顶层不能直接引入会依赖运行时 hook 的逻辑；需要运行态上下文时，应放到子组件或可选上下文边界内。

AppShell 折叠导航合同已经归档：桌面展开态为 248px 侧栏，收起态为 72px 图标栏，收起链接使用注册图标并保留 aria/title 标签，不显示首字截断文本。`artifacts/commercial-ui/app-shell-collapsed-navigation-413/` 保存 `/arena` 与 `/interactive-learning/control-workbench` 的 light/dark、展开/收起/移动证据，`appShellNavigationContract: collapsed-icon-rail` 由商业 UI 治理门禁校验。

学生二级路线壳层迁移已经归档：`/interactive-learning`、`/interactive-learning/courses`、`/interactive-learning/chapter-components`、`/interactive-learning/cross-domain-exploration` 和 `/assessment/adaptive-practice` 共享 `AppShell` 学习图谱壳层、中央学生旅程导航和 72px 收起导航证据。`artifacts/commercial-ui/student-secondary-routes-414/` 保存五条路由的 light/dark、展开/收起/移动证据。

知识图谱壳层迁移已经完成实现：`/knowledge` 使用可收起 `AppShell`，公开态、学生登录态和教师登录态都走中心角色导航；章节目录、关系筛选、图例、2D/3D 切换和资源面板保持知识图谱局部工具语义，不再作为平台导航。`artifacts/commercial-ui/knowledge-map-unified-shell-415/` 保存 light/dark、展开/收起/移动命令面板证据。

数据中心角色可见性已经完成实现：`/data-center` 只面向教师和管理员，学生直接访问默认进入 `/profile/evidence`；普通数据中心 UI 的“演示数据”来源标签默认隐藏，由管理员配置控制，管理员审计和治理视图仍保留来源可见性。`artifacts/commercial-ui/data-center-operations-roles-416/` 保存学生重定向、教师标签关闭/开启和管理员审计来源可见证据。

统一 UI 治理已经覆盖二级导航、知识图谱壳层和角色可见性。知识图谱近期又完成根节点气泡布局、边界几何和 inspector 持久化治理；React Doctor 系列中的 server、aria role、shared state/effect、interactive state/effect 和 resource state/effect 已归档到 specs。

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

智能课件发布的双回执、不可变版本、课堂绑定实施状态和 P0 验收边界见 [智能课件发布 P0 运行手册](./operations/smart-courseware-p0-runbook.md)。

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

## 智能备课文档

教师智能备课以课程依据、六阶段 BOPPPS 教案和互动课件为三个受治理文档域。三类文档共用全屏编辑外壳、保存状态、结构导航和 AI 建议区域，但各自保留原有 schema、校验、版本、批准与发布契约。课程依据以 Markdown 为规范编辑格式，未使用版本可原位更新，已确认、引用或投影的版本通过后继版本继续编辑；教案固定六个顶层 BOPPPS 阶段，只允许编辑内部步骤；互动课件继续由 manifest 和共享 slide runtime 校验。

富文本文档适配器位于 `src/features/teacher/preparation-document-editor/`，当前使用固定版本的 Tiptap 与 Markdown、表格、公式扩展，也为作业题面和参考答案提供嵌入模式。自动保存和显式保存都携带乐观修订，冲突与失败保留浏览器本地副本。AI 建议的接受与忽略属于普通编辑操作，不会执行教师批准。

智能教案生成使用受治理的备课资源包：教师可以组合已授权上传资料与确认到章节、节的教材范围，系统为知识点、目标和生成内容保留可检查、可替换、可移除的来源绑定。默认班级读取当前累积画像；班级改变或语义内容改变会使既有生成结果失效，缺少可靠来源时必须由教师确认原因。真实结构化模型按 BOPPPS 阶段生成并记录可恢复的尝试，失败恢复不会覆盖已完成阶段。教师可在统一编辑器中保存教案、获取 AI 建议、重新打开任务，并删除未发布任务。桌面与窄屏工作区使用同一业务流程。

## 数据治理、学习路径与智能助教

数据治理位于 `src/lib/data-governance/`，负责把互动日志和后台事件转成可解释的学习证据。

主要数据表与链路：

- `InteractionLog`：课堂、资源、知识卡、Arena 和交互组件的原始事件。
- `LearningEventBatch`：二级事件批处理存储。
- `EventDictionary`：核心事件词典和能力映射。
- `LearningFact`：从事件中物化的统一学习事实。
- 仿真任务证据：虚拟仿真、控制工作台、Arena 与控制奥德赛的合格学生产物按稳定任务键和不透明产物键写入零画像权重的不可变 `LearningFact`；Arena 只接受有效官方提交，其他运行必须绑定学生所有的持久化结果。
- 仿真任务画像：`simulationValidationEvidence` 以当前发布的全局任务目录为统一分母，只统计带明确完成权威的满分任务；历史候选通过防篡改计划逐学生增量应用，目录变化通过 fenced reconciliation 刷新个人画像和当前 roster 班级均值，无合格证据时保持不可用而不填零。
- `StudentPortraitV2Snapshot`：学生七维 portrait v2 主画像快照；`StudentCompetencySnapshot` 仅作为历史兼容输入。
- `StudentEvidenceFeatureCache`：受治理证据缓存，包含带 authority 标记的 portrait v2 主画像和兼容快照。
- `StudentProfileSummary`：面向 AI 和页面展示的学生画像摘要。
- `ClassCompetencySnapshot`：班级七维 portrait v2 聚合画像。
- `StudentRiskFlag`、`GrowthRecord`、`LearningRecommendation`：风险、成长和推荐链路。

学生画像当前以七维 portrait v2 为主模型：控制建模与表征、系统分析与解释、控制器设计与综合、仿真验证与证据、工程约束与安全、迁移整合与应用、反思改进与 AI 协作。历史六维 `competencyVector` 仅通过显式兼容适配器参与迁移、回退和审计，不得作为页面、路径或推荐的主画像。

控制校正学习路径与全课程智能助教已经从提案推进到多项实现和归档 specs。当前稳定能力包括 goal slice 注册、角色化诊断、学习证据 RAG 语料、文档 rubric 批改工作台、教师备课增强包、智能助教 demo 包、控制校正诊断画像、教师报告和评估 demo。近期 Prisma 模型已经包含 `DiagnosisReportSnapshot`、`CourseEnhancementPack` 以及与路径执行、偏差、干预、证据缓存相关的表。

后续继续扩展智能助教时，应把控制校正作为可验证样例，把全课程助教作为泛化平台能力，而不是复制某个目标切片的专用逻辑。

智能助教设计的关键不是单独聊天框，而是同一事实源驱动的闭环：

学习证据采集 -> 能力画像更新 -> 定性/定量诊断 -> 多路径推荐 -> 资源执行 -> 作业/试题批改 -> 下次课增强包 -> 控灵伴学解释与追踪。

文档/PDF 批改能力应把 MarkItDown 视为非统一作答文档的 PDF/Office 到 Markdown 转换适配器，不把它当作评分系统或高保真 PDF 阅读器。统一作答中的 PDF、Office 文档和图片采用受外部处理政策约束的 Mathpix-only 理解路径，不允许本地二进制语义进入 evaluator、batch、批准或写回链；Markdown 与纯文本附件在校验对象完整性后由平台限量直读。部分附件无法理解时，系统保留原件和缺失清单，AI 结果保持为待教师确认的证据不完整建议。评分、教师审核、学生反馈、证据引用和画像回写需要独立契约。

## AI 与控灵

AI 能力嵌入多个教学场景：

- `/api/ai/chat`：通用 AI 对话接口。
- `/api/ai/konling-context`：控灵助手上下文。
- `src/lib/course-ai-contexts.ts`、`src/lib/unit-*-ai-contexts.ts`：课程、步骤和知识点级 AI 上下文。
- `src/lib/konling-agent-runtime.ts`：控灵模式、工具、上下文与引用约束。
- `src/features/ai/companion`：仿真与学习过程中的伴学和干预。
- 管理员 `/admin/config`：AI 供应商、模型、启用状态与响应测试。

AI 可以解释、提示、总结和建议，但不能伪造学习事实、不能代替官方评测器给出 Arena 成绩、不能跳过课堂契约直接改变课程步骤。未来 Konling 模式需要按诊断、路径建议、资源辅导、批改反馈、班级摘要和备课共创分别声明上下文、工具、引用类别、隐私边界和 fallback。

## 权威知识候选与 ActKG 协议变基

当前候选权威知识底座锁定为 ActKG CTKG 0.2 聚合工程包 `control-theory-engineering-v0.2`：841 个 release entries、744 个投影节点、97 条投影关系和 1302 条唯一上游 RAG crosswalk，谓词词表共九种。两个组件发布只用于校验聚合包声明的血缘与哈希，不作为并列导入项。

公共 bundle 按原始字节完整导入，可逐字节重构并校验 SHA-256；ActKG 私有 CTKGDataset 明确不可用，平台不导入、不推断、不重建其内容。CTKG 0.1 仅保留为历史精确适配器，用于审计与回归，不再参与当前候选准入。2026-08-11，生产事务 `production-v040-58f70df-20260811T083732Z` 已将四类 selector 切换到冻结 `v0.4.0` 包中的 Authority Snapshot、Teaching Projection、prerequisite publication 与 consumer activation；六个 versioned graph consumers 以该组合运行。Legacy reader、crosswalk 与历史审计证据仍保留，但不再是这六类消费者的生产 authority。

候选 Repository、三项投影（`act.canvas.v2`、`act.node-detail.v2`、`act.migration-review.v1`）、候选图谱与候选态控灵绑定同一聚合 ReleaseSet、`projectionDigest` 与 `sourceDatasetHash`，不混入旧 root-locus 行；方向或谓词与固定合同冲突时在导入或投影契约处失败关闭，不再运行时改写。旧发布身份下的 inventory、crosswalk、candidate、decision 与 binding 输出只保留为 historical/stale 审计记录，不充当当前 readiness。

标准 public Bundle 可经兼容校验后作为显式非生产候选导入（#1131）；导入完成后 ACT 从已往返验证的数据库快照复算 `ReleaseSetDeltaReceipt`（#1132）。当前环境首个标准候选以已接受的 #1125 v0.2 为冻结 base；仅当安装内完全没有已接受 ReleaseSet 时才标记 `BASELINE`。上游 `release-diff` 只作交叉验证，分歧时不落 accepted 信号；纯包装修订只记录 Bundle 身份、不产生语义 signals。通用失效/增量信号只描述对象/关系/Crosswalk/组件/Projection/词表身份与原因，不决定课程角色、资源角色、教学关系，也不移动 candidate/active/Legacy selector。

下游 CourseCoverage 与 ACT structural-unit crosswalk、资源教学角色、RAG/KAQ/SAR、学习路径和学习事实仍分别受各自依赖门禁约束，不在 Delta 计算边界内接线。此次生产切换不提升数据库 candidate、Canonical resource-binding shadow 或 KAQ selector；它只激活已经 READY 的 versioned graph consumer 组合。

## OpenSpec 与工作树协作

本项目使用 OpenSpec 管理功能开发。已完成变更会归档到 `openspec/specs/`，尚未归档的变更位于 `openspec/changes/`。新功能、治理、UI 重构、依赖迁移和智能助教能力都应先形成 proposal、design、tasks 和 spec delta，再进入实现。课程知识基座重建准备系列当前采用 ADR 0045 的边界：只治理当前课程真源、发布图谱、审核映射和活跃引用；历史事实与派生状态保留原图谱修订，切换后新事实才绑定唯一活动的新修订。该系列不以历史事件重放、画像对账或全库 writer 闭包作为 readiness 条件。

工作树是长期隔离边界。基线分支为 `integration`，发布分支为 `main`；具体工作树、分支与授权范围以当前任务上下文和 `git worktree` 实际状态为准，不在长期文档中固化易变化的本机分工。进入永久工作树后，不再为同一任务创建第二层工作树。

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
rtk npm run deploy:app -- --skip-build
```

课程 runtime 走独立 OSS 发布，不要用应用部署脚本同步本地 tree：

```bash
rtk npm run deploy:runtime
```

生产排障需同时检查应用容器、worker、scheduler、PostgreSQL、Redis、systemd 服务和 `/api/readyz`。生产容器从已物化的 OSS blob-view 只读 bind 读取 runtime，默认 `RUNTIME_DELIVERY_MODE=ossfs-blob-view`。`legacy-rsync` 已退役；更新 runtime 只能使用 `npm run deploy:runtime`。操作细则见 [OSS runtime 迁移手册](./operations/oss-runtime-migration.md)。

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
