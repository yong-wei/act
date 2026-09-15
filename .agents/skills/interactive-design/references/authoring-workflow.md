> 本文件按当前任务范围选择章节。完整课程工作流中的全量检查仅用于整课交付；局部修改只运行受影响检查，不声称整课通过。文风遵循 course-content/AGENTS.override.md，不机械重复生成与重写。技能内脚本、notes 和资产路径均相对技能根目录；仓库路径保持原义。

# interactive-design — 互动课程设计技能

## 概述

本技能负责作者态互动课程设计，不负责前端实现，也不负责 runtime 审查。它的唯一目标是把讲义中的证据链，转换成可实现、可审查、不可随意降级，且**学生脱离讲稿也能独立理解知识对象、判断动作与本次课程目标**的双轨设计真源：

- `design/{unit}-interactive-page.md`
- `design/{unit}-interactive-contract.yaml`

本技能主文件只保留总流程、职责边界与参考文件入口。凡是例题与推导显影、曲线互动面板、页面顺序与教师/学生控制语义等细则，一律下沉到 `references/`。

互动课程设计首先是逻辑与内容设计，不是视觉包装稿。图片、结构图、对比图和大屏视觉只服务证据链，不能成为页面排序的默认理由；不得为了“首屏好看”或“冲击力强”把大图固定放到页面最上方。

## 何时使用

- 用户要求制作、重写或修订 `interactive-page.md`
- 用户要求制作、重写或修订 `interactive-contract.yaml`
- 用户指出某课互动页“图先于逻辑”“例题消失”“推导被压扁”“作答区过于笼统”“教师控制不够”
- 用户要求把讲义内容拆成互动步骤，但强调必须保留讲义逻辑顺序

## 边界

- 本技能负责作者态互动设计与契约。
- 本技能不负责师生端代码、课堂路由、会话同步与运行时埋点落地；这些由 `interactive-lesson` 负责。
- 本技能不负责讲义正文、知识图谱概念事实与 BOPPPS 主线制作；这些由 `lesson` 负责。
- 本技能负责互动呈现层的步骤编排、卡片展示位置、作答卡与显影链设计；因此 `sequence.json` 的最终顺序和 `groups[].step_ids` 应在本技能完成后定稿。若 lesson 阶段已生成 `sequence.json`，只把它当作候选输入，不得让它压制互动页步骤数、页面顺序或卡片拆分。

## 必读输入

开始前至少读取：

1. `course-content/authoring/lessons/[单元编号]/design/[单元编号]-handout.md`
2. `course-content/authoring/lessons/[单元编号]/design/[单元编号]-boppps.md`
3. `course-content/authoring/lessons/[单元编号]/manifest.json`
4. 已有知识卡片与 `course-content/authoring/knowledge/cards/lessons/[单元编号]/sequence.json`（若存在）

如已存在旧版互动设计，还必须读取：

5. `course-content/authoring/lessons/[单元编号]/design/[单元编号]-interactive-page.md`
6. `course-content/authoring/lessons/[单元编号]/design/[单元编号]-interactive-contract.yaml`

## 核心原则

在作者态互动设计中，`interactive-contract.yaml` 是机读约束，`interactive-page.md` 是页面蓝图 prose。两者都以讲义证据链为源，但人读稿默认不得直接继承实现门槛、检查表和流程提示的表层口吻。先抽 **clean brief**，再写页面蓝图 prose，最后再做一次去污染检查。

0. **独立学习可理解性是硬门槛**
   - 每一步都要自问：若拿掉讲稿，学生能否仅凭当前页面知道“对象是什么、正在判断什么、为什么现在看这页、结论如何服务本次课程目标”。
   - 若答案是否定的，说明该页缺少题面、前提、公式链、图后解释或结论桥接，必须补齐，不能交给教师口头兜底。

0.5 **显式目标只保留本次课程目标**
   - 若页面需要显式呈现目标，只允许列出“完成本次课程后，学习者能够……”的布鲁姆能力项。
   - 不得把单元边界、课次定位、课程接口或主线位置写成面向学生的目标说明。

0.6 **先产出人读版设计，再进入机读契约**
   - 新建或改变教学设计时先给出人读版页面设计，说明步骤顺序、对应讲义章节、页面元素出现顺序、公式与符号说明、显影链和互动方式。
   - 人读版设计通过内容自检后，需取得用户对该设计的明确接受才能进入机读契约。已有明确接受可复用；用户已明确要求修复已批准契约时直接完成该范围修复，不逐文件重复确认。重要教学设计变化仍需接受。
   - 用户未显式通过前，只能修订人读版设计，不得先写契约框架、不得生成 `interactive-contract.yaml` 草稿，也不得回填机读字段。

0.7 **固定首尾步骤**
   - 步骤 1 固定为导入：使用导入漫画，在场景中提出问题或创设情境，引出本单元主要内容。
   - 步骤 2 固定为课程目标：用布鲁姆动词给出完成本单元后学生应具备的能力。
   - 步骤 3 固定为前测：题目必须是客观题，前测不得考察本单元知识，只考察进入本单元学习所需的基础能力，例如前序概念、数学工具、读图规则或基本计算；禁止考察本单元将要讲解的新概念、新方法、新结论或本单元例题中的核心推理。
   - 前测题全部采用客观题，可混合单选、多选、排序、判断等题型；不得出现主观简答或开放论述。
   - 收尾固定拆成两个页面：后测一个页面，总结一个页面。
   - 后测使用简明题目验证课程目标达成，必须与目标页呼应，但不得设计成过度复杂的综合大题；题目总数不超过 3 题，最多 1 题为主观题。
   - 总结页顶部必须附课程信息图；随后讨论本单元主要内容、局限性、重点难点，并可留下拓展思考；学生页还必须给出学生个人课堂表现统计数据，教师页必须给出班级整体表现统计数据。

