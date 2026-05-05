━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
互动页面设计 | 单元 4-1：设计起点：性能指标体系、工程约束与可行域表达
技术栈：Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 文档职责

- 本文件是供人审阅的页面蓝图，只描述页面模板、阅读顺序、固定证据、互动升级位、教师聚合与学生页预览口径。
- 同目录 [interactive-contract.yaml](./interactive-contract.yaml) 是机读真源；两份文件必须逐步骤同名、同序、同边界。
- 本文件不是讲课脚本，不写教师口播，也不把页面结构留给实现阶段临时发挥。
- 本课首先承担完整课件职责，再把最值得升级的位置做成证据联读板、参数联动仿真板或任务工作区。

## 表述规则

- 每一步先固定页面上直接可见的对象、公式、图表、表格、结论，再写互动升级。
- 讲义中的曲线图默认升级为参数联动仿真板，且互动图必须是讲义静态图的可调镜像，不另起一张新图。
- 曲线图运行时统一接入 Rust/WASM 控制分析引擎；固定数轴、固定图组语义、图下折叠控件栏、图内指标标注保留两位小数。
- 除系统框图外，对照矩阵、指标角色矩阵、任务表达卡、区域分层图、误判卡与判断清单默认采用前端原生绘制或原生表格，不保留为位图主体。
- 默认预览入口固定为学生演示页；教师端模板弹窗只用于看骨架，不替代真实页面。

## 全课总览

| 步骤 | 标题 | 页面模板 | 主阅读顺序 | 互动主类型 | 学生页预览 |
|------|------|----------|------------|------------|------------|
| step-01 | 任务表达入口：从跨域证据写出设计任务 | `map_hero_slide` | 封面情境图 -> 课程信息图 -> 导入问题 | `none` | `/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-01` |
| step-02 | 本次课程目标 | `goal_boundary_slide` | 本次课程目标 | `none` | `/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-02` |
| step-03 | 同图异读预判：为什么同一套证据会写出两张任务书 | `question_stack` | 前测基本知识点 -> 三题预判 | `quiz_group` | `/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-03` |
| step-04 | 主场景 A：客船航向控制先保什么 | `case_study_dashboard` | 对象/背景 -> 模型与公式 -> 图像与曲线 -> 指标/边界 -> 判断与任务卡 | `parametric_sim` | `/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-04` |
| step-05 | 对照案例 B：稳定平台为什么把速度排得更前 | `case_study_dashboard` | 对象/背景 -> 模型与公式 -> 图像与曲线 -> 指标/边界 -> 判断与任务卡 | `parametric_sim` | `/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-05` |
| step-06 | 双案例对照：排序变化来自哪里 | `contrast_summary_board` | 对照矩阵 -> 排序结果 -> 一句话收束 | `evidence_board + card_sort` | `/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-06` |
| step-07 | 指标角色重组：时域、频域、积分误差各自回答什么 | `formula_table_match` | 问题分工 -> 公式与指标 -> 角色映射 | `triple_match` | `/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-07` |
| step-08 | 任务分类：硬约束、软目标、观察指标 | `comparison_panel_with_sort` | 分类规则 -> 指标卡组 -> 角色归类 | `card_sort` | `/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-08` |
| step-09 | 任务表达卡工作区：把后续设计输入写全 | `task_card_workspace` | 模板字段 -> 证据来源 -> 任务表达卡填写 | `task_card_workspace` | `/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-09` |
| step-10 | 区域分层：可行域、满意域、最优域不是一步 | `layered_region_board` | 集合关系 -> 分层图示 -> 边界判断 | `binary_choice` | `/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-10` |
| step-11 | 误判检查：稳定不等于完成，可行不等于最优 | `misconception_board` | 误判卡 -> 五步清单 -> 纠偏判断 | `binary_choice` | `/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-11` |
| step-12 | 后测：先写任务，再谈方法 | `summary_quiz_board` | 后测题组 | `quiz_group` | `/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-12` |
| step-13 | 总结：任务表达卡成为后续设计输入 | `summary_quiz_board` | 课程信息图 -> 四句带走 -> 课堂表现统计 | `none` | `/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-13` |

## 讲义证据单元映射

