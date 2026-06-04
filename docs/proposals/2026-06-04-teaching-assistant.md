# 自动控制原理智能助教闭环开发方案

## 方案总判断

这条线最值得做，而且应该做成**以事实真源驱动的教学闭环**，而不是再堆一个“会说话的功能层”。你已经明确了三件关键约束：第一，平台现有资源类型是丰富但异构的，既有虚拟仿真、课堂交互、竞技场与控制仿真平台，也有知识卡片、视频音频讲义和仍在成熟中的自适应习题；第二，诊断必须落到**能力维度—指标点—计算依据—证据汇总**的闭环；第三，最终呈现必须是**系统内可见、可演示、可复审**的 UI，而不是只有接口。把这三件事合起来，最合理的路线不是“先做一个大而全的 AI 教育平台”，而是把系统收束为一个清晰主线：**学习证据采集 → 能力画像更新 → 定性/定量诊断 → 多路径推荐 → 资源执行 → 作业/试题批改 → 下次课增强包 → 控灵伴学解释与追踪**。这条主线同时对应了学习分析领域对“可行动洞察”的要求，也避开了很多学习分析仪表盘只停留在描述性统计、无法真正改变教学与学习行为的常见问题。

更重要的是，**学情分析、批改、备课**不应分三套系统做。它们在工程上应该共享同一个事实真源：学生模型、任务模型和证据模型。证据中心设计把这三者的关系说得很清楚：先定义希望对学生做出的能力推断，再定义哪些可观测行为能支撑这些推断，再定义哪些任务或资源能生成这些证据；真正成熟的系统不是“看见了数据再想能做什么”，而是“先定义要推断什么，再组织数据结构和任务结构去稳定地产生证据”。这正好对应你要求的“每个指标点都有明确计算依据，诊断内容可以闭环”。

因此，这份方案的核心判断是：**不要把“画像”理解为一个静态 dashboard，也不要把“控灵”理解为一个单独聊天框。画像应是事实层，诊断是推断层，路径是决策层，控灵是解释与执行层。** 这样做，后续不论接入更多多模态资源、换模型供应商、还是把作业从 PDF 报告迁移到平台内结构化任务，系统主干都不需要重写。

## 闭环架构与事实真源

建议把“自动控制原理智能助教闭环”定为一个**单事实源、双视图、三类决策输出**的架构。

“单事实源”的意思是，所有诊断、推荐、批改、备课增强都从同一组学习事实中派生，而不允许每个功能自己维护一套“学生状态”。事实源至少分为三层：
其一是**原始事件层**，记录平台里发生了什么，例如视频观看、知识卡片浏览、知识图谱点击、课堂互动答题、虚拟仿真操作、竞技场对战、控制工作台实验、控灵问答、作业上传、批改反馈确认等；其二是**证据原子层**，把事件翻译成可被教学解释的“证据”，例如“在二阶系统校正专题下，连续三次把超调量与调整时间权衡方向判断反了”“在 lead compensator 设计任务中能正确计算零极点位置但不能解释相位裕度变化”；其三是**画像快照层**，把证据沿能力维度聚合成学生当前状态。这样的分层与学习分析、证据中心设计以及面向教学决策的仪表盘研究是一致的，也更适合你要求的教师/学生双视图派生。

“双视图”的意思是：**教师视图强调根因、群体差异和干预优先级；学生视图强调解释、举措、可选路径和证据可追溯**。这并不是简单地把同一页面删减一下，而是要在 UI 和文案层面做角色分化。学习分析研究长期强调，教师和学生面对分析信息的使用情境不同，只有数据并不自动转化为有效行动；设计必须围绕“谁要做什么决策”展开。教师端如果只给排名和热力图，学生端如果只给雷达图和分数，都会退化成“看热闹的数据面板”。

“三类决策输出”则是这个闭环真正可用的关键：

第一类是**诊断输出**。系统要回答“你现在在哪些维度强、弱、为什么”，且每一个判断都能回到证据。
第二类是**路径输出**。系统不只给一条“最优路径”，而是给三条特征鲜明、偏好不同但都合理的路径，如“补基础稳态型”“仿真驱动型”“冲刺纠偏型”；学生的选择本身再反过来作为认知与偏好画像的一部分。
第三类是**教学增强输出**。系统把班级画像与个体画像汇总成“下次课增强包”，嵌回你预先设计的课程主干，不破坏教学主线但实现动态适应。这个做法与当前研究中“以可行动反馈和低推理成本解释支撑自我调节学习”的设计原则一致，也比把所有内容交给实时生成更稳。