0.8 **步骤名称采用教科书式陈述标题**
   - 每个步骤名称必须采用一般教科书式陈述形式，直接概括对象、方法、原理、分析过程或结论范围。
   - 步骤名称不得使用问句，包括“为什么……”“XX如何……”“XX是否……”等形式。
   - 步骤名称不得使用否定句，包括“XX不是XX”“不能……”“不要……”等形式。
   - 问题、冲突和辨析可以放在页面正文、导入漫画或作答题面中，但不能作为步骤名称。

1. **讲义顺序优先于视觉包装**
   - 页面顺序、模块顺序与图文先后，默认服从讲义证据链。
   - 图片不得因为“首屏更好看”而被强行顶到页面最上方。
   - 若讲义顺序是“原理/公式 -> 结构图 -> 分析推导 -> 对比图”，互动页必须按这个顺序写入页面蓝图和契约。
   - 结构图、曲线图、对比图的位置必须能从讲义证据链或明确的设计理由中解释；若解释不了，默认放在其对应原理、题面或推导之后。
   - 除目标页和前测页外，每个步骤都必须注明对应讲义章节；所有讲义正文章节都必须被互动步骤覆盖。
   - 每个步骤内部必须严格按对应讲义章节的内容出现顺序设计页面元素，并在页面设计中显式写出“元素出现顺序”。
   - 若对应讲义章节含公式，互动页必须列出主要公式和符号说明。
   - 每个页面标题必须作为页面顶端的独立模块呈现，并配一段文案说明本页主要内容；该模块不替代正文证据链。

1.5 **模板名意味着区域拓扑，不只是视觉名**
   - 在作者态 contract 中，模板名不仅决定页面外观，也决定区域顺序和模块归宿。
   - 若某个模板把 `problem`、`media`、`interaction` 等区域拆开写明，设计稿必须分别说明这些区域承载什么教学任务，不能只写成“一个综合面板”。
   - 若同一区域存在多个 `must_be_visible` 模块，必须把它们当成多个独立教学载荷分别表达，不能在 prose 中偷并成一个笼统联动画面。

1.6 **组件式 manifest 契约优先**
   - `interactive-contract.yaml` 必须能被 review/export 转成 shared manifest runtime 可消费的 `interactive-manifest.json`，不能只写给人工阅读。
   - 不允许设计任何超出现有组件库的模块。`modules[].kind` 只能使用当前标准组件类；确有能力缺口时，结论必须是“当前组件库不支持，需要先提出组件库扩展变更”，不得在课程契约中发明新 kind 或让实现层按课程编号猜。
   - `modules[].payload` 必须承载模块标题、内容键、公式键、图片键、表格列行、路径项、显影项等最小渲染数据；不得依赖实现层写 `4-6`、`4-3` 或具体 module id 的映射表。
   - 静态内容模块不得无说明地写 `payload: {}`。若确需使用 `content_blocks` 的通用隐式规则，必须在契约中显式写出 `payload.resolver` 或等价说明，例如 `implicit:key_formulas_by_formula_card_order`、`implicit:media_by_image_panel_order`、`implicit:summary_by_module_key`；否则审查脚本应判定为不可审计。
   - 每个静态内容模块在导出后必须能记录到明确的 `resolved_content_source`：来自 `module.payload`、`content_blocks.<key>`，或已命名的隐式 resolver。无法追踪来源的模块，即使页面人工可读，也视为设计契约不足。
   - 活动类模块只声明作答/选择/题组活动的布局锚点与 `interaction_spec` 关系，不得同时承担正文内容承载；正文区不得再重复列出与 `activity_cards[].prompt` 完全相同的题面。
   - `interaction_spec.activity_cards[]` 必须写入题面、选项、提交粒度、参考答案或揭示规则；选择题、题组和二元判断不得依赖课程私有 `QUIZ_OPTIONS`、`SINGLE_CHOICE_OPTIONS` 等常量。
   - 路径图、目标卡、问题卡、公式卡、图片面板、原生表格、显影链、作答锚点、选择题组等，都要在 contract 中给出可渲染 payload；不要只写“这里使用组件”。

1.7 **当前允许的标准组件**

`modules[].kind` 只能从下表选择；旧组件名只能放入 `payload.legacyKind` 作为迁移提示，不得作为新课或已迁移课的 `kind`。