| handout_anchor | evidence_unit_id | evidence_kind | must_appear_content | target_step | page_mode | interaction_archetype | media_or_table_ref | acceptance_note |
|---|---|---|---|---|---|---|---|---|
| `## 一、回到地图：同一套跨域证据，为什么会写出两张不同任务书` | `eu-01-entry-question` | `concept_card` | 封面情境图、课程信息图，以及围绕客船航向控制与稳定平台两案提出的导入问题。 | `step-01` | `static` | `entry_overview` | `4-1-cover-comic.png` / `4-1-info.png` / 导入问题卡 | 首屏必须同时看到封面情境图、课程信息图和导入问题。 |
| `## 二、先做“同图异读”，再回收最小指标语言` | `eu-02-prejudge` | `diagnostic_prompt` | 三道预判题必须围绕“当前最不能接受的后果、哪类指标先前移、为何不能写成同一张任务书”。 | `step-03` | `static+interactive` | `diagnostic_quiz` | 预判题组 | 三题必须全部明文落页，不得只留按钮。 |
| `### 2.1 主场景 A：客船航向控制为什么先保平顺与储备` | `eu-03-ship-figure` | `curve_figure` | 客船对象框图、$P_h(s)$、$L_h(s)$、客船四联图、$M_p \le 15\%$、$t_s \le 45\,\text{s}$、入口排序判断。 | `step-04` | `static+interactive` | `parametric_sim` | `4-1-ship-heading-block.png` / `4-1-ship-heading-quad.png` | 对象框图、可调四联图和读图卡必须同页可见。 |
| `### 2.2 对照案例 B：为什么稳定平台会把速度与带宽排得更前` | `eu-04-platform-figure` | `curve_figure` | 稳定平台对象框图、$P_p(s)$、$L_p(s)$、综合图布局说明、速度优势与储备代价的入口排序。 | `step-05` | `static+interactive` | `parametric_sim` | `4-1-platform-pitch-block.png` / `4-1-platform-pitch-quad.png` | 必须保留案例 B 的特殊图组结构与短对照定位。 |
| `### 2.3 为什么同一套图，会读出两种任务排序` | `eu-05-compare-matrix` | `table` | 双场景同图异读对照矩阵四行内容和“语言相同，排序不同”的收束语。 | `step-06` | `static+interactive` | `evidence_reorder` | 表 4 / `4-1-case-compare-summary.png` | 对照矩阵改为原生表格，排序条目拖拽区位于其下。 |
| `### 3.1 三类常用指标，各自回答不同问题 / ### 3.2 指标真正进入设计时，会变成三种角色` | `eu-06-role-language` | `formula_table` | 时域、频域、积分误差三类问题卡，`ISE/IAE/ITAE` 三式，表 5 的三类角色。 | `step-07` | `static+interactive` | `concept_role_mapping` | 表 5 / `4-1-indicator-role-matrix.png` | 问题卡、积分误差公式和角色矩阵必须先于配对区出现。 |
| `### 3.3 为什么“所有指标都重要”不是合格任务书` | `eu-07-role-classification` | `classification_rule` | 硬约束、软目标、观察指标三类规则与“角色由任务决定，不由名词决定”的固定提醒。 | `step-08` | `static+interactive` | `role_classification` | 角色规则卡 | 规则卡必须完整落页，拖拽区只做分类，不重复解释。 |
| `### 4.1 一张合格的任务表达卡，至少要写清七项内容 / ### 4.2 主场景 A：客船航向控制的任务表达卡 / ### 4.3 对照案例 B：稳定平台的任务表达卡为什么会改写排序` | `eu-08-task-card` | `task_card` | 七字段模板、五步判断清单、主场景 A 完整示范、案例 B 短对照。 | `step-09` | `static+interactive` | `task_card_workspace` | 表 6 / 表 7 / 表 8 / `4-1-task-card-template.png` | 模板卡、证据库和填写区必须同屏。 |
| `## 五、可行域、满意域与最优域必须分层` | `eu-09-region-layer` | `region_figure` | $\mathcal{O}\subseteq\mathcal{S}\subseteq\mathcal{F}$、三层区域定义、表 10 的三层差别。 | `step-10` | `static+interactive` | `layer_judgement` | 表 10 / `4-1-region-layering.png` | 分层图改为原生图示，不得退化为单张位图。 |
| `## 六、常见误判与工程判断清单` | `eu-10-misconception` | `misconception` | 三类误判卡、四步联读顺序、表 11 的五步工程判断清单。 | `step-11` | `static+interactive` | `misconception_diagnosis` | 表 11 | 误判卡与五步清单必须同页。 |
| `### 7.5 课后自检` | `eu-11-post-test` | `summary_quiz` | 三题后测，检查任务表达、区域分层与同图异读判断。 | `step-12` | `static+quiz` | `post_assessment_quiz` | 后测题组 | 后测与总结分开，后测只承担达成检查。 |
| `## 七、本节小结与衔接 / ### 7.4 一页带走` | `eu-12-summary-exit` | `summary` | 课程信息图、四句带走、`4-2/4-3/4-4` 去向与课堂表现统计。 | `step-13` | `static` | `lesson_summary` | `4-1-info.png` / 小结卡 / 去向卡 | 总结页必须能独立复习，并显示个人或班级课堂表现统计。 |