可以把总体结构压缩为下面这条链：

```text
平台事件流
  -> 学习证据抽取器
  -> 画像事实真源
  -> 诊断引擎
  -> 多路径规划器
  -> 资源调度器
  -> 作业/试题批改引擎
  -> 教师增强包生成器
  -> 控灵解释与伴学
  -> 新交互再次回流到事件流
```

对“控制系统校正能力”这条线，我建议先把能力画像收敛为六个主维度，而不是一开始做得过散：

- **概念辨识**：超调量、调整时间、稳态误差、相位裕度、截止频率等概念是否混淆
- **建模表征**：能否在传函、根轨迹、Bode、时域指标之间切换
- **指标推理**：能否从设计目标反推校正方向，解释 trade-off
- **参数求解**：能否完成控制器参数和关键频域/时域量的计算
- **方案评估**：能否比较不同校正方案的优劣与适用边界
- **迁移实践**：能否把方案迁移到仿真、竞技场、控制工作台和开放任务中

这六个维度并不排斥更细粒度的知识点，它们只是在 UI 和决策层面做了上卷。底层仍然应该挂到知识图谱节点、任务类型和具体指标点上。知识追踪与认知诊断的研究已经反复显示，只靠静态考试分数不足以支持精细个性化，动态学习状态、题目属性、知识结构和冷启动机制必须一起考虑。

## 数据模型兼容方案

这部分最重要的原则只有一句：**尽量不改现有业务表，新增“旁路事实层”和“派生层”，用兼容性 schema 把现有功能接进来。** 这样你可以边比赛边演进，不会因为一次重构把现有页面和功能链全部打碎。

建议新增的核心表如下。这里不假设你当前一定使用某种 ORM；字段设计强调的是边界，而不是语法。

### 学习事实与证据

```sql
create table learning_event (
  id bigint primary key,
  tenant_id bigint not null,
  user_id bigint not null,
  course_id bigint not null,
  class_id bigint null,
  session_id varchar(64) null,
  source_type varchar(32) not null,      -- video, card, sim, arena, class_interaction, agent_chat, pdf_assignment...
  source_id varchar(64) not null,
  event_type varchar(64) not null,       -- play, pause, seek, submit, retry, click, answer, ask, ...
  event_time timestamp not null,
  duration_ms bigint null,
  payload jsonb not null,
  created_at timestamp not null
);

create table evidence_atom (
  id bigint primary key,
  event_id bigint null,
  user_id bigint not null,
  course_id bigint not null,
  capability_code varchar(64) not null,
  indicator_code varchar(64) not null,
  topic_code varchar(64) null,
  polarity smallint not null,            -- +1 positive evidence, -1 negative evidence, 0 neutral
  strength numeric(8,4) not null,
  confidence numeric(8,4) not null,
  calc_version varchar(32) not null,
  evidence_type varchar(32) not null,    -- behavior, answer, simulation, dialog, grading
  evidence_ref jsonb not null,           -- page, timestamp, questionId, turnId, bbox...
  observed_at timestamp not null
);
```

### 画像、指标、分位数与诊断视图

```sql
create table profile_snapshot (
  id bigint primary key,
  user_id bigint not null,
  course_id bigint not null,
  snapshot_at timestamp not null,
  model_version varchar(32) not null,
  source_span jsonb not null,            -- 过去7天/本章/全学期
  overall_confidence numeric(8,4) not null,
  cold_start_mode varchar(32) not null   -- explicit_test / implicit_trace / mixed
);

create table profile_dimension_value (
  id bigint primary key,
  snapshot_id bigint not null,
  capability_code varchar(64) not null,
  score numeric(8,4) not null,
  percentile numeric(5,2) null,
  level_code varchar(32) not null,       -- emerging / developing / proficient / advanced
  calc_basis jsonb not null              -- 指标贡献、权重、观测覆盖率
);

create table profile_indicator_value (
  id bigint primary key,
  snapshot_id bigint not null,
  indicator_code varchar(64) not null,
  raw_value numeric(10,4) null,
  normalized_value numeric(8,4) not null,
  percentile numeric(5,2) null,
  coverage numeric(8,4) not null,
  basis_formula text not null,
  basis_payload jsonb not null
);

create table diagnosis_view_materialization (
  id bigint primary key,
  snapshot_id bigint not null,
  audience varchar(16) not null,         -- teacher / student
  narrative_md text not null,
  evidence_bundle jsonb not null,
  generated_by varchar(32) not null,
  generated_at timestamp not null
);
```

### 路径与资源图谱