| 标准组件 | 适用范围 | 必备 payload / 契约要点 |
| --- | --- | --- |
| `content.rich` | 正文段落、问题背景、提示语、定义解释、教师提示等非结构化内容 | `title`、`text`、`body`、`block_key` 或可审计 `resolver` |
| `content.cardSet` | 目标卡、要点组、概念卡组、风险/结论/职责条、步骤清单等重复卡片 | `items`、`goals`、`cards`、`text`、`block_key`；审计必须能判定非空 |
| `content.formula` | 单条公式、公式组、符号说明、公式链 | `formula`、`formulas`、`symbols`、`block_key`、`formula_key` 或公式型 resolver |
| `content.code` | MATLAB/Octave 代码示例、函数调用速通、可运行诊断片段 | `language`、`code`、`block_key`，默认使用 MATLAB/Octave 高亮；不得作为普通正文或公式块处理 |
| `content.table` | 原生表格、比较表、参数表、记录表、公式表 | `columns`、`rows`，必要时补 `title`、`text`、单位/适用边界 |
| `content.figure` | 图片、静态图、SVG 图、媒体图组、结构图、曲线截图 | `src`、`assets`、`image_key`、`caption`、`explanation`；图题必须是学科对象标题 |
| `content.reveal` | 推导链、例题步骤、逐步显影解释、分层判断链 | `items` 或 `block_key`，每一层必须有完整文本，必要时含公式 |
| `content.stageMap` | 课程路径、阶段图、模块地图、学习路线提示 | `items`、`stages`、`current`、`block_key` |
| `visual.stage` | 非线性二维视觉舞台、路径对照、证据地图、局部显影、图形与活动共存的综合页面 | `stageId`、`aspectRatio`、`layers`、规范化 `region`、`zIndex`、`revealState`、教学标题、证据锚点；不得退化为纵向卡片列表 |
| `visual.derivationStage` | 二维公式推导、例题演算、非线性显影、长公式分块显影、语义变色 | `stageId`、`formulas`、`formula.blocks`、LaTeX 源、`textBlocks`、`connectors`、`revealSteps.targetIds`、`teacherControls`、`cognitiveLoad` |
| `visual.blockDiagram` | 控制系统方框图展示、路径高亮、结构构造、错误诊断、反馈回路识别 | `graphId`、`nodes`、`edges`、节点位置、标签、端口/求和点类型、`interactions.mode`、`revealPlan`；互动模式不得只给静态图 |
| `visual.signalFlowGraph` | 信号流图读图、前向通路、回路、不接触回路、梅森项映射 | `graphId`、`nodes`、`branches`、`forwardPaths`、`loops`、`nonTouchingLoopGroups`、`masonTerms`、`revealPlan`；公式项必须能回指图中路径或回路 |
| `visual.annotatedMedia` | 带热点和标注的图片/媒体证据选择、图上诊断、教师热点聚合 | `media.src`、`media.alt`、`annotations`、规范化热点 `region`、`evidenceRole`、`selectableAnnotations`、`revealPlan`、教学标签；不得显示文件名或模块名 |
| `visual.embedded-activity` | 嵌入视觉舞台或注释媒体中的图上选择、判断、定位任务 | `visualModuleId`、`activityId`、`anchorId`、`position`、`prompt`、`responseContractId`、`answerOptions`；必须接 canonical response contract |
| `activity.panel` | 单选、多选、判断、排序、配对、题组、短答、提交型活动的作答槽 | 必须在 `interaction_spec.activity_cards[]` 写 `prompt`、`response_kind`、选项/匹配项、答案、提交粒度 |
| `activity.workspace` | 结构化工作区、表单式工作区、案例记录、参数记录、需要学生填写多字段的活动 | 必须给 `response_kind`，通常为 `text.structured`、`parameter.set` 或 `table.builder`；字段结构必须显式 |
| `compute.panel` | Rust/WASM 或共享能力驱动的互动图形、根轨迹、Bode、参数扫描、训练面板 | 必须给 `capabilityRef` 与能力入口字段（如 `panel_id`、`spec_key`、`case_id`、`resolver`、`src/path` 或等价引用）；若页面要求学生调参或提交图形观察，还必须写清控件、默认参数和提交字段 |
| `analytics.summary` | 学生个人统计、班级统计、提交率、目标达成摘要 | `metrics`、`items`、`block_key`，并写清学生端/教师端差异 |
| `layout.support` | 标题、路由辅助、页面支持元素，不产生学习证据 | 只能承载布局辅助，不得替代正文、作答或统计模块 |

禁止项：

- 禁止把 `image-panel`、`formula-card`、`quiz-card`、`single-choice-card`、`drag-match`、`stage-map` 等旧组件名写入 `modules[].kind`。
- 禁止因标准组件不足而在课程契约中新增 `kind`；必须先提出组件库扩展或收窄设计。
- 禁止把关键内容放入 renderer 不可审计的私有字段；若审计脚本不能识别为非空，契约必须改写为 `text`、`items`、`columns/rows`、`formula(s)`、`src/assets`、`block_key` 等可审计字段。

1.8 **新增视觉组件的使用原则**

新增 `visual.*` 组件用于解决“卡片堆叠无法表达空间关系”的问题，不用于给普通正文换皮。选择时按教学对象判断：

- 若页面需要在同一二维空间组织图片、公式、标注、路径、局部活动或教师显影，使用 `visual.stage`。
- 若页面核心是推导、例题演算、公式项来源和变换关系，使用 `visual.derivationStage`；不得用普通 `content.reveal` 代替需要空间布局、非线性显影、LaTeX 分块或语义变色的推导。
- 若页面要求学生识别控制结构、反馈支路、比较点、执行器、对象或传感器，使用 `visual.blockDiagram`；不得把可交互结构图降级为 `content.figure`。
- 若页面要求学生识别变量节点、支路、前向通路、回路、不接触回路或梅森公式项，使用 `visual.signalFlowGraph`；公式表不得替代图中路径/回路高亮。
- 若页面要求学生在图中选择输入、输出、参数、风险、结果或证据位置，使用 `visual.annotatedMedia`，必要时叠加 `visual.embedded-activity`。
- 若页面核心是数值计算、参数扫描、响应曲线、Bode/Nyquist、根轨迹、训练或已有控制工作台能力，优先使用 `compute.panel` 和注册 capability；不得为课程另写数值面板。

