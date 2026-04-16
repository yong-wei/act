---
name: interactive-lesson-implementation
description: Use when implementing or upgrading this repository's interactive lessons from `course-content/authoring/lessons/` and reviewed runtime lesson bundles, especially to align new lesson structures, turn reviewed handouts/BOPPPS/media into production pages, and enforce the current premium-course rules around evidence-complete page coverage, hidden AI page contexts, submission feedback, teacher aggregation, event governance, runtime media, and session sync/performance reuse.
---

# Interactive Lesson Implementation

## Overview

按当前仓库的新体系实现或优化互动课程。把 `course-content/authoring/lessons/.../design/interactive-page.md` 与 `interactive-contract.yaml` 视为双轨设计真源，把 `course-content/runtime/lessons/...` 下经过 `lesson-content-review` 的产物视为已审查输入，把仓库中的课程代码视为待对齐对象。

本技能主文件只保留总流程、触发条件和参考文件入口。凡是页面布局、入口页文案装配、runtime 媒体文档格式、视频/音频容器、讲义摘要渲染这类可复用细节，一律下沉到 `references/`，不要继续把所有设计细节堆回主技能正文。

当前默认基线不再是单一 `L-2c`，而是综合以下已落地课程能力：
- `1-1`：理论型精品互动课的第一页入口、教师/学生双端、提交闭环、教师统计与答案揭示、统一事件链。
- `1-2`：17 步课堂蓝图、词云/回复列表、runtime 首页与课堂双线协同。
- `1-3`：增强型工作区、步骤级 AI 上下文、知识卡抽屉、浏览器验收、review/runtime 联动。
- `2-1`：课前预习台统一入口模板、runtime 媒体文案装配、页内音视频容器、讲义在线阅读/下载，以及课堂外资源互动追踪链路。
- `4-1`：统一 `useControlEngine -> control-analysis.worker.ts -> Rust/WASM compute_analysis -> ControlFigureWorkspace` 的曲线联动基线、固定面板组合、固定坐标范围、指标覆盖层与共享夹具回退。

后续课程若涉及参数联动曲线，默认沿用 `4-1` 的 Rust/WASM 曲线联动基线；除非设计稿显式声明例外，不再回退到旧的单课内联图表实现。

**核心原则：**
- 互动课程首先是完整课件，其次才是互动体验。页面必须先承载标题层级、公式、表格、图示、例题、结论，再把最值得升级的位置做成交互。
- 静态页合法且必要；不是每一步都必须互动，页面总数按教学逻辑与覆盖需求决定，不设硬上限。
- 关键知识不得转嫁给互动组件。即使关闭互动，页面也必须保留核心概念、公式、图示、表格、例题和结论。
- 若设计稿已把“原理/定理模块”“例题模块”“作答模块”分开，实施阶段不得把它们合并成统一信息块或统一工作区壳。
- 若设计稿已区分 `发放作答`、`开放浏览`、`教师逐步显影`、`显示参考答案`，实施阶段不得退化成单一“释放互动 / 显示答案”双开关。
- 若设计稿已把学生作答拆成多张步骤卡，实施阶段不得收缩为单个统一文本框、统一提交按钮或统一答案模型。
- 若设计稿未把某页明确声明为题组页，而是“正文阅读 + 方法判断 + 作答”混合页，实施阶段默认维持“正文在前、作答在后”的顺序；不得把作答区整体提前到正文上方。
- 除前测 / 后测 / 设计稿显式声明的题组页外，实施阶段默认每页作答卡不超过 2 张；不得把多个判断点继续堆回 3 张以上的小卡组。
- 若讲义与设计稿把不同方法页和比较页分开，实施阶段不得跳过方法页而只保留比较页。
- 页面骨架优先服从讲义证据链，不得把案例页、综合页或设计页实现成流程管理器、小测堆栈或摘要卡拼盘。
- 双轨设计真源具有最高优先级：人读 `interactive-page.md`，机读 `interactive-contract.yaml`。实现时必须同时服从二者，不得跳过其一。
- **严格按结构化文档实现。禁止降级实现、禁止偷懒替换、禁止自由发挥补设计。**
- 设计稿中若已明确拖拽、连线、排序、拖槽、路径高亮、热点标注等组件形态，实施阶段不得改成选择题、填空题、文本问答或“先放占位以后再补”。
- 设计稿中若已固定页面模板、区域、模块、文本、公式、图片、表格、教师聚合、隐藏式 AI 上下文与学生页预览，实施阶段不得擅自删改、合并、改写或重排。
- 设计稿若已固定证据单元顺序、主阅读顺序、曲线图镜像排布、基线参数或结构切换方式，实现阶段不得擅自改成“图先行”“卡片先行”“单选替代”或“另起一套互动图”。
- 设计稿若写明 `parameter_slider` / `parametric_sim` / 曲线联动图，实施时必须让控件直接驱动同页曲线或图示的原生重绘；禁止保留静态截图，再在截图下方附一块“滑块说明卡”假装联动。
- 设计稿若同时给出对象框图、传函与曲线证据，页面顺序必须服从讲义与设计真源；默认先对象框图，再传函，再动态曲线区。若框图与传函同屏，可用双栏；若该段只剩框图，则框图单栏横向铺满。
- 不得在通用内容面板中预留一个无差别媒体槽位，再把所有图片或 `mediaSrc` 自动插入正文前部；图片、图组、结构图、表格与公式的出现位置必须由步骤契约中的 `layout.regions`、`modules` 与 `order` 决定。
- 设计稿若已写明“图后继续读公式/表格/实例表/风险表”，实现阶段不得把图单独提升到页面最前方，再把后续证据拆散到别处；图后证据必须按既定顺序继续展开。
- 对于非曲线教学图，实施阶段默认不接受“直接贴一张 PNG 再加说明”的降级方案；若设计稿对应的是结构图、步骤图、对比图、矩阵图、职责图或判断清单，应优先落成原生组件、显影板或分步呈现板。
- 对于推导型或公式密集型页面，实施阶段必须让阅读节奏可见：至少区分 `起点公式 / 中间推导 / 目标公式 / 结论解释` 的展示层次；不得把讲义中的推导链压成一块最终公式卡。
- 若设计稿要求“逐步显影后才出现图片或验证图”，实现阶段必须先落题面和显影链，再落图片；不得提前把图片挂到正文第二行之前。
- 展示页若没有作答语义，不得额外渲染“无需提交”占位卡、空教师汇总卡或其他壳层占位模块。
- 运行时页面必须 `runtime-first`，不能偷偷回读 `authoring` 或历史 `content`。
- 课程页面必须同步接入步骤级 AI 上下文、提交反馈、教师端汇总、统一课程事件与数据治理语义。
- 课程入口页、预习台、知识图谱、知识卡片、跨域模块和 standalone 互动资源的课堂外行为，也必须进入统一追踪链路；不要只顾课堂内事件。
- 所有图像都必须是真实媒体：代码直出图、前端真实绘图或 AI 生成图；禁止 ASCII 图。
- 媒体不足时，优先补作者态 `media/raw` / `media/processed`，再导出 runtime；不要把“后续补图”当默认答案。