```sql
create table resource_node (
  id bigint primary key,
  node_code varchar(64) unique not null,
  resource_type varchar(32) not null,    -- video, sim, arena, deck, card, worksheet, assignment, next_pack
  title varchar(255) not null,
  topic_code varchar(64) not null,
  capability_tags jsonb not null,
  difficulty numeric(8,4) null,
  est_minutes int null,
  metadata jsonb not null,
  is_active boolean not null default true
);

create table resource_edge (
  id bigint primary key,
  from_node_code varchar(64) not null,
  to_node_code varchar(64) not null,
  edge_type varchar(32) not null,        -- prerequisite, reinforce, remediate, challenge, optional
  weight numeric(8,4) not null,
  metadata jsonb not null
);

create table path_plan (
  id bigint primary key,
  user_id bigint not null,
  snapshot_id bigint not null,
  plan_style varchar(32) not null,       -- reinforce_foundation / sim_driven / sprint_fix
  objective text not null,
  plan_json jsonb not null,
  explanation_md text not null,
  adopted boolean not null default false,
  created_at timestamp not null
);
```

### 批改与 PDF 回写

```sql
create table submission_asset (
  id bigint primary key,
  submission_id bigint not null,
  asset_type varchar(32) not null,       -- original_pdf / extracted_md / annotated_pdf
  storage_key varchar(255) not null,
  checksum varchar(128) not null,
  metadata jsonb not null,
  created_at timestamp not null
);

create table rubric_definition (
  id bigint primary key,
  rubric_code varchar(64) unique not null,
  assignment_id bigint null,
  schema_json jsonb not null,
  version varchar(32) not null,
  active boolean not null default true
);

create table grading_run (
  id bigint primary key,
  submission_id bigint not null,
  rubric_code varchar(64) not null,
  parse_status varchar(32) not null,
  grading_status varchar(32) not null,
  machine_score numeric(8,4) null,
  human_score numeric(8,4) null,
  score_breakdown jsonb not null,
  review_state varchar(32) not null,     -- pending / teacher_edited / approved / returned
  citations_json jsonb not null,
  created_at timestamp not null
);

create table grading_annotation (
  id bigint primary key,
  grading_run_id bigint not null,
  page_no int null,
  bbox jsonb null,
  md_span jsonb null,
  annotation_type varchar(32) not null,  -- highlight / sticky / freetext
  comment_md text not null,
  criterion_code varchar(64) null,
  severity varchar(16) null
);
```

### 控灵长程记忆与引用

```sql
create table rag_chunk (
  id bigint primary key,
  corpus_type varchar(32) not null,      -- knowledge_card, lecture_note, submission_md, diagnosis, policy
  corpus_id varchar(64) not null,
  location jsonb not null,
  content_hash varchar(128) not null,
  embedding_ref varchar(128) null,
  text_md text not null,
  metadata jsonb not null
);

create table agent_memory (
  id bigint primary key,
  user_id bigint not null,
  course_id bigint not null,
  memory_type varchar(32) not null,      -- preference, misconception, adopted_path, coaching_style
  memory_value jsonb not null,
  source_snapshot_id bigint null,
  expires_at timestamp null,
  created_at timestamp not null
);
```

这样做有三个直接好处。其一，现有业务功能只需要在关键节点补发 `learning_event`，不要求立即重写。其二，画像计算、路径规划、诊断生成、批改引擎都能复用同一证据层。其三，后续如果作业从 PDF 报告过渡到平台内结构化任务，你只是换证据抽取器，不用推翻上层逻辑。这个“学生模型—证据模型—任务模型”分离结构，与证据中心设计和扩展到学习层的 e-ECD 框架高度一致。

关于**班级分位数**，建议在 `profile_dimension_value` 和 `profile_indicator_value` 内直接存储百分比形式的 percentile，但计算应该区分两类：
一类是**同班级同阶段分位数**，用于你提到的雷达图对比；另一类是**学业同起点增长分位数**，用于避免“高基础学生永远看起来更强”的错觉。教育测量中 percentile 与 student growth percentile 的区别很重要：前者反映相对位置，后者反映相近基线群体中的相对增量。前者适合班级横向比较，后者适合闭环教学是否有效。

## 页面与交互落地

你特别强调“不要只做了功能，留了接口，但是无法看到具体的功能演示”，这点完全正确。这个项目如果想在比赛中建立说服力，必须把核心页面做成**能直接跑演示链路**的产品面，而不是后台能力合集。

### 学生侧页面

学生端建议做四个主页面。

