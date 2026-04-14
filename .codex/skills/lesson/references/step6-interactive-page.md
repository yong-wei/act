# Step 6：互动页面设计规格

> 目标：将讲义内容映射为结构化的数字学习页面，并同时产出供人审阅的 `interactive-page.md` 与供实现/审查消费的 `interactive-contract.yaml`。

## 双轨真源

### 1. 双轨定义

- `interactive-page.md`
  - 人读真源。
  - 只描述页面布局、阅读顺序、固定内容、互动升级位、反馈规则、教师聚合与学生页预览口径。
- `interactive-contract.yaml`
  - 机读真源。
  - 固定页面模板、区域 ID、模块 ID、证据单元、内容块、互动规格、埋点、教师洞察、隐藏式 AI context、预览契约与验收项。

### 2. 双轨关系

- 两个文件必须同课次、同目录、同一轮设计中同步产出。
- 人读稿与机读稿必须逐步骤一一对应，不允许“先写 md，yaml 以后再补”，也不允许“先写 yaml，md 靠实现阶段脑补”。
- 后续互动课程实现默认只允许读取这两份设计源，不再回读讲义自由发挥页面结构。

### 3. 职责边界

- 人读稿回答：
  - 页面长什么样
  - 页面按什么顺序读
  - 页面先放什么证据
  - 哪些位置值得升级成互动
  - 学生页预览应该看到什么
- 机读稿回答：
  - 具体模板、区域、模块、证据单元、字段、事件、验收条件

---

## 平台技术背景（cruise-classroom，无需重新探索代码库）

| 要素 | 说明 |
|------|------|
| 技术栈 | Next.js 14 App Router + TypeScript + Tailwind CSS + shadcn/ui |
| 仿真 | iframe 嵌入 `/simulations/cruise`，通过 postMessage 桥接数据 |
| 数学公式 | KaTeX（所有公式使用 LaTeX 编写，行内 `$...$`，行间 `$$...$$`） |
| 图表 | Recharts；3D 场景：React Three Fiber |
| 主色调 | `slate-950` 背景 + `cyan-300/400` 主色 + `border-white/10~20` 边框 |

### 三页架构

- 入口页：教师创建课堂获得 6 位码；学生凭码加入；演示模式 `sessionId='demo'` 绕过同步
- 教师页 `/teacher/[sessionId]`：控制全局节奏，通过 PATCH `/api/session/[sessionId]` 推送 `currentItemId`
- 学生页 `/student/[sessionId]`：每 2.5 秒轮询跟随教师步骤；demo 模式可自由浏览

### 步骤驱动机制

课程流程由 `CRUISE_LESSON_STEPS` 数组定义，每个步骤包含：
- `id`
- `title`
- `stage`
- `duration`

---

## 设计哲学

### 1. 互动页面首先是完整课件

- 互动页面是“增强的数字课件”，不是课堂流程管理器。
- 页面总数按内容逻辑决定，不设固定上限。
- 每一步先承担传统课件职责：标题层级、关键条目、关键公式、关键图像、关键表格、关键例题、关键结论。
- 互动组件只能升级学习方式，不能替代主要知识呈现。
- 允许纯静态页面承担知识展示，不强制每页都带交互控件。

### 2. 先证据保真，再做互动升级

- 先写清楚页面上直接可见的证据单元，再决定哪里值得交互升级。
- 默认三类主类型：
  - 证据联读板：对象、公式、图、表、结论同屏联动，用于跨域联读、案例比较、任务重写。
  - 参数联动仿真板：参数变化驱动曲线、轨迹、指标同步变化，用于时域、频域、根轨迹与综合图组。
  - 推导显影板：逐层展开公式来源、判断链与步骤，用于推导、表格递推、误差通道与设计过程。
- 排序、连线、拖拽、拖槽、路径高亮、前后测、工作区填写等组件仍可使用，但只作为局部辅助手段，不再主导整页骨架。

### 3. 人读稿必须是页面蓝图，不是讲课脚本

- `interactive-page.md` 只保留客观结构描述：
  - 页面模板
  - 主阅读顺序
  - 区域布局
  - 模块清单
  - 固定文本/公式/图片/表格
  - 互动升级机制
  - 埋点摘要
  - 教师聚合
  - 学生页预览路径