## 路径与真源

### 1. 先解析真实课次路径

不要假设所有课都在 `legacy/`，也不要假设新课都不在 `legacy/`。先解析出该课真实目录：

- 作者态设计源：
  - `course-content/authoring/lessons/<lesson>/...`
  - 或 `course-content/authoring/lessons/legacy/<lesson>/...`
- runtime 产物：
  - `course-content/runtime/lessons/<lesson>/...`
  - 或 `course-content/runtime/lessons/legacy/<lesson>/...`

实现前先确认这两个目录是否一一对应，再继续。

### 1.5 双轨设计源

若课次已建立双轨设计，作者态设计源默认包括：

- `design/interactive-page.md`
- `design/interactive-contract.yaml`

实现前必须确认：
- 两者都存在
- 步骤顺序一致
- 步骤标题一致
- 互动类型一致
- 学生页预览路径一致

若两者不一致，先回到设计/审查阶段修正，不得带着冲突进入实现。

### 2. 运行时知识与卡片路径

当前正确路径如下：

- 全局节点唯一来源：`course-content/runtime/knowledge/graph/nodes.json`
- 全局关系唯一来源：`course-content/runtime/knowledge/graph/relations.jsonl`
- 全局知识卡唯一来源：`course-content/runtime/knowledge/cards/nodes/`
- 课次局部结构来源：`course-content/runtime/lessons/.../<lesson>/graph-overlay.json`
- 课次首页与步骤编排来源：`course-content/runtime/lessons/.../<lesson>/lesson.json`
- 课次讲义来源：`course-content/runtime/lessons/.../<lesson>/handout.md`
- 审查结果来源：`course-content/runtime/lessons/.../<lesson>/review/*`

互动课程实现不要自创第二套知识卡路径，也不要把 lesson runtime 误写成知识卡正文存放处。

### 3. 已审查输入

默认需要读取：

- `design/interactive-page.md`
- `design/interactive-contract.yaml`（若存在则必读）
- `runtime/.../lesson.json`
- `runtime/.../graph-overlay.json`
- `runtime/.../handout.md`
- `runtime/.../media/<lesson>-media.md`（若课程入口页、预习台或外部媒体入口存在，则必读）
- `runtime/.../review/boppps.md`
- `runtime/.../review/review-report.md`
- `runtime/.../review/interactive-page-check.json`
- `runtime/.../review/knowledge-card-check.json`
- `runtime/.../review/multimedia-check.json`
- `runtime/.../review/source-manifest.json`

如果这些 runtime/review 产物不存在，先回到 `lesson-content-review`，不要在本技能里顺手补审正文或知识卡。

若课程包含入口页预习台、媒体入口卡或讲义下载/在线阅读卡，还必须额外读取：