**学情总览页**是第一入口。页面上方是能力雷达图，六个主维度同时显示“能力值”和“班级分位数”；中部是每个维度的定性解读卡片，格式固定为“当前判断—根因证据—下一步动作—对应资源入口”；底部是证据汇总折叠面板，显示该判断来自哪些视频片段、知识卡片、题目、仿真记录、控灵对话或作业片段。学习分析研究表明，仅显示统计值很难转化为行动，而带解释和下一步建议的、低推理成本的可视化更容易被学生实际使用。

**路径选择页**是第二入口。页面默认展示三条路线，每条路线都必须明确“目标画像差值”“预计用时”“资源构成”“风格标签”“适合原因”。比如：
“补基础稳态型”主打概念辨识和指标推理，资源以知识卡片、讲义片段、经典短题为主；
“仿真驱动型”强调在虚拟仿真和控制工作台中通过可视化反馈重建理解；
“冲刺纠偏型”则直接围绕当前最短板指标做密集纠偏。
关键不是算法多复杂，而是**三条路线确实长得不一样**。如果三条路径只是顺序不同，学生不会感到自己被尊重，也无法把“选择偏好”沉淀为扩展画像。

**任务执行页**不是一个新页面，而是现有资源页上的嵌入式学习片段条。无论学生当前进入视频、虚拟仿真、课堂互动回放还是知识卡片，都应该看到一个一致的小组件：
“你为什么会来到这里”“这一资源主要补哪两个指标点”“完成后会怎样改变你的画像”“当前路径进度”。
这一步很关键，因为很多自适应系统的问题不是推荐不准，而是推荐之后马上失联。

**作业反馈页**需要同时支持两种形态。对 PDF 报告型作业，左侧是 PDF 预览和批注层，右侧是 rubric 分解、得分、问题定位和建议；对平台内结构化任务，则左侧换成轨迹回放、仿真结果或答题过程证据。这样你在过渡期就不需要维护两套完全不同的认知界面。

### 教师侧页面

教师端建议做三个主页面。

**班级诊断页**是“看班”的主面板。顶部给出六个维度的班级分布、中位数、下四分位群体规模和增长分位；中部给出“根因聚类”，例如“多数学生不是不会算，而是在由时域指标反推校正方向时卡住”；下方给出“建议干预动作”，并能一键生成下次课增强包。教师面对学习分析时最需要的不是更多图，而是把图压缩成能直接转化为教学动作的结论。

**个体会诊页**是教师查看单个学生时的深钻界面。这里和学生页不同，重点不在“鼓励性的下一步”，而在“根因链”。页面应按“维度→指标点→证据→近三周变化→可干预资源”展开，并支持和同班中位学生做对照。这样教师可以快速判断究竟是概念短板、迁移断裂、练习覆盖不足，还是路径执行中途放弃。

**批改工作台页**是智能助教落地性的关键。页面分三栏：
左栏是提交物与解析状态；
中栏是 rubric 树状评分与证据链接；
右栏是 AI 生成的批注与教师修改区。
教师可以逐条接受、改写、删除批注，也可以整份“批准后返回学生”。这既符合当前 AI 批改研究中“快速反馈有价值，但自动评分不能无监督下放”的结论，也更符合真实教学情境中的信任机制。

### 控灵入口的 UI 角色

控灵不应该是“独立智能体页面”。我建议它做成全局抽屉式入口，但在不同页面切到不同模式：

- 在学情页，它是**诊断解释器**
- 在路径页，它是**路径比较顾问**
- 在资源页，它是**页面上下文答疑与提醒器**
- 在批改页，它是**教师审核助手**
- 在班级诊断页，它是**班级问题摘要器**
- 在下次课增强包页，它是**备课共创助手**

而且默认不暴露原始长对话给教师看，只暴露“元反思摘要”和风控信号。近期关于 student-AI interaction dashboard 的研究已经指出，教师若直接读取全量学生 AI 对话，既不具可扩展性，也有明显隐私与寒蝉效应问题；更合理的做法是默认显示会话级摘要、交互模式和风险提示，必要时再受控下钻。

## API 与智能体工具链

### API 设计

API 应围绕“事实采集、画像计算、诊断生成、路径规划、批改审阅、增强包生成”六类动作来设计，而不是按页面组件碎片化设计。

建议保留现有业务 API，不去打断旧链路，新增一组 “assist” 或 “intelligence” 前缀接口：