## 曲线图证据单元补充合同

| figure_ref | baseline_state | layout_mirror | controls | reachable_states | collapse_policy |
|------------|----------------|---------------|----------|------------------|-----------------|
| `4-1-ship-heading-quad.png` | `K_h=2.25`，基线结构与讲义原图一致 | `2x2` | 图下折叠控件栏，单共享滑块 `K_h` | `handout_curve_family_baseline`、`ship_speed_up_margin_tighter`、`ship_more_conservative_slower_but_safer` | `controls_below_collapsible` |
| `4-1-platform-pitch-quad.png` | `K_p=5`，保留讲义原有综合图布局 | `custom-grid` | 图下折叠控件栏，单共享滑块 `K_p` | `handout_curve_family_baseline`、`platform_speed_advantage_with_tighter_margin`、`platform_margin_recovery_with_speed_tradeoff` | `controls_below_collapsible` |

| engine_family | request_contract | axis_policy | overlay_policy | sampling_policy | precision_policy |
|---------------|------------------|-------------|----------------|-----------------|------------------|
| `rust_wasm_control_engine` | `caseId=ship_heading`；`outputs=[step_response, root_locus, magnitude, phase]`；`timeRange=[0,160]`；`frequencyRange=[1e-3,10]`；`rootLocus=[0,5]`；`referenceProfile=unit_step`；`feasibleRegion={Mp<=15%, ts<=45s}` | `fixed_extent` | 时域图显示 `$M_p,t_r,t_s,t_p$`，幅频图显示 `$GM,\omega_c$`，根轨迹显示当前闭环极点， 相频图显示 `$PM,\omega_g$` | 根轨迹关键点附近加密采样，交汇与回折保持连续，交叉频率附近频域采样加密 | `fixed_2_decimals` |
| `rust_wasm_control_engine` | `caseId=platform_pitch`；`outputs=[step_response, root_locus, magnitude, phase]`；`timeRange=[0,1.2]`；`frequencyRange=[1e-1,10^3]`；`rootLocus=[0,12]`；`referenceProfile=unit_step`；`feasibleRegion=high_speed_high_damping_entry` | `fixed_extent` | 综合图主视根轨迹显示当前闭环极点，右侧窄图显示时域指标、`GM`、`PM` 与交叉频率 | 双根轨迹分支连续重排序，交汇与回折区加密；交叉频率与裕度附近频域采样加密 | `fixed_2_decimals` |

## 原生示意图与原生表格合同

| figure_or_table_ref | render_mode | progressive_reveal | interaction_carrier | acceptance_note |
|---------------------|-------------|--------------------|---------------------|-----------------|
| `表 4 / 4-1-case-compare-summary.png` | `native_table + native_html` | `row_or_column_reveal` | 行高亮 + 排序条目拖拽 | 四行对照矩阵必须保留，不能烘成信息图位图。 |
| `表 5 / 4-1-indicator-role-matrix.png` | `native_table + native_svg` | `row_or_column_reveal` | 问题卡点击高亮 + 三栏配对 | 角色矩阵中的符号与公式必须继续支持 LaTeX。 |
| `表 6 / 4-1-task-card-template.png` | `native_html` | `section_click_reveal` | 七字段模板逐段显影 + 工作区填写 | 模板卡必须可继续扩展为后续局部交互，不保留为静态图片。 |
| `表 10 / 4-1-region-layering.png` | `native_svg` | `step_click_reveal` | 分层区点击高亮 + 层级判断 | 三层区域关系必须可点击显影。 |
| `表 11` | `native_table` | `row_or_column_reveal` | 五步清单逐行高亮 + 误判纠偏 | 五步清单必须与误判卡同页可见。 |

---

## 步骤 01｜任务表达入口：从跨域证据写出设计任务

### 页面骨架

- 模板：`map_hero_slide`
- 主阅读顺序：
  - `封面情境图`
  - `课程信息图`
  - `导入问题`