- 禁用动作化表达：
  - `展示`
  - `引导`
  - `完成一次`
  - `跟随推导`
  - `让学生`
  - `讲解`
- 不再把每一步写成“教师端做什么、学生端做什么”的课堂脚本；若确有双端差异，只写页面差异和数据可见性差异。

### 4. 案例页默认按讲义逻辑组织

- 设计型和案例型页面默认遵守以下主阅读顺序：
  - 对象/背景
  - 模型与公式
  - 推导或分析
  - 图像与曲线
  - 指标/边界
  - 判断与任务卡
- 不得默认改成：
  - 先放一张大图，再把模型和公式塞到次要区域
  - 先放流程总览卡，再零碎补内容
  - 先做小测，再迟迟不出现核心证据

### 5. 曲线图默认动态化

- 只要讲义中的证据单元包含可由参数、结构或模型变化驱动的曲线图，默认都要升级为参数联动仿真板。
- 互动图必须是讲义静态图的“可调镜像”，而不是另起一张新图。
- 曲线图步骤默认接入统一 Rust/WASM 控制分析引擎；设计稿必须写清共享请求接口，而不是只描述视觉结果。
- 默认状态必须与讲义静态图一致，包括：
  - 默认参数
  - 默认结构组合
  - 默认曲线数量
  - 默认图组排布
- 静态图若为 `2×2` 图组，互动图默认也保持 `2×2` 图像格子；仅在窄屏下允许响应式重排，不改变图组语义。
- 若幅频图与相频图拆分显示，其位置必须严格继承讲义原图中的子图安排；不得在实现阶段互换位置或替换阅读顺序。
- 控件栏默认位于图像模块下方，折叠显示。
- 控件规则：
  - 只有一个参数可调：默认一个滑块。
  - 涉及结构变化：默认使用结构勾选项，并为每类结构提供各自的参数滑块。
  - 同类型结构只设置一次，不按每条曲线重复配置。
- 两类默认互动场景：
  - 单一结构、多参数曲线：通过滑块复现讲义中不同参数下的曲线位置，默认停在基线参数。
  - 多种结构并列对照：通过勾选切换结构，并调整各结构参数；默认勾选状态与基线参数与静态图一致。
- 图形范围默认固定；`x/y` 轴范围必须按参数上下限覆盖的全区间预先设定，不允许写成“随参数动态自适应”。
- 曲线图面板默认只保留标题；子图上的说明信息改为指标标注：时域图显示当前性能指标，频域图显示双裕度，根轨迹图显示当前闭环极点；所有图内标注与 tooltip 统一保留 2 位小数。
- 时域图默认以虚线叠加参考信号。
- 根轨迹步骤若存在分离点、回折点、交汇点等关键区间，必须在设计稿中显式写出“关键点附近采样加密、轨迹连续交汇”的验收要求。
- 子图内容与位置必须严格镜像讲义，不允许为实现方便临时重排。

### 5.1 示意图与原生表格默认原生化

- 除系统框图外，步骤图、对比图、卡片图、矩阵图、层级图、区域图、判断清单等示意图，默认都应设计为前端原生绘制。
- 步骤型、对比型、卡片型示意图默认写成“按步骤点击逐步呈现”的互动形态，不做一次性整图静态贴图。
- 讲义中的表格进入互动页时，默认设计为原生表格组件，公式与符号继续走 LaTeX 渲染链。
- 只有承载不可替代外部素材信息的图像，才允许在互动页保留位图。

### 6. 预览口径必须对齐学生页

- 默认预览入口固定为学生演示页。
- 教师端模板弹窗只用于看教案骨架，不得当作真实页面预览。
- 人读稿与机读稿都必须显式写出学生演示页路径。
- 若某一步设计为拖拽、连线、排序、拖槽、路径高亮或参数联动图，学生演示页必须直接显示真实组件，不允许退化为单选、填空或文本表单。

### 7. 数据治理采用“轻量高价值”

- 记录步骤级结果摘要即可，不记录高频原始轨迹。
- 重点记录：
  - 提交结果
  - 重试次数
  - 错因标签
  - AI/提示使用
  - 耗时分段
  - 教师揭示是否看到