```http
POST   /api/intelligence/events/ingest
POST   /api/intelligence/profile/recompute
GET    /api/intelligence/profile/student/{userId}
GET    /api/intelligence/profile/class/{classId}
POST   /api/intelligence/diagnosis/render
POST   /api/intelligence/path-plans/generate
POST   /api/intelligence/path-plans/{planId}/adopt
POST   /api/intelligence/grading/submissions/{submissionId}/parse
POST   /api/intelligence/grading/submissions/{submissionId}/grade
PATCH  /api/intelligence/grading/runs/{runId}/review
POST   /api/intelligence/prep-pack/generate
POST   /api/intelligence/copilot/chat
GET    /api/intelligence/copilot/context
POST   /api/intelligence/rag/retrieve
POST   /api/intelligence/rag/verify-citations
```

这组 API 的重点不是名字，而是边界：
`events/ingest` 只负责入事实层；
`profile/recompute` 只负责状态更新；
`diagnosis/render` 做角色化视图派生；
`path-plans/generate` 从画像快照出发生成多路径；
`grade` 和 `review` 分离，强制留有人在环；
`prep-pack/generate` 从班级画像与下次课目标出发；
`copilot/chat` 必须带页面上下文、当前画像摘要和可引用证据，而不是裸聊天。

### 批改流水线

PDF 作业批改建议采用**固定 worker + 评阅智能体**的两段式，而不是全部塞给一次对话。

第一段是解析 worker：上传 PDF 后，后台异步转 Markdown，产生结构块、页码映射和文本 span。MarkItDown 适合放在这里，因为它的目标就是把 PDF、Word、Excel 等多种文档转换为 LLM 友好的 Markdown，并保留标题、列表、表格等结构；但官方也明确提醒它更适合文本分析而不是高保真人类阅读，所以它应承担“提取与索引”职责，而不是“最终展示”职责。

第二段是评阅智能体：输入 rubric、参考资料、解析后的 Markdown、题目元信息和课程知识库，输出“criterion 级评分、证据 span、批注建议、总评草案”。之后用回写器把批注落回 PDF。PDF 批注层面，`pypdf` 已支持 FreeText 等 annotation，适合生成可点击的贴注和评论框；如果需要更强的浏览器端交互批注，也可以用 Adobe PDF Embed API 的评论/标注能力做前端视图层，但比赛落地时我更建议先用 `pypdf` 产出可下载静态批注 PDF，再在前端叠加可编辑评论层，路径更稳。

真正难点不在“能不能评”，而在**证据定位**。所以解析 worker 必须额外输出：

- markdown block id
- 原 PDF page number
- 原文 bbox 或至少字符偏移映射
- 标题层级与列表上下文
- 图片/表格的占位与说明区块

没有这层映射，批注永远回不去 PDF，也无法做“点开 rubric 直接跳原文”的 UI。

### 兼容模型层

你要求扩展到 **OpenAI-compatible baseURL provider** 和 **Anthropic-compatible** 两类，我建议不要把“模型选型”写死在业务逻辑里，而是引入一个统一的 `ProviderAdapter`。

接口建议如下：

```ts
interface ProviderAdapter {
  providerType: 'openai-compatible' | 'anthropic-compatible';
  supports: {
    tools: boolean;
    vision: boolean;
    citations: boolean;
    jsonSchema: boolean;
    streaming: boolean;
  };
  generate(input: ModelRequest): Promise<ModelResponse>;
  stream(input: ModelRequest): AsyncIterable<ModelDelta>;
  embed?(input: EmbedRequest): Promise<EmbedResponse>;
}
```

OpenAI-compatible 这条线可以直接接自定义 `baseURL`，这是 Vercel AI SDK 官方支持的能力。Anthropic 这条线则应该走**原生 Messages API 兼容适配器**，因为 Anthropic 官方文档明确把 OpenAI SDK compatibility 定位为便于测试与比较模型能力的兼容层，并提示如果需要 Claude 的完整能力，如 citations、tool use、PDF 等，更好的方式是走原生 Claude API。也就是说，**在你的系统里可以同时支持 Anthropic-compatible endpoint 和 OpenAI-compatible endpoint，但 Claude 系列若要发挥“控灵”工具链与可引用输出的优势，业务上优先走 Anthropic native adapter**。

这件事在工程上会直接影响三块能力：
其一是工具调用的一致性；
其二是结构化输出与 citation 的稳定性；
其三是未来接入更小模型或私有化模型时的迁移成本。
所以不要把 provider 逻辑散在各个页面 route 里，必须集中到模型网关中。

## Rubric schema 与 RAG 引用协议

### Rubric schema

Rubric 不能只是一张教师可读的表，它必须是**机器可执行、教师可审核、学生可解释**的结构体。建议采用 analytic rubric，而不是 holistic rubric。因为你需要 partial credit、证据定位、定性反馈和后续画像回流，holistic score 不够用。教育评估文献长期强调，analytic rubric 更适合形成性反馈和可解释评分。