- 区域：
  - `header`：课次标题
  - `lead`：封面情境图与课程信息图
  - `summary`：导入问题卡

### 模块清单

- `cover-comic`：客船航向与稳定平台情境图
- `lesson-infograph`：任务表达课程信息图
- `core-question-card`：导入问题卡

### 固定内容

- 封面情境图使用 `4-1-cover-comic.png`，呈现客船航向控制与船载稳定平台两个工程对象。
- 课程信息图使用 `4-1-info.png`，呈现“对象证据 -> 指标角色 -> 区域分层 -> 任务表达卡”的学习路径。
- 导入问题卡固定写明：
  - 面对同一套稳定性、动态性能和频域储备证据，客船航向控制与稳定平台会形成怎样不同的目标、约束和优先级？
  - 把这些证据写成任务表达卡时，哪些指标应成为底线，哪些指标应成为改进方向，哪些指标只用于观察后果？

### 互动升级点

- 主类型：`none`
- 本页无作答区，无揭示按钮，无教师统计面板占位。

### 埋点与教师数据

- 埋点摘要：`viewed`、`timeOnStep`、`teacherFollowSync`
- 教师聚合：`view_count`、`sync_status`

### 预览口径

- 学生页预览：`/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-01`
- 对齐要求：首屏直接出现封面情境图、课程信息图和导入问题，无空白互动容器。

---

## 步骤 02｜本次课程目标

### 页面骨架

- 模板：`goal_boundary_slide`
- 主阅读顺序：
  - `本次课程目标`
- 区域：
  - `goals`：四项目标卡

### 模块清单

- `goal-cards`：四项目标卡

### 固定内容

- 四项目标卡固定写明：
  - 解释同一套跨域证据在不同工程场景中导出不同任务排序的原因；
  - 区分时域、频域与积分误差指标分别回答的问题；
  - 判别指标在任务书中承担硬约束、软目标或观察指标的角色；
  - 撰写包含对象、目标、约束、优先级与证据来源的任务表达卡。

### 互动升级点

- 主类型：`none`
- 本页纯静态承载，只呈现本次课程目标，不添加提交区或装饰性互动。

### 埋点与教师数据

- 埋点摘要：`viewed`、`timeOnStep`
- 教师聚合：`view_count`

### 预览口径

- 学生页预览：`/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-02`
- 对齐要求：只呈现布鲁姆动词驱动的本次课程目标，不增加目标说明、边界说明或提交模块。

---

## 步骤 03｜同图异读预判：为什么同一套证据会写出两张任务书

### 页面骨架

- 模板：`question_stack`
- 主阅读顺序：
  - `前测基本知识点`
  - `三题预判`
- 区域：
  - `question-stack`：三题纵向堆叠
  - `submit-bar`：提交与反馈条

### 模块清单

- `pretest-q1`：客船场景最不能接受什么
- `pretest-q2`：稳定平台为什么不能只盯速度
- `pretest-q3`：为何不能写成同一张任务书

### 固定内容

- 标题模块文案只写本页考察的基本知识点：控制系统稳定性判断、时域与频域指标含义、积分误差指标含义，以及指标角色与优先级的基础认识。
- 三道题干全部明文落页，并明确引用“客船航向控制”“稳定平台”两个对象。

### 互动升级点

- 主类型：`quiz_group`
- 作答模型：允许重提一次；教师端区分首答与重提。
- 反馈规则：只返回错因标签，不直接给完整排序答案。
- 教师揭示：`teacher_toggle`

### 埋点与教师数据

- 埋点摘要：`attemptCount`、`resultState`、`errorBucket`、`teacherRevealSeen`
- 教师聚合：`question_distribution`、`top_misconceptions`

### 预览口径

- 学生页预览：`/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-03`
- 对齐要求：三题在未作答状态下全部可见，反馈条位于题组下方。

---

## 步骤 04｜主场景 A：客船航向控制先保什么

### 页面骨架

- 模板：`case_study_dashboard`
- 主阅读顺序：
  - `对象/背景`
  - `模型与公式`
  - `图像与曲线`
  - `指标/边界`
  - `判断与任务卡`
- 区域：
  - `object`：对象框图与传函
  - `evidence`：四联图与控件栏
  - `analysis`：读图卡与任务填写区

### 模块清单

- `ship-object-block`：`4-1-ship-heading-block.png`
- `ship-quad-figure`：客船四联图画板
- `ship-reading-card`：主矛盾 / 必守边界 / 证据来源卡

### 固定内容