- [references/runtime-entry-page-pattern.md](references/runtime-entry-page-pattern.md)
- [references/runtime-media-index-contract.md](references/runtime-media-index-contract.md)

## 启动方式

如果用户没有明确说明是新课还是改现有课，先问清楚：

1. 是开始一门新课实现，还是优化已有互动课？
2. 课次编号是什么？

如果是优化已有课：
- 先读 `notes/<lesson>.md`
- 再读当前实现入口文件
- 最后确认本轮优化范围

如果是开始新课：
- 先读设计稿和 runtime/review
- 再找 `1-1`、`1-2`、`1-3` 或其他最相近课程做复用基线
- 先给实现计划，再开始改代码

## 工作流

### 1. 先读双轨设计，不得边实现边补设计

实现前先逐步核对双轨设计中已经固定的结构，不得在实现阶段重新发明页面：

- 页面模板、区域布局、模块清单是否已明确
- 证据单元、主阅读顺序、折叠策略是否已明确
- 固定文本、公式、图片、表格、例题、结论是否已明确
- 互动组件类型、交互规则、干扰项、揭示规则是否已明确
- 曲线图是否已明确为静态展示还是参数联动仿真板；若为参数联动图，是否已写明基线参数、图组排布、结构切换方式与控件栏位置
- 埋点摘要、教师聚合、AI 上下文、学生页预览路径是否已明确

若这些内容未写明，先回到 `interactive-page.md` / `interactive-contract.yaml` 补设计，不得在实现阶段自由发挥补齐。

若缺失的是例题显影节奏、学生作答卡粒度、教师浏览控制或图文顺序等作者态约束，先回到 `interactive-design` 补设计，不得在实现阶段擅自发明默认规则。

禁止把设计稿中已经结构化写死的内容，在实现阶段再“合理化调整”为更简单、更省事的版本。

### 2. 开工前必须建立“设计稿到实现稿对照表”

实现前先在 `notes/<lesson>.md` 写出对照表，再开始改代码。对照表至少包含：

- 设计稿步骤 / 标题
- 人读稿页面模板 / 主阅读顺序 / 区域 / 模块 / 固定内容
- 机读稿互动类型 / 交互规则 / 埋点 / 教师聚合 / AI 上下文 / 预览路径
- 若为曲线图步骤：静态图基线、图组排布、结构切换、控件折叠策略
- 当前实现位置或缺口
- 本轮处理状态（严格实现 / 缺实现 / 设计冲突待回修）
- 验证方式或证据

建立对照表后，至少核对：

- 步骤数量、标题、顺序、时长
- 每一步的页面模板、主阅读顺序、区域、模块、静态承载内容是否已实现
- 每一步的互动类型是否与机读契约一致
- 每一步的证据单元是否已完整落页，而不是只剩摘要卡
- 若存在曲线图步骤，默认状态是否复现讲义静态图，图组排布是否与原图一致
- 每一步是否发生了降级实现、删减实现或擅自新增设计
- 教师端控制流：释放、揭示、汇总、结束课堂
- 学生页默认预览是否与真实学生页一致
- 首页是否正确消费 runtime 导学、知识图谱、卡片预览与讲义入口
- 媒体是否真的存在，而不是还停留在设计说明

没有对照表，不得直接开工。

### 3. AI / 反馈 / 数据治理设计必须先于实现

每个需要互动的步骤，在动手前明确：

#### AI 上下文

- `topic`
- `learningObjectives`
- `knowledgeType`
- `quickQuestions`
- `systemPromptExtension`
- `deliveryMode`

默认做法：
- 在 `src/lib/<lesson>-ai-contexts.ts` 中集中维护步骤级配置
- 在 `src/lib/course-ai-contexts.ts` 中注册课程
- 在学生页步骤切换时调用 `useGlobalAI().updatePageContext(...)`
- 默认把 AI 作为隐藏式页面上下文与快捷提示词配置，供全局浮动助手消费；不要默认在页面内部实现显式 AI 模块
- 默认把快捷提问嵌入控灵助手上下文，不再在页面正文里额外摆一块“页内 AI 助手”“复制提示词”或单独打开对话框的区域
- 若课程确需页内 AI 入口，必须有明确理由，并在设计稿中写成例外项；不要跳转旧 `/ai` 页面

#### 学生反馈

至少明确该步骤是否具备：
- `SubmissionStatus` 或同等级提交态提示
- 提交成功反馈
- 防连续提交/防连点的等待态或按钮禁用策略
- 等待教师释放的锁定态
- 教师揭示答案后的参考答案显示
- 允许修正或重提时的反馈文案

#### 教师汇聚

客观题默认要求：
- 显示选项统计
- 可释放活动
- 可揭示答案

文本题默认要求：
- 显示词云
- 默认折叠学生回复列表
- 回复按时间排序

若设计稿已明确教师汇聚组件或禁止记录的高频事件，实现时必须原样遵守，不得擅自增加原始轨迹采集。

