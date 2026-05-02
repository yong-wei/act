---
name: interactive-lesson-implementation
description: Use when implementing or upgrading this repository's interactive lessons from `course-content/authoring/lessons/` and reviewed runtime lesson bundles, especially to align new lesson structures, turn reviewed handouts/BOPPPS/media into production pages, and enforce the current premium-course rules around evidence-complete page coverage, hidden AI page contexts, submission feedback, teacher aggregation, event governance, runtime media, and session sync/performance reuse.
---

# Interactive Lesson Implementation

## Overview

按当前仓库的新体系实现或优化互动课程。把 `course-content/authoring/lessons/.../design/...-interactive-page.md` 与 `interactive-contract.yaml` 视为双轨设计真源，把 `course-content/runtime/lessons/...` 下经过 `lesson-content-review` 的产物视为已审查输入，把仓库中的课程代码视为待对齐对象。

对采用新编排链的课程，运行时真源不是课程私有 `step-panels` 或 `unit-*-course.ts` 中再写一份平行页面契约，而是 review/export 后的 `interactive-manifest.json`。共享模板注册表、模块注册表与活动注册表的职责是**兑现 manifest 合同**，不是在实现阶段二次发明页面结构、吞并模块或把课程级缺口藏进共享渲染器。

当前组件式 manifest runtime 的默认入口是 `src/features/interactive/shared/manifest-runtime/`：

- `layout-renderer.tsx`：只负责编排 manifest step、layout region、template registry 与 module registry。
- `content-renderers.tsx`：负责公式、摘要、表格、图片、显影、路径图、目标卡、问题卡等静态内容模块。
- `activity-renderers.tsx`：负责学生提交、教师控制、答案揭示和提交汇总。
- `types.ts`：复用 `src/lib/interactive-lesson-manifest.ts` 类型，避免重复定义。