视觉组件的设计稿必须写清学生端与教师端差异：未释放、已释放、显影中、答案揭示、学生提交后、教师诊断聚合至少哪些状态存在。所有可见标题、热点、节点、路径和错误说明必须使用教学语义，不得暴露 `stageId`、`graphId`、payload key、renderer 名、文件路径或 capability id。

视觉组件默认产生学习证据或交互证据。设计契约必须说明哪些事件只进入 `InteractionLog`，哪些提交进入 `StudentStepResponse`，哪些可作为 `LearningFact` 物化输入；浏览、聚焦、显影查看不能在没有作答或评分规则时被当作掌握证据。

2. **问题、原理、例题、作答必须拆开写清**
   - 原理/定理模块与例题模块必须分离。
   - 例题题面必须完整出现，不能只保留结果、图或摘要。
   - 学生作答区必须明确对应问题，不能只给空白输入框。
   - 不得使用“题面卡”“互动卡”等无教学语义的泛称替代真实模块名称；标题应直接说明对象、问题或方法。

3. **逐步显影只能隐藏步骤，不能隐藏题面**
   - 讲义中完整的推理过程、求解链与推导链，默认做成逐步显影。
   - 首次可隐藏的是步骤，不是题目本身。
   - 逐步显影页必须保留“本页在整堂课中解决什么问题”的静态提示，避免学生只看到碎片步骤。
   - 每个页面的显影状态必须彼此独立；切到新页面时默认全部收缩，不得继承上一页的展开状态。
   - 讲义中的例题或案例分析步骤必须设计为逐步显影；显影步骤不能过度省略，不能仅用文字描述替代公式、图形、表格或必要计算。
   - 若例题或案例分析中有公式，显影链必须保留公式；不得把公式压缩成“代入计算可得”。

3.5 **曲线图优先升级为 Rust 驱动互动图形**
   - 若讲义章节中有响应曲线、根轨迹、Bode/Nyquist、参数扫描或同类曲线图，优先考虑采用 Rust 驱动的图形面板复现讲义静态图的布局。
   - 互动图形页面必须分析设计意图，说明为什么选择这些参数作为控件，并把控件放在图形下方。
   - 有互动图形的页面，不再另设互动题目；学生调节参数后提交当前参数或观察记录作为互动。

4. **教师控制必须语义分离**
   - `发放作答`、`开放浏览`、`教师逐步显影`、`显示参考答案` 不是同一个开关。
   - 若这些语义不同，必须在机读契约中拆成独立字段。

5. **学生作答默认隐藏或锁定**
   - 默认优先隐藏作答区；若确需占位，再退化为锁定态。
   - 每个作答步骤优先采用独立小卡片，单独提交。
   - 除前测 / 后测 / 明确声明为题组页的步骤外，单页作答问题默认不超过 2 个；若超过 2 个，必须在设计稿中写明理由。
   - 无互动图形的普通页面，互动题目不得超过 2 题，全部采用客观题，可混合单选、多选、排序、判断等题型，并允许每题单独提交。
   - 普通互动页若设置 2 题，默认采用双栏排布；不得无理由回退为上下单栏堆叠。
   - 只要页面同时承担“阅读理解 + 方法判断 + 结果核对”，默认先呈现正文与题面，再呈现作答区；只有纯题组页才允许作答区位于页面最上方。
   - 若作答卡标题已经完整写出题面或判断动作，正文区默认不再重复同一句题面；除非设计稿明确要求补充额外作答说明。

## 参考文件入口

- 例题、推导、显影与教师/学生浏览控制：`worked-example-modules.md`
- 曲线图、设计页与比较页的拆分原则：`curve-interaction-panels.md`
- 页面顺序、模板区域拓扑、公式表格排布、作答卡与机读契约字段：`page-sequence-and-activity-controls.md`

## 设计流程

### Step 1｜抽取 clean brief 与讲义证据单元

先把 handout、BOPPPS、manifest、已有卡片、候选 sequence 和既有设计中的工程性提示下沉为 hidden constraints，只保留：

- 本页必须出现哪些对象、证据、题面、公式链、图后解释、结论桥接
- 本页若需显式目标，应出现哪些布鲁姆能力项
- 本页必须出现哪些**可直接渲染给学生的正文内容载荷**，例如标题句、题面全文、关键段落、表格内容、图后解释、作答题面与总结句
- 哪些范围不能扩张
- 目标读者在这一页需要完成什么理解 / 判断 / 操作
- 哪些教师控制语义必须进入机读契约，但不直接写成 prose 句型

若 `sequence.json` 已存在，先判断它是“已由互动设计验收过的最终顺序”还是“lesson 阶段候选草案”。候选草案只能提供卡片池和初始分组，不能限制最终互动步骤数；若互动设计需要拆分后测/总结、增加扰动/噪声页、调整卡片展示时机，应以页面自包含和讲义证据链为准。

若当前上下文里混入大量 harness、superpowers 或实现阶段提示，优先采用“主代理先抽 clean brief，子代理只接收 brief 生成 prose”的策略；子代理只处理页面蓝图 prose，不继承上游工程提示全文。

把讲义中的内容切成证据单元，至少覆盖：

- 对象与题面
- 原理/定理
- 公式链
- 表格
- 图与图后解释
- 媒体出现时机与前后证据
- 例题与求解链
- 结论句
- 误判点