#### 课程事件与治理

优先复用统一课程事件链，不要在课程页散写裸字符串。至少判断是否需要：

- `lesson_step_view`
- `lesson_step_leave`
- `lesson_submit`
- `lesson_resubmit`
- `workspace_param_change`
- `ai_panel_open`
- `ai_query_submit`
- `sync_error`
- `session_finalize`

如果新增事件类型或 payload 结构，必须同步检查：
- `src/lib/classroom-analytics/event-taxonomy.ts`
- `src/lib/data-governance/event-normalization.ts`
- `src/lib/data-governance/event-types.ts`
- 相关测试

实现目标不是“埋点能发出去”，而是后续可以沉淀 `LearningFact`。

#### 课堂外资源事件

如果页面上存在“不进入课堂会话也能访问”的资源或互动区，必须显式判断其是否属于课堂外资源追踪范围。典型包括：

- 课程入口页预习台中的视频、音频、课件、讲义
- 入口页 runtime 知识图谱节点与知识卡片
- 独立跨域探索入口或模块卡片
- standalone 互动资源页中的非课堂态交互

这类行为不要借用 `lesson_step_view`、`lesson_submit` 等课堂事件语义，也不要因为“不是课堂内”就不接埋点。默认要求：

- 优先复用 `useResourceInteractionTracking`
- 入口媒体至少覆盖：`resource_view`、`resource_open`、`resource_play`、`resource_progress`、`resource_download`、`resource_complete`
- 知识图谱节点点击至少覆盖：`knowledge_graph_node_focus`
- 知识卡片打开至少覆盖：`knowledge_card_open`
- 跨域或外部互动模块入口至少覆盖：`external_module_open`
- payload 至少能回收到 `surface`、`pageType`、`targetType`、`targetId`、`targetLabel`、`originPath`

新增或改造入口页时，目标不只是“前端能发事件”，而是：

- `InteractionLog` 能记录这些行为
- 个人中心活动流能正确展示标题、说明、链接与徽标
- 高价值事件后续可升格为 `LearningFact` 或能力贡献

若本轮课次包含预习台、媒体卡、入口知识图谱、知识卡或跨域入口，必须同时转读：

- [references/runtime-entry-page-pattern.md](references/runtime-entry-page-pattern.md)
- [references/runtime-media-index-contract.md](references/runtime-media-index-contract.md)

### 4. 媒体策略

#### 代码直出和线框图优先

遇到以下媒体不足时，优先补真实媒体，而不是 ASCII 或长期占位：

- 时域/频域/根轨迹/伯德图/奈奎斯特等控制图
- 方框图、信号流图、电路图、弹簧阻尼系统等线框图

#### 曲线图镜像实现优先

若设计稿中的证据单元对应 handout 曲线图，默认优先实现为“静态图的可调镜像”：

- 默认参数、默认结构组合、默认曲线数量必须先复现讲义静态图
- 静态图若为 `2x2` 图组，互动图默认也保持 `2x2` 图组，只允许为窄屏做响应式重排
- 控件栏默认位于图组下方并折叠
- 单参数变化默认只给一个滑块
- 多结构比较默认给结构勾选项，并为每种结构提供自己的参数滑块
- 同类型结构只配置一次，不按每条曲线重复配置
- 不得把 handout 的曲线图随意改成另一种视觉组织方式，除非设计稿已明确要求
- 控件变化必须即时驱动曲线、设计点、可行域标记或相关示意层同步重绘；禁止“控件会动，但图不变”
- 运行时统一复用共享控制分析底座：`useControlEngine`、`control-analysis.worker.ts`、Rust/WASM `compute_analysis`、`ControlFigureWorkspace` 与共享请求接口；不要在单课里重写一套内联图表计算器
- 曲线图请求参数必须与设计稿契约对齐，至少覆盖 `caseId`、`outputs`、`timeRange`、`frequencyRange`、`rootLocus`、`structures`、`referenceProfile`、`feasibleRegion`
- 若设计稿要求“统一根轨迹工作区”，实现时必须只保留一个根轨迹面板，并让添加零点/添加极点/拖动零极点位置这些控件直接驱动该面板；不得保留静态根轨迹截图，再另挂一个不联动的小控件区
- 四联图或多联图的子图内容、位置与阅读顺序，必须严格继承讲义原图布局；若讲义把幅频和相频拆成双图，也必须按原图位置实现，不得因为实现方便改换位置
- 面板默认只保留标题，不再额外堆叠解释文案；时域图显示当前时域性能指标，频域图显示 `PM/GM` 与交越频率，根轨迹图显示当前闭环极点；所有图内标注与 tooltip 统一保留 2 位小数
- 时域图默认用虚线叠加参考信号
- 绘图范围与数轴必须固定，按参数上下限覆盖的全区间预设；不允许滑块变化时动态缩放坐标轴，避免界面闪烁
- 根轨迹实现必须关注分离点、回折点与交汇点；若统一 Rust 引擎已对关键区间采样做过加密，实现阶段不得再退回低精度采样，导致分离点不交汇
- 曲线图的子图内容、位置、阅读顺序必须与讲义严格一致；不得把讲义左下的根轨迹挪到右上，也不得把综合图压扁成任意切换式单图