旧路径 `interactive-manifest-renderer.tsx`、`manifest-content-renderers.tsx`、`manifest-activity-renderers.tsx` 只是兼容 re-export；新增能力应优先落在 `manifest-runtime/` 目录下。课程目录下的 `step-panels.tsx` 若仍存在，只能是薄适配器：载入 manifest、合并共享 registry、接入极少量窄适配器和会话状态，不得再扩展为课程私有大 switch 或内容常量仓库。

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
- 互动课程实现以讲义逻辑和内容证据为导向，不以视觉效果为导向。大图、结构图、对比图、曲线图都必须服从步骤证据链，不能因为“页面更好看”或共享模板默认槽位而被放到最上方。
- 静态页合法且必要；不是每一步都必须互动，页面总数按教学逻辑与覆盖需求决定，不设硬上限。
- 关键知识不得转嫁给互动组件。即使关闭互动，页面也必须保留核心概念、公式、图示、表格、例题和结论。
- 若设计稿已把“原理/定理模块”“例题模块”“作答模块”分开，实施阶段不得把它们合并成统一信息块或统一工作区壳。
- 若设计稿已区分 `发放作答`、`开放浏览`、`教师逐步显影`、`显示参考答案`，实施阶段不得退化成单一“释放互动 / 显示答案”双开关。
- 若设计稿已把学生作答拆成多张步骤卡，实施阶段不得收缩为单个统一文本框、统一提交按钮或统一答案模型。
- 若设计稿为页面定义了目标区块，实施阶段只允许显式呈现“完成本次课程后，学习者能够……”的布鲁姆能力单列表；不得补写单元边界、课次定位或课程接口说明。
- 学生端图片标题、图注、提示文案禁止泄露 `runtime`、`设计稿`、`实现`、`配套图示`、`默认消费路径`、`单元边界`、`课次定位`、`课程接口` 这类工程或编排口径；学生只应读到对象、证据、判断任务与本次课程目标。
- 若设计稿未把某页明确声明为题组页，而是“正文阅读 + 方法判断 + 作答”混合页，实施阶段默认维持“正文在前、作答在后”的顺序；不得把作答区整体提前到正文上方。
- 除前测 / 后测 / 设计稿显式声明的题组页外，实施阶段默认每页作答卡不超过 2 张；不得把多个判断点继续堆回 3 张以上的小卡组。
- 前测题必须全部按客观题实现，可混合单选、多选、排序、判断等题型；不得在实现阶段加入主观简答。
- 普通互动页若出题，最多 2 题，全部为客观题；双题页默认使用双栏排布并支持逐题独立提交。
- 后测最多 3 题，且最多 1 题为主观题；实现时不得把后测扩写成大段开放问答。
- 总结页学生端必须显示学生个人课堂表现统计，教师端必须显示班级整体表现统计；不得只保留静态总结文本。
- 若讲义与设计稿把不同方法页和比较页分开，实施阶段不得跳过方法页而只保留比较页。
- 页面骨架优先服从讲义证据链，不得把案例页、综合页或设计页实现成流程管理器、小测堆栈或摘要卡拼盘。
- 双轨设计真源具有最高优先级：人读 `interactive-page.md`，机读 `interactive-contract.yaml`。实现时必须同时服从二者，不得跳过其一。
- **严格按结构化文档实现。禁止降级实现、禁止偷懒替换、禁止自由发挥补设计。**
- 设计稿中若已明确拖拽、连线、排序、拖槽、路径高亮、热点标注等组件形态，实施阶段不得改成选择题、填空题、文本问答或“先放占位以后再补”。
- 设计稿中若已固定页面模板、区域、模块、文本、公式、图片、表格、教师聚合、隐藏式 AI 上下文与学生页预览，实施阶段不得擅自删改、合并、改写或重排。
- 对 manifest 驱动新课，`must_be_visible: true` 的模块必须真实落页；缺 renderer、renderer 返回 `null`、或被共享渲染器静默过滤，都属于实现失败，不得以“后续补模块”“先用占位壳层”或“课程私有分支兜底”视作已完成。
- 对 manifest 驱动新课，不能只用人工浏览器检查判断“页面看起来有内容”。实现阶段必须让每个模块都可被脚本审计出 `renderer_owner`、`resolved_content_source`、`resolved_content_type`、`is_empty` 和诊断信息；浏览器验证只负责最终 DOM 与交互行为，不负责替代 manifest 静态审计。
- 模板名不仅决定视觉顺序，也承载区域拓扑与保留规则。若步骤模板把两个模块放在同一区域，实施阶段必须保留它们的独立节点与阅读顺序，不得压成一个笼统面板或单个壳层摘要。
- 共享模块注册表必须覆盖契约中实际出现的 `kind`；真正特殊的能力应落成窄适配器模块，而不是重新退回整门课私有 `switch (step.id)` 渲染器。
- 共享 renderer 禁止写课程 id、step id 或 module id 特判，例如把 `4-6` 的活动标题、`4-3` 的选择题选项、某个卡片参考答案硬编码在共享层。标题、选项、参考答案、表格行列、图片路径和显影文本必须优先来自 manifest payload；缺字段时给可见诊断或回退设计补 payload。
- 处理组件缺口的顺序固定为：先补作者态 contract / runtime manifest payload，再补共享 content/activity renderer；只有能力确实不通用时，才写课程窄适配器。不得回退到课程私有 `QUIZ_OPTIONS`、`SINGLE_CHOICE_OPTIONS`、页面级参考答案映射或 `switch (step.id)`。
- `content-renderers.tsx` 与 `activity-renderers.tsx` 的职责必须分离：`activity-card`、`activity-card-set`、`single-choice-card`、`quiz-card`、`quiz-group` 等活动模块只能由 activity runtime 消费；正文 content registry 不得再渲染“本页作答”题面列表。
- 共享教师活动汇总必须显示 `activity_cards[].prompt` 中的完整题面，并在选择题、排序题、多选题等场景同步显示选项；教师释放互动后不能只看到提交人数、学生答案或统计结果。已迁移到 manifest shared activity runtime 的新课，应通过共享 `activity-renderers.tsx` 一次满足该要求，不再逐页复制教师汇总代码。
- 共享教师活动汇总默认只显示答案聚合统计，不显示提交人姓名；每个互动模块必须提供`查看细节`入口，教师点击后才展示该模块的提交明细与学生姓名。
- `rust-analysis-panel`、`rust-time-compare-panel`、`rust-bode-compare-panel` 这类 Rust/WASM 共享模块属于当前正式覆盖面。三域互动的 Rust 链条替换后若出现缺口，应修共享模块或其窄适配器，不得把新课技能默认回退到旧图表实现。
- 设计稿若已固定证据单元顺序、主阅读顺序、曲线图镜像排布、基线参数或结构切换方式，实现阶段不得擅自改成“图先行”“卡片先行”“单选替代”或“另起一套互动图”。
- 设计稿若已为某页写出本次课程目标或能力项，实现阶段必须保持布鲁姆动词与能力粒度，不得改写成课程编排说明、单元串联说明或泛化口号。
- 若讲义或设计稿的顺序是“原理/公式 -> 结构图 -> 分析显影 -> 对比图”，实现必须按该顺序渲染；不得把媒体数组、hero 图或通用 `MediaPanel` 自动提前。
- 设计稿若写明 `parameter_slider` / `parametric_sim` / 曲线联动图，实施时必须让控件直接驱动同页曲线或图示的原生重绘；禁止保留静态截图，再在截图下方附一块“滑块说明卡”假装联动。
- 设计稿若同时给出对象框图、传函与曲线证据，页面顺序必须服从讲义与设计真源；默认先对象框图，再传函，再动态曲线区。若框图与传函同屏，可用双栏；若该段只剩框图，则框图单栏横向铺满。
- 若设计稿要求例题逐步显影，默认首屏只能显示第 `1` 层；不得默认展开两层或更多。
- 逐步显影默认禁止在底部额外渲染显式“下一步 / 显示下一步”按钮；继续展开的交互锚点固定为“点击当前已显影的最下方步骤显示下一层”。
- 若教师端存在逐步显影控制，实现必须把显影层级接到独立的 `teacherRevealProgress` 状态；学生端在教师已放出的层级基础上，可按契约决定是否允许继续本地点击显影。
- 逐步显影测试必须至少覆盖三项：默认只显示 `1` 层、点击当前最下方已显影步骤可继续展开、教师端 `teacherRevealProgress` 推进后学生端首屏层级同步更新。
- 逐步显影型例题若设计稿要求“题面放到步骤上”，则题面必须进入显影链首层，不得在显影链下方再重复渲染静态题面、静态特征方程或静态稳定范围等总结块。
- 逐步显影型例题若外层已经通过显影链承载推导节奏，页面底部不得再追加一组重复公式卡或结论卡；静态区只允许保留不与显影链重复的方法分工、阅读提示或最小必要说明。
- 不得在通用内容面板中预留一个无差别媒体槽位，再把所有图片或 `mediaSrc` 自动插入正文前部；图片、图组、结构图、表格与公式的出现位置必须由步骤契约中的 `layout.regions`、`modules` 与 `order` 决定。
- 设计稿若已写明“图后继续读公式/表格/实例表/风险表”，实现阶段不得把图单独提升到页面最前方，再把后续证据拆散到别处；图后证据必须按既定顺序继续展开。
- 对于非曲线教学图，实施阶段默认不接受“直接贴一张 PNG 再加说明”的降级方案；若设计稿对应的是结构图、步骤图、对比图、矩阵图、职责图或判断清单，应优先落成原生组件、显影板或分步呈现板。
- 对于推导型或公式密集型页面，实施阶段必须让阅读节奏可见：至少区分 `起点公式 / 中间推导 / 目标公式 / 结论解释` 的展示层次；不得把讲义中的推导链压成一块最终公式卡。
- 若设计稿要求“逐步显影后才出现图片或验证图”，实现阶段必须先落题面和显影链，再落图片；不得提前把图片挂到正文第二行之前。
- 双题页或双卡页的作答卡标题必须直接写题面或判断动作，不得出现“卡片 1 / 卡片 2”这类无语义标题；单卡按钮文案统一使用`提交答案`。
- 若作答卡标题已经完整给出题面或判断动作，卡体内部不得再重复渲染同一题面文案；默认只保留标题、输入控件与提交按钮。
- 除前测 / 后测 / 纯题组页 / 设计稿显式例外外，双题作答区默认按双栏半宽并排实现；不得为了省实现而改成上下单栏堆叠，或把两张卡重新并入一块统一作答面板。
- 逐步显影组件若已在外层显示步骤编号，步骤标题正文不得再重复写“第 1 步：……”。若确需写步骤标题，也应直接写该层动作或结论，不得再附页外总按钮。
- 逐步显影状态必须按页面 / 步骤独立管理；切换到新页面时默认全部收缩，上一页已经全部显影不得让下一页继承展开状态。
- 展示页若没有作答语义，不得额外渲染“无需提交”占位卡、空教师汇总卡或其他壳层占位模块。
- 运行时页面必须 `runtime-first`，不能偷偷回读 `authoring` 或历史 `content`。
- 课程页面必须同步接入步骤级 AI 上下文、提交反馈、教师端汇总、统一课程事件与数据治理语义。
- 下拉页面菜单必须标注页面序号，例如`第 03 页 · 频域裕度读取`，不能只显示标题。
- 每个页面标题必须在课堂页顶端以独立模块显示，并用文案描述本页主要内容；顶栏中的短标题、环节标签或同步提示不能替代该模块。
- 知识卡片入口默认并入右下角课程浮动工具按钮，不嵌入顶部信息栏，也不占用顶栏横向空间；点击浮动按钮后展示功能菜单，至少包含`主题切换`与`知识卡片`两个入口。课程浮动工具存在时，全局深浅主题切换按钮必须让位，避免右下角出现两个重叠按钮。
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

