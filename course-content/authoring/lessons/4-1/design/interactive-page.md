━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
互动页面设计 | 单元 4-1：设计起点：性能指标体系、工程约束与可行域表达
技术栈：Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 文档职责

- 本文件是供人审阅的页面蓝图，只描述页面模板、固定内容、互动组件、反馈规则、教师聚合、AI 边界与学生页预览口径。
- 同目录 [interactive-contract.yaml](./interactive-contract.yaml) 是机读契约；两者必须逐步骤一一对应。
- 本课是模块 4 的入口页，不承担控制器选型、参数整定或自动求优。
- 页面总目标固定为：让学生把已有分析证据重写成“目标—约束—优先级—证据来源”的任务表达卡。

## 表述规则

- 页面描述只保留客观结构：区域、模块、文本、公式、图片、表格、互动组件、反馈规则、教师聚合与验收条件。
- 动作化表述禁用：`展示`、`引导`、`让学生`、`教师讲`、`实现时再补`。
- 静态内容优先。互动组件只负责分类、比较、填写和误判纠正，不替代讲义中的核心判断。
- 本课主线固定为：`案例回收 -> 指标角色重组 -> 硬约束/软目标/观察指标 -> 可行域/满意域/最优域 -> 双案例四联图联读 -> 任务表达卡`。

## 全课总览

| 步骤 | 标题 | 页面模板 | 主体布局 | 互动组件 | 学生页预览 |
|------|------|----------|----------|----------|------------|
| step-01 | 回到地图：为什么稳定还不等于任务可接受 | `map_hero_slide` | 路径图 + 主问题卡 + 边界卡 | `none` | `/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-01` |
| step-02 | 学习目标与边界：4-1 只负责写任务书 | `goal_boundary_slide` | 目标卡 + 负责/不负责表 | `none` | `/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-02` |
| step-03 | 前测：为什么“所有指标都重要”不是合格任务书 | `question_stack` | 三题前测 + 提交条 | `quiz_group` | `/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-03` |
| step-04 | 指标角色重组：时域、频域、积分误差分别回答什么 | `formula_table_match` | 三类指标表 + 对应区 | `triple_match` | `/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-04` |
| step-05 | 任务分类：硬约束、软目标、观察指标 | `comparison_panel_with_sort` | 分类规则卡 + 指标卡组 | `card_sort` | `/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-05` |
| step-06 | 区域分层：可行域、满意域、最优域不是一步 | `layered_region_board` | 三层区域图 + 判断卡 | `binary_choice` | `/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-06` |
| step-07 | 主场景 A：客船航向控制的跨域联读 | `case_study_dashboard` | 对象框图 + 四联图 + 读图卡 | `structured_compare` | `/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-07` |
| step-08 | 对照案例 B：稳定平台为什么把速度排得更前 | `case_study_dashboard` | 对象框图 + 综合图 + 对照卡 | `structured_compare` | `/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-08` |
| step-09 | 双案例对照：同一套图，为什么会读出两种排序 | `contrast_summary_board` | 对照矩阵 + 排序卡 | `card_sort` | `/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-09` |
| step-10 | 任务表达卡工作区：把后续设计输入写全 | `task_card_workspace` | 模板卡 + 证据区 + 填写区 | `task_card_workspace` | `/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-10` |
| step-11 | 误判检查：稳定不等于完成，可行不等于最优 | `misconception_board` | 三类误判卡 + 判断区 | `binary_choice` | `/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-11` |
| step-12 | 后测与收束：先写任务，再谈方法 | `summary_quiz_board` | 后测题组 + 小结卡 + 去向卡 | `quiz_group` | `/interactive-learning/courses/unit-4-1-design-task-expression/student/demo?step=step-12` |

## 讲义核心内容映射