#### 示意图原生重绘

以下内容默认视为“结构示意图”，应优先在前端以 SVG / Canvas / 结构化组件原生重绘，而不是直接插入 PNG：

- 任务表达卡模板
- 指标角色矩阵
- 区域分层图、可行域/满意域/最优域关系图
- 判断清单、职责分工板、流程关系图

只有当图片本身承载不可替代的外部素材信息时，才允许保留位图。若是模板、矩阵、层级框、关系示意，必须做成前端可读、可缩放、可随主题适配的原生组件。

除系统框图外，默认不再把示意图实现成静态 PNG。若设计稿中的示意图属于步骤、对比、卡片式结构，默认进一步升级为“按步骤点击逐步呈现”的互动形态，而不是一次性平铺全部信息。

#### 公式与推导显影优先

若设计稿中的证据单元包含推导链、公式比较链或“由标准式推出结论”的阅读节奏，实施时默认优先实现为逐步显影，而不是一次性把所有公式平铺在同一块卡片中：

- 至少区分 `起点对象/标准式`、`中间推导`、`目标公式`、`代入或判断`、`结论句`
- 首屏必须先出现讲义要求的起点证据，不得一上来只给最终式
- 若设计稿要求“先看公式，再看图，再看实例表”，实现时不得让图片或媒体模块抢到公式前面
- 若步骤正文中同时有图和推导链，图与推导谁先谁后必须由步骤契约决定，不得交给共享面板的默认槽位控制
- 公式显影组件必须保留 LaTeX 渲染与逐项标题，不得退化成纯文本列表

#### 原生表格

讲义中的表格进入互动页时，默认实现为前端原生表格：

- 公式与符号继续走页面 LaTeX 渲染链
- 不得把表格整体做成图片贴入页面
- 若设计稿要求逐行、逐列或分组呈现，应实现为渐进揭示，而不是整表静态平铺

制作规则：
- 互动课运行时参数联动曲线：使用统一 Rust/WASM 控制分析引擎与共享工作区
- 作者态静态图、离线校核数据、夹具基线：使用 `python3` + `control` 或 `Octave`
- 方框图/信号流图/电路/机械结构：使用 `tikz-control-draw`
- 示意图与表格原生化：使用前端 SVG / Canvas / HTML 原生组件
- 作者态脚本放在 `course-content/authoring/lessons/.../<lesson>/media/raw/`
- 审核产物放在 `course-content/authoring/lessons/.../<lesson>/media/processed/`
- 再通过 `bash course-content/scripts/export-runtime.sh <lesson>` 导出到 runtime

不要直接把代码直出图写进 `public/` 当默认正式路径。

#### 外部或 AI 生成媒体

若确实需要外部图片、视频或 AI 图：
- 也先落到作者态 `media/processed/`
- 在页面中最终通过 `/course-runtime/...` 或统一运行时路径消费
- 禁止正式交付保留 ASCII 图、字符框图、字符波形

详细规则见：
- [references/media-and-path-rules.md](references/media-and-path-rules.md)
- [references/runtime-code-generated-media.md](references/runtime-code-generated-media.md)

### 5. 入口页与课堂页约束

#### 首页与入口页

首页通用约束仍然成立：

1. 教师入口 / 自由浏览 / 学生入口
2. 课程概览与导学
3. runtime 知识点网络
4. 知识卡片预览
5. 讲义入口与讲义详情

硬要求：
- 知识点网络来自 runtime 全局图谱 + lesson overlay
- 关系要有方向，不是无向线
- 讲义必须正确渲染 LaTeX 公式
- 讲义入口与详情区都要支持导出 PDF
- 如果入口页包含预习台或课外媒体卡，默认复用 `2-1` 当前入口模板或其共享组件，不要各课重新发明结构、容器和事件链。
- 入口页若包含预习台、媒体卡、讲义、知识图谱、知识卡或跨域入口，必须采用统一资源挂载与互动埋点链路；优先复用 `LessonEntryMediaHub`、`LessonEntryRuntimeSections` 与 `useResourceInteractionTracking`，不要单课自造资源壳层或自定义裸埋点。

若课程入口页还包含“课前预习台”或运行态媒体入口，不要在主技能正文里自行发挥布局和文案，必须转读：

- [references/runtime-entry-page-pattern.md](references/runtime-entry-page-pattern.md)
- [references/runtime-media-index-contract.md](references/runtime-media-index-contract.md)

#### 课堂页

