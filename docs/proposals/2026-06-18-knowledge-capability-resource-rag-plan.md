# 知识-能力-资源-RAG 统一底座计划

## 总判断

本计划的核心判断是：平台下一阶段不应只落地一个独立 RAG 系统，也不应只把路径规划改成更复杂的资源推荐器。真正需要建立的是一个统一的教学语义底座，把知识图谱、能力图谱、统一资源库、可验证引用、学习证据和自适应路径规划连接起来。

当前系统已经具备若干基础：知识图谱、ResourceNode、路径规划、学习证据 RAG、控灵运行时、讲义与互动课 runtime、仿真与 Arena 证据。问题在于这些能力仍然容易各自维护一套资源理解：路径规划看 ResourceNode，控灵看证据引用，课程 runtime 看 registry，知识图谱看知识节点，习题和媒体资源又有自己的材料边界。随着讲义、教材、视频、音频、图片、习题、互动课、仿真和 Arena 任务持续膨胀，如果不先统一资源身份、知识映射、能力目标、引用定位和证据能力，后续 RAG、路径规划和控灵都会出现口径分裂。

因此，本计划建议把平台从“资源驱动”升级为“知识-能力-资源-证据驱动”：

```text
知识图谱定义事实结构
  -> 能力图谱定义掌握目标
  -> 统一资源库登记可学习、可引用、可执行、可验证的资源
  -> 检索投影服务控灵 RAG 与可点击引用
  -> 规划投影服务自适应路径与资源排布
  -> 证据投影服务诊断、画像、路径推进与教师干预
```

这不是新增一个功能层，而是为已有功能建立共同语义层。

## 基本约定

### 知识节点描述 fact

知识节点应描述相对客观的学科事实、概念、定理、方法、模型和结构关系。它不应被教师的教学偏好直接改写。例如“闭环特征方程”“相位裕度”“根轨迹渐近线”“奈奎斯特稳定判据”是知识节点；不同教师可以选择不同教学顺序和掌握要求，但不应改变这些节点的基本事实含义。

知识图谱中的边应表达学科关系，例如：

- `prerequisite-of`：先修依赖。
- `derived-from`：推导来源。
- `part-of`：组成关系。
- `contrasts-with`：对比关系。
- `applies-to`：应用关系。
- `represents`：表征关系。

这些边可以为教学路径提供依据，但不能直接等同于路径规划边。

### 能力目标体现教育要求

能力目标应建立在知识节点之上，描述学生应达到的掌握水平。能力目标不是知识事实本身，而是教师、课程或培养方案对知识掌握程度的要求。

同一个知识节点可以绑定多个能力层级。例如“闭环特征方程”可以有如下能力目标：

| 能力层级 | 要求 |
| --- | --- |
| 识记 | 能说出闭环特征方程的定义 |
| 理解 | 能解释闭环特征方程与稳定性的关系 |
| 应用 | 能从方框图写出闭环特征方程 |
| 分析 | 能判断参数变化对闭环极点的影响 |
| 评价 | 能比较不同校正方案对闭环稳定裕度的影响 |
| 创造 | 能设计满足约束的校正结构 |

能力图谱可以采用布鲁姆动词作为通用层级语言，但具体能力项必须落到课程语义和可观察证据上，不能只停留在抽象动词。

### 资源是统一实体，不是 RAG chunk

统一资源库管理的对象应是资源实体，而不是检索片段。讲义、教材章节、知识卡、视频、音频、图片、习题、互动课步骤、仿真任务、Arena 任务、项目任务和教师讲评都可以成为资源。

RAG chunk 只是资源的检索投影；路径节点只是资源的规划投影；前端链接只是资源的展示投影；学习事件只是资源的证据投影。不能让其中任何一种投影反过来成为资源真源。

建议采用如下层级：

```text
Resource
  -> ResourceSegment
      -> CitationTarget
      -> RetrievalChunk

Resource
  -> PlanningUnit
      -> PathNode
```

- `Resource`：统一资源实体。
- `ResourceSegment`：资源内部可定位片段，例如 Markdown block、视频时间段、音频时间段、图片说明区、习题小问。
- `CitationTarget`：可点击引用地址。
- `RetrievalChunk`：供混合检索使用的索引片段。
- `PlanningUnit`：可被路径规划选择的学习动作。
- `PathNode`：某个学生某次路径中的执行节点。