同时把每个证据单元继续拆成“页面内容载荷”，至少考虑：

- 页面标题与小标题
- 面向学生直接显示的正文句、提示句、过渡句
- 完整题面或案例任务书，不得只写“见讲义”
- 公式本体与公式解释句
- 表格列名、行名与单元格正文
- 图注、图后解释与读图口令
- 逐步显影各层的完整文本，而不是只记“第 1 步 / 第 2 步”
- 作答卡标题、题面、干扰项或答案口径
- 本页收束句与回接本次课程目标的结论句

图片下方文案不得直接使用页面标题、模块标题、图片标题或文件名。若图片本身已经足够清楚，可以不写下方文案；若需要文案，必须写成图片具体内容描述、可观察证据、读图顺序或基于图片的分析判断。

`image-panel` 与互动图像/图形面板必须写入具体学科对象标题，例如说明看到的结构、曲线、路径、相图、频域证据或工程场景；不得使用“图片面板”“互动图像”“图示”“Rust 面板”“三标签面板”等只描述载体或实现形态的标题。图下文案不得复述标题，应补充可观察证据、读图顺序或判断口径；若没有新增信息，宁可不写 caption。

页面标题模块下的一句简短说明只属于标题模块文案，不得再另做“要点”“页面总览”“说明卡”“后测说明”等独立模块来复述同一内容。前测、后测和总结尤其不能把标题模块说明重复渲染成额外要点卡。

若某个证据单元只能被概括成“这里放一张图”“这里有个表”“这里学生讨论”，说明内容载荷尚未抽完，不能进入后续步骤。

### Step 2｜为证据单元选页面归宿

输出“证据单元升级决策表”，至少写清：

- `证据类型`
- `来源锚点`
- `目标步骤`
- `升级方式`
- `保留元素`
- `不得删减内容`
- `验收点`

同时输出“知识卡片互动归宿表”，至少写清：

- `node_id`
- `卡片标题`
- `来源证据`
- `目标步骤`
- `呈现方式`（常显卡片 / 显影卡片 / 作答前置 / 总结回看）
- `是否需要补写或拆分`

若发现现有 `sequence.json` 与互动步骤不一致，优先修订 sequence；不要为了迁就旧 sequence 压缩互动步骤。

同时输出“讲义章节覆盖表”，至少写清：

- `讲义章节`
- `覆盖步骤`
- `页面元素出现顺序`
- `主要公式与符号说明`
- `是否包含例题/案例显影`
- `是否包含曲线图与 Rust 互动面板`
- `互动方式`（无题 / 单题 / 双题 / 参数调节提交 / 前测题组 / 后测题组）

目标页与前测页可以不对应讲义章节；其余步骤不得缺少讲义章节映射。若某个讲义章节无法映射，必须先调整步骤框架。

### Step 3｜先搭步骤框架，再写页面蓝图 prose

先给出步骤列表框架，再逐步补齐每步的：

- 对应讲义章节（目标页和前测页除外）
- 页面模板
- 区域布局
- 模块清单
- 页面正文内容源
- 静态承载内容
- 证据顺序
- 元素出现顺序
- 主要公式与符号说明
- 互动升级点
- 教师控制
- 学生默认状态
- 学生页预览路径
- 本页脱离讲稿后的自包含检查

`interactive-page.md` 的每一步都应写成**页面蓝图 prose**，解释当前页的对象、证据、判断动作和阅读顺序；不要写成教师口播稿、前端需求单或“展示 / 引导 / 完成一次”式动作脚本。

仅写“静态承载内容：表 3 结果摘要”“对象 `P(s)` 与控制器 `C(s)`”“这里出现题面与四联图”还不够。这些仍是摘要级设计约束，不是可直接实现的课程内容。每一步必须继续下沉到可直接落到页面上的内容层，例如：

- 标题卡写什么句子
- 题面全文如何呈现
- 表格每一列和每个关键单元格写什么
- 公式后解释句怎么写
- 图后先读什么、再判断什么
- 作答卡标题与题面各写什么
- 本页最后用哪一句话把结论接回本次课程目标
- 若本页显式出现课程目标，布鲁姆能力项具体写什么

若实现者拿到设计稿后，仍需要自己编写大段教学正文、重写题面、补表格内容、脑补图后解释或替作者决定显影文本，则该设计稿仍然内容不足。

### Step 4｜用户确认后同步产出双轨真源

进入本步骤前必须满足：

- 人读版设计已经完整覆盖固定首尾步骤、讲义章节覆盖表、元素出现顺序、公式与符号说明、显影链、互动方式和自包含检查。
- 用户已经明确回复同意进入机读契约阶段。可接受表达包括“通过”“确认”“同意”“进入机读契约”“继续写 contract”等明确授权。
- 若用户只是提出修改意见、追问细节、要求继续完善，默认视为尚未通过；必须继续修订人读版设计。

未满足上述条件时，不得创建、重写或补全 `interactive-contract.yaml`。

`interactive-page.md` 与 `interactive-contract.yaml` 必须逐步骤一致，包括：

- 步骤顺序
- 标题
- 页面模板
- 互动类型
- 预览路径
- 教师控制语义
- 学生访问语义
- 页面正文内容源与内容块语义
- 每步知识卡片归属与 `sequence.json` 的 `groups[].step_ids`

其中：