- `design/{unit}-interactive-page.md`
- `design/{unit}-interactive-contract.yaml`

实现前必须确认：
- 两者都存在
- 步骤顺序一致
- 步骤标题一致
- 互动类型一致
- 学生页预览路径一致

若两者不一致，先回到设计/审查阶段修正，不得带着冲突进入实现。

### 1.6 Manifest-first runtime 真源

对新编排课次，还必须确认 runtime 是否已导出：

- `runtime/.../interactive-manifest.json`

并把它视为共享渲染器的唯一页面编排输入。实现前至少核对：

- manifest 中的步骤顺序、模板名、区域顺序与作者态 contract 一致
- `modules` 中所有 `must_be_visible: true` 项都能在共享模块注册表中找到落点
- 每个静态内容模块都能解析到明确内容来源；若为隐式来源，manifest 或 contract 必须能说明 resolver 规则
- 活动模块不会进入正文 content renderer，也不会在正文区重复渲染 `activity_cards[].prompt`
- 若同一区域存在多个必显模块，当前模板不会把它们压成单节点或在过滤阶段静默丢弃

若 manifest 已导出但共享渲染器无法兑现这些字段，说明问题在实现链，不得回退为课程级平行契约。

### 2. 运行时知识与卡片路径

当前正确路径如下：