建议 schema 形态如下：

```json
{
  "rubricCode": "autocontrol-correction-report-v1",
  "course": "automatic-control-principles",
  "taskType": "pdf_report",
  "maxScore": 100,
  "dimensions": [
    {
      "code": "problem_understanding",
      "title": "问题理解与任务对齐",
      "weight": 0.15,
      "criteria": [
        {
          "code": "goal_identification",
          "description": "是否准确识别设计目标、约束和已知条件",
          "levels": [
            {"score": 1.0, "label": "fully_met", "descriptor": "目标与约束完整、准确、无关键遗漏"},
            {"score": 0.6, "label": "partially_met", "descriptor": "识别主要目标，但遗漏关键约束或边界"},
            {"score": 0.2, "label": "weakly_met", "descriptor": "目标理解存在明显偏差"}
          ],
          "requiresEvidence": true,
          "evidenceHints": ["report_section:introduction", "report_section:task_analysis"]
        }
      ]
    },
    {
      "code": "control_reasoning",
      "title": "控制推理与校正分析",
      "weight": 0.35,
      "criteria": [
        {
          "code": "tradeoff_reasoning",
          "description": "能否解释时域/频域指标权衡并给出校正方向",
          "levels": [
            {"score": 1.0, "label": "fully_met", "descriptor": "推理链完整，指标-方案联系清晰"},
            {"score": 0.5, "label": "partially_met", "descriptor": "方向基本正确，但推理链不完整"},
            {"score": 0.0, "label": "not_met", "descriptor": "只给结论，缺乏有效推理"}
          ],
          "requiresEvidence": true
        }
      ]
    },
    {
      "code": "simulation_validation",
      "title": "仿真验证与结果解释",
      "weight": 0.25,
      "criteria": []
    },
    {
      "code": "engineering_expression",
      "title": "工程表达与报告组织",
      "weight": 0.15,
      "criteria": []
    },
    {
      "code": "reflection_and_improvement",
      "title": "反思与改进建议",
      "weight": 0.10,
      "criteria": []
    }
  ],
  "penalties": [
    {
      "code": "formula_without_explanation",
      "trigger": "reasoning_missing",
      "maxDeduction": 8
    }
  ],
  "profileWriteback": {
    "problem_understanding": ["concept_identification"],
    "control_reasoning": ["indicator_reasoning", "scheme_evaluation"],
    "simulation_validation": ["transfer_practice"],
    "engineering_expression": [],
    "reflection_and_improvement": ["metacognition"]
  }
}
```

这里真正关键的是最后的 `profileWriteback`。也就是说，作业批改不是独立终点，而是把 criterion 级评分映射回画像。这样学情报告里“控制推理维度较弱”的判断，既可以来自过程数据，也可以来自作业证据，闭环才成立。

### RAG 引用协议

如果诊断、路径推荐、批改意见、增强包都要可信，就不能接受“模型说得像真的但没有证据”。建议做一个**强约束引用协议**，而不是让模型自由写“参考了某资料”。

统一协议建议如下：

```json
{
  "answer": "你的‘指标推理’处于发展中水平，主要问题不是不会算，而是由设计目标反推校正方向时经常缺少解释链。",
  "citations": [
    {
      "citationId": "rag_01",
      "chunkId": "kc_ode_bode_0042",
      "sourceType": "knowledge_card",
      "sourceId": "card-204",
      "loc": {"section": "相位裕度与超调量关系"},
      "quoteMode": "paraphrase"
    },
    {
      "citationId": "rag_02",
      "chunkId": "evt_report_20260603_17",
      "sourceType": "assignment_md",
      "sourceId": "submission-801",
      "loc": {"page": 4, "mdBlock": "b187"},
      "quoteMode": "evidence"
    },
    {
      "citationId": "rag_03",
      "chunkId": "trace_sim_5520",
      "sourceType": "simulation_trace",
      "sourceId": "simrun-5520",
      "loc": {"timestamp": "00:03:18-00:03:44"},
      "quoteMode": "behavior"
    }
  ]
}
```

然后在生成链路上强制四件事：

第一，检索器只返回带 `chunkId` 的候选证据；
第二，模型输出只能引用候选集合中的 `chunkId`；
第三，后处理器验证 `chunkId` 是否真实存在、是否与答案内容语义一致；
第四，前端把 citation 渲染成“证据胶囊”，点击直接跳到知识卡片片段、作业原文或仿真轨迹片段。