| handout_anchor | core_item_type | must_appear_content | target_step | page_mode | interaction_upgrade | media_or_table_ref | acceptance_note |
|---|---|---|---|---|---|---|---|
| `## 一、引入：系统已经稳定，为什么还不能直接开始选控制器` | concept+question | “稳定不等于任务完成”“先写任务，再谈方法”两条开场判断。 | step-01 | static | 无。 | 主问题卡 | 首屏必须出现地图、问题和边界。 |
| `### 2.2 三组常用指标，各自回答不同问题` | concept+table | 时域、频域、积分误差三类指标分别回答什么。 | step-04 | static+interactive | 仅把指标和问题做配对，不增加新推导。 | 表 2 / 表 3 提炼版 | 分类说明必须先静态出现。 |
| `### 2.3 指标的真正角色：硬约束、软目标与观察指标` | concept+table | 三类角色定义、常见写法、在设计中的作用。 | step-05 | static+interactive | 拖拽分类只负责暴露排序误判。 | 表 3 | 分类规则必须先于拖拽区出现。 |
| `### 2.4 可行域：先圈出不能碰的区域，再谈更优方案` 与 `### 3.4 满意域和最优域，还需要再分开一次` | concept+formula | $\mathcal{O}\subseteq\mathcal{S}\subseteq\mathcal{F}$ 与三层分工。 | step-06 | static+interactive | 只判断当前结论属于哪一层，不求参数。 | 公式卡 + 分层图 | 必须明确“4-1 不求最优”。 |
| `### 4.1 案例 A` | case+figure | 客船航向控制对象框图、传递函数、四联图和任务卡。 | step-07 | static+interactive | 结构化比较只负责归纳主矛盾、边界和证据。 | `4-1-ship-heading-block.png` / `4-1-ship-heading-quad.png` | 对象框图与四联图必须同页可见。 |
| `### 4.2 案例 B` | case+figure | 稳定平台对象框图、特殊布局综合图和任务卡。 | step-08 | static+interactive | 结构化比较只负责指出排序为何重排。 | `4-1-platform-pitch-block.png` / `4-1-platform-pitch-quad.png` | 必须保留案例 B 的双根轨迹特征。 |
| `### 4.3 双案例对照` | comparison+table | 同一套图如何读出不同任务排序。 | step-09 | static+interactive | 排序卡只强化对照，不替代表格本体。 | 表 11 | 对照矩阵和排序结果必须同屏。 |
| `### 3.5 从任务表达卡到后续设计输入` 与 `### 5.4 工程判断清单` | procedure+template | 任务表达卡六字段、五步判断清单。 | step-10 | static+interactive | 工作区只填写对象、目标、约束、软目标、证据。 | 表 5 / 表 12 | 模板卡和证据区必须同屏。 |
| `### 5.1-5.3 常见误判` | misconception | 稳定不等于完成；所有指标不等同；单图不能直接下结论。 | step-11 | static+interactive | 二选一判断只用于暴露误区。 | 误判卡 | 三类误判必须完整落页。 |
| `## 六、第五章：本节小结与前后衔接` | summary+quiz | 三句带走 + `4-2/4-3` 去向。 | step-12 | static+quiz | 后测只检验表达能力，不引入选型题。 | 小结卡 | 去向卡与后测题同页。 |

## 步骤 01｜回到地图：为什么稳定还不等于任务可接受

### 页面骨架

- 模板：`map_hero_slide`
- 区域：`header` / `lead` / `summary`

### 模块清单

- `stage-map`：模块 4 路径图
- `core-question-card`：主问题卡
- `boundary-card`：本课边界卡

### 静态承载内容

- 路径图固定高亮 `3-9 -> 4-1 -> 4-2 -> 4-3`。
- 主问题卡固定写明：
  - 系统已经稳定，为什么还不能直接谈方法？
  - 同一组分析证据，为什么会因为场景不同而写出不同任务排序？
- 边界卡固定写明：本课不进入控制器选型、参数整定和自动求优。

### 互动升级点

- 组件类型：`none`

### 埋点与教师数据

- 埋点摘要：`viewed`、`timeOnStep`、`teacherFollowSync`
- 教师聚合：`view_count`、`sync_status`

### AI 边界

- 页面目标：标定 `4-1` 是模块 4 的任务表达入口。
- 允许范围：课程路径、任务表达与分析证据的区别。
- 禁止范围：任何控制器推荐。

## 步骤 02｜学习目标与边界：4-1 只负责写任务书

### 页面骨架

- 模板：`goal_boundary_slide`
- 区域：`goals` / `boundary`

### 静态承载内容

- 四项目标卡固定对应：会重组指标、会分角色、会讲分层、会写任务卡。
- 边界表固定写明：
  - 本课负责：任务语言、优先级、可行域表达、案例联读。
  - 本课不负责：控制结构选择、参数整定、最优解搜索。