- 全局节点唯一来源：`course-content/runtime/knowledge/graph/nodes.json`
- 全局关系唯一来源：`course-content/runtime/knowledge/graph/relations.jsonl`
- 全局知识卡唯一来源：`course-content/runtime/knowledge/cards/nodes/`
- 课次局部结构来源：`course-content/runtime/lessons/.../<lesson>/graph-overlay.json`
- 课次首页与步骤编排来源：`course-content/runtime/lessons/.../<lesson>/lesson.json`
- 课次讲义来源：`course-content/runtime/lessons/.../<lesson>/<lesson>-handout.md`
- 审查结果来源：`course-content/runtime/lessons/.../<lesson>/review/*`

互动课程实现不要自创第二套知识卡路径，也不要把 lesson runtime 误写成知识卡正文存放处。

### 3. 已审查输入

默认需要读取：

- `design/{unit}-interactive-page.md`
- `design/{unit}-interactive-contract.yaml`（若存在则必读）
- `runtime/.../lesson.json`
- `runtime/.../interactive-manifest.json`（新编排课次必读）
- `runtime/.../graph-overlay.json`
- `runtime/.../<lesson>-handout.md`
- `runtime/.../media/<lesson>-media.md`（若课程入口页、预习台或外部媒体入口存在，则必读）
- `runtime/.../review/<lesson>-boppps.md`
- `runtime/.../review/review-report.md`
- `runtime/.../review/interactive-page-check.json`
- `runtime/.../review/knowledge-card-check.json`
- `runtime/.../review/multimedia-check.json`
- `runtime/.../review/source-manifest.json`
- `design/interactive-design-acceptance.json`

如果这些 runtime/review 产物不存在，先回到 `lesson-content-review`，不要在本技能里顺手补审正文或知识卡。

如果 `interactive-page-check.json` 已经记录 `runtime_review_stale`、`inline_ai_visibility`、`static_media_downgrade` 或接受文件缺失问题，先回到设计 / 审查 / 实现接受流程修复；不得带着这些硬闸门问题继续写代码。

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
- 若存在 `interactive-manifest.json`，先以 `4-6` 与 `src/features/interactive/shared/manifest-runtime/` 作为组件式基线；`1-1`、`1-2`、`1-3` 主要用于入口页、会话、提交闭环等非 manifest 旧实现参考
- 先给实现计划，再开始改代码

## 工作流

### 1. 先读双轨设计，不得边实现边补设计

实现前先逐步核对双轨设计中已经固定的结构，不得在实现阶段重新发明页面：

- 页面模板、区域布局、模块清单是否已明确
- runtime manifest 是否已把这些模板、区域和模块完整导出，且未在 review/export 链上丢失
- 证据单元、主阅读顺序、折叠策略是否已明确
- 固定文本、公式、图片、表格、例题、结论是否已明确
- 页面正文内容源是否已明确到可直接实现，而不是只剩摘要级“这里放什么”
- `modules[].payload` 是否已承载共享 renderer 需要的标题、内容键、公式项、表格行列、图片路径、路径项、显影项或卡片项
- `interaction_spec.activity_cards[]` 是否已承载题面、选项、参考答案、揭示规则和提交粒度；选择题与题组不得依赖实现侧课程私有常量
- 互动组件类型、交互规则、干扰项、揭示规则是否已明确
- 曲线图是否已明确为静态展示还是参数联动仿真板；若为参数联动图，是否已写明基线参数、图组排布、结构切换方式与控件栏位置
- 埋点摘要、教师聚合、AI 上下文、学生页预览路径是否已明确