近期关于 RAG 引用和 source attribution 的研究与工程实践都指出，模型很容易产生“看起来像引用”的幻觉，因此引用验证必须是独立步骤，而不能只靠提示词约束。

对不同功能，还应有不同的协议子集：

- **学情诊断**：至少引行为证据 + 资源证据
- **路径推荐**：至少引画像快照 + 资源节点元数据 + 前置依赖
- **作业批改**：至少引 submission markdown span + rubric criterion
- **控灵答疑**：至少引当前页面上下文 + 课程知识库；如果答案超出证据，则必须明确标注为一般性解释而非课程内证据结论

这一步做扎实后，比赛中的“可信、可追溯、有教学闭环”说服力会非常强。

## 分阶段实施与验收

下面这组 issue 设计不是学术 roadmap，而是可直接给 Codex 开工的实现顺序。顺序的逻辑是：先做事实层，再做诊断，再做批改，再做闭环增强，最后做演示打磨。不要反过来。

### 阶段一

目标是把现有平台事件纳入事实层，并接通最小可见 UI。

建议 issue 集：

- **建立 learning_event 统一接入层**
  为视频、知识卡片、课堂互动、虚拟仿真、竞技场、控灵会话补发标准事件。
  完成标准：六类核心资源都能在新表里形成统一事件流。

- **建立 evidence_atom 抽取器框架**
  先不追求全覆盖，只实现“控制系统校正”主题下最关键的十几个指标点。
  完成标准：至少三类不同资源能产出同一能力维度下的证据原子。

- **学生学情总览页 MVP**
  雷达图、班级分位数、维度定性卡片、证据折叠面板全部可见。
  完成标准：从真实课程数据生成一份完整个人报告。

这个阶段的验收不是算法优不优秀，而是**是否形成了能跑通的单人闭环**。

### 阶段二

目标是让画像可解释、可计算、可视图派生。

建议 issue 集：

- **实现 profile_snapshot 与指标计算引擎**
  支持能力值、覆盖率、置信度、班级分位数、增长分位数。
- **实现教师/学生双视图 narrative renderer**
  同一快照输出 teacher 版和 student 版。
- **实现路径规划器**
  至少输出三条风格不同的路径，并记录学生采纳行为。
- **实现资源节点种子与边关系**
  先人工维护“控制系统校正”专题的资源图，不追求全课程自动化。

完成标准是：同一个学生进入学情页、路径页和控灵抽屉时，看到的是**前后一致**的状态，而不是三套互相冲突的判断。

### 阶段三

目标是把 PDF 作业批改做成真正可展示的功能。

建议 issue 集：

- **作业 PDF ingest worker**
  上传后调用 MarkItDown 转 Markdown，保存解析结果与页码映射。
- **Rubric loader 与 grading engine**
  按 analytic rubric 输出 criterion 级评分与证据。
- **PDF annotation writer**
  生成带批注的新 PDF。
- **教师批改工作台**
  支持逐条采纳/改写/退回，并回写画像。

完成标准：教师能上传真实 PDF，几分钟内在系统内看到解析结果、评分草案、批注文档和可修改工作台。MarkItDown 负责抽取，`pypdf` 负责回写注释，教师保留最后裁决权。

### 阶段四

目标是完成真正的课堂闭环。

建议 issue 集：

- **班级诊断页**
  展示群体维度分布、根因聚类、关键学生群体。
- **下次课增强包生成器**
  给出“应插入的互动组件、补充卡片、微仿真、诊断题、控灵提示词”。
- **控灵页面上下文模式**
  学情、路径、资源、批改、班级诊断五种模式全部接通。
- **会话级元反思摘要**
  教师默认看摘要，不看原始对话全文。

完成标准：班级诊断页可以一键生成“下次课增强包”，并在下节课真实嵌入主干课程。

### 阶段五

目标是比赛化与验收硬化。

建议 issue 集：

- **引用验证器与风控器**
  拦截伪 citation、空证据叙事和越权结论。
- **可演示样本库**
  准备 3 名不同画像学生、1 个班级、2 份 PDF 作业、1 次前后测。
- **统一 demo 模式**
  页面切换时固定 mock/live 数据集，保证演示稳定。
- **指标看板**
  显示画像覆盖率、引用命中率、教师改写率、路径采纳率。

完成标准：整套链路能在不依赖临场运气的前提下稳定演示。

### 验收测试

验收测试不应只测接口通不通，而要测闭环是否成立。建议至少有这些测试：