- `interactive-page.md` 负责给出人读层的完整页面内容蓝图；
- `interactive-contract.yaml` 负责给出机读层的最小可实现内容载荷；
- `sequence.json` 负责记录互动步骤与知识卡片展示顺序；在本技能中应随双轨真源同步校准，不能早于互动页独立冻结；
- 二者都必须承载课程内容，不能出现“人读稿有内容、契约只有框架”或“契约有若干字段、人读稿只有约束摘要”的失衡状态。
- 对采用组件式 manifest runtime 的课次，契约还必须让每个 `modules[].kind` 与 `modules[].payload` 足够明确，使实现层只需补共享 renderer 或窄适配器，不需要写课程私有内容映射。
- 活动类 payload 也必须来自契约：题组选项、二元判断选项、参考答案、教师揭示文本和卡片标题都应落在 `interaction_spec` 或等价字段中。

### Step 5｜出稿前检查

必须逐项确认：

- 步骤 1 是否为导入漫画场景，且在场景中提出本单元主要问题
- 步骤 2 是否为布鲁姆动词驱动的课程目标页
- 步骤 3 是否为只考察本单元所需基础知识点的客观题前测页，未提前考察本单元将要讲解的新概念、新方法、新结论或核心推理
- 所有步骤名称是否采用教科书式陈述标题，且没有问句或否定句
- 收尾是否拆成后测页和总结页，且总结页顶部已附课程信息图
- 除目标页与前测页外，每步是否都注明对应讲义章节，讲义章节是否全面覆盖
- 每步是否严格按对应讲义章节内容出现顺序设计页面元素，并显式写出元素出现顺序
- 含公式章节是否列出主要公式和符号说明
- 后测题目是否简明、呼应目标页且不过度复杂
- 总结页是否讨论主要内容、局限性、重点难点和拓展思考
- 讲义中的核心对象、公式、图表、例题、结论都已落页
- 任何完整推导链都没有被压成“结果卡”
- 比较页没有吞掉本应单独存在的方法页
- 题面完整可见，逐步显影只控制步骤
- 逐步显影链的后续层级已完整列出，不存在只显影第一层而没有后续内容的页面
- 若讲义未明确讨论可行域、满意域或设计域，设计稿不得要求绘制可行域，也不得借用其他课次的可行域图层
- 图片、结构图或对比图没有被统一媒体槽位强行提前到页面最上方
- 学生作答卡不是统一大表单
- 教师控制不是单一“释放互动”开关
- 抽掉讲稿后，每一步仍能让学生知道当前对象、任务、关键证据以及它们与本次课程目标的连接点
- 若页面显式写出课程目标，是否只保留了本次课程目标的布鲁姆能力项，而没有暴露单元边界、课次定位或课程接口
- 所有曲线页都写明基线状态、阅读口令和结论回接，不能只给可操作面板
- 含曲线图章节是否优先设计 Rust 驱动互动图形面板，默认布局是否复现讲义静态图，控件是否位于图形下方
- 有互动图形的页面是否取消普通互动题目，改为参数调节后提交
- 无互动图形的普通页面互动题是否不超过 2 题且允许单独提交
- 需要二维空间组织、非线性显影、结构图、信号流图、图上热点或图中活动的页面是否已升级为合适的 `visual.*` 组件，而不是继续使用静态截图、纵向卡片或普通 reveal
- `visual.derivationStage` 是否保留 LaTeX 源、公式分块、非线性 `targetIds`、语义变色和长公式分块策略
- `visual.blockDiagram` / `visual.signalFlowGraph` 是否提供结构化节点、边/支路、路径、回路、显影计划和教学标签，且能产生结构证据
- `visual.annotatedMedia` / `visual.embedded-activity` 是否提供热点、证据角色、图上任务、教师诊断口径和 canonical response contract
- 视觉组件是否写明深浅色、学生/教师、未释放/已释放/显影/提交/揭示/诊断聚合等状态矩阵
- 页面蓝图 prose 中没有把 teacher controls、验收点、实现门槛直接写成自然段主干

### 学生面文本语义校准

互动页面中的学生面文本（标题、引导语、卡片文字、反馈文案、选项文字、图表标题、答案提示）同样适用 `course-content/AGENTS.override.md` 的写作约束：

1. **评价词展开**：不出现"更稳""更强""更全面"等未展开评价词；每个评价必须说明"在哪个维度上更好"
2. **动词精准**：不出现"进行""实现""打造""赋能"等万能动词；优先使用精确实义动词
3. **搭配自然**：不出现英文直译式中文表达（"硬的结论""稳的结果""深的融合"）
4. **句式克制**：不连续使用"不是……而是……""既……又……"等同构句式；每页面"不是……而是……" ≤ 1 次
5. **语体稳定**：保持在"引导式书面文本"语体内，不写成课堂口播或工程备注