硬要求：
- 顶部标题区保持完整课件语义，不只剩“当前第几步”
- 非首页知识卡入口统一放在标题区右上角
- 知识卡抽屉统一文案：`知识卡片` / `页面知识卡片`
- 学生页默认窄屏优先
- 当前在线学生列表默认折叠
- 学生端首次跟教师，之后不同步时给出提示并允许手动跳转，不强制追页
- 教师页必须可结束课堂
- 默认预览口径与学生页一致；教师端模板弹窗不是实现验收标准

### 5.5 禁止降级与自由发挥

以下行为一律视为实现不合格：

- 设计稿写的是拖拽配对，实际做成单选题
- 设计稿写的是路径高亮，实际做成文字解释题
- 设计稿写的是三列配对舞台，实际只保留一个下拉框
- 设计稿写了完整表格、公式条、图示，实际删成几行摘要
- 设计稿写的是动态曲线联动，实际保留静态截图，只在下方加参数说明卡
- 设计稿写的是模板卡、矩阵图、层级示意，实际直接塞一张位图
- 设计稿写明学生演示页预览，实际仍以教师模板弹窗作为验收替代
- 设计稿未要求新增内容，实际擅自加入新问题、新结论、新例题或新交互
- 设计稿信息不全时，实施阶段自行补设计而不回写设计源

正确做法只有两种：

1. 严格实现现有结构化设计
2. 发现设计冲突或缺口时，先回写 `interactive-page.md` 与 `interactive-contract.yaml`，经审查后再实现

### 6. 会话同步与性能约束

优先复用现有会话底座，不重新造轮子：

- `useTeacherLessonSession`
- `useStudentLessonSession`
- `useCourseEventTracking`
- `useInteractiveTracking`
- `/api/session/[sessionId]`
- `/api/session/[sessionId]/stream`

当前规范已经包含：
- Redis 缓存会话状态
- Redis 发布状态变更
- SSE 实时同步
- Redis 不可用时的轮询降级
- 课堂限流

新课默认复用这套链路，不要重新写单课轮询器、手搓同步协议或重复的会话存储。

### 7. 复用当前精品课实现

优先参考：

- `1-1`
  - 课程入口与 runtime 首页导学
  - 教师端释放/显示答案/结束课堂
  - 提交闭环与事件跟踪
- `1-2`
  - 17 步课堂蓝图
  - 词云/回复列表
  - 页面结构化上下文与课堂骨架拆分
- `1-3`
  - 增强版工作区
  - 步骤级 AI 上下文集中注册
  - 知识卡抽屉与 review/runtime 深度联动

不要再把旧精品课里“重互动、轻课件”的部分当成新规范继续扩散。

## 实现约束

- 优先复用现有课程框架、路由解析、预置教案、课程目录注册与资源注册。
- 课程实现后，必须在互动课程总入口页注册精品课程入口。
- 新课实现后，必须在 `src/features/interactive/learning-catalog.ts` 注册入口。
- 不把 AI 文案、快捷问题、步骤目标散落在多个组件里。
- 不默认给每一步长出页内 AI 区块；若只是为了接控灵助手上下文，保持隐藏式页面上下文即可。
- 不把大块课程正文硬编码成难以复用的 JSX 常量堆；优先整理为步骤配置、内容块、媒体清单、工作区配置。
- 不在模块里继续散写旧式颜色类；优先复用统一主题变量和现有 premium lesson 视觉基线。
- 公式必须以 LaTeX 形式在页面中正确渲染，不能退化为纯文本近似写法。
- 面向学生的文案、按钮、选项标签中不得泄露实现层字段名、枚举值、内部状态键或 telemetry tag，例如 `stable_equals_done` 这类内部标识不得直接显示在前端。
- 页面中的互动只能实现设计契约已经声明的类型、顺序、反馈与指标呈现；若实现时发现契约缺字段，应先回写 `interactive-page.md` / `interactive-contract.yaml`，再继续编码。
- 不得把作者态已写死的页面顺序再次编码成组件内部默认顺序；若共享组件需要承载图片、公式、表格或补充说明，必须显式接收步骤级顺序配置，不得依赖统一前置媒体逻辑。
- 若步骤同时包含图片、公式、表格与结论区，实现稿必须逐一对照契约确认：哪些内容同屏、哪些先于交互区出现、哪些只能在揭示后出现；不能因为复用统一外壳就让图片区或摘要区抢到正文前面。
- 非曲线教学图若被实现为原生组件，契约中至少应能看出 `upgrade_mode`、`reveal_sequence`、`same_screen_with` 与 `fallback_static_reason`；若这些字段缺失，应先补契约，不得靠实现者自行猜测。
- 推导型页面若使用公式卡、公式栈或渐进揭示组件，必须让组件顺序直接对齐设计稿；若当前组件无法表达推导链，应先扩展组件或拆分步骤，而不是退回“一次性平铺全部公式”。
- 页面埋点必须优先复用统一互动采集框架；课堂内事件走 `useCourseEventTracking / useInteractiveTracking`，课堂外资源事件走 `useResourceInteractionTracking`，不得把两套语义混写。
- 若实现偏离设计稿，必须在课程笔记中写清楚：来自哪份设计稿、偏离原因、为何更适合平台。