需要特别明确的是，`ResourceNode` 仍然是当前路径规划已经归档的治理合同。短期内，`PlanningUnit` 应作为 `ResourceNode` 的语义细化、生成来源或规划投影说明，而不是绕开 `ResourceNode`。任何进入自适应路径的资源仍必须经过 `ResourceNode` 的 audit、eligibility、launch target、privacy policy、evidence instrumentation 和 path semantics 治理。

### 路径规划目标是知识目标与能力目标

路径规划不应只按资源类型或标签推荐资源。实际目标应来自知识节点和能力目标：

```text
学生当前状态
  + 目标知识节点
  + 目标能力层级
  + 先后修关系
  + 可用资源与证据能力
  + 学习者偏好和约束
  -> 生成可执行路径
```

路径节点的粒度应是“学生可以执行、系统可以判断状态变化”的学习动作，而不是任意文本片段。一个资源可以拆出多个 PlanningUnit，但 PlanningUnit 需要具备明确的学习目的、预计时间、完成条件、证据能力和前置关系。

### 控灵回答必须基于资源语义和学习者状态

控灵回答不应只做相似文本检索。它应同时使用：

- 用户所在课程、单元、知识节点和能力目标。
- 资源的知识映射、能力映射、权威等级和引用位置。
- 学习者画像、偏好、历史路径、诊断和证据质量。
- 当前页面、当前路径节点、当前课堂或任务上下文。

控灵应优先返回带可验证引用的回答。模型只应产生引用意图或引用标识，最终可点击链接由后端 citation resolver 生成。引用必须后验校验，不能信任模型自行拼接 URL 或声称来源。

## 统一资源模型

统一资源模型应包含下列属性组。不同场景可以读取不同子集，但统一语义层集中的是身份、映射、投影、引用、治理和审计，不是把所有内容复制到一个大表里。讲义 runtime、TeachingResource、resource registry、互动课 manifest、视频音频资源、仿真、Arena 和评分工件仍应保留各自 source-of-record；统一层负责把它们登记为可规划、可检索、可引用、可验证的资源。

| 属性组 | 说明 |
| --- | --- |
| identity | `resourceId`、来源、版本、hash、source of record |
| content | 标题、摘要、正文或转写文本、图片描述、媒体时间轴 |
| pedagogy | 课程、章节、知识节点、学习目标、先修关系、难度 |
| capability | 能力层级、布鲁姆动词、能力证据类型、掌握标准 |
| planning | 是否可进入路径、预计时间、认知负荷、适用策略、前置 PlanningUnit |
| retrieval | 可索引文本、chunk 策略、关键词、embedding、全文索引字段 |
| citation | Markdown anchor、block id、页码、视频时间点、音频时间点、图片区域 |
| rendering | 前端路由、播放器、互动组件 registry、外部链接 |
| evidence | 是否能产生完成证据、掌握证据、诊断证据、仿真/Arena 证据 |
| governance | 权限、角色可见性、教师策略、审定状态、质量警告、过期状态 |

文本类资源应尽量转为 Markdown，并为标题、段落、公式、表格、图片、例题和小结生成稳定 block id。文本中嵌入图像时，图片附近的描述应进入资源段落，但图片本身仍需有独立资源标识和可点击位置。

视频和音频资源应保留原始媒体地址、完整 transcript 或关键时间轴、时间点摘要和可跳转时间参数。引用链接应能够跳到准确时间点或时间段起点。

图片资源不应只通过附近文字被引用。图片需要独立登记图片说明、来源位置、OCR 文本、可选区域描述和展示链接。

习题应作为资源进入统一体系。每道题或小问应绑定知识节点、能力层级、先修要求、评分规则、常见错误和可生成证据。习题既可以服务路径规划，也可以服务控灵解释、诊断和教师报告。

## 四类图谱

### 知识图谱

知识图谱回答“学科事实之间有什么关系”。它应稳定、可审定、少受教师个体偏好影响。

知识图谱节点应避免混入“学生要达到什么水平”或“这节课要怎么教”的语义。那些应进入能力图谱和教学策略层。

### 能力图谱

能力图谱回答“围绕某个知识节点，学生需要达到什么掌握水平”。它允许课程、教师、班级或阶段有不同目标，但必须可映射到证据。