若这些内容未写明，先回到 `interactive-page.md` / `interactive-contract.yaml` 补设计，不得在实现阶段自由发挥补齐。

这里的“内容未写明”不仅指缺少模板或模块，更包括以下情况：

- 人读稿只写“静态承载内容：表 3 结果摘要”“对象 `P(s)` 与控制器 `C(s)`”，却没有真正可显示给学生的正文、题面、表格内容、图后解释
- 机读稿虽有 `content_blocks` 或 `modules[].payload`，但里面只有标题索引、占位说明、锚点提示或“见讲义”
- 例题页没有题面全文，只有“展示例题”“显示推导链”这类摘要句
- 表格页只有列名要求，没有行项和单元格正文
- 图页只有媒体文件名，没有图注、读图口令和图后结论
- 显影页只有“第 1 步 / 第 2 步”标签，没有每层具体文本
- 选择题、题组、二元判断页在 manifest 中没有选项和参考答案，需要实现层额外写课程私有常量

只要出现上述任一情况，都视为**内容真源不足**，必须阻塞并回退设计，不能带着“先做框架、内容后补”的想法继续实现。

若缺失的是例题显影节奏、学生作答卡粒度、教师浏览控制或图文顺序等作者态约束，先回到 `interactive-design` 补设计，不得在实现阶段擅自发明默认规则。

禁止把设计稿中已经结构化写死的内容，在实现阶段再“合理化调整”为更简单、更省事的版本。

### 2. 开工前必须建立“设计稿到实现稿对照表”

实现前先在 `notes/<lesson>.md` 写出对照表，再开始改代码。对照表至少包含：

- 设计稿步骤 / 标题
- 人读稿页面模板 / 主阅读顺序 / 区域 / 模块 / 固定内容
- 人读稿页面正文内容源 / 缺口
- 机读稿互动类型 / 交互规则 / 埋点 / 教师聚合 / AI 上下文 / 预览路径
- 机读稿 `modules[].payload` / `content_blocks` / 题面 / 表格 / 显影文本 / 作答选项 / 参考答案完整性
- 若为曲线图步骤：静态图基线、图组排布、结构切换、控件折叠策略
- 当前实现位置或缺口
- 本轮处理状态（严格实现 / 缺实现 / 设计冲突待回修）
- 验证方式或证据

建立对照表后，至少核对：

- 步骤数量、标题、顺序、时长
- 每一步的页面模板、主阅读顺序、区域、模块、静态承载内容是否已实现
- 每一步的 runtime manifest 是否与作者态 contract 同步，且共享渲染器未吞掉任何 `must_be_visible` 模块
- 每一步的 manifest 审计是否能证明静态模块非空、活动模块只归 activity registry、图片说明与公式/表格/显影文本没有留在 `content_blocks` 里未消费
- 每一步的互动类型是否与机读契约一致
- 每一步的证据单元是否已完整落页，而不是只剩摘要卡
- 每一步的页面内容是否主要来自双轨真源，而不是实现阶段自由补写
- 课程适配器是否保持薄层：未新增课程私有大 switch、选择题常量、参考答案映射或共享 renderer 中的课程 id 特判
- 若某一步缺少可直接实现的内容真源，是否已在开工前标成阻塞并回退设计
- 若存在曲线图步骤，默认状态是否复现讲义静态图，图组排布是否与原图一致
- 每一步是否发生了降级实现、删减实现或擅自新增设计
- 教师端控制流：释放、揭示、汇总、结束课堂
- 学生页默认预览是否与真实学生页一致
- 首页是否正确消费 runtime 导学、知识图谱、卡片预览与讲义入口
- 媒体是否真的存在，而不是还停留在设计说明
- 下拉页面菜单是否逐项标注页面序号
- 每页顶端是否存在独立标题模块及主要内容描述
- 教师端互动统计默认是否只显示聚合结果，提交明细是否只能通过`查看细节`展开
- 总结页是否分别兑现学生个人课堂表现统计与教师班级整体表现统计

没有对照表，不得直接开工。

若对照表显示任何一步存在“结构齐全但内容真源不足”，也不得直接开工。此时唯一正确动作是回到 `interactive-design` 补齐内容真源，而不是让实现者自行写正文、压缩题面、重建表格或脑补图后解释。