- 对象区完整写出：
  $$
  P_h(s)=\frac{0.01715}{s(s+0.1)(s+2.14375)},\qquad
  L_h(s)=\frac{0.0385875}{s(s+0.1)(s+2.14375)}
  $$
- 边界区完整写出：
  $$
  M_p \le 15\%,\qquad t_s \le 45\,\text{s}
  $$
- 读图卡固定写明：
  - 当前系统稳定，但过程偏冲、偏拖；
  - 当前闭环极点尚未进入任务允许区域；
  - 客船场景的入口排序是“先保平顺与储备，再谈提速”。

### 互动升级点

- 主类型：`parametric_sim`
- 互动组件：
  - 上部为四联图参数联动画板；
  - 下部为三字段结构化填写区，仅填写“当前主要矛盾 / 必守边界 / 证据来源”。
- 反馈规则：按字段提示缺项与错类，不直接给控制器名称或参数建议。

### 曲线互动镜像说明

- 对应静态图：`4-1-ship-heading-quad.png`
- 基线状态：`K_h=2.25`，默认曲线位置与讲义原图一致。
- 图组排布：`2x2`，阅读顺序固定为“时域 -> 幅频 -> 根轨迹 -> 相频”。
- 控件策略：图像模块下方折叠式控件栏，仅暴露一个共享滑块 `K_h`。
- 折叠策略：`图下折叠控件栏`
- 运行时合同要点：
  - `engine_family = rust_wasm_control_engine`
  - `request_contract` 必含 `caseId=ship_heading`、`outputs`、`timeRange`、`frequencyRange`、`rootLocus`、`referenceProfile`、`feasibleRegion`
  - `axis_policy = fixed_extent`
  - `panel_overlay` 固定显示当前时域指标、交叉频率、双裕度与闭环极点
  - `sampling_policy` 必须写出根轨迹关键点加密采样与轨迹连续性
  - `precision_policy = fixed_2_decimals`

### 埋点与教师数据

- 埋点摘要：`fieldCompletion`、`errorBucket`、`timeOnStep`
- 教师聚合：`field_completion_rate`、`top_error_buckets`

### 预览口径

- 学生页预览：`/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-04`
- 对齐要求：对象框图、四联图和读图卡必须首屏连续可读；学生演示页必须展示真实滑块与真实四联图。

---

## 步骤 05｜对照案例 B：稳定平台为什么把速度排得更前

### 页面骨架

- 模板：`case_study_dashboard`
- 主阅读顺序：
  - `对象/背景`
  - `模型与公式`
  - `图像与曲线`
  - `指标/边界`
  - `判断与任务卡`
- 区域：
  - `object`：对象框图与传函
  - `evidence`：综合图与控件栏
  - `analysis`：短对照读图卡

### 模块清单

- `platform-object-block`：`4-1-platform-pitch-block.png`
- `platform-quad-figure`：稳定平台综合图画板
- `platform-reading-card`：速度优势 / 边界代价 / 证据来源卡

### 固定内容

- 对象区完整写出：
  $$
  P_p(s)=\frac{2960\left(\frac{s}{15}+1\right)}{s\left(\frac{s}{3}+1\right)\left[(1.7s+1)(0.005s+1)(0.001s+1)+100\right]},\qquad
  L_p(s)=K_pP_p(s)
  $$
- 布局说明固定写明：案例 B 保留“根轨迹主视区 + 右侧窄图”的综合图结构，只承担排序重排的短对照职责。
- 读图卡固定写明：
  - 当前工作点速度优势明显；
  - 超调与储备仍未整理到位；
  - 平台场景的入口排序是“先保速度优势，再把超调与储备整理到位”。

### 互动升级点

- 主类型：`parametric_sim`
- 互动组件：
  - 上部为综合图参数联动画板；
  - 下部为三字段结构化填写区，仅填写“速度为何前移 / 哪条边界不能放松 / 代价来自哪类证据”。
- 反馈规则：检查是否同时写到速度优势与边界代价，不扩展为整定课。

### 曲线互动镜像说明

- 对应静态图：`4-1-platform-pitch-quad.png`
- 基线状态：`K_p=5`，默认布局与讲义原图一致，不压扁成普通单图切换。
- 图组排布：`custom-grid`，阅读顺序固定为“主视根轨迹 -> 右侧时域 -> 右侧幅频 -> 右侧相频”。
- 控件策略：图像模块下方折叠式控件栏，仅暴露一个共享滑块 `K_p`。
- 折叠策略：`图下折叠控件栏`
- 运行时合同要点：
  - `engine_family = rust_wasm_control_engine`
  - `request_contract` 必含 `caseId=platform_pitch`、`outputs`、`timeRange`、`frequencyRange`、`rootLocus`、`referenceProfile`、`feasibleRegion`
  - `subplot_mapping` 必须明确根轨迹主视区与右侧三块窄图区的对应关系
  - `axis_policy = fixed_extent`
  - `panel_overlay` 固定显示当前时域指标、双裕度、交叉频率与闭环极点
  - `sampling_policy` 必须写出双根轨迹关键区间加密与连续重排序
  - `precision_policy = fixed_2_decimals`

### 埋点与教师数据

- 埋点摘要：`fieldCompletion`、`errorBucket`、`timeOnStep`
- 教师聚合：`field_completion_rate`、`top_error_buckets`

### 预览口径

- 学生页预览：`/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-05`
- 对齐要求：综合图的特殊布局必须原样保留；学生演示页必须直接显示真实参数联动组件。

---

## 步骤 06｜双案例对照：排序变化来自哪里

### 页面骨架

- 模板：`contrast_summary_board`
- 主阅读顺序：
  - `对照矩阵`
  - `排序结果`
  - `一句话收束`
- 区域：
  - `matrix`：双案例同图异读原生矩阵
  - `sorting`：排序条目拖拽区
  - `summary`：一句话收束卡

### 模块清单

- `case-compare-matrix`：原生表格矩阵
- `sorting-cards`：排序条目卡组
- `summary-card`：一句话收束卡

### 固定内容

- 原生矩阵固定保留四行：
  - 左上时域首先暴露什么；
  - 根轨迹首先提示什么；
  - 幅频首先提示什么；
  - 相频与裕度首先提示什么。
- 收束卡固定写明：
  - 变的是任务优先级，不是基础分析语言；
  - 同一套图在不同场景下会导出不同任务排序。

### 互动升级点

- 主类型：`evidence_board + card_sort`
- 对照矩阵采用原生表格，可逐行高亮。
- 排序区把条目拖入“客船排序”“平台排序”两列。
- 反馈规则：错位时只提示“场景与排序不匹配”。

### 埋点与教师数据

- 埋点摘要：`sortAttempted`、`sortCorrected`、`timeOnStep`
- 教师聚合：`sorting_distribution`、`completion_rate`

### 预览口径

- 学生页预览：`/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-06`
- 对齐要求：原生矩阵与拖拽区必须同屏；不允许退化成纯文字列表。

---

## 步骤 07｜指标角色重组：时域、频域、积分误差各自回答什么

### 页面骨架

- 模板：`formula_table_match`
- 主阅读顺序：
  - `问题分工`
  - `公式与指标`
  - `角色映射`
- 区域：
  - `formula`：积分误差公式卡
  - `tables`：问题卡与角色矩阵
  - `interaction`：三栏配对区

### 模块清单

- `role-question-cards`：三类问题卡
- `integral-index-card`：积分误差公式卡
- `role-matrix-table`：原生角色矩阵
- `role-match-zone`：三栏配对区

### 固定内容

- 三类问题卡固定写明：
  - 过程是否可接受；
  - 离风险边界和任务频带还有多远；
  - 全过程累计付出了什么代价。
- 公式卡固定保留：
  $$
  J_{\mathrm{ISE}}=\int_{0}^{\infty} e^2(t)\,\mathrm{d}t,\qquad
  J_{\mathrm{IAE}}=\int_{0}^{\infty} |e(t)|\,\mathrm{d}t,\qquad
  J_{\mathrm{ITAE}}=\int_{0}^{\infty} t|e(t)|\,\mathrm{d}t
  $$
- 原生矩阵固定保留“硬约束 / 软目标 / 观察指标”的三类角色与典型写法。

### 互动升级点

- 主类型：`triple_match`
- 互动区只负责把典型指标拖到“过程接受度 / 储备边界 / 累计代价”三栏。
- 反馈规则：即时标对错，可重试。

### 埋点与教师数据

- 埋点摘要：`matchAttempted`、`matchCorrected`、`timeOnStep`
- 教师聚合：`common_mismatch_pairs`、`completion_rate`

### 预览口径

- 学生页预览：`/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-07`
- 对齐要求：三类问题卡、积分误差公式和角色矩阵必须先于配对区出现；公式与符号继续采用 LaTeX 渲染。

---

## 步骤 08｜任务分类：硬约束、软目标、观察指标

### 页面骨架

- 模板：`comparison_panel_with_sort`
- 主阅读顺序：
  - `分类规则`
  - `指标卡组`
  - `角色归类`
- 区域：
  - `rules`：分类规则卡
  - `card-bank`：指标与场景条目卡组
  - `sort-area`：三类角色拖拽区

### 模块清单

- `classification-rules`：分类规则卡
- `metric-card-bank`：指标卡组
- `classification-sort`：分类拖拽区

### 固定内容

- 规则卡必须完整写出：
  - 硬约束：不能破，先筛掉不能做的；
  - 软目标：守住底线后继续争取；
  - 观察指标：用来解释代价与后果。
- 指标卡组至少包含：$M_p$、$t_s$、$\gamma$、$\omega_c$、$\omega_b$、$M_r$、积分误差。
- 固定提醒语必须出现：角色由任务背景决定，不由名词本身决定。

### 互动升级点

- 主类型：`card_sort`
- 任务：把两组场景条目拖入三类角色区。
- 反馈规则：先只提示“分类冲突”，答案由教师控制揭示。

### 埋点与教师数据

- 埋点摘要：`attemptCount`、`sortBucket`、`timeOnStep`
- 教师聚合：`bucket_distribution`、`common_sort_errors`

### 预览口径

- 学生页预览：`/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-08`
- 对齐要求：规则卡必须完整落页，拖拽区位于其下，不改写为单选题。

---

## 步骤 09｜任务表达卡工作区：把后续设计输入写全

### 页面骨架

- 模板：`task_card_workspace`
- 主阅读顺序：
  - `模板字段`
  - `证据来源`
  - `任务表达卡填写`
- 区域：
  - `template`：七字段模板卡
  - `evidence`：证据库与示范卡
  - `workspace`：任务表达卡填写区

### 模块清单

- `task-card-template`：原生七字段模板卡
- `evidence-bank`：可引用证据条
- `task-card-example-a`：主场景 A 示例卡
- `task-card-example-b`：案例 B 短对照卡
- `task-card-form`：填写区

### 固定内容

- 七字段固定为：对象、控制目标、最紧矛盾、硬约束、软目标、观察指标、证据来源。
- 五步判断清单固定写明：
  - 当前场景最不能接受的后果是什么；
  - 这些后果先落在哪些指标上；
  - 当前工作点是否进入允许区域；
  - 再改善会先碰到什么代价；
  - 最后再写排序和任务卡。
- 证据库必须同时给出主场景 A 的完整示范口径和案例 B 的短对照口径。

### 互动升级点

- 主类型：`task_card_workspace`
- 模板卡采用原生 HTML，支持七字段逐段显影。
- 学生从证据库拖入或点选证据条，再填写任务表达卡。
- 反馈规则：按字段检查是否遗漏“最紧矛盾”和“证据来源”。

### 埋点与教师数据

- 埋点摘要：`fieldCompletion`、`submissionState`、`timeOnStep`
- 教师聚合：`field_completion_rate`、`submission_overview`、`top_missing_fields`

### 预览口径

- 学生页预览：`/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-09`
- 对齐要求：模板卡、证据库与填写区必须同屏；模板卡不能退化为图片。

---

## 步骤 10｜区域分层：可行域、满意域、最优域不是一步

### 页面骨架

- 模板：`layered_region_board`
- 主阅读顺序：
  - `集合关系`
  - `分层图示`
  - `边界判断`
- 区域：
  - `formula`：集合关系公式卡
  - `diagram`：原生分层图示
  - `decision`：边界判断区

### 模块清单

- `layer-formula-card`：集合关系公式卡
- `layer-diagram`：原生分层图
- `layer-difference-table`：三层差别表
- `layer-judgement`：边界判断区

### 固定内容

- 公式卡固定写明：
  $$
  \mathcal{O}\subseteq\mathcal{S}\subseteq\mathcal{F}
  $$
- 分层图区固定说明：
  - 可行域：先排除不能做；
  - 满意域：当前已经可接受；
  - 最优域：后续课程才有资格比较。
- 三层差别表必须保留“稳定 / 可接受 / 最优”的典型误判对照。

### 互动升级点

- 主类型：`binary_choice`
- 分层图采用原生 SVG，支持逐层点击显影。
- 任务：判断给定说法属于哪一层误判。
- 反馈规则：即时给出错因标签。

### 埋点与教师数据

- 埋点摘要：`selectedOption`、`resultState`、`errorBucket`
- 教师聚合：`option_distribution`、`misconception_rate`

### 预览口径

- 学生页预览：`/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-10`
- 对齐要求：分层图必须为真实可点击图示；不允许退化为纯文字说明。

---

## 步骤 11｜误判检查：稳定不等于完成，可行不等于最优

### 页面骨架

- 模板：`misconception_board`
- 主阅读顺序：
  - `误判卡`
  - `五步清单`
  - `纠偏判断`
- 区域：
  - `cards`：三类误判卡
  - `checklist`：工程判断清单
  - `decision`：纠偏判断区

### 模块清单

- `misconception-cards`：三类误判卡
- `engineering-checklist`：五步原生表格清单
- `misconception-judge`：判断区

### 固定内容

- 三张误判卡固定写明：
  - 稳定 = 任务完成；
  - 所有指标同等重要；
  - 只看一张图就能直接下结论。
- 五步清单固定保留：
  - 当前场景最不能接受的后果是什么；
  - 这些后果会先落在哪些指标上；
  - 当前工作点有没有进入当前任务允许区域；
  - 若继续改善，会先碰到哪类代价；
  - 最后该怎样写成任务书。

### 互动升级点

- 主类型：`binary_choice`
- 误判卡采用原生卡片，可逐张高亮。
- 五步清单采用原生表格，可逐行高亮。
- 任务：判断给定说法属于哪一类误判。
- 反馈规则：即时显示错因标签。

### 埋点与教师数据

- 埋点摘要：`selectedOption`、`resultState`、`errorBucket`
- 教师聚合：`misconception_distribution`、`top_error_buckets`

### 预览口径

- 学生页预览：`/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-11`
- 对齐要求：误判卡与五步清单必须同页可见；教师端只增加聚合统计，不改变学生页布局。

---

## 步骤 12｜后测：先写任务，再谈方法

### 页面骨架

- 模板：`summary_quiz_board`
- 主阅读顺序：
  - `后测题组`
- 区域：
  - `quiz`：后测题组

### 模块清单

- `post-quiz-group`：三题后测

### 固定内容

- 后测题组固定围绕三类判断：
  - 4-1 的出口是任务表达卡；
  - 可行域、满意域和最优域必须分层；
  - 同一套分析图会因工程场景不同读出不同排序。

### 互动升级点

- 主类型：`quiz_group`
- 作答模型：三道客观题，每题独立提交。
- 反馈规则：后测只收束主线，不新增新概念。

### 埋点与教师数据

- 埋点摘要：`attemptCount`、`resultState`、`timeOnStep`
- 教师聚合：`question_distribution`、`completion_rate`、`top_misconceptions`

### 预览口径

- 学生页预览：`/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-12`
- 对齐要求：本页只呈现后测题组；总结内容移至步骤 13。

---

## 步骤 13｜总结：任务表达卡成为后续设计输入

### 页面骨架

- 模板：`summary_quiz_board`
- 主阅读顺序：
  - `课程信息图`
  - `四句带走`
  - `课堂表现统计`
- 区域：
  - `infograph`：课程信息图
  - `summary`：四句带走与后续去向
  - `stats`：个人或班级课堂表现统计

### 模块清单

- `lesson-infograph`：`4-1-info.png`
- `takeaway-cards`：四句带走卡
- `next-step-cards`：后续去向卡
- `course-stat-panel`：课堂表现统计

### 固定内容

- 课程信息图必须位于总结页顶部。
- 四句带走固定写明：
  - 稳定只是设计起点，不是设计终点；
  - 同一套跨域证据会因为工程场景不同而读出不同任务排序；
  - 进入设计前必须把最紧矛盾、硬约束、软目标、观察指标和证据来源写成任务表达卡；
  - 可行域不等于满意域，满意域也不等于最优域。
- 去向卡固定说明：
  - `4-2` 按任务筛选可行结构；
  - `4-3` 按任务卡形成初始方案方向；
  - `4-4` 用失败诊断回看任务表达是否准确。

### 互动升级点

- 主类型：`none`
- 本页不再承担后测提交；学生端显示个人浏览、提交、前后测和参数探索统计，教师端显示班级整体表现统计。

### 埋点与教师数据

- 埋点摘要：`viewed`、`timeOnStep`、`submittedPages`、`parameterSnapshots`
- 教师聚合：`class_summary_stats`

### 预览口径

- 学生页预览：`/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-13`
- 对齐要求：总结页顶部显示课程信息图；学生端显示个人课堂表现统计，教师端显示班级整体表现统计；本页无提交区。