页面蓝图 prose 的去污染检查同步增加上述五项。
- 每一步都已写出可直接呈现给学生的正文内容、题面、表格内容、图后解释或显影文本，而不是只留下摘要级标签
- `interactive-contract.yaml` 的 `content_blocks` 不是标题索引或占位提示，而是最小可实现内容真源
- `interactive-contract.yaml` 的 `modules[].payload`、`content_blocks` 与 `interaction_spec.activity_cards[]` 足以驱动共享 renderer；实现侧不需要按课程 id 或 module id 另写标题、选项、参考答案和表格行列
- `interactive-contract.yaml` 中每个静态模块都能被脚本判断 `renderer_owner: content`、`resolved_content_source`、`resolved_content_type` 与 `is_empty: false`；每个活动模块都能被脚本判断 `renderer_owner: activity`
- 若静态模块使用 `payload: {}`，契约中已写出可审计 resolver；否则必须补 `block_key`、`formula_key`、`image_key`、`field`、`rows`、`items` 或等价 payload
- `activity_cards[].prompt` 不会在正文内容模块中重复出现；若正文需要引入同一判断点，应改写为背景说明或阅读提示，而不是复制题面
- 对 manifest-first 课程，导出 runtime 后必须能运行独立审计脚本：`python3 .agents/skills/interactive-design/scripts/audit_interactive_manifest.py --lesson <lesson>`；脚本应留在本技能目录下，不能放到全局 `scripts/tests/` 里作为技能规则的隐式副本
- 实现者不需要靠 handout 或个人理解二次撰写大段课程正文，才能把当前步骤做成可读页面
- `sequence.json` 若存在，必须与最终步骤数和卡片归属一致；若它来自 lesson 阶段草案，必须在本阶段修订后再进入接受记录

#### 实现契约脚本闸门

完成或修改 `interactive-contract.yaml` 后，必须先执行契约生成闸门；任一失败都视为互动设计未完成，不能进入接受记录阶段：

```bash
python3 course-content/scripts/export_runtime.py <lesson>
python3 .agents/skills/interactive-design/scripts/audit_interactive_manifest.py --lesson <lesson>
npm run test:unit -- src/features/interactive/__tests__/interactive-module-taxonomy.test.ts src/features/interactive/__tests__/interactive-module-registry-gate.test.ts
```

完成子代理接受闭环并写入 `interactive-design-acceptance.json` 后，再执行终闸门：

```bash
python3 course-content/scripts/review_lesson_content.py --lesson <lesson> --skip-export --strict-implementation-contract
```

闸门解释：

- `export_runtime.py <lesson>` 验证作者态契约能导出 runtime `interactive-manifest.json`。
- `audit_interactive_manifest.py --lesson <lesson>` 检查每个模块的 `renderer_owner`、`resolved_content_source`、`resolved_content_type`、非空内容、activity/content 分离和重复题面。
- `interactive-module-taxonomy` / `interactive-module-registry-gate` 检查当前 runtime manifest 库存仍只使用标准模块、响应契约和已注册 compute capability。
- `review_lesson_content.py --strict-implementation-contract` 检查作者态互动页、契约字段、设计接受记录、实现契约与硬闸门；该命令必须在接受记录写入后运行。

不得把失败解释为“实现阶段再处理”。常见修复顺序是：先修 `interactive-contract.yaml` 的 `modules[].kind`、payload、`content_blocks`、`interaction_spec.activity_cards[]`，再重新导出 runtime，最后重跑审计。

### Step 6｜子代理设计接受记录

完成 `interactive-page.md` 与 `interactive-contract.yaml` 后，必须进入子代理驱动接受流程：

1. 主代理首先基于讲义的核心思路和主要内容模块，先定总页数、页面顺序以及每页对应的讲义文稿范围。
2. 主代理同步确定每页需要展示的知识卡片、作答卡、显影链和媒体证据；这一结果用于更新 `sequence.json`，不受 lesson 阶段候选顺序约束。
3. 主代理把单页 clean brief 发给**设计子代理**，要求它围绕“学生只看这一页互动就能明白”完成页面设计。
4. 设计子代理完成后，再交给**逻辑审核子代理**，用学生视角审查“学生只看这一页互动就能明白这个页面到底在讲什么吗”。
5. 若逻辑审核子代理判定不通过，必须转交给**整改子代理**回修，再次进入审核闭环。
6. 上述“设计子代理 -> 逻辑审核子代理 -> 整改子代理（按需）”是**强约束硬流程**，不得省略、合并、主代理代审，也不得以任何“等价检查”“主代理 fallback”“单次自查”替代。

1. 主代理只把 clean brief、讲义证据单元表、双轨真源草案与必须遵守的检查项交给设计审查子代理，不把上游 harness、实现阶段提示或完整聊天上下文塞给子代理。
2. 子代理必须按**单步 clean brief -> 单步页面设计 -> 单步逻辑审核**的粒度工作；不得把整课打包成一次笼统审查，也不得跳过页面级独立判断。
3. 子代理只判断“证据是否完整落页、页面蓝图 prose 是否自包含、机读契约是否可实现、是否存在降级或污染信号”，不得在审查阶段重写整课。
4. 主代理根据子代理问题回修双轨真源后，必须把回修后的对应步骤重新送入逻辑审核闭环，直到通过为止。
5. 若当前环境没有可用子代理、子代理调用失败、子代理权限不足，或任何原因导致上述独立代理链无法执行，主代理必须**立即向用户如实报告**：当前流程被阻塞，尚不满足 `interactive-design` 的接受条件；不得自主降级为主代理自审，不得写入“已接受”的验收文件。
6. 只有在子代理闭环真实完成且全部通过后，才允许写入 `design/interactive-design-acceptance.json`；缺少该文件时，后续 `lesson-content-review` 将视为硬闸门未通过。

`interactive-design-acceptance.json` 最小结构：