能力图谱不得替代现有能力画像或 goal slice。Bloom 层级只是目标层级语言；实际实现应映射到现有 competency dimensions、`adaptive-goal-slice-registry`、学习目标、证据类型和 materialized learner-state。也就是说，能力目标回答“这个知识点要达到什么水平”，画像维度回答“学生当前表现如何”，两者通过证据和目标映射连接。

能力图谱至少应包含：

- 绑定知识节点。
- 能力层级。
- 行为动词。
- 成功表现。
- 可观测证据。
- 可用资源类型。
- 评价方式。

### 资源图谱

资源图谱回答“哪些资源覆盖哪些知识节点、训练哪些能力、产生哪些证据”。资源图谱是路径规划和 RAG 检索共用的上游。

资源图谱不只表达“资源属于哪个章节”，还要表达：

- 覆盖的知识节点。
- 目标能力层级。
- 支持的学习动作。
- 资源内部片段与知识/能力的对应关系。
- 可产生的完成证据和掌握证据。
- 权威等级和审定状态。

### 学习证据图谱

学习证据图谱回答“学生在知识节点和能力目标上表现如何”。它不应直接替代知识图谱或资源图谱，而应作为学习者状态层。

证据可以来自答题、批改、视频观看、讲义阅读、互动课操作、仿真任务、Arena 提交、控灵问答、教师评价和反思报告。不同证据需要有不同置信度、时效性和权重。

## 混合检索与引用策略

完整 RAG 应采用混合检索，而不是单纯向量检索：

```text
权限与场景过滤
  -> 关键词/全文检索
  -> 向量语义检索
  -> 知识节点与能力目标过滤
  -> 资源权威等级排序
  -> 学习者状态重排
  -> 引用候选后验校验
```

全文检索适合术语、公式、定理、章节标题和习题编号。向量检索适合语义接近的问题。知识/能力过滤保证结果在教学语义上对齐。后验引用校验保证控灵不能编造来源。

引用策略应满足：

- 知识解释必须引用课程资源、知识卡、教材或教师审定材料。
- 路径推荐原因必须引用知识/能力目标、资源属性和学习证据。
- 批改反馈必须引用题目、评分标准、学生提交片段和教师审定规则。
- 多媒体引用必须能跳到视频/音频时间点或图片位置。
- 权限不足的引用应被拒绝或脱敏，而不是展示内部路径。

## 路径规划策略

路径规划应消费规划投影，而不是直接消费 RAG chunk。规划投影的基本单位是 PlanningUnit。

PlanningUnit 至少需要包含：

- 绑定资源和资源片段。
- 覆盖知识节点。
- 目标能力层级。
- 预计时间。
- 认知负荷。
- 先修 PlanningUnit 或知识节点。
- 完成条件。
- 证据行为。
- 是否可跳过、替代或作为终端验证。
- 适用学习者状态。

路径规划可以按如下逻辑运行：

```text
确定目标知识节点与能力目标
  -> 读取学生当前证据状态
  -> 找出缺口与先修阻塞
  -> 选择候选 PlanningUnit
  -> 按时间、负荷、偏好、证据能力、资源多样性排序
  -> 生成多条风格明确的路径
  -> 路径执行后写回证据
```

这意味着未来路径不应只是“看讲义、做练习、进仿真”的粗颗粒列表，而应能够生成“先补某个知识节点的理解层级，再通过某个互动任务验证应用层级，最后用仿真或 Arena 形成迁移证据”的学习路线。

## 控灵策略

控灵应作为解释层和伴学层，而不是独立事实源。

控灵回答问题时应先解析问题的教学语义：

- 问题对应哪些知识节点。
- 问题要求哪个能力层级。
- 学生当前在哪些相关节点上证据不足。
- 当前资源、路径或课堂上下文是否限定回答范围。

然后再检索资源与证据。对于同一问题，不同学生可能得到不同解释顺序和推荐材料，但知识事实和引用来源必须稳定。

控灵输出应区分：

- 事实解释：主要引用知识资源。
- 个性化诊断：引用学习证据和诊断快照。
- 路径建议：引用能力目标、资源属性和学习者偏好。
- 批改解释：引用题目、rubric、学生答案和教师审定记录。
- 媒体引导：引用视频、音频、图片或互动课片段。