### 互动升级点

- 组件类型：`none`

### AI 边界

- 页面目标：建立清晰边界。
- 禁止范围：把 `4-2/4-3` 内容偷渡进来。

## 步骤 03｜前测：为什么“所有指标都重要”不是合格任务书

### 页面骨架

- 模板：`question_stack`
- 区域：`question-stack` / `submit-bar`

### 模块清单

- `pretest-q1`：稳定是否等于完成
- `pretest-q2`：更大带宽是否一定更优
- `pretest-q3`：所有指标都写上是否就算完整

### 静态承载内容

- 三道题干全部明文落页。
- 常见误区提示固定列出：
  - 稳定不是任务完成；
  - 更大带宽未必无条件更好；
  - 没有优先级的任务卡不是合格任务卡。

### 互动升级点

- 组件类型：`quiz_group`
- 作答模型：允许重提一次；教师端区分首答与重提
- 揭示规则：`teacher_toggle`

### AI 边界

- 页面目标：暴露入口误区。
- 禁止范围：直接给答案解释全文。

## 步骤 04｜指标角色重组：时域、频域、积分误差分别回答什么

### 页面骨架

- 模板：`formula_table_match`
- 区域：`formula` / `tables` / `interaction`

### 静态承载内容

- 三组问题卡固定写明：
  - 过程是否可接受；
  - 离风险边界还有多远；
  - 全过程累计代价有多大。
- 保留积分误差三式：
  $$
  J_{\mathrm{ISE}},\quad J_{\mathrm{IAE}},\quad J_{\mathrm{ITAE}}
  $$

### 互动升级点

- 组件类型：`triple_match`
- 任务：把典型指标拖到“过程接受度 / 储备边界 / 累计代价”三栏
- 反馈规则：即时标对错，可重试

### AI 边界

- 页面目标：压实三类指标的功能差异。
- 禁止范围：扩展为优化算法讲解。

## 步骤 05｜任务分类：硬约束、软目标、观察指标

### 页面骨架

- 模板：`comparison_panel_with_sort`
- 区域：`rules` / `card-bank` / `sort-area`

### 静态承载内容

- 规则卡必须完整出现：
  - 硬约束：不能破；
  - 软目标：守住底线后继续争取；
  - 观察指标：用来解释方案后果。
- 指标卡组包含：超调、调节时间、相角裕度、带宽、谐振峰值、积分误差。

### 互动升级点

- 组件类型：`card_sort`
- 任务：把两组场景条目拖入三类角色区
- 反馈规则：先只提示“分类冲突”，答案由教师控制揭示

### AI 边界

- 页面目标：让学生对“角色”而不是“名词”负责。
- 禁止范围：根据角色直接给控制器建议。

## 步骤 06｜区域分层：可行域、满意域、最优域不是一步

### 页面骨架

- 模板：`layered_region_board`
- 区域：`formula` / `diagram` / `decision`

### 静态承载内容

- 公式卡：
  $$
  \mathcal{O}\subseteq\mathcal{S}\subseteq\mathcal{F}
  $$
- 分层图固定说明：
  - 可行域：先排除不能做；
  - 满意域：当前已经可以接受；
  - 最优域：后续再比较。

### 互动升级点

- 组件类型：`binary_choice`
- 任务：判断给定说法属于“可行 / 满意 / 最优”中的哪一层误判
- 反馈规则：错因标签化

### AI 边界

- 页面目标：把入口课边界说透。
- 禁止范围：直接求参数最优解。

## 步骤 07｜主场景 A：客船航向控制的跨域联读

### 页面骨架

- 模板：`case_study_dashboard`
- 区域：`object` / `evidence` / `analysis`

### 模块清单

- `ship-object-block`：`4-1-ship-heading-block.png`
- `ship-quad-figure`：`4-1-ship-heading-quad.png`
- `ship-reading-card`：主矛盾/边界/证据三栏卡

### 静态承载内容

- 传递函数卡完整写出：
  $$
  L_h(s)=\frac{0.0385875}{s(s+0.1)(s+2.14375)}
  $$
- 可行域边界固定写明：$M_p \le 15\%$、$t_s \le 45\,\text{s}$。

### 互动升级点

- 组件类型：`structured_compare`
- 任务：根据四联图填写“当前主要矛盾 / 必守边界 / 当前证据”
- 反馈规则：按字段给出缺项提示