- 禁止记录：
  - 逐像素拖拽轨迹
  - 每次 hover
  - 每次微小位置调整
  - 对教师端无意义的高频 UI 事件

---

## 讲义证据单元映射合同

进入页面设计前，必须先从 `handout.md` 抽取证据单元总表：

| handout_anchor | evidence_unit_id | evidence_kind | must_appear_content | target_step | page_mode | interaction_archetype | media_or_table_ref | acceptance_note |
|----------------|------------------|---------------|---------------------|-------------|-----------|------------------------|--------------------|-----------------|
| `2.1 定义` | `eu-01` | `object / formula / curve_figure / structure_figure / table / conclusion / misconception / task_card / derivation` | [写明必须出现在页面上的具体内容] | `step-xx` | `static / static+interactive / interactive / static+collapsible` | `none / evidence_board / parametric_sim / derivation_reveal` | [图号 / 表号 / 媒体路径；无则写“无”] | [写明如何核对内容已显式出现] |

合同要求：
- 核心概念、核心公式、关键图表、关键例题、关键结论、关键误判与关键任务表达，必须逐项映射到至少一个步骤页。
- 不允许用“见讲义”“课堂口述”“实现时再补”替代映射。
- 一个步骤页可以承接多个讲义锚点，但每个证据单元都必须能回查到具体步骤。
- `must_appear_content` 必须写到足够具体，能直接落成页面上的文本、公式、表格、图片或控件，不写泛泛主题词。
- 次级推导、补充说明、附录类内容允许进入折叠区、抽屉或展开块，但不能直接消失。
- 若某项不值得互动升级，可合法落为静态页。

### 曲线图证据单元的额外合同

凡 `evidence_kind=curve_figure`，额外补一行镜像说明：

| figure_ref | baseline_state | layout_mirror | controls | reachable_states | collapse_policy |
|------------|----------------|---------------|----------|------------------|-----------------|
| `4-1-ship-heading-quad.png` | [写明默认参数和默认结构组合] | `single / 2x2 / custom-grid` | [单滑块 / 结构勾选 + 各自滑块] | [说明讲义中的哪些典型曲线位置必须可复现] | `controls_below_collapsible` |

并额外补一组运行时合同：

| engine_family | request_contract | axis_policy | overlay_policy | sampling_policy | precision_policy |
|---------------|------------------|-------------|----------------|-----------------|------------------|
| `rust_wasm_control_engine` | [写明 `caseId / outputs / timeRange / frequencyRange / rootLocus / structures / referenceProfile / feasibleRegion`] | `fixed_extent` | [时域指标 / 双裕度 / 当前闭环极点] | [写明关键点加密采样要求] | `fixed_2_decimals` |

硬约束：
- `baseline_state` 必须能复现讲义原图。
- `layout_mirror` 默认与讲义一致。
- `reachable_states` 必须覆盖讲义中已经出现过的典型曲线位置或结构差异。
- `collapse_policy` 默认写 `controls_below_collapsible`。
- `engine_family` 默认写 `rust_wasm_control_engine`。
- `axis_policy` 默认写 `fixed_extent`，不得写动态缩放。
- `overlay_policy` 必须明确到每个子图显示什么指标；四联图中若含幅频与相频双图，必须同时覆盖 `PM` 与 `GM`。
- `sampling_policy` 若为空，视为设计未完成；根轨迹关键点附近必须明确采样加密与轨迹连续性要求。
- `precision_policy` 默认写 `fixed_2_decimals`。
- 曲线图步骤的人读稿与机读稿都必须显式写出 `engine_family`、`request_contract`、`subplot_mapping`、`axis_policy`、`overlay_policy`、`sampling_policy`、`precision_policy`；缺任一字段，视为合同未完成。

### 示意图证据单元的额外合同

凡 `evidence_kind=structure_figure / task_card / conclusion / misconception` 且本质上属于步骤图、对比图、卡片图、矩阵图、层级图、区域图、判断清单时，额外补一组原生绘制合同：

| figure_ref | render_mode | progressive_reveal | interaction_carrier | acceptance_note |
|------------|-------------|--------------------|---------------------|-----------------|
| `4-1-task-card-template.png` | `native_svg / native_html / native_canvas` | `step_click_reveal / section_click_reveal / none` | [写明点击展开、逐项高亮或局部显影方式] | [写明哪些内容必须可交互呈现] |