控灵不能把未经审定的生成内容写入高价值画像。需要写入画像或路径决策的内容，应经过证据抽取、置信度评估和必要的教师复核。

## 既有 specs 与 active changes 关系

该计划是上游发展方向，不应覆盖或绕开现有 OpenSpec 合同。后续拆分时应优先复用下列能力：

- `adaptive-learning-path-planning`：路径规划已经消费 audited `ResourceNode` graph，并要求 path node 具备 path semantics、launch target、evidence behavior 和 completion metadata。
- `teacher-resource-node-management`：教师侧已经有 ResourceNode 浏览、映射质量、路径资格、治理警告和 scoped edit 的合同。
- `learning-evidence-rag-corpus`：当前学习证据 RAG 已经定义 course content、knowledge card、runtime handout、path summary、diagnosis、grading、simulation、Arena 和 teacher report 等 source types，并要求 citation verification、privacy scope 和 teaching knowledge / learner evidence 分层。
- `konling-agent-runtime`：控灵已经有 server-owned context、citation classes、path advisor、grading、prep pack 和 privacy scope 合同。
- `student-evidence-feature-cache`、`simulation-arena-evidence-governance`、`document-rubric-grading-workbench`：这些能力已经定义一部分证据来源、质量、回写和教师复核边界。

当前 active changes 中，`add-adaptive-path-launch-return-context`、`restore-adaptive-path-resume-completion-state` 和 `fix-adaptive-path-option-selection-layout` 正在处理路径节点启动、返回、恢复、选择和完成状态。本文后续 Issue F 和 Issue H 不能抢先改写这些执行语义；应等待这些变更完成，或在 OpenSpec 中显式声明依赖关系与非重叠范围。

## 后续 OpenSpec 拆分建议

**Issue A：Unified Resource Semantic Model**

内容：定义统一 Resource、ResourceSegment、CitationTarget、PlanningUnit、RetrievalChunk 的模型边界；梳理现有 ResourceNode、resource registry、knowledge card、interactive runtime、media、assessment、simulation 和 Arena 的映射关系。

验收：现有资源类型都能映射到统一资源模型；不会把 RAG chunk 或 PathNode 当作资源真源；模型包含版本、权限、知识映射、能力映射、引用定位和证据能力。

依赖既有 specs：`adaptive-learning-path-planning`、`teacher-resource-node-management`、`learning-evidence-rag-corpus`。

风险：中。

**Issue B：Knowledge-to-Capability Graph Layer**

内容：在现有知识图谱之上建立能力目标层，支持按知识节点绑定布鲁姆层级、行为动词、成功表现、可观测证据和评价方式。

验收：至少以控制系统校正主题为样例，完成一组知识节点到能力目标的映射；知识节点事实关系与能力要求关系保持分离。

依赖既有 specs：`adaptive-learning-path-planning`、`student-evidence-feature-cache`、`role-based-learning-diagnosis`。

风险：中。

**Issue C：Resource Mapping and Teacher Governance Workspace**

内容：先扩展教师资源管理工作台的只读审计与缺口清单，使教师能查看资源的知识覆盖、能力覆盖、路径资格、证据能力、审定状态和治理警告；后续再开放 scoped edit。

验收：教师能筛选缺少知识/能力映射的资源；缺少关键映射或证据能力的资源默认不能进入高置信路径规划。

依赖既有 specs：`teacher-resource-node-management`、`adaptive-learning-path-planning`。

风险：中。

**Issue D：Citation Address and Resolver**

内容：建立统一引用地址模型和 resolver，支持 Markdown block、页内锚点、图片位置、视频时间点、音频时间点、互动课步骤和外部资源链接。

验收：控灵和前端都不直接拼接引用 URL；引用 ID 经过后端解析后生成可点击链接；无权限或过期引用被拒绝或脱敏。

依赖既有 specs：`learning-evidence-rag-corpus`、`konling-agent-runtime`、`platform-data-center-ui`。

风险：中。

**Issue E：Resource Retrieval Corpus and Hybrid Search**

内容：扩展既有 `learning-evidence-rag-corpus`，增加资源检索投影与教学知识/学习证据分层检索策略，支持全文检索、向量检索、知识/能力过滤、权限过滤、权威等级排序和重排。

验收：讲义 Markdown、知识卡、视频/音频 transcript、图片描述和习题都能进入检索语料；同一问题可以返回带 CitationTarget 的候选证据。