### 2.5 子代理驱动实现接受文件

实现完成前必须形成 `notes/interactive-implementation-acceptance.json`，它不是普通笔记，而是 `lesson-content-review` 脚本会读取的硬闸门输入。

流程固定为：

1. 主代理逐个页面发放实现任务，先把双轨真源、runtime/review 产物、实现源码入口、对照表和已知风险整理成短任务包。
2. 每一页先交给**实现子代理**，任务目标必须写明：忠实反映契约中的内容和逻辑，不随便应付，把文本升级成服务知识传授与能力训练的互动形态。
3. 实现子代理完成后，再交给**学生视角审查子代理**，明确用学生视角追问“学生只看这一页，是否足以理解当前对象、过程和结论”。
4. 若学生视角审查子代理判定不通过，主代理必须把该页转交给另一位整改子代理回修，再进入下一轮审查。
5. 若本地服务可启动，再调用教师端 / 学生端浏览器验收子代理；不能启动时，必须在接受文件中写明降级为代码级验收以及缺失的浏览器证据。
6. 若环境没有可用子代理、子代理调用失败或权限不足，必须向用户报告当前实现接受流程被阻塞；不得写入 `status: "accepted"`，也不得用主代理自审伪造子代理接受结果。
7. 所有页面都通过后，再写入 `notes/interactive-implementation-acceptance.json`，随后运行 `python3 course-content/scripts/review_lesson_content.py --lesson <lesson> --strict-implementation-contract`。

`notes/interactive-implementation-acceptance.json` 最小结构：

```json
{
  "acceptance_version": 1,
  "lesson_id": "<lesson>",
  "status": "accepted",
  "accepted_at": "2026-04-19T00:00:00+08:00",
  "review_mode": "subagent",
  "implementation_contract_source": "src/lib/<lesson>-course.ts",
  "reviewed_runtime_artifacts": [
    "course-content/runtime/lessons/<lesson>/review/review-report.md",
    "course-content/runtime/lessons/<lesson>/review/interactive-page-check.json"
  ],
  "checks": {
    "inline_ai_visibility": {
      "status": "pass",
      "step_ids": [],
      "evidence": []
    },
    "content_source_completeness": {
      "status": "pass",
      "step_ids": [],
      "evidence": []
    },
    "static_media_downgrade": {
      "status": "pass",
      "step_ids": [],
      "evidence": []
    }
  },
  "issues": []
}
```

判定要求：

- `inline_ai_visibility`：只要契约为 `ai_context_spec.delivery_mode: hidden_page_context`，学生页正文中出现页内 AI 卡片、提示词复制区、独立对话入口或跳转旧 `/ai` 的入口，即必须记为 `fail`。
- `content_source_completeness`：只要某一步的最终页面正文、题面、表格、显影文本、图后解释、作答题面、选项或参考答案，主要依赖实现阶段自由补写，而不是来自双轨设计真源中可直接实现的内容载荷，即必须记为 `fail`。典型信号包括：设计稿只有摘要句、`content_blocks` 或 `modules[].payload` 只有占位提示、实现稿新增大段作者态未给出的正文、把“见讲义”改写成页面内容、选择题选项在课程私有常量中另写。
- `static_media_downgrade`：只要契约要求 `workspace`、`parameter_slider`、`parametric_sim` 或等价工作区联动，而实现仍用静态 PNG/SVG/PDF 主体加文字说明、滑块不驱动图像或控件只改旁白，即必须记为 `fail`。
- 三类问题被写入接受文件后，审查脚本应在 `interactive-page-check.json` 中分别落为 `inline_ai_visibility`、`content_source_insufficient` 与 `static_media_downgrade`，并在严格模式下阻塞。

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
- 可行域、满意域或约束域不是默认视觉层；只有设计契约明确要求时才绘制。若当前案例没有讨论可行域，传入共享分析引擎的 `feasibleRegion` 必须省略或显式为 `undefined`，不得继承其他课次夹具。
- 运行时统一复用共享控制分析底座：`useControlEngine`、`control-analysis.worker.ts`、Rust/WASM `compute_analysis`、`ControlFigureWorkspace` 与共享请求接口；不要在单课里重写一套内联图表计算器
- 若当前课程只需要统一曲线体系中的某一类图，优先复用共享分析引擎 + 共享图面板组件（如 `MagnitudePanel`、`PhasePanel`、`RootLocusPanel`）；不得退回自绘 SVG 曲线或静态截图假装联动
- 曲线图请求参数必须与设计稿契约对齐，至少覆盖 `caseId`、`outputs`、`timeRange`、`frequencyRange`、`rootLocus`、`structures`、`referenceProfile`；`feasibleRegion` 只有在契约明确要求可行域时才传入。
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
- 逐步显影组件必须能展开全部设计层级。若教师端只控制初始层数，学生端仍应按契约支持本地点击最下方已显影步骤继续展开或等待教师推进；不得停在第一层没有后续内容，也不得退回显式页外“下一步”按钮。