```json
{
  "acceptance_version": 1,
  "lesson_id": "<lesson>",
  "status": "accepted",
  "accepted_at": "2026-04-19T00:00:00+08:00",
  "review_mode": "subagent",
  "source_files": {
    "interactive_page": "course-content/authoring/lessons/<lesson>/design/<lesson>-interactive-page.md",
    "interactive_contract": "course-content/authoring/lessons/<lesson>/design/<lesson>-interactive-contract.yaml"
  },
  "checks": {
    "evidence_complete": "pass",
    "contract_alignment": "pass",
    "student_self_contained": "pass",
    "no_prose_pollution": "pass",
    "sequence_finalized": "pass"
  },
  "sequence_source": "interactive_design_finalized",
  "issues": []
}
```

阻塞态约束：

- 若子代理链未真实执行完成，不得产出 `status: "accepted"` 的验收文件。
- 若因子代理不可用而中断，必须向用户明确说明阻塞原因，并等待用户处理环境或调整任务；这属于流程阻塞，不属于可自主裁剪的设计细节。
- `review_mode` 只允许记录真实执行过的审查模式；当前技能默认且唯一接受态取值为 `subagent`，不得再写入 `main_agent_fallback` 或其他主代理替代模式。

## 输出要求

### `interactive-page.md`

必须写清：

- 全课总览
- 人读版步骤框架，且步骤 1/2/3 与后测/总结遵守固定语义
- 讲义章节覆盖表，注明目标页和前测页以外每步对应的讲义章节
- 证据单元升级决策表
- 混合证据顺序表
- 每一步的页面骨架、模块清单、静态承载内容、元素出现顺序、互动升级点、教师控制、学生默认状态、预览口径
- 每一步的页面正文内容源，例如标题文案、题面全文、关键正文句、表格正文、图后解释、显影文本、作答题面、收束句
- 含公式步骤的主要公式与符号说明
- 含例题或案例分析步骤的逐步显影链，且保留必要公式、图形、仿真或表格
- 含曲线图步骤的 Rust 图形面板设计、控件意图和参数提交方式；若不采用 Rust 面板，写明理由
- 每一步使用哪些知识卡片、是否常显、是否随显影出现、是否需要补写卡片
- 每一步的“脱离讲稿自包含检查”或等价说明

### `interactive-contract.yaml`

必须写清：

- `layout`
- `modules`
- `content_blocks`
- `evidence_sequence`
- `interaction_spec`
- `teacher_controls`
- `preview_contract`

若涉及例题显影或学生作答，还必须补齐由参考文件要求的访问与控制字段。

`content_blocks` 在本技能中是**强制内容真源**，不得退化为标题索引、占位提示或“见讲义”锚点。每一步至少应能从 `content_blocks` 或等价结构中直接读出以下一类或多类内容：

- 正文段落 / 提示句
- 题面全文 / 任务书
- 表格内容
- 公式解释句
- 图注与图后解释
- 显影步骤文本
- 作答卡题面或选项
- 收束句 / 回接主线句

`modules` 与 `interaction_spec` 是组件式 runtime 的直接输入，也不得退化为占位索引。至少应写清：

- `modules[].kind`、`region`、`order`、`must_be_visible`
- `modules[].payload.title` 或等价标题来源
- 公式、表格、图片、路径项、显影项、卡片组等模块对应的 payload 键与实体内容
- `activity_cards[].prompt`、`response_kind`、`options`、`submit_scope`
- `reference_answer`、`reveal_answer` 或等价答案揭示规则

`modules[].kind` 必须使用标准模块类；旧组件名只能放在 `payload.legacyKind` 中作为历史渲染提示。`response_kind` 必须使用 `choice.single`、`choice.binary`、`choice.multi`、`text.short`、`text.structured`、`parameter.set`、`ordering.sequence`、`matching.pairs`、`table.builder` 等 canonical 响应名，不得继续使用 `single_choice`、`fill_text`、`drag_match` 等迁移别名。

若当前步骤没有这些内容，只剩模板、模块名和互动类型，则该契约仍不能视为可实现的双轨真源。

### `interactive-design-acceptance.json`

必须写清：

- `acceptance_version`
- `lesson_id`
- `status`
- `accepted_at`
- `review_mode`
- `source_files.interactive_page`
- `source_files.interactive_contract`
- `checks`
- `issues`
- `sequence_finalized` 或等价字段，说明 `sequence.json` 已与互动步骤和卡片归属一致；若本课暂不制作互动课程，不应写接受文件

## 常见误用

| 误用 | 正确做法 |
|------|----------|
| 只保留图片与一句结论 | 把题面、公式链、图后解释和结论全部落页 |
| 把结构图或大图固定放在页面最上方 | 按讲义证据链决定图片出现时机，通常先原理/公式，再图，再分析或对比 |
| 把例题和原理压进同一个信息块 | 原理模块与例题模块分离 |
| 让学生默认就能展开全部例题步骤 | 默认锁定学生浏览权限，由教师单独控制 |
| 用统一大表单承载整页作答 | 拆成独立小卡片，单独提交 |
| 用比较页替代完整方法页 | 先给方法页，再给比较页 |

## 完成态

只有在以下条件同时满足时，才算完成：

- 双轨真源已写入作者态目录
- 讲义证据链已完整映射
- `sequence.json` 已按互动步骤完成最终校准，或明确记录本课不使用卡片顺序
- 例题与推导显影规则已写清
- 曲线图步骤与比较页的拆分合理
- 教师/学生控制语义已写成可实现字段
- 子代理闭环已真实通过，并写入 `design/interactive-design-acceptance.json`
- 拿掉讲稿后，学生仍可基于互动页理解当前知识对象、判断动作以及它们与本次课程目标的关系

*版本：v1.2 | 2026-04-26*