硬约束：
- 除系统框图外，`render_mode` 默认不允许写位图。
- 步骤型、对比型、卡片型示意图默认写 `progressive_reveal=step_click_reveal`。
- 只有确实承载不可替代外部素材时，才允许例外写 `none`，并必须说明原因。

### 原生表格证据单元的额外合同

凡 `evidence_kind=table` 且需要进入互动页，额外补一组原生表格合同：

| table_ref | render_mode | formula_rendering | progressive_reveal | acceptance_note |
|-----------|-------------|-------------------|--------------------|-----------------|
| `表 6` | `native_table` | `latex_inline_and_block` | `row_or_column_reveal / none` | [写明哪些列、公式、符号必须保留] |

硬约束：
- `render_mode` 默认写 `native_table`。
- `formula_rendering` 默认写 `latex_inline_and_block`。
- 不允许把表格整体烘成位图后贴入页面。

---

## 双视角信息如何落位

双端差异仍然要设计，但写法改为：

- 人读稿：
  - 只写教师端 / 学生端的页面差异
  - 例如：教师端可见聚合统计，学生端只见个人提交态
- 机读稿：
  - `teacher_controls` 写教师控制项
  - `interaction_spec` 写学生交互与反馈
  - `teacher_insight_spec` 写教师汇聚组件
  - `ai_context_spec` 只写隐藏式上下文，不默认要求页面显式 AI 模块

---

## 页面布局原则

### 1. 按需互动

- 无互动步骤：全幅纯文本 / 静态图示 / 静态表格 / 静态例题
- 有互动步骤：主证据区在上，互动区在下，保持自然流式布局
- 参数联动图：图组优先，控件后置

### 2. 小屏优先

- 默认采用纵向流式布局
- 不采用“课件内容一侧、互动区一侧”的固定双栏作为默认方案
- 互动区允许折叠，但静态内容不得被折叠到看不见
- `2×2` 图组在窄屏下可改为 `1×4` 或 `2×2` 自适应重排，但必须保持原图阅读顺序

### 3. 图像规范统一

- 互动页面中的图示只能来自真实媒体：
  - 代码直出图
  - TikZ 线框图
  - AI 生成图
  - 前端真实绘图
- 禁止 ASCII 图、字符框图、字符波形

---

## 步骤类型

| 步骤类型 | 特征 |
|----------|------|
| 纯展示页 | 静态课件页，无提交 |
| 核心内容页 | 静态知识主体 + 轻量互动升级 |
| 参数联动画板页 | 图组与参数控制为主，默认镜像静态曲线图 |
| 推导显影页 | 推导链、判断链或表格递推为主 |
| 测验页 | 客观题 / 短答 / 后测 |
| 知识整合页 | 总表、对照、速记、对象库、例题收束 |

---

## 人读稿输出格式（interactive-page.md）

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
互动页面设计 | 单元[编号]：[标题]
技术栈：Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 文档职责
- [说明：本文件是供人审阅的页面蓝图]

## 表述规则
- [说明：禁用动作化表达、证据单元优先、学生页预览优先]

## 全课总览
| 步骤 | 标题 | 页面模板 | 主阅读顺序 | 互动主类型 | 学生页预览 |
|------|------|----------|------------|------------|------------|
| ...  | ...  | ...      | ...        | ...        | ...        |

## 讲义证据单元映射
| handout_anchor | evidence_unit_id | evidence_kind | must_appear_content | target_step | page_mode | interaction_archetype | media_or_table_ref | acceptance_note |
|---|---|---|---|---|---|---|---|---|

---

## step-xx｜[标题]

### 页面骨架
- 模板：`[...]`
- 主阅读顺序：
  - `[...]`
  - `[...]`
- 区域：
  - `[...]`：`[...]`，[区域用途]

### 模块清单
- `[...]`：`[...]`

### 固定内容
- [页面上直接可见的文本、公式、图片、表格、例题、结论]

### 互动升级
- 主类型：`evidence_board / parametric_sim / derivation_reveal / none`
- [组件形态、控件、反馈规则、揭示规则]