#### 原生表格

讲义中的表格进入互动页时，默认实现为前端原生表格：

- 公式与符号继续走页面 LaTeX 渲染链
- 不得把表格整体做成图片贴入页面
- 若设计稿要求逐行、逐列或分组呈现，应实现为渐进揭示，而不是整表静态平铺
- 当表格单元格中包含分式、上下标或多行判断语句时，优先使用原生 LaTeX 组件与原生表格节点，不要把整张关键表直接压成 Markdown 表格字符串

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
- 课堂页正文默认采用比旧 `text-sm` 基线大两档的字号；段落、说明、图注、表格正文、题面和总结文本应达到 `text-lg` 级别及相应行距。导航、按钮、标签、页码、状态徽标等控件不按正文放大。
- 面向学生的文案、按钮、选项标签中不得泄露实现层字段名、枚举值、内部状态键或 telemetry tag，例如 `stable_equals_done` 这类内部标识不得直接显示在前端。
- 页面中的互动只能实现设计契约已经声明的类型、顺序、反馈与指标呈现；若实现时发现契约缺字段，应先回写 `interactive-page.md` / `interactive-contract.yaml`，再继续编码。
- 不得把作者态已写死的页面顺序再次编码成组件内部默认顺序；若共享组件需要承载图片、公式、表格或补充说明，必须显式接收步骤级顺序配置，不得依赖统一前置媒体逻辑。
- 若步骤同时包含图片、公式、表格与结论区，实现稿必须逐一对照契约确认：哪些内容同屏、哪些先于交互区出现、哪些只能在揭示后出现；不能因为复用统一外壳就让图片区或摘要区抢到正文前面。
- 若使用其他课次的请求构造器、夹具或媒体配置，必须逐字段审查是否携带当前课次未声明的语义，例如可行域、满意域、旧指标阈值或旧图组顺序；不允许直接复用导致证据污染。
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
- 含结构图或对比图的页面已经验证“原理/公式、结构图、分析显影、对比图”的相对顺序，不受通用媒体槽位影响
- 每一步的证据单元都已显式落页，不是只剩摘要卡或操作卡
- 不存在“通用媒体槽位把图片统一插在正文最前面”的实现惯性；图片、公式、表格、结论的顺序均由步骤契约控制
- 未明确讨论可行域的案例没有绘制可行域，也没有从其他课次夹具继承 `feasibleRegion`
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

若课次已建立 `interactive-contract.yaml` 且仓库内已存在对应互动课程实现，收工前还必须在子代理实现接受文件写入后执行：

```bash
python3 course-content/scripts/review_lesson_content.py --lesson <lesson> --strict-implementation-contract
```

要求：
- 该命令必须通过，不能只生成 `interactive-page-check.json` 而忽略实现契约漂移
- 重点检查作者态 `interactive-contract.yaml`、`design/interactive-design-acceptance.json`、`notes/interactive-implementation-acceptance.json` 与本地页面契约、步骤定义是否一致
- 对 manifest 驱动新课，还必须检查 `interactive-manifest.json`、共享模板注册表与共享模块注册表是否兑现 contract-required modules，而不是只让页面“能渲染出来”
- 对 manifest 驱动新课，还必须执行或补齐 manifest audit：优先运行 `python3 .codex/skills/interactive-design/scripts/audit_interactive_manifest.py --lesson <lesson>`；检查 `must_be_visible` 模块 renderer 覆盖、content 模块非空、activity 模块不进入正文、`activity_cards[].prompt` 不重复、`key_formulas` 与公式模块数量匹配、`media` 与图片模块数量匹配、图后说明已被消费
- 对含活动卡的新课，还必须检查教师端活动汇总：题面、选项、参考答案揭示和学生提交结果应来自同一份 manifest activity card，且题面在未提交和已提交状态下都可见。
- 若作者态文件晚于 runtime 审查产物，脚本会判定 `runtime_review_stale`，必须先重新审查并重新接受实现
- 若本地实现把隐藏式 AI 做成页内入口，脚本会判定 `inline_ai_visibility`
- 若工作区 / 参数联动被静态媒体替代，脚本会判定 `static_media_downgrade`
- 若失败，先修实现或修双轨真源，再继续浏览器验收
- 若 `interactive-page-check.json` 或 `review-report.md` 仍保留 `handout_anchor`、公式映射、契约解析、实现契约漂移等关键告警，不得宣称实现完成；默认以关键告警清零作为收工门槛