## 闭环验证

收工前必须先完成“完整课件职责”核对，再做“设计稿 vs 实现稿”核对，最后做浏览器验收。至少确认：

- 每一步即使关闭互动，仍保留可讲授的静态核心内容
- 静态页被合理使用来承载概念、公式、表格、图示、例题、结论
- 关键知识没有被转嫁给互动组件、页内 AI 模块或提交后反馈区
- 页面先满足完整课件职责，而不是只剩互动骨架
- 设计型或案例型页面的主阅读顺序仍与讲义一致，没有被改写成“大图先行”或“流程卡先行”
- 每一步的证据单元都已显式落页，不是只剩摘要卡或操作卡
- 不存在“通用媒体槽位把图片统一插在正文最前面”的实现惯性；图片、公式、表格、结论的顺序均由步骤契约控制
- 首页和课堂页都没有偷偷回读 `authoring`
- 媒体真实可读，且不是 ASCII 占位
- 每个需要 AI 的步骤都接到正确的隐藏式上下文；若出现页内 AI 入口，必须属于设计稿允许的例外
- 所有曲线图步骤都满足“默认状态复现 handout 静态图、图组排布一致、控件栏下置折叠”
- 动态曲线步骤已验证“控件变化 -> 图形即时重绘”，而不是只有旁白或数值变化
- 动态曲线步骤已验证“统一 Rust/WASM 引擎 + 固定面板组合 + 固定坐标范围 + 2 位小数指标标注”全部成立
- 非曲线教学图已按契约落实为原生组件、显影板或分步呈现板；若仍保留位图，笔记中已写明不可替代理由
- 推导型页面已验证“起点公式 -> 中间推导 -> 目标公式 -> 结论解释”的阅读节奏，不是只剩结果式
- 学生提交后有明确提交态、等待态、答案反馈或修正反馈
- 教师端统计、词云、答案揭示、结束课堂都可用
- 课程事件与治理映射没有脱节
- 课堂外资源行为没有漏掉；入口页媒体、讲义、知识图谱、知识卡片与跨域入口均已进入统一追踪链
- 课程使用统一 session / Redis / SSE 能力，没有单课私有同步方案
- 原生示意图在亮色/深色、桌面/移动口径下都可读，没有退化成糊图或裁切错位
- 原生表格已落成真实表格节点，表内公式与符号渲染正常，没有被截图替代

验证结果必须写回 `notes/<lesson>.md`，至少留下：
- 设计稿到实现稿对照表的最终状态
- 完整课件职责核对结论
- 浏览器验收或测试证据
- 仍待回补的页面覆盖缺口

若课次已建立 `interactive-contract.yaml` 且仓库内已存在对应互动课程实现，收工前还必须执行：

```bash
python3 course-content/scripts/review_lesson_content.py --lesson <lesson> --strict-implementation-contract
```

要求：
- 该命令必须通过，不能只生成 `interactive-page-check.json` 而忽略实现契约漂移
- 重点检查作者态 `interactive-contract.yaml` 与本地页面契约、步骤定义是否一致
- 若失败，先修实现或修双轨真源，再继续浏览器验收
- 若 `interactive-page-check.json` 或 `review-report.md` 仍保留 `handout_anchor`、公式映射、契约解析、实现契约漂移等关键告警，不得宣称实现完成；默认以关键告警清零作为收工门槛

实现完成后必须通过该脚本测试：

```bash
python3 .codex/skills/interactive-lesson-implementation/scripts/check_contract_alignment.py --lesson 2-1
```

若当前课次还没有预设，可改用显式参数：

```bash
python3 .codex/skills/interactive-lesson-implementation/scripts/check_contract_alignment.py \
  --contract course-content/authoring/lessons/<lesson>/design/interactive-contract.yaml \
  --implementation src/lib/<lesson>-course.ts \
  --page-contract-const <PAGE_CONTRACT_CONST> \
  --step-const <STEP_CONST>
```

这条脚本会调用实现侧一致性测试，校验作者态 `interactive-contract.yaml` 与本地平行契约在步骤标题、互动类型、模板/区域、教师洞察、telemetry、错因标签和学生演示页预览路径上的一致性。未通过时，不得宣称互动页面已经按契约实现。

在上述脚本通过后，必须再调用子代理做实现情况审查：

- 至少调用 1 个子代理做“契约实现审查”，核对页面结构、曲线面板、原生示意图、原生表格、入口资源挂载与埋点是否与技能规范一致
- 若本地服务可启动，默认继续调用教师端/学生端双子代理做浏览器闭环验收
- 主代理负责收集审查结论与缺陷，不把长篇浏览器过程塞回主上下文

若子代理审查指出契约漏实现、旧口径回潮、埋点缺失或曲线/示意图降级，必须先修复，再宣称完成。