### 曲线互动镜像说明（仅曲线图步骤需要）
- 对应静态图：`[...]`
- 基线状态：`[...]`
- 图组排布：`single / 2x2 / ...`
- 控件策略：`单滑块 / 结构勾选 + 各自滑块`
- 折叠策略：`图下折叠控件栏`

### 埋点与教师数据
- 埋点摘要：`[...]`
- 教师聚合：`[...]`

### 预览口径
- 学生页预览：`...`
- 对齐要求：`...`

---
[重复上述格式]
```

说明：
- `interactive-page.md` 中不再把“AI 边界”作为默认显式栏目；若需要记录，只写“隐藏式 AI 上下文说明”，并明确其不对应页面可见模块。

---

## 机读稿输出格式（interactive-contract.yaml）

机读稿默认至少包含以下字段：

```yaml
contract_version: "2.1"
lesson_id: "2-1"
course_title: "..."
course_route_segment: "..."
preview_mode:
  default_entry: student_demo
  student_demo_base_path: /interactive-learning/courses/...
  teacher_preview_panel_note: 教师端模板弹窗仅用于看教案骨架
telemetry_strategy: lightweight_high_value
teacher_insight_strategy: step_level_aggregation_only
required_step_fields:
  - layout
  - modules
  - evidence_units
  - content_blocks
  - interaction_spec
  - teacher_controls
  - telemetry_spec
  - teacher_insight_spec
  - ai_context_spec
  - preview_contract
  - acceptance_checks
steps:
  step-01:
    title: ...
    layout:
      template: ...
      regions: [...]
      reading_order: [...]
    modules: [...]
    evidence_units: [...]
    content_blocks: [...]
    interaction_spec:
      interaction_kind: ...
      interaction_archetype: ...
    teacher_controls: [...]
    telemetry_spec: ...
    teacher_insight_spec: ...
    ai_context_spec:
      delivery_mode: hidden_page_context
      quick_questions: [...]
      canonical_facts: [...]
    preview_contract: ...
    acceptance_checks: [...]
```

### `interactive_figure_spec`（仅曲线图步骤需要）

曲线图步骤的机读合同必填字段固定为：

- `engine_family`
- `request_contract`
- `baseline_state`
- `layout_mirror`
- `subplot_mapping`
- `axis_policy`
- `controls`
- `panel_overlay`
- `reference_signal`
- `sampling_policy`
- `precision_policy`
- `reachable_states`

缺任一字段，都视为曲线图合同未完成。下面的 YAML 仅以 `4-1` 为示例，字段集合本身适用于所有后续曲线图步骤。

```yaml
interactive_figure_spec:
  mirrors_static_figure: true
  figure_ref: 4-1-ship-heading-quad.png
  engine_family: rust_wasm_control_engine
  request_contract:
    caseId: ship_heading
    outputs: [step_response, root_locus, magnitude, phase, nyquist]
    timeRange: { start: 0, end: 160, samples: 600 }
    frequencyRange: { min: 1e-3, max: 10, samples: 400 }
    rootLocus: { minGain: 0, maxGain: 5, samples: 240, currentGain: 2.25 }
    referenceProfile: [{ time: 0, value: 1 }]
  baseline_state:
    structure_mode: baseline
    parameters:
      K: 2.25
  layout_mirror: 2x2
  subplot_mapping:
    top_left: step_response
    top_right: magnitude
    bottom_left: root_locus
    bottom_right: phase
  axis_policy:
    mode: fixed_extent
    source: parameter_bounds_cover_all_states
  controls:
    placement: below_figure
    collapsed_by_default: true
    structure_toggles:
      - pd
      - lag
    parameter_controls:
      - id: K
        kind: slider
        scope: shared
      - id: Td
        kind: slider
        scope: pd
  panel_overlay:
    step_response: [Mp, tr, ts, tp]
    magnitude: [GM, wc]
    root_locus: [current_closed_loop_poles]
    phase: [PM, wg]
  reference_signal:
    style: dashed
    source: referenceProfile
  sampling_policy:
    root_locus_critical_points: adaptive_dense_sampling
    requires_branch_continuity_at_breakaway: true
  precision_policy:
    tooltip_decimals: 2
    overlay_decimals: 2
  reachable_states:
    - handout_curve_family_baseline
    - handout_curve_family_variant_a
    - handout_curve_family_variant_b