实现完成后必须通过该脚本测试：

```bash
python3 .codex/skills/interactive-lesson-implementation/scripts/check_contract_alignment.py --lesson 2-1
```

若当前课次还没有预设，可改用显式参数：

```bash
python3 .codex/skills/interactive-lesson-implementation/scripts/check_contract_alignment.py \
  --contract course-content/authoring/lessons/<lesson>/design/<lesson>-interactive-contract.yaml \
  --implementation src/lib/<lesson>-course.ts \
  --page-contract-const <PAGE_CONTRACT_CONST> \
  --step-const <STEP_CONST>
```

这条脚本只服务仍保留本地页面契约常量的旧式实现；对 manifest-first 课程，优先依赖 `interactive-manifest.json`、共享 runtime 测试和 strict review。脚本会调用实现侧一致性测试，校验作者态 `interactive-contract.yaml` 与本地实现契约在步骤标题、互动类型、模板/区域、教师洞察、telemetry、错因标签和学生演示页预览路径上的一致性。未通过时，不得宣称互动页面已经按契约实现。

子代理审查必须发生在严格脚本前；主代理只收集审查结论、修复问题并写入接受文件，不把长篇浏览器过程塞回主上下文。

若子代理审查指出契约漏实现、旧口径回潮、埋点缺失、页内 AI 入口或曲线/示意图静态降级，必须先修复，再写 `notes/interactive-implementation-acceptance.json`，更不得宣称完成。

推荐至少补一类守卫测试：
- 检查隐藏式 AI 页面上下文与控灵助手接线
- 若设计稿要求页内 AI 入口，再检查其以内嵌对话框或抽屉实现，而非跳转
- 检查 manifest runtime 的 content/activity 分层：活动模块不会进入正文 layout，页面中每个活动题面默认只出现一次
- 检查真实课程样本页没有 `data-manifest-render-error`、没有 `data-manifest-missing-field`，且图片说明、公式、表格、显影文本均有实际 DOM 内容
- 检查提交反馈与教师汇聚存在
- 检查曲线图步骤的基线参数、图组排布与控件布局未漂移
- 检查统一事件链接线
- 检查 runtime 首页内容来源
- 对 manifest 驱动新课，检查 required module ids 全部落页、同区域多模块顺序保留、模板区域分组未被单壳层吞并、`?step=` 预览不丢模块

详细规则见：
- [references/manifest-runtime-contract.md](references/manifest-runtime-contract.md)
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
- 收工前必须补齐 `notes/interactive-implementation-acceptance.json`
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
  - 校验作者态 `interactive-contract.yaml` 与旧式本地实现契约的一致性
  - 默认支持仍保留页面契约常量的预设课次；manifest-first 课程优先使用 shared runtime 测试与 strict review
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
- `references/manifest-runtime-contract.md`
  - 新编排课程的 manifest-first 合同、模板/模块/活动注册表职责与必显模块兑现规则
- `references/verification-and-note-update.md`
  - 设计核对、浏览器验收、笔记更新与验证清单
- `references/closed-loop-browser-validation.md`
  - 浏览器闭环验收总则
- `references/browser-closed-loop-acceptance.md`
  - 教师 / 学生双身份真实课堂闭环验收硬闸门
- `references/browser-validation-teacher-subagent.md`
  - 教师端验收细则
- `references/browser-validation-student-subagent.md`
  - 学生端验收细则

## 快速检查表

- [ ] 已解析真实 authoring/runtime 课次路径，而不是想当然写 `legacy` 或非 `legacy`
- [ ] 已确认课程产物已经过 `lesson-content-review`
- [ ] 已读取 `interactive-page.md`、`interactive-contract.yaml`、runtime handout、review 产物与 graph overlay
- [ ] 若存在 `interactive-manifest.json`，已把它作为运行时页面编排真源，并确认课程适配器保持薄层
- [ ] 已确认 manifest payload 足以驱动共享 renderer，没有课程私有选项、参考答案或 module id 映射
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
- [ ] 已写入 `notes/interactive-implementation-acceptance.json`
- [ ] 已通过 `python3 course-content/scripts/review_lesson_content.py --lesson <lesson> --strict-implementation-contract`
- [ ] 已更新 `notes/<lesson>.md`