### AI 边界

- 页面目标：把主场景 A 的任务排序压实为“平顺与储备优先，再谈提速”。
- 禁止范围：直接给出控制器名称。

## 步骤 08｜对照案例 B：稳定平台为什么把速度排得更前

### 页面骨架

- 模板：`case_study_dashboard`
- 区域：`object` / `evidence` / `analysis`

### 模块清单

- `platform-object-block`：`4-1-platform-pitch-block.png`
- `platform-quad-figure`：`4-1-platform-pitch-quad.png`
- `platform-reading-card`：速度/阻尼/储备三栏卡

### 静态承载内容

- 当前工作点卡固定写明：高带宽、高速度、超调偏大、储备仍需补足。
- 说明卡固定写明：案例 B 使用“双根轨迹 + 右上双窄图”布局是为了保留快速极点信息。

### 互动升级点

- 组件类型：`structured_compare`
- 任务：指出“为什么速度前移，但边界不能放松”
- 反馈规则：检查是否同时写到速度优势与储备代价

### AI 边界

- 页面目标：让学生区分“排序重排”和“边界失效”。
- 禁止范围：扩展为整定课。

## 步骤 09｜双案例对照：同一套图，为什么会读出两种排序

### 页面骨架

- 模板：`contrast_summary_board`
- 区域：`matrix` / `sorting` / `summary`

### 静态承载内容

- 对照矩阵固定保留四行：
  - 时域暴露的主要矛盾；
  - 根轨迹首先提示的问题；
  - 幅频首先提示的问题；
  - 相频/裕度首先提示的问题。

### 互动升级点

- 组件类型：`card_sort`
- 任务：把两条结论分别拖到“客船排序”和“平台排序”
- 反馈规则：错位时只提示“场景与排序不匹配”

### AI 边界

- 页面目标：压实“语言相同，排序不同”。

## 步骤 10｜任务表达卡工作区：把后续设计输入写全

### 页面骨架

- 模板：`task_card_workspace`
- 区域：`template` / `evidence` / `workspace`

### 模块清单

- `task-card-template`：六字段模板
- `evidence-bank`：可引用证据条
- `task-card-form`：填写区

### 静态承载内容

- 六字段固定为：对象、目标、硬约束、软目标、观察指标、证据来源。
- 判断清单固定写明五步：
  - 先问最不能接受的后果；
  - 再问先落在哪些指标；
  - 再问当前是否进入可行域；
  - 再问继续改善会先碰到什么代价；
  - 最后才写排序。

### 互动升级点

- 组件类型：`task_card_workspace`
- 任务：选择一个案例，填完整张任务表达卡
- 反馈规则：按字段检查是否遗漏“优先级”和“证据来源”

### AI 边界

- 页面目标：形成可交给 `4-2/4-3` 的共用输入。
- 允许范围：误判检查、字段完整性检查。
- 禁止范围：直接给方案。

## 步骤 11｜误判检查：稳定不等于完成，可行不等于最优

### 页面骨架

- 模板：`misconception_board`
- 区域：`cards` / `decision`

### 静态承载内容

- 三张误判卡固定写明：
  - 稳定 = 任务完成；
  - 所有指标同等重要；
  - 单看一张图就能写结论。

### 互动升级点

- 组件类型：`binary_choice`
- 任务：判断给定说法属于哪一类误判
- 反馈规则：即时错因标签

### AI 边界

- 页面目标：在进入 `4-2` 之前清理入口误判。

## 步骤 12｜后测与收束：先写任务，再谈方法

### 页面骨架

- 模板：`summary_quiz_board`
- 区域：`quiz` / `summary` / `next-step`

### 静态承载内容

- 小结卡固定保留三句带走：
  - 稳定只是起点，不是终点；
  - 变的是任务排序，不是基础语言；
  - 四联图联读的出口是任务表达卡。
- 去向卡固定写明：
  - `4-2`：根据任务排序筛结构；
  - `4-3`：根据任务卡写初始方案方向。

### 互动升级点

- 组件类型：`quiz_group`
- 任务：完成 4 道后测题
- 揭示规则：`teacher_toggle`

### AI 边界

- 页面目标：完成本课收束并把学生送到 `4-2/4-3`。
- 禁止范围：提前给出结构选型结论。