```

说明：
- 若仓库当前审查脚本只支持 JSON 语法兼容的 YAML，可临时采用 JSON 语法保存，但字段语义不变。
- `interactive-page.md` 与 `interactive-contract.yaml` 的步骤顺序、标题、预览路径、互动类型必须一致。
- `ai_context_spec` 默认只表达隐藏式上下文，不等价于页面可见 AI 区块。

### `native_figure_spec`（仅原生示意图步骤需要）

```yaml
native_figure_spec:
  render_mode: native_svg
  progressive_reveal: step_click_reveal
  reveal_sequence:
    - object
    - contrast
    - judgment
  keeps_future_interaction_slots: true
```

### `native_table_spec`（仅表格步骤需要）

```yaml
native_table_spec:
  render_mode: native_table
  formula_rendering: latex_inline_and_block
  progressive_reveal: row_or_column_reveal
```

---

## 两阶段工作流

### 第一阶段：先确认框架

先输出：
- 讲义证据单元映射总表
- 全课总览表
- 步骤列表框架：
  - 步骤
  - 标题
  - 页面模板
  - 主阅读顺序
  - 互动主类型
  - 学生页预览

### 第二阶段：再补齐双轨正文

确认框架后，逐步补全：
- 人读稿每一步的页面蓝图
- 机读稿每一步的字段

每一步最少补齐：
- `页面骨架`
- `模块清单`
- `固定内容`
- `互动升级`
- `埋点与教师数据`
- `预览口径`

凡是曲线图步骤，额外补齐：
- `曲线互动镜像说明`
- `interactive_figure_spec`

凡是原生示意图步骤，额外补齐：
- `native_figure_spec`

凡是表格步骤，额外补齐：
- `native_table_spec`

---

## 公式、预览与数据治理硬约束

- 所有公式都必须写成 LaTeX。
- 行内公式使用 `$...$`，行间公式使用 `$$...$$`。
- 需要对比多个概念、结构、现象时，优先用表格。
- 互动页面中的图、表、公式与讲义版本保持语义一致。
- 人读稿中的“固定内容”必须足以让页面脱离教师口述独立阅读。
- 机读稿中的 `telemetry_spec` 默认只写轻量高价值字段。
- 默认预览口径固定为学生演示页；若人读稿与机读稿的预览路径不一致，视为设计未完成。
- 一旦设计为拖拽、连线、排序、拖槽、路径高亮或参数联动图，后续实现不得降级成选择题、填空题或文本问答。
- 曲线图步骤若无法在默认状态下复现讲义原图，视为设计未完成。
- 原生示意图若仍以整张位图交付，且又不存在不可替代的外部素材理由，视为设计未完成。
- 原生表格若失去公式符号渲染能力，视为设计未完成。

---

## 验收口径

设计阶段的验收不再只检查“组件是否存在”，而必须同时检查：

1. 证据完整出现：
   - 对象、公式、图、表、结论、误判与任务卡是否都显式落页。
2. 阅读顺序正确：
   - 页面是否沿讲义逻辑展开，而不是改写成流程管理页或题库页。
3. 互动未替代主知识：
   - 即使关闭互动，页面是否仍保留完整可讲授内容。
4. 曲线图镜像成立：
   - 默认状态是否复现讲义静态图。
   - 图组排布是否与静态图一致。
   - 控件是否位于图下折叠区。
   - 运行时接口、固定范围、指标标注、两位小数与参考信号是否已写入合同。
5. 次级内容仍可访问：
   - 附录推导、补充说明、次级结论是否有折叠入口，而不是直接消失。
6. 原生示意图与原生表格成立：
   - 除系统框图外，示意图是否明确为原生绘制。
   - 步骤型/对比型/卡片型示意图是否明确逐步呈现方式。
   - 表格是否明确为原生表格并保留公式渲染。

---

## 结束提示

> “以上是互动页面主体框架，共 [N] 步骤，并已附讲义证据单元映射总表。请确认：步骤拆分是否合理？讲义中的核心对象、公式、图表、例题、结论、误判与任务表达是否都已找到页面落点？曲线图的默认互动镜像、基线参数、图组排布与控件策略是否合理？确认框架后，将同步写入 `interactive-page.md` 与 `interactive-contract.yaml`，再进入多模态资源设计（Step 7）。”