依赖既有 specs：`learning-evidence-rag-corpus`、`konling-agent-runtime`。

风险：中到高。

**Issue F：Planning Projection and Path Unit Granularity**

内容：从统一资源库生成 PlanningUnit，并让自适应路径规划按知识目标、能力目标、先后修关系、预计时间、认知负荷、学习者状态和证据能力选择资源。

验收：路径节点粒度从粗资源列表升级为可执行学习动作；路径中的每个节点都能解释其知识目标、能力目标、资源依据和完成证据。

依赖既有 specs 与 active changes：`adaptive-learning-path-planning`、`teacher-resource-node-management`、`add-adaptive-path-launch-return-context`、`restore-adaptive-path-resume-completion-state`、`fix-adaptive-path-option-selection-layout`。

风险：中。

**Issue G：Konling Knowledge-Capability Grounding**

内容：让控灵回答问题时同时消费知识节点、能力目标、资源检索结果、学习者画像和当前路径/页面上下文，并强制后验引用校验。

验收：知识解释、路径建议、批改解释和媒体引导四类回答都能展示可点击引用；引用缺失或校验失败时降低置信度或拒绝高价值建议。

依赖既有 specs：`konling-agent-runtime`、`learning-evidence-rag-corpus`、`adaptive-learning-path-planning`。

风险：中到高。

**Issue H：Evidence Writeback and Mastery State**

内容：将路径执行、习题、已批准批改、仿真、Arena、互动课和控灵工具运行结果产生的证据统一回写到知识节点与能力目标层，形成可解释掌握状态。控灵相关证据仅限 `AgentToolRun`、已批准干预 outcome、materialized evidence summary 或经过治理的引用摘要；原始聊天和未经审定模型叙述不得直接回写 mastery。

验收：同一学习者在某个知识节点和能力层级上的状态可追溯到具体资源、任务和证据；路径规划和控灵都能使用该状态，但不能直接信任未经审定的生成内容。

依赖既有 specs 与 active changes：`student-evidence-feature-cache`、`simulation-arena-evidence-governance`、`document-rubric-grading-workbench`、`konling-agent-runtime`、`restore-adaptive-path-resume-completion-state`。

风险：高。

## 实施顺序

建议先做上游语义模型，再做检索和路径执行。顺序如下：

1. 统一资源模型与现有系统映射。
2. 知识节点到能力目标的样例图谱。
3. 引用地址模型和 resolver。
4. 教师资源治理工作台只读审计与缺口清单。
5. 资源检索投影与混合检索。
6. PlanningUnit 生成和路径粒度治理。
7. 控灵知识-能力 grounding。
8. 学习证据回写到知识-能力掌握状态。
9. 教师资源治理工作台 scoped edit 补强。

其中第 1、2、3 步是底座，不能跳过。若先做检索或控灵，很容易形成新的孤立资源库。

## 明确不做

第一阶段不做通用互联网搜索。资源范围应限定在平台登记、审定或授权的课程资源与学习证据。

第一阶段不让 LLM 自动决定资源权限、路径完成或掌握度。LLM 可以参与解释、摘要和候选生成，但高价值状态必须由系统规则、证据模型或教师复核确认。

第一阶段不把每个 Markdown chunk 都变成路径节点。路径节点必须是可执行学习动作。

第一阶段不把知识节点改造成教师偏好容器。教师偏好、课程目标和掌握要求进入能力图谱与策略层。

## 成功标准

完成该系列后，平台应具备以下能力：

- 每个主要资源都能说明覆盖哪些知识节点和能力目标。
- 每个主要资源都能生成可点击、可校验的引用位置。
- 控灵回答可以引用讲义、教材、知识卡、视频/音频 transcript、图片描述和习题解析。
- 路径规划可以按知识缺口和能力目标选择资源，而不是只按粗标签或资源类型。
- 习题、互动课、仿真和 Arena 都能作为资源与证据进入同一体系。
- 学习者画像可以解释为“在哪些知识节点、哪些能力层级上有什么证据”。
- 教师可以看到资源映射缺口，并决定哪些资源可进入路径规划或高置信控灵回答。

最终目标是让知识图谱、资源库、RAG、路径规划、画像诊断、批改和控灵共享同一套教学语义，而不是继续作为多个相邻但割裂的功能模块存在。