推荐至少补一类守卫测试：
- 检查隐藏式 AI 页面上下文与控灵助手接线
- 若设计稿要求页内 AI 入口，再检查其以内嵌对话框或抽屉实现，而非跳转
- 检查提交反馈与教师汇聚存在
- 检查曲线图步骤的基线参数、图组排布与控件布局未漂移
- 检查统一事件链接线
- 检查 runtime 首页内容来源

详细规则见：
- [references/verification-and-note-update.md](references/verification-and-note-update.md)
- [references/closed-loop-browser-validation.md](references/closed-loop-browser-validation.md)
- [references/browser-validation-teacher-subagent.md](references/browser-validation-teacher-subagent.md)
- [references/browser-validation-student-subagent.md](references/browser-validation-student-subagent.md)

主代理不需要读取这两个子代理规范文件；只有在明确分派教师端/学生端浏览器验收任务时，才把对应规范交给子代理执行。

## 课程笔记机制

笔记目录：`notes/`

规则：
- 每门课一个文件：`notes/<lesson>.md`
- 优化已有课前先读笔记
- 完成一轮主要实现或核对后必须更新笔记
- 开工前必须写入“设计稿到实现稿对照表”
- 收工前必须补上“完整课件职责核对”和验证记录
- 笔记要记录“当前规范如何在该课落地”，不是只记流水账

如果笔记不存在，使用：

```bash
python3 scripts/init_course_note.py --lesson 1-4 --title "示例标题"
```

## 资源

### scripts/

- `scripts/init_course_note.py`
  - 初始化课程笔记
  - 使用 `python3` 运行
- `scripts/check_contract_alignment.py`
  - 校验作者态 `interactive-contract.yaml` 与本地实现平行契约的一致性
  - 默认支持 `2-1` 预设；其他课次可显式传路径和常量名
  - 使用 `python3` 运行

### references/

- `references/media-and-path-rules.md`
  - 外部媒体、AI 图与处理后产物的目录、命名、导出规则
- `references/runtime-entry-page-pattern.md`
  - `2-1` 当前入口页模式的布局、文案装配、音视频/讲义容器、课堂外资源埋点与禁止项
- `references/runtime-media-index-contract.md`
  - `runtime/lessons/<lesson>/media/<lesson>-media.md` 的文档结构、解析约束与前端装配规则
- `references/runtime-code-generated-media.md`
  - Rust/WASM 运行时曲线、作者态静态图、前端原生绘制、`tikz-control-draw` 与 runtime 导出规范
- `references/verification-and-note-update.md`
  - 设计核对、浏览器验收、笔记更新与验证清单
- `references/closed-loop-browser-validation.md`
  - 浏览器闭环验收总则
- `references/browser-validation-teacher-subagent.md`
  - 教师端验收细则
- `references/browser-validation-student-subagent.md`
  - 学生端验收细则

## 快速检查表

- [ ] 已解析真实 authoring/runtime 课次路径，而不是想当然写 `legacy` 或非 `legacy`
- [ ] 已确认课程产物已经过 `lesson-content-review`
- [ ] 已读取 `interactive-page.md`、runtime handout、review 产物与 graph overlay
- [ ] 若课程入口页含预习台/媒体卡，已读取 `references/runtime-entry-page-pattern.md`
- [ ] 若课程入口页含 runtime 媒体文档，已读取 `references/runtime-media-index-contract.md`
- [ ] 已先设计完整课件骨架，再设计互动升级位
- [ ] 已确认首页与课堂页都 `runtime-first`
- [ ] 已为步骤级 AI、提交反馈、教师汇聚、课程事件与治理链路写出方案
- [ ] 已区分课堂内事件与课堂外资源事件，未把入口资源误记成课堂步骤事件
- [ ] 已确认是否需要 `SubmissionStatus`、等待释放态和防连续提交策略
- [ ] 已确认教师端统计、词云、答案揭示和结束课堂链路
- [ ] 若课程入口页含预习台/媒体卡/知识图谱/知识卡/跨域入口，已设计并保留统一课堂外资源追踪链
- [ ] 已判断媒体缺口应通过 `media/raw` / `media/processed` 补齐，而不是继续 ASCII 或长期占位
- [ ] 已区分“运行时互动曲线使用 Rust/WASM 统一引擎”与“作者态静态图/离线校核使用 `python3 + control` 或 `Octave`”
- [ ] 已对示意图使用前端原生绘制，对表格使用原生表格，对线框图使用 `tikz-control-draw`
- [ ] 已优先复用统一 session / Redis / SSE / rate limit 能力
- [ ] 已在课程目录、预置教案、课堂码解析和 AI 注册表中完成接线
- [ ] 已确认课程入口采用统一资源挂载与互动埋点链路
- [ ] 已完成设计稿对照验证与浏览器闭环验收
- [ ] 已完成至少一次子代理实现审查
- [ ] 已通过 `python3 course-content/scripts/review_lesson_content.py --lesson <lesson> --strict-implementation-contract`
- [ ] 已更新 `notes/<lesson>.md`
