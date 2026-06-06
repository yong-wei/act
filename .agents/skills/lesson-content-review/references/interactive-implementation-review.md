# 互动页面实现专项审查

## 审查目标

互动页专项审查不是只看 `interactive-page.md` 是否“写得完整”，而是检查三层合同是否一致：
- 第一层：`design/{unit}-interactive-page.md` 的页面蓝图与讲义映射
- 第二层：`design/{unit}-interactive-contract.yaml` 的结构化契约
- 第三层：本地实现导出的步骤定义与页面契约

只要三层中有一层漂移，就不能判定互动页审查通过。

## 产物定位

课程内容审核技能的互动页结论统一写入：
- `course-content/runtime/lessons/<lesson>/review/interactive-page-check.json`

其中至少应关注：
- `mapping_contract_mode`
- `missing_mapping_columns`
- `invalid_handout_anchors`
- `missing_target_steps`
- `step_reading_order_missing`
- `curve_figure_steps_missing_mirror`
- `curve_figure_steps_missing_contract`
- `step_contract_issues`
- `implementation_contract_source`
- `implementation_contract_summary`
- `implementation_contract_issues`

## 元件级检查清单

### 一、讲义映射与阅读顺序

- `interactive-page.md` 必须包含 `## 讲义核心内容映射` 或 `## 讲义证据单元映射`
- 若使用证据单元映射，表头至少包含：
  - `handout_anchor`
  - `evidence_unit_id`
  - `evidence_kind`
  - `must_appear_content`
  - `target_step`
  - `page_mode`
  - `interaction_archetype`
  - `media_or_table_ref`
  - `acceptance_note`
- 每个 `handout_anchor` 必须能回指讲义标题
- 每个 `target_step` 必须能命中对应步骤正文
- 采用证据单元映射的步骤必须写出 `主阅读顺序`
- `主阅读顺序` 与 `interactive-contract.yaml > layout.reading_order` 必须一致

### 二、页面骨架与本地实现

本地实现契约必须逐步骤比对以下字段：

| 作者态字段 | 本地实现字段 |
| --- | --- |
| `title` | `lessonSteps[].title` |
| `interaction_spec.interaction_kind` | `lessonSteps[].pageType` 与 `pageContracts[].interactionKind` |
| `layout.template` | `pageContracts[].layout.template` |
| `layout.regions` | `pageContracts[].layout.regions` |
| `layout.reading_order` | `pageContracts[].layout.readingOrder` |
| `interaction_spec.interaction_archetype` | `pageContracts[].interactionArchetype` |
| `preview_contract.demo_path` | `pageContracts[].previewDemoPath` |
| `teacher_insight_spec.widgets` | `pageContracts[].teacherInsightWidgets` |
| `telemetry_spec.summary_fields` | `pageContracts[].telemetrySummaryFields` |
| `telemetry_spec.misconception_tags` | `pageContracts[].misconceptionTags` |
| `ai_context_spec.delivery_mode` | `lessonSteps[].aiContext.deliveryMode` 或 `pageContracts[].aiDeliveryMode` |
| `interactive_figure_spec.layout_mirror` | `pageContracts[].figureLayoutMirror` |
| `interactive_figure_spec.controls.placement` | `pageContracts[].controlsPlacement` |
| `interactive_figure_spec.controls.collapsed_by_default` | `pageContracts[].controlsCollapsedByDefault` |

判定原则：
- 不接受“语义差不多”的近似映射
- 不接受为了实现方便把互动原型降级为更弱题型
- `interaction_kind: none` 只允许落到 `display` 或 `summary` 一类静态页语义

### 三、隐藏式 AI 页面上下文

- `ai_context_spec` 默认只表达隐藏式页面上下文
- 若作者态写的是 `hidden_page_context`，本地实现不得默认渲染可见 AI 模块
- 允许把该上下文提供给控灵助手或课程级 AI 消费，但不能篡改为页面主模块

### 四、教师侧聚合与埋点

- 教师侧只审聚合结果，不要求高频原始轨迹回放
- `teacher_insight_spec.widgets` 必须与页面真实聚合组件一致
- `telemetry_spec.summary_fields` 与 `misconception_tags` 不得缺项或换义
- 若页面设计要求教师聚合识别典型误判，本地实现必须保留对应标签

## 曲线图镜像专项

只要讲义中存在曲线图证据单元，默认进入互动镜像审查。

### 设计稿必查

- 页面步骤正文必须写出“曲线互动镜像说明”
- `interactive-contract.yaml` 必须提供 `interactive_figure_spec`
- `interactive_figure_spec.mirrors_static_figure` 应表达对静态图的镜像关系
- `baseline_state` 必须能回到 handout 静态图所对应的默认结构和参数

### 结构与布局必查

- 讲义静态图为 `2×2` 图组时，互动图默认布局必须为 `2x2`
- 互动图默认状态下的曲线位置、结构组合、参数取值必须与 handout 静态图一致
- 控件栏默认位于图像模块下方，且默认折叠

### 控件设计必查

- 若只有一个可调参数，只允许一个滑块承担主调节
- 若涉及结构变化，使用结构勾选，并为每类结构提供各自参数滑块
- 同类型结构只配置一次，不按静态图中出现的曲线条数重复设置控件
- 不得把多结构对比退化成“每条曲线一个单独开关”

## 常见降级实现

- 设计稿是拖拽、连线、排序，实现阶段改成单选或判断
- `2×2` 曲线图组改成单图轮播、标签页切换或下拉菜单切图
- 图下折叠控件栏改成常驻侧栏，挤压图像阅读空间
- 默认状态不是讲义静态图，而是任意参数演示态
- 隐藏式 AI 上下文被做成常驻 AI 卡片

以上任一情况都应在审查结论中标注为 `需修订` 或 `阻塞`，不能因为“功能还能用”而放行。