- **画像一致性测试**：同一原始事件流重复计算两次，快照值完全一致。
- **分位数稳定性测试**：新增一个无关班级不应影响当前班级 percentile。
- **证据可追溯测试**：每条学情结论至少有一条可点击证据。
- **路径差异性测试**：三条路径的资源重合率不高于设定阈值。
- **批改可审核测试**：教师修改任一 criterion 后，总评、画像回写和返回 PDF 同步更新。
- **citation 真实性测试**：人为注入伪造 chunkId，系统必须拦截。
- **隐私边界测试**：教师默认不可见原始学生长对话全文，只能看摘要层。
- **模型兼容测试**：同一个 `ProviderAdapter` 契约能跑通一个 OpenAI-compatible 和一个 Anthropic-compatible provider。

这些测试项之所以重要，是因为学习分析与 AI grading 的实证研究都提醒同一个问题：系统若没有解释层、教师监督和可操作反馈，即使“能跑”也未必产生可靠教学价值。

## 演示脚本与开放问题

### 比赛演示脚本

建议把比赛演示压缩成一条具体故事线，而不是功能巡检。

开场先给出一句话定位：
**“这不是一个答疑机器人，而是一个把学习证据、能力画像、路径规划、作业批改和下次课增强包串成闭环的自动控制原理智能助教系统。”**

随后按下面顺序演示：

先进入**学生学情总览页**。展示某学生在“控制系统校正”专题下六维能力雷达图、班级分位数和定性分析。点击“控制推理”维度，展开证据汇总，直接看到它来自视频学习、仿真操作和上一份作业中的具体证据。这里要强调“每个判断都可追溯”。

再进入**路径选择页**。系统给出三条不同路径，分别偏基础重建、仿真驱动和冲刺纠偏。演示学生选择“仿真驱动型”，随后跳入一个虚拟仿真资源页。此时页面右侧出现控灵抽屉，自动说明“你为什么来到这里、这一资源补哪个指标点、完成后路径如何推进”。这样观众能立刻看出“推荐不是孤立的”。

接着切到**PDF 作业批改工作台**。上传一份报告，展示后台完成 Markdown 解析、rubric 评分和 PDF 批注生成。此时不要只展示最终分数，要展示 criterion 级证据、批注定位和教师可以一键改写。真正打动评委的不是“AI 会打分”，而是“教师仍掌控最后判断，但工作量显著下降，且评分依据更透明”。

然后切到**教师班级诊断页**。显示这一班当前最主要的问题不是“都不会”，而是“多数学生能算参数，但不能稳定解释基于指标的校正方向选择”。点击“生成下次课增强包”，系统生成一组会嵌入下节课主干中的增强资源：一个课堂互动诊断题、一个 lead/lag 对比小仿真、一张知识卡片和一个控灵课堂提示模板。这里要突出“主干课程不被破坏，只做针对性增强”。

最后回到**学生学情页**，展示下次课后画像变化，说明闭环完成。结尾不是“模型很强”，而是“教师得到了可行动洞察，学生得到了多路径选择，系统得到了新的证据回流”。

### 开放问题与限制

这份方案已经能够直接指导 Codex 分阶段实施，但仍有三个需要在落地前明确的问题。

第一，**integration 分支的逐文件现状**在本轮回答中没有再次完成文件级核验，因此这里采用的是“与既有功能低耦合兼容”的增量方案，而不是针对仓库现有每个模块的精确 refactor map。换句话说，数据模型和 API 设计是可以直接推进的，但在具体表名、路由风格、前端状态管理方式上，仍需按你仓库的现有实现做一次贴边适配。

第二，**冷启动策略**需要你在课程节奏上做一个选择：是显式用一份入门诊断测，还是优先走隐式冷启动。研究上两种都成立，但如果以比赛展示为优先，我更建议采取“显式短测 + 隐式纠偏”的混合模式，因为演示更直观，也更容易解释“为什么画像一开始就是有依据的”。

第三，**PDF 批注精度**取决于你能否稳定保留 Markdown 与原 PDF 的位置映射。MarkItDown 很适合做提取与索引，但不是高保真版面恢复器；因此第一阶段应该接受“注释框批注 + 页码定位”为主，后续再不断提高 bbox 精度，而不要一开始就追求类似人工 Acrobat 批改的细粒度逐词高亮。

如果只允许先做一个最能打、最成体系、最容易展示的实现，我的建议非常明确：**先做“学生学情诊断页 + 三路径推荐页 + PDF 批改工作台 + 教师班级诊断页/增强包页 + 控灵五态上下文抽屉”这五个 UI 面。** 这五个面一旦跑通，你的“自动控制原理智能助教闭环”就已经不是概念，而是一个能站住的产品。