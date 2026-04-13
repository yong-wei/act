━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
互动页面设计 | 单元 4-1：设计起点：性能指标体系、工程约束与可行域表达
技术栈：Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 文档职责

- 本文件是供人审阅的课堂前台页面蓝图，负责固定页面顺序、模板、静态内容、互动方式、反馈口径与验收标准。
- 同目录 [interactive-contract.yaml](./interactive-contract.yaml) 是机读契约；两者必须逐步骤同名、同序、同边界。
- 本课是模块 4 的任务表达入口，先把“场景 -> 证据 -> 排序 -> 任务卡”写清楚，不承担控制器选型、参数整定或最优搜索。
- 页面总目标固定为：学生能够基于双案例跨域证据，写出一张包含“最紧矛盾、硬约束、软目标、观察指标、证据来源”的任务表达卡。

## 表述规则

- 互动课首先承担完整课件职责。每一步都要先把概念、公式、图示、表格和判断语句落成可读页面，再决定是否升级互动。
- 本课主线固定为：`地图定位 -> 同图异读预判 -> 主场景联读 -> 对照案例重排 -> 双案例对照 -> 指标角色回收 -> 任务卡 -> 区域分层 -> 误判清单 -> 后测收束`。
- 双案例页面必须保留“同一套跨域证据、不同任务排序”的核心对照，不能把稳定平台案例扩写成与主场景 A 平行的第二条主线。
- 所有公式统一使用 LaTeX：行内 `$...$`，行间 `$$...$$`。
- AI 信息只作为隐藏式页面上下文交给控灵助手消费，不设计页内显式 AI 模块。
- 互动组件只负责预判、配对、分类、填写、误判暴露与参数联动，不负责替代学生完成控制器判断。

## 全课总览

| 步骤 | 标题 | 页面模板 | 主阅读顺序 | 互动主类型 | 学生页预览 |
|------|------|----------|------------|------------|------------|
| step-01 | 回到地图：稳定不是任务完成 | `map_hero_slide` | 路径定位 -> 主问题 -> 本课边界 | `none` | `/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-01` |
| step-02 | 学习目标与边界：4-1 只负责写任务书 | `goal_boundary_slide` | 学习目标 -> 本课负责 -> 本课不负责 | `none` | `/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-02` |
| step-03 | 同图异读预判：为什么同一套证据会写出两张任务书 | `question_stack` | 场景提示 -> 三题预判 -> 误区提示 | `quiz_group` | `/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-03` |
| step-04 | 主场景 A：客船航向控制先保什么 | `case_study_dashboard` | 对象/背景 -> 模型与公式 -> 图像与曲线 -> 指标/边界 -> 判断与任务卡 | `parameter_slider` | `/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-04` |
| step-05 | 对照案例 B：稳定平台为什么把速度排得更前 | `case_study_dashboard` | 对象/背景 -> 模型与公式 -> 图像与曲线 -> 指标/边界 -> 判断与任务卡 | `parameter_slider` | `/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-05` |
| step-06 | 双案例对照：排序变化来自哪里 | `contrast_summary_board` | 对照矩阵 -> 排序结果 -> 一句话收束 | `card_sort` | `/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-06` |
| step-07 | 指标角色重组：时域、频域、积分误差各自回答什么 | `formula_table_match` | 问题分工 -> 公式与指标 -> 角色映射 | `triple_match` | `/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-07` |
| step-08 | 任务分类：硬约束、软目标、观察指标 | `comparison_panel_with_sort` | 分类规则 -> 指标卡组 -> 角色归类 | `card_sort` | `/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-08` |
| step-09 | 任务表达卡工作区：把后续设计输入写全 | `task_card_workspace` | 模板字段 -> 证据来源 -> 任务表达卡填写 | `task_card_workspace` | `/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-09` |
| step-10 | 区域分层：可行域、满意域、最优域不是一步 | `layered_region_board` | 集合关系 -> 分层图示 -> 边界判断 | `binary_choice` | `/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-10` |
| step-11 | 误判检查：稳定不等于完成，可行不等于最优 | `misconception_board` | 误判卡 -> 四格联读顺序 -> 纠偏判断 | `binary_choice` | `/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-11` |
| step-12 | 后测与收束：先写任务，再谈方法 | `summary_quiz_board` | 后测题组 -> 四句带走 -> 后续去向 | `quiz_group` | `/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-12` |

## 讲义证据单元映射

| handout_anchor | evidence_unit_id | evidence_kind | must_appear_content | target_step | page_mode | interaction_archetype | media_or_table_ref | acceptance_note |
|---|---|---|---|---|---|---|---|---|
| `## 一、回到地图：同一套跨域证据，为什么会写出两张不同任务书` | `eu-01-entry-question` | `concept_card` | “稳定不是任务完成”“4-1 先写任务，再谈方法”两条开场判断。 | step-01 | static | `entry_overview` | 主问题卡 | 首屏必须同时出现地图、主问题卡与边界卡。 |
| `## 二、先做“同图异读”，再回收最小指标语言` | `eu-02-prejudge` | `diagnostic_prompt` | 以双案例预判题压出“同图异读”主问题。 | step-03 | static+interactive | `diagnostic_quiz` | 预判题组 | 三题必须围绕“排序为何变化”而不是名词记忆。 |
| `### 2.1 主场景 A：客船航向控制为什么先保平顺与储备` | `eu-03-ship-figure` | `curve_figure` | 客船对象框图、传递函数、四联图与入口排序。 | step-04 | static+interactive | `parametric_sim` | `4-1-ship-heading-block.png` / `4-1-ship-heading-quad.png` | 对象框图、参数联动图和任务判断必须同页可见。 |
| `### 2.2 对照案例 B：为什么稳定平台会把速度与带宽排得更前` | `eu-04-platform-figure` | `curve_figure` | 稳定平台对象框图、综合图与短对照排序。 | step-05 | static+interactive | `parametric_sim` | `4-1-platform-pitch-block.png` / `4-1-platform-pitch-quad.png` | 必须保留案例 B 的原图布局和“快但不够稳健”定位。 |
| `### 2.3 为什么同一套图，会读出两种任务排序` | `eu-05-compare-matrix` | `comparison_table` | 双案例同图异读对照矩阵。 | step-06 | static+interactive | `evidence_reorder` | 表 4 / `4-1-case-compare-summary.png` | 对照矩阵和排序结果必须同屏。 |
| `### 3.1 三类常用指标，各自回答不同问题` | `eu-06-role-language` | `formula_table` | 时域、频域、积分误差类指标分别回答什么；保留 `ISE/IAE/ITAE` 三式。 | step-07 | static+interactive | `concept_role_mapping` | 表 5 / `4-1-indicator-role-matrix.png` | 三类问题卡必须先于互动区出现。 |
| `### 3.2 指标真正进入设计时，会变成三种角色 / ### 3.3 为什么“所有指标都重要”不是合格任务书` | `eu-07-role-classification` | `classification_rule` | 硬约束、软目标、观察指标三类角色与排序误判。 | step-08 | static+interactive | `role_classification` | 表 5 / 角色规则卡 | 分类规则必须先于拖拽区出现。 |
| `### 4.1 一张合格的任务表达卡，至少要写清七项内容 / ### 6.4 工程判断清单：从跨域读图走到任务书` | `eu-08-task-card` | `task_card` | 任务表达卡七字段与五步判断清单。 | step-09 | static+interactive | `task_card_workspace` | 表 6 / `4-1-task-card-template.png` | 模板卡和证据库必须同屏。 |
| `## 五、可行域、满意域与最优域必须分层` | `eu-09-region-layer` | `region_formula` | `$\mathcal{O}\subseteq\mathcal{S}\subseteq\mathcal{F}$` 与“4-1 不求最优”。 | step-10 | static+interactive | `layer_judgement` | 表 10 / `4-1-region-layering.png` | 必须明确“稳定 != 可接受 != 最优”。 |
| `## 六、常见误判与工程判断清单` | `eu-10-misconception` | `misconception_card` | 三类常见误判与四格联读顺序。 | step-11 | static+interactive | `misconception_diagnosis` | 误判卡 / 表 11 | 三类误判必须完整落页。 |
| `## 七、本节小结与衔接 / ### 7.4 一页带走 / ### 7.5 课后自检` | `eu-11-summary-exit` | `summary_quiz` | 四句带走、后测、`4-2/4-3` 去向。 | step-12 | static+quiz | `summary_quiz` | 小结卡 / 去向卡 | 总结页必须同时出现带走语句与去向卡。 |

## 步骤 01｜回到地图：稳定不是任务完成

### 页面骨架

- 模板：`map_hero_slide`
- 区域：`header` / `lead` / `summary`

### 主阅读顺序

- `路径定位` -> `主问题` -> `本课边界`

### 模块清单

- `stage-map`：模块 4 路径图
- `core-question-card`：主问题卡
- `boundary-card`：本课边界卡

### 静态承载内容

- 路径图固定高亮 `3-9 -> 4-1 -> 4-2 -> 4-3`，把 4-1 标为“任务表达入口”。
- 主问题卡固定写明：
  - 系统已经稳定，为什么还不能直接谈方法？
  - 同一套跨域证据，为什么会写出不同任务排序？
- 边界卡固定写明：本课只写任务，不进入结构选型、参数整定和自动求优。

### 互动升级点

- 组件类型：`none`

### AI 边界

- 页面目标：建立模块 4 的入口定位。
- 允许范围：课程路径、分析语言与任务语言的区别。
- 禁止范围：任何控制器推荐。

## 步骤 02｜学习目标与边界：4-1 只负责写任务书

### 页面骨架

- 模板：`goal_boundary_slide`
- 区域：`goals` / `boundary`

### 主阅读顺序

- `学习目标` -> `本课负责` -> `本课不负责`

### 模块清单

- `goal-cards`：四项目标卡
- `boundary-table`：负责/不负责对照表

### 静态承载内容

- 四项目标卡固定写明：
  - 会解释为什么同一套证据会导出不同排序；
  - 会区分时域、频域、积分误差类指标各自回答什么；
  - 会把指标改写成硬约束、软目标和观察指标；
  - 会写出可交给 `4-2/4-3/4-4` 的任务表达卡。
- 边界表固定写明：
  - 本课负责：双案例联读、指标角色回收、任务卡、区域分层、误判清单；
  - 本课不负责：控制结构选择、参数方向试探、最优解搜索。

### 互动升级点

- 组件类型：`none`

### AI 边界

- 页面目标：把 4-1 与后续课次的边界立住。
- 禁止范围：提前讨论 `4-2/4-3` 的方案判断。

## 步骤 03｜同图异读预判：为什么同一套证据会写出两张任务书

### 页面骨架

- 模板：`question_stack`
- 区域：`question-stack` / `submit-bar`

### 主阅读顺序

- `场景提示` -> `三题预判` -> `误区提示`

### 模块清单

- `pretest-q1`：客船场景最先要守住什么
- `pretest-q2`：稳定平台场景为什么不能只盯着速度
- `pretest-q3`：同一套图为何不能写成同一张任务书

### 静态承载内容

- 三道题干全部明文落页，并在题干中明确引用“客船航向控制”和“稳定平台”两个对象。
- 题干只问三类判断：
  - 当前最不能接受的后果是什么；
  - 哪类指标应当先前移；
  - 为什么“所有指标都重要”不是设计入口。
- 误区提示固定列出：
  - 稳定不是任务完成；
  - 更大带宽不是无条件更优；
  - 没有排序的任务卡不能交给后续课。

### 互动升级点

- 组件类型：`quiz_group`
- 作答模型：允许重提一次；教师端区分首答与重提。
- 揭示规则：`teacher_toggle`

### AI 边界

- 页面目标：先暴露“同图异读”入口误区。
- 禁止范围：替学生给出完整结论。

## 步骤 04｜主场景 A：客船航向控制先保什么

### 页面骨架

- 模板：`case_study_dashboard`
- 区域：`object` / `evidence` / `analysis`

### 主阅读顺序

- `对象/背景` -> `模型与公式` -> `图像与曲线` -> `指标/边界` -> `判断与任务卡`

### 模块清单

- `ship-object-block`：`4-1-ship-heading-block.png`
- `ship-quad-figure`：`4-1-ship-heading-quad.png`
- `ship-reading-card`：主矛盾/边界/证据三栏卡

### 静态承载内容

- 对象区完整写出：
  $$
  P_h(s)=\frac{0.01715}{s(s+0.1)(s+2.14375)},\qquad
  L_h(s)=\frac{0.0385875}{s(s+0.1)(s+2.14375)}
  $$
- 四联图区旁固定写明入口边界：
  $$
  M_p \le 15\%,\qquad t_s \le 45\,\text{s}
  $$
- 读图卡必须把三条判断写实：
  - 当前系统稳定，但过程偏冲、偏拖；
  - 设计点还未进入当前任务可接受区域；
  - 客船场景的入口排序是“平顺与储备优先，再谈提速”。

### 互动升级点

- 主类型：`parameter_slider`
- 参数联动区负责在讲义基线状态上联动显示客船四联图，允许学生围绕同一结构调节关键增益并观察时域、根轨迹、幅频与相频/裕度同步变化。
- 结构化比较卡保留为次级工作区，只负责填写“当前主要矛盾 / 必守边界 / 当前证据来源”。
- 反馈规则：按字段提示缺项，不直接给控制器答案。

### 曲线互动镜像说明

- 对应静态图：`4-1-ship-heading-quad.png`
- 默认状态：保持讲义基线参数 `K_h=2.25`，四联图初始曲线位置与 handout 完全一致。
- 图组排布：默认保持 `2×2` 四联图阅读语义；窄屏仅做响应式重排，不改变阅读顺序。
- 控件策略：图像模块下方使用折叠式控件栏；当前步骤只暴露一个共享参数滑块，不额外拆分同类结构开关。
- 可达状态：至少覆盖讲义中的基线工作点与“继续提速会压紧储备”的关键变化区间。

### AI 边界

- 页面目标：把主场景 A 的排序压实为“先进入可接受区域，再谈速度”。
- 交付方式：隐藏式页面上下文，仅供控灵助手消费。
- 禁止范围：直接给出结构名称。

## 步骤 05｜对照案例 B：稳定平台为什么把速度排得更前

### 页面骨架

- 模板：`case_study_dashboard`
- 区域：`object` / `evidence` / `analysis`

### 主阅读顺序

- `对象/背景` -> `模型与公式` -> `图像与曲线` -> `指标/边界` -> `判断与任务卡`

### 模块清单

- `platform-object-block`：`4-1-platform-pitch-block.png`
- `platform-quad-figure`：`4-1-platform-pitch-quad.png`
- `platform-reading-card`：速度/超调/储备三栏卡

### 静态承载内容

- 对象区完整写出：
  $$
  P_p(s)=\frac{2960\left(\frac{s}{15}+1\right)}{s\left(\frac{s}{3}+1\right)\left[(1.7s+1)(0.005s+1)(0.001s+1)+100\right]},\qquad
  L_p(s)=K_pP_p(s)
  $$
- 说明卡固定写明：案例 B 保留“双根轨迹 + 右上双窄图”的综合布局，只服务“排序重排”的短对照功能。
- 读图卡必须把三条判断写实：
  - 当前工作点速度优势明显；
  - 超调与储备仍未整理到位；
  - 平台场景的入口排序是“先保速度优势，再把超调与储备整理到位”。

### 互动升级点

- 主类型：`parameter_slider`
- 参数联动区负责镜像案例 B 的综合图，保留原图中的“根轨迹主视区 + 压缩幅相窄图”结构，让学生通过关键参数调节观察速度优势与储备代价的联动。
- 结构化比较卡保留为次级工作区，只负责填写“速度为何前移 / 哪条边界不能放松 / 当前代价来自哪类证据”。
- 反馈规则：检查是否同时写到速度优势与边界代价。

### 曲线互动镜像说明

- 对应静态图：`4-1-platform-pitch-quad.png`
- 默认状态：保持 handout 中案例 B 的基线工作点与原图结构，不把综合图压扁成普通单图切换。
- 图组排布：保留讲义原有的“综合图”阅读结构，默认先看主视根轨迹，再看压缩幅相窄图。
- 控件策略：图像模块下方使用折叠式控件栏；当前步骤优先暴露一个共享参数滑块，后续若加入结构变化，再增加结构勾选与各自参数滑块。
- 可达状态：至少覆盖“速度优势仍在”和“储备进一步压紧”两类典型状态。

### AI 边界

- 页面目标：让学生区分“排序重排”和“边界失效”不是一回事。
- 交付方式：隐藏式页面上下文，仅供控灵助手消费。
- 禁止范围：扩展为整定课。

## 步骤 06｜双案例对照：排序变化来自哪里

### 页面骨架

- 模板：`contrast_summary_board`
- 区域：`matrix` / `sorting` / `summary`

### 主阅读顺序

- `对照矩阵` -> `排序结果` -> `一句话收束`

### 模块清单

- `case-compare-matrix`：双案例同图异读对照矩阵
- `sorting-cards`：排序条目卡组
- `summary-card`：一句话收束卡

### 静态承载内容

- 对照矩阵固定保留四行：
  - 左上时域首先暴露什么；
  - 根轨迹首先提示什么；
  - 幅频首先提示什么；
  - 相频与裕度首先提示什么。
- 总结卡固定写明：
  - 变的是任务优先级，不是基础分析语言；
  - 同一套图在不同场景下会导出不同任务排序。

### 互动升级点

- 组件类型：`card_sort`
- 任务：把结论条目拖到“客船排序”或“平台排序”。
- 反馈规则：错位时只提示“场景与排序不匹配”。

### AI 边界

- 页面目标：把“同图异读”从案例现象压成稳定结论。
- 禁止范围：跨案例给统一方案。

## 步骤 07｜指标角色重组：时域、频域、积分误差各自回答什么

### 页面骨架

- 模板：`formula_table_match`
- 区域：`formula` / `tables` / `interaction`

### 主阅读顺序

- `问题分工` -> `公式与指标` -> `角色映射`

### 模块清单

- `role-question-cards`：三类问题卡
- `integral-index-card`：积分误差公式卡
- `role-match-zone`：指标配对区

### 静态承载内容

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
- 静态说明必须明确：这里回收的是最小指标语言，不展开为优化算法专题。

### 互动升级点

- 组件类型：`triple_match`
- 任务：把典型指标拖到“过程接受度 / 储备边界 / 累计代价”三栏。
- 反馈规则：即时标对错，可重试。

### AI 边界

- 页面目标：把三类指标的功能差异压实。
- 禁止范围：扩展为最优化课程。

## 步骤 08｜任务分类：硬约束、软目标、观察指标

### 页面骨架

- 模板：`comparison_panel_with_sort`
- 区域：`rules` / `card-bank` / `sort-area`

### 主阅读顺序

- `分类规则` -> `指标卡组` -> `角色归类`

### 模块清单

- `classification-rules`：分类规则卡
- `metric-card-bank`：指标卡组
- `classification-sort`：分类拖拽区

### 静态承载内容

- 规则卡必须完整出现：
  - 硬约束：不能破，先筛掉不能做的；
  - 软目标：守住底线后继续争取；
  - 观察指标：用来解释代价与后果。
- 指标卡组至少包含：$M_p$、$t_s$、$\gamma$、$\omega_c$、$\omega_b$、$M_r$、积分误差。
- 固定提醒语必须出现：同一个指标名称能扮演什么角色，不由名词本身决定，而由任务背景决定。

### 互动升级点

- 组件类型：`card_sort`
- 任务：把两组场景条目拖入三类角色区。
- 反馈规则：先只提示“分类冲突”，答案由教师控制揭示。

### AI 边界

- 页面目标：把“指标名称”改写成“任务角色”。
- 禁止范围：根据角色直接给控制器建议。

## 步骤 09｜任务表达卡工作区：把后续设计输入写全

### 页面骨架

- 模板：`task_card_workspace`
- 区域：`template` / `evidence` / `workspace`

### 主阅读顺序

- `模板字段` -> `证据来源` -> `任务表达卡填写`

### 模块清单

- `task-card-template`：七字段模板卡
- `evidence-bank`：可引用证据条
- `task-card-form`：填写区

### 静态承载内容

- 七字段固定为：对象、控制目标、最紧矛盾、硬约束、软目标、观察指标、证据来源。
- 判断清单固定写明五步：
  - 当前场景最不能接受的后果是什么；
  - 这些后果先落在哪些指标上；
  - 当前工作点是否进入允许区域；
  - 继续改善会先碰到什么代价；
  - 最后再写排序和任务卡。
- 页面必须同时给出主场景 A 的完整示范口径和案例 B 的短对照口径。

### 互动升级点

- 组件类型：`task_card_workspace`
- 任务：任选一个案例，完整填写任务表达卡。
- 反馈规则：按字段检查是否遗漏“最紧矛盾”和“证据来源”。

### AI 边界

- 页面目标：形成可交给 `4-2/4-3/4-4` 的统一输入卡。
- 允许范围：字段完整性检查、误判提醒。
- 禁止范围：直接生成控制器方案。

## 步骤 10｜区域分层：可行域、满意域、最优域不是一步

### 页面骨架

- 模板：`layered_region_board`
- 区域：`formula` / `diagram` / `decision`

### 主阅读顺序

- `集合关系` -> `分层图示` -> `边界判断`

### 模块清单

- `layer-formula-card`：集合关系公式卡
- `layer-diagram`：分层示意图
- `layer-judgement`：分层判断区

### 静态承载内容

- 公式卡固定写明：
  $$
  \mathcal{O}\subseteq\mathcal{S}\subseteq\mathcal{F}
  $$
- 分层图固定说明：
  - 可行域：先排除不能做；
  - 满意域：当前已经可接受；
  - 最优域：后续课程才有资格比较。
- 页面必须明确写出：4-1 只把边界画到“当前可接受”，不能直接把“稳定”写成“已经最优”。

### 互动升级点

- 组件类型：`binary_choice`
- 任务：判断给定说法属于哪一层误判。
- 反馈规则：即时给出错因标签。

### AI 边界

- 页面目标：把“稳定 != 可接受 != 最优”说透。
- 禁止范围：直接求参数最优解。

## 步骤 11｜误判检查：稳定不等于完成，可行不等于最优

### 页面骨架

- 模板：`misconception_board`
- 区域：`cards` / `decision`

### 主阅读顺序

- `误判卡` -> `四格联读顺序` -> `纠偏判断`

### 模块清单

- `misconception-cards`：三类误判卡
- `misconception-judge`：判断区

### 静态承载内容

- 三张误判卡固定写明：
  - 稳定 = 任务完成；
  - 所有指标同等重要；
  - 只看一张图就能直接下结论。
- 旁侧必须给出四格联读顺序提示：
  - 先看时域暴露什么；
  - 再看根轨迹与可行域；
  - 再看幅频给出的工作频带；
  - 最后看相频与裕度代价。

### 互动升级点

- 组件类型：`binary_choice`
- 任务：判断给定说法属于哪一类误判。
- 反馈规则：即时显示错因标签。

### AI 边界

- 页面目标：在进入 `4-2` 之前清理入口误判。
- 禁止范围：把误判题变成选型题。

## 步骤 12｜后测与收束：先写任务，再谈方法

### 页面骨架

- 模板：`summary_quiz_board`
- 区域：`quiz` / `summary` / `next-step`

### 主阅读顺序

- `后测题组` -> `四句带走` -> `后续去向`

### 模块清单

- `post-quiz-group`：后测题组
- `summary-card`：四句带走
- `engineering-checklist-card`：工程判断清单
- `next-step-card`：去向卡

### 静态承载内容

- 小结卡固定保留四句带走：
  - 稳定只是设计起点，不是设计终点；
  - 同一套跨域证据，会因为场景不同而读出不同任务排序；
  - 真正进入设计前，必须先写清最紧矛盾、硬约束、软目标、观察指标和证据来源；
  - 可行域不等于满意域，满意域不等于最优域。
- 工程判断清单卡固定保留五步判断顺序。
- 去向卡固定写明：
  - `4-2`：根据任务排序讨论结构适配逻辑；
  - `4-3`：根据任务卡讨论初始参数方向；
  - `4-4`：根据任务卡回看首轮失败诊断。

### 互动升级点

- 组件类型：`quiz_group`
- 任务：完成 4 道后测题。
- 揭示规则：`teacher_toggle`

### AI 边界

- 页面目标：完成本课收束并把学生送到 `4-2/4-3/4-4`。
- 禁止范围：提前给出结构选型结论。
