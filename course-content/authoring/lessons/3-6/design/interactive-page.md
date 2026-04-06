━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
互动页面设计 | 单元 3-6：零点作用与动态改善实验——从性能目标到校正设计
技术栈：Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 文档职责
- 本文件是供人审阅的页面蓝图，只描述页面模板、固定内容、互动组件、反馈规则、教师聚合、AI 边界与学生页预览口径。
- 同目录 [interactive-contract.yaml](./interactive-contract.yaml) 是机读契约；两者必须逐步骤一一对应。
- 本文件不是讲义摘要，不写教师口播，不把公式、图表、任务链或验收标准留给实现阶段临场补充。
- 默认预览口径固定为学生演示页；教师端模板弹窗只用于查看课堂骨架，不代替真实页面预览。

## 表述规则
- 页面描述只保留客观结构：区域、模块、文本、公式、图片、表格、互动组件、反馈规则、聚合数据与验收条件。
- 动作化表述禁用：`展示`、`引导`、`让学生`、`教师讲`、`先做一次`、`跟随推导` 等。
- 静态内容优先。互动组件只负责判断、翻译、记录、比较、验收与边界决策，不能替代核心概念、公式、图表和结论。
- 本课主线固定为：`目标分类 -> 指标翻译 -> 时域 PD -> 时域测速反馈 -> 频域超前 -> 同指标下的 PD -> 非最小相边界选择`。

## 全课总览
| 步骤 | 标题 | 页面模板 | 主体布局 | 互动组件 | 学生页预览 |
|------|------|----------|----------|----------|------------|
| step-01 | 封面导入：为什么今天必须先定目标 | `binary_choice_illustration` | 封面媒体 + 核心追问 + 首反应选择 | `single_choice` | `/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-01` |
| step-02 | 回到地图：从零点机理切到校正设计 | `map_hero_slide` | 路径图 + 主线卡 + 边界卡 | `none` | `/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-02` |
| step-03 | 本节目标与五任务设计链 | `goal_chain_slide` | 目标卡 + 任务链 + 产出卡 | `none` | `/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-03` |
| step-04 | 前测：你会怎样从指标进入设计 | `question_stack` | 三题前测 + 理由栏 + AI 锁定提示 | `quiz_group` | `/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-04` |
| step-05 | 任务书：固定对象、两类目标与交付记录 | `table_plus_prompt` | 对象卡 + 目标表 + 任务书提示卡 | `categorize_and_confirm` | `/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-05` |
| step-06 | 工作区 A：把时域指标翻译成设计可行域 | `constraint_translation_workspace` | 公式卡 + 复平面工作区 + 记录表 | `workspace_builder` | `/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-06` |
| step-07 | 工作区 B：`PD` 时域设计 | `tri_panel_design_workspace` | 任务链卡 + 三面板工作区 + 验收卡 | `parameter_workspace` | `/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-07` |
| step-08 | 工作区 C：测速反馈时域设计 | `structure_formula_workspace` | 结构图 + 公式卡 + 三面板工作区 | `parameter_workspace` | `/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-08` |
| step-09 | 工作区 D：超前频域设计 | `bode_design_workspace` | 设计链卡 + Bode 工作区 + 回查卡 | `parameter_workspace` | `/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-09` |
| step-10 | 工作区 E：同一频域指标下的 `PD` 设计 | `dual_solution_compare_workspace` | 指标卡 + Bode 工作区 + 并排比较卡 | `structured_compare` | `/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-10` |
| step-11 | 工作区 F：非最小相边界与结构选择 | `boundary_decision_workspace` | 边界对象卡 + 风险图 + 选择矩阵 | `decision_submit` | `/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-11` |
| step-12 | 后测：设计链和边界是否分清 | `post_quiz_stack` | 三题后测 + 一句解释 + AI 对照区 | `quiz_group` | `/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-12` |
| step-13 | 收束：从指标走到结构选择 | `summary_infographic` | 三句结论 + 信息图 + 去向卡 | `exit_reflection` | `/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-13` |

> 核心互动承接：`step-04` 到 `step-12` 中，学生完成前测、目标分类、指标翻译、五个任务工作区记录、边界选择与后测，累计约 `58` 分钟；其中 `step-06` 到 `step-11` 的实操主工作区累计约 `54` 分钟。

## 讲义核心内容映射
| handout_anchor | core_item_type | must_appear_content | target_step | page_mode | interaction_upgrade | media_or_table_ref | acceptance_note |
|---|---|---|---|---|---|---|---|
| `### 1.1 上一课的成果与本课的挑战` | concept+bridge | 从 `3-5` 的零点机理切到 `3-6` 的目标驱动设计，明确“知道会变”还不够，必须会把指标翻译成设计动作。 | `step-02` | `static` | 无，保持路径图、主线卡和边界卡同屏。 | `课程路径图` | 页面首屏必须看出 `3-5 -> 3-6 -> 3-7` 的链条。 |
| `### 1.2 本课主线` | concept+workflow | 五任务链：时域 `PD`、时域测速反馈、频域超前、同指标下的 `PD`、非最小相边界选择。 | `step-03` | `static` | 无，任务链只做结构化落页。 | `任务链卡` | 五个任务必须完整写出，不得缩成“若干设计任务”。 |
| `### 1.3 [AI融入点] 先做一次“目标翻译”预测` | ai-boundary | 先独立判断，再允许查看 AI 对照；AI 只做错因对照，不代替学生进入设计。 | `step-04` | `static+quiz` | 前测提交完成后才开放 AI 对照。 | `前测区` | AI 锁定提示必须先于 AI 入口出现。 |
| `### 2.1 示例系统 / ### 2.3 五个设计任务` | concept+table | $$G_p(s)=\frac{4}{s(s+0.8)}$$ 以及五个任务分别对应的两类目标与推荐工具。 | `step-05` | `static+classification` | 分类组件只负责把时域目标和频域目标分到对应入口。 | `3-6-design-map.png` | 对象公式、任务表和入口分类必须同屏。 |
| `### 2.4 将时域指标翻译为目标区域` | formula+workspace | $$M_p=e^{-\frac{\zeta\pi}{\sqrt{1-\zeta^2}}}\times100\%$$，$$t_s \approx \frac{4}{\zeta\omega_n}$$，以及 $\zeta \ge 0.456$、$\operatorname{Re}(s)\le -1$。 | `step-06` | `static+workspace` | 工作区只负责填写目标区域和纯增益失败原因，不替代公式本体。 | `复平面目标区域叠加工具` | 两条公式和两个翻译结论必须完整落页。 |
| ### 3.1 先选设计点，而非先猜零点 / ### 3.2 用相角条件反推零点位置 / ### 3.3 用模值条件求增益与闭环验收 | formula+design | $$s_d=-1.1\pm j1.67$$，$$G_{PD}(s)=K(1+T_d s)$$，以及 `T_d≈0.35`、`K≈1.00` 的验收链。 | `step-07` | `static+workspace` | 三面板工作区只负责调参、验收和记录，不省略设计点与控制器公式。 | `3-6-pd-design.png` | 设计点、控制器形式和验收指标必须同时可见。 |
| `### 4.1 将测速反馈改写成广义根轨迹问题 / ### 4.2 用等效极点位置反推 $K_t$ / ### 4.3 由模值条件选定 $K$` | formula+design | $$U(s)=K E(s)-K_t sY(s)$$，$$1+\frac{4K}{s(s+0.8+4K_t)}=0$$，以及“先定等效极点，再求 $K_t$”的顺序。 | `step-08` | `static+workspace` | 交互只负责填写顺序、调节参数和提交解释，不替代公式卡。 | `3-6-pd-rate-structure.png / 3-6-rate-feedback-design.png` | 结构图、等效特征方程和顺序提醒必须同屏。 |
| `### 5.1 固定频域目标，并说明为何任务 D 沿用 / ### 5.2 第一步：计算所需最大超前角 / ### 5.3 第二步：将最大超前角布置到目标截止频率` | formula+design | $$PM \ge 50^\circ,\qquad \omega_c \approx 3\,\text{rad/s}$$，$$G_{lead}(s)=K_c\frac{aTs+1}{Ts+1}$$，以及“先补角，再布置频带”的顺序。 | `step-09` | `static+workspace` | 工作区只负责选取 `a,T,K_c` 并回查阶跃，不替代目标卡与控制器形式。 | `3-6-lead-design.png` | 频域目标和超前形式必须在工作区上方静态呈现。 |
| ### 6.1 为何要在同一指标下再做一次 `PD` / ### 6.2 第一步：沿用任务 C 的基准频率点 / ### 6.3 第二步：由相角条件直接求 $T_d$ | formula+compare | $$PM \ge 50^\circ,\qquad \omega_c \approx 3\,\text{rad/s}$$ 与“同指标下比较超前和 `PD` 的时域副作用”必须同时落页。 | `step-10` | `static+compare` | 并排比较组件只负责记录差异，不替代共同目标卡。 | `3-6-pd-frequency-design.png` | 相同指标卡和并排比较卡必须同屏。 |
| ### 7.1 明确边界对象 / ### 7.2 非最小相对象的设计难点 / ### 7.3 在非最小相对象上如何选择 `PD`、测速反馈和超前 | formula+boundary | $$G_{nmp}(s)=\frac{4(1-0.3s)}{s(s+0.8)}$$，以及“先改目标，再选结构”的边界结论。 | `step-11` | `static+decision` | 选择矩阵只负责提交理由与结构选择，不替代边界对象和风险图。 | `3-6-rhp-boundary.png` | 边界对象公式、风险图和结构选择矩阵必须同屏。 |
| `## 八、本课小结与前后衔接` | summary | 三句收束：时域先翻译成区域，频域先翻译成补角与交叉频率，非最小相先重审目标。 | `step-13` | `static+reflection` | 退出反思只收一句个人总结。 | `3-6-info.png` | 信息图和三句结论必须一起出现。 |

## 步骤 01｜封面导入：为什么今天必须先定目标

### 页面骨架
- 模板：`binary_choice_illustration`
- 区域：
  - `media`：封面图或导入视频
  - `question`：核心追问
  - `interaction`：第一反应选择

### 模块清单
- `cover-media`：`3-6-cover-comic.png` 或 `3-6-intro-video.mp4`
- `core-question-card`：导入追问卡
- `first-reaction-choice`：首反应单选组件

### 静态承载内容
- 核心追问固定写明：为什么同样都在“引入零点相关装置”，有时入口是目标极点区域，有时入口却是相角裕度与截止频率。
- 封面副标题固定写明：本课不再停留在“零点会不会改善”，而是进入“目标如何驱动结构与参数选择”。

### 互动升级点
- 组件类型：`single_choice`
- 选项固定为：
  - A：先看根轨迹
  - B：先看 `Bode` 图
  - C：先看目标是什么
- 正确项：`C`
- 反馈规则：只提示“本课入口先按目标分类，再进入工具”，不提前公布后续设计结果。

### 埋点与教师数据
- 埋点摘要：`selectedOption`、`resultState`、`teacherRevealSeen`
- 教师聚合：`option_distribution`、`goal_entry_confusion_rate`

### AI 边界
- 页面目标：打破“先上某张图再说”的惯性。
- 允许范围：目标、入口、设计工具分类。
- 禁止范围：直接给出五任务的参数结果。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-01`
- 对齐要求：封面媒体、核心追问和选择按钮在首屏同时可见。

## 步骤 02｜回到地图：从零点机理切到校正设计

### 页面骨架
- 模板：`map_hero_slide`
- 区域：
  - `header`：路径图
  - `lead`：主线切换卡
  - `summary`：本课边界卡

### 模块清单
- `stage-map`：模块 3 路径图
- `bridge-card`：从 `3-5` 到 `3-6` 的切换卡
- `boundary-card`：本课边界说明

### 静态承载内容
- 路径图固定高亮 `3-5 -> 3-6 -> 3-7`。
- 切换卡固定写明：`3-5` 回答“零点为什么能改动态”，`3-6` 回答“指标如何驱动结构与参数”，`3-7` 再进入稳态改善线。
- 边界卡固定写明：本课只做目标驱动设计与边界判断，不展开模块 4 的完整方案整定。

### 互动升级点
- 组件类型：`none`
- 提交态：无
- 揭示规则：无

### 埋点与教师数据
- 埋点摘要：`viewed`、`timeOnStep`、`teacherFollowSync`
- 教师聚合：`view_count`、`sync_status`

### AI 边界
- 页面目标：标定本课在模块 3 中的位置。
- 允许范围：前后课关系、主线切换、边界。
- 禁止范围：提前进入具体计算。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-02`
- 对齐要求：路径图、主线卡和边界卡必须同屏。

## 步骤 03｜本节目标与五任务设计链

### 页面骨架
- 模板：`goal_chain_slide`
- 区域：
  - `goals`：三项目标
  - `chain`：五任务链
  - `outputs`：固定提交物

### 模块清单
- `goal-card-row`：三项目标卡
- `task-chain`：五任务流程卡
- `deliverable-card-row`：固定交付记录卡

### 静态承载内容
- 三项目标固定为：
  - 会把时域指标翻译成设计可行域；
  - 会把频域指标翻译成补角与交叉频率目标；
  - 会在非最小相对象下先重审目标再选结构。
- 五任务链固定为：时域 `PD`、时域测速反馈、频域超前、同指标下的 `PD`、非最小相边界选择。
- 固定提交物完整列出：`指标翻译表`、`时域设计记录`、`频域设计记录`、`边界判断卡`、`一页设计报告`。

### 互动升级点
- 组件类型：`none`
- 提交态：无
- 揭示规则：无

### 埋点与教师数据
- 埋点摘要：`viewed`、`timeOnStep`
- 教师聚合：`view_count`

### AI 边界
- 页面目标：压实本课能力边界与输出格式。
- 允许范围：目标、任务链、交付物。
- 禁止范围：把任务链缩写成装置名称列表。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-03`
- 对齐要求：目标卡、任务链和交付物卡必须同屏。

## 步骤 04｜前测：你会怎样从指标进入设计

### 页面骨架
- 模板：`question_stack`
- 区域：
  - `question-stack`：三题前测
  - `record`：一句理由栏
  - `ai-gate`：AI 锁定提示

### 模块清单
- `pretest-q1`：时域目标入口题
- `pretest-q2`：频域目标入口题
- `pretest-q3`：非最小相边界题
- `reason-record`：理由填写栏
- `ai-gate-note`：AI 顺序约束卡

### 静态承载内容
- 三道题干全部明文落页，分别对应：`M_p/t_s`、`PM/\omega_c`、右半平面零点。
- AI 顺序卡固定写明：先提交自己的入口判断，再允许查看 AI 对照；AI 只做错因对照，不代替学生作答。

### 互动升级点
- 组件类型：`quiz_group`
- 作答模型：三题前测 + 一句理由
- 反馈规则：只显示正确率与误区标签，不直接给完整标准答案
- AI 解锁：前测与理由提交完成后才开放

### 埋点与教师数据
- 埋点摘要：`attemptCount`、`resultState`、`errorBucket`、`reasonTextSubmitted`
- 教师聚合：`question_distribution`、`top_misconceptions`

### AI 边界
- 页面目标：暴露“时域 / 频域 / 边界目标混淆”的起点误区。
- 允许范围：错因归类、术语纠偏、入口对照。
- 禁止范围：生成完整前测答案。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-04`
- 对齐要求：未作答状态下三题、理由栏和 AI 锁定提示同时可见。

## 步骤 05｜任务书：固定对象、两类目标与交付记录

### 页面骨架
- 模板：`table_plus_prompt`
- 区域：
  - `object`：对象与任务表
  - `targets`：两类目标表
  - `interaction`：入口分类确认

### 模块清单
- `plant-card`：示例对象卡
- `goal-table`：时域 / 频域目标对照表
- `task-table`：五任务与工具表
- `entry-classifier`：入口分类组件

### 静态承载内容
- 对象卡固定给出

$$
G_p(s)=\frac{4}{s(s+0.8)}
$$

- 目标表固定给出：时域目标 `M_p \le 20\%`、`t_s \le 4\,\text{s}`；频域目标 `PM \ge 50^\circ`、`\omega_c \approx 3\,\text{rad/s}`。
- 任务表固定写出五个任务分别对应的目标类型与推荐工具。
- 提示卡固定写明：本课不是“装置哪个好”的竞赛，而是“同一目标下该从哪条设计链进入”。

### 互动升级点
- 组件类型：`categorize_and_confirm`
- 学生任务：把时域目标和频域目标分别拖入“先上根轨迹 / 先上 Bode 图 / 先做边界重审”三栏
- 反馈规则：允许二次调整；第一次只提示入口类型，不给后续参数

### 埋点与教师数据
- 埋点摘要：`bucketAssignment`、`attemptCount`、`timeOnStep`
- 教师聚合：`goal_bucket_distribution`、`misbucket_rate`

### AI 边界
- 页面目标：压实“先按目标分类，再选工具”的入口规则。
- 允许范围：对象、任务、目标分类。
- 禁止范围：替学生完成分类。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-05`
- 对齐要求：对象公式、目标表、任务表和分类组件必须同屏。

## 步骤 06｜工作区 A：把时域指标翻译成设计可行域

### 页面骨架
- 模板：`constraint_translation_workspace`
- 区域：
  - `formula`：翻译公式卡
  - `workspace`：复平面目标区域工作区
  - `record`：指标翻译表

### 模块清单
- `translation-formula-card`：时域指标翻译公式
- `complex-plane-workspace`：目标区域叠加工作区
- `translation-record-table`：记录表

### 静态承载内容
- 公式卡必须完整给出

$$
M_p=e^{-\frac{\zeta\pi}{\sqrt{1-\zeta^2}}}\times100\%
$$

$$
t_s \approx \frac{4}{\zeta\omega_n}
$$

- 结论卡固定写明：$\zeta \ge 0.456$，$\operatorname{Re}(s)\le -1$。
- 提醒卡固定写明：纯增益根轨迹的复根实部始终停在 `-0.4`，因此纯增益不能进入本课可行域。

### 互动升级点
- 组件类型：`workspace_builder`
- 学生任务：在复平面上叠加阻尼线和实部边界，并填写纯增益失败原因
- 反馈规则：只提示边界是否叠加正确，不替学生写出结论句

### 埋点与教师数据
- 埋点摘要：`constraintOverlayState`、`recordSubmitted`、`attemptCount`
- 教师聚合：`overlay_accuracy`、`pure_gain_failure_tags`

### AI 边界
- 页面目标：把口号式“更快更稳”翻译成区域语言。
- 允许范围：指标翻译、阻尼线、实部边界。
- 禁止范围：代替学生完成翻译表。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-06`
- 对齐要求：两条公式、两个翻译结论和工作区必须同屏。

## 步骤 07｜工作区 B：`PD` 时域设计

### 页面骨架
- 模板：`tri_panel_design_workspace`
- 区域：
  - `task-chain`：任务链卡
  - `workspace`：根轨迹 / 阶跃 / 指标三面板
  - `record`：`PD` 设计记录卡

### 模块清单
- `pd-design-chain`：`PD` 设计顺序卡
- `tri-panel-workspace`：三面板工作区
- `pd-record-card`：参数与验收记录卡

### 静态承载内容
- 设计点卡固定给出

$$
s_d=-1.1\pm j1.67
$$

- 控制器形式卡固定给出

$$
G_{PD}(s)=K(1+T_d s)
$$

- 顺序卡固定写明：先证纯增益不可能，再用相角条件求 `T_d`，再用模值条件求 `K`，最后用阶跃响应验收。
- 验收提示卡固定写明：本课参考结果为 `T_d≈0.35`、`K≈1.00`，但记录重点是设计链和验收逻辑，而不是死记数值。

### 互动升级点
- 组件类型：`parameter_workspace`
- 开放参数：`T_d`、`K`
- 学生任务：调参直到三面板同时通过目标区域和时域指标验收，并提交一句“为什么零点位置能把轨迹拉入可行域”
- 反馈规则：保留调参轨迹；只给出通过 / 未通过状态

### 埋点与教师数据
- 埋点摘要：`parameterTrail`、`validationState`、`recordSubmitted`
- 教师聚合：`final_parameter_distribution`、`validation_pass_rate`

### AI 边界
- 页面目标：压实时域 `PD` 的完整设计链。
- 允许范围：设计点、相角条件、模值条件、验收。
- 禁止范围：跳过设计点直接背答案。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-07`
- 对齐要求：设计点、控制器形式、三面板工作区和记录卡必须同屏。

## 步骤 08｜工作区 C：测速反馈时域设计

### 页面骨架
- 模板：`structure_formula_workspace`
- 区域：
  - `structure`：结构图与公式卡
  - `workspace`：三面板工作区
  - `record`：测速反馈记录卡

### 模块清单
- `rate-structure-card`：测速反馈结构图
- `rate-formula-card`：标准表达式与等效特征方程
- `tri-panel-workspace`：三面板工作区
- `rate-record-card`：记录卡

### 静态承载内容
- 结构图旁必须完整给出

$$
U(s)=K E(s)-K_t sY(s)
$$

$$
1+\frac{4K}{s(s+0.8+4K_t)}=0
$$

- 顺序卡固定写明：先定等效极点位置，再求 $K_t$，最后由模值条件求 $K$。
- 对照提醒固定写明：测速反馈的抓手是等效极点位置，不是“把 `PD` 换了个位置”。

### 互动升级点
- 组件类型：`parameter_workspace`
- 开放参数：`K_t`、`K`
- 学生任务：完成参数调整并提交一句“为什么这里不能说只是把 `PD` 换了个位置”
- 反馈规则：突出参数调整顺序是否正确，结果达标后才允许提交

### 埋点与教师数据
- 埋点摘要：`parameterTrail`、`adjustmentOrder`、`recordSubmitted`
- 教师聚合：`adjustment_order_distribution`、`pd_rate_confusion_rate`

### AI 边界
- 页面目标：建立测速反馈与 `PD` 的设计抓手差异。
- 允许范围：结构图、等效方程、调参顺序。
- 禁止范围：把测速反馈误写成前向显式增零点。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-08`
- 对齐要求：结构图、两条公式和工作区必须同屏。

## 步骤 09｜工作区 D：超前频域设计

### 页面骨架
- 模板：`bode_design_workspace`
- 区域：
  - `goal`：频域目标卡
  - `workspace`：Bode 工作区
  - `record`：超前设计记录卡

### 模块清单
- `frequency-goal-card`：频域目标卡
- `lead-formula-card`：超前控制器卡
- `bode-workspace`：Bode 工作区
- `lead-record-card`：记录卡

### 静态承载内容
- 目标卡必须完整给出

$$
PM \ge 50^\circ,\qquad \omega_c \approx 3\,\text{rad/s}
$$

- 控制器形式卡必须完整给出

$$
G_{lead}(s)=K_c\frac{aTs+1}{Ts+1},\qquad a>1
$$

- 顺序卡固定写明：先看“若只调增益会怎样”，再算所需补角，再把最大超前角布置到目标截止频率附近，最后求 `K_c` 并回查时域代价。

### 互动升级点
- 组件类型：`parameter_workspace`
- 开放参数：`a`、`T`、`K_c`
- 学生任务：完成超前设计并记录“为什么这一步必须先看若只调增益会怎样”
- 反馈规则：Bode 指标和回查阶跃响应都通过后才标记完成

### 埋点与教师数据
- 埋点摘要：`parameterTrail`、`marginState`、`recordSubmitted`
- 教师聚合：`lead_parameter_distribution`、`margin_recovery_rate`

### AI 边界
- 页面目标：压实频域超前设计链。
- 允许范围：补角、交叉频率、幅值条件、回查。
- 禁止范围：把超前设计压成“调到看起来差不多”。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-09`
- 对齐要求：频域目标卡、超前形式卡和 Bode 工作区必须同屏。

## 步骤 10｜工作区 E：同一频域指标下的 `PD` 设计

### 页面骨架
- 模板：`dual_solution_compare_workspace`
- 区域：
  - `goal`：共同指标卡
  - `workspace`：`PD` 频域工作区
  - `compare`：与超前的并排比较卡

### 模块清单
- `shared-goal-card`：共同频域目标卡
- `pd-frequency-card`：`PD` 频域设计提示卡
- `bode-workspace`：Bode 工作区
- `compare-board`：与超前的对照板

### 静态承载内容
- 共同目标卡必须再次完整给出

$$
PM \ge 50^\circ,\qquad \omega_c \approx 3\,\text{rad/s}
$$

- 提示卡固定写明：任务 E 与任务 D 使用同一组频域指标，目的不是重复设计，而是比较相同目标下不同结构的时域副作用。
- 对照板固定要求记录：达标情况、超调、调节时间、高频放大风险。

### 互动升级点
- 组件类型：`structured_compare`
- 学生任务：在同一指标下完成 `PD` 频域设计，并填写与超前方案的并排比较表
- 反馈规则：只允许提交结构化比较，不接受只写“都达标”这种空结论

### 埋点与教师数据
- 埋点摘要：`comparisonSubmitted`、`differenceTags`、`validationState`
- 教师聚合：`difference_tag_distribution`、`empty_comparison_rate`

### AI 边界
- 页面目标：压实“同指标下比较副作用”的课程意图。
- 允许范围：共同目标、并排比较、时域回查。
- 禁止范围：只看频域达标就结束。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-10`
- 对齐要求：共同目标卡、工作区和并排比较卡必须同屏。

## 步骤 11｜工作区 F：非最小相边界与结构选择

### 页面骨架
- 模板：`boundary_decision_workspace`
- 区域：
  - `boundary-object`：边界对象卡
  - `risk`：风险图与边界说明
  - `decision`：结构选择矩阵

### 模块清单
- `nmp-object-card`：边界对象卡
- `risk-figure`：`3-6-rhp-boundary.png`
- `decision-matrix`：结构选择矩阵
- `example-replay`：保守示例回放入口

### 静态承载内容
- 边界对象卡必须完整给出

$$
G_{nmp}(s)=\frac{4(1-0.3s)}{s(s+0.8)}
$$

- 风险说明固定写明：右半平面零点在 `+3.33`，原来的 `\omega_c \approx 3` 目标已过于激进。
- 结论卡固定写明：非最小相对象下先改目标，再选 `PD`、测速反馈或超前。

### 互动升级点
- 组件类型：`decision_submit`
- 学生任务：先判断原目标是否仍可行，再在三种结构中做出优先选择，并提交一句依据
- 反馈规则：提交前必须先勾选“已重审目标”，避免跳过边界判断直接选结构

### 埋点与教师数据
- 埋点摘要：`feasibilityChoice`、`structureChoice`、`reasonSubmitted`
- 教师聚合：`structure_choice_distribution`、`boundary_skip_rate`

### AI 边界
- 页面目标：建立“边界先于调参”的判断顺序。
- 允许范围：可行性、风险、保守目标、结构选择。
- 禁止范围：在未重审目标时直接推荐结构。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-11`
- 对齐要求：边界对象公式、风险图和结构选择矩阵必须同屏。

## 步骤 12｜后测：设计链和边界是否分清

### 页面骨架
- 模板：`post_quiz_stack`
- 区域：
  - `question-stack`：三题后测
  - `explain`：一句解释栏
  - `ai-compare`：AI 对照区

### 模块清单
- `posttest-q1`：为什么任务 D 和 E 使用同一频域指标
- `posttest-q2`：为什么测速反馈入口是等效极点
- `posttest-q3`：为什么右半平面零点下先重审目标
- `one-sentence-explain`：一句解释栏
- `ai-compare-panel`：AI 对照区

### 静态承载内容
- 三道题干全部明文落页。
- AI 对照区固定写明：只在完成后测后开放，用于比较你的理由是否遗漏“目标先于结构”的关键句。

### 互动升级点
- 组件类型：`quiz_group`
- 作答模型：三道后测题 + 一句解释
- 反馈规则：先显示正确率，再开放 AI 对照；AI 不重写学生答案，只标记遗漏点

### 埋点与教师数据
- 埋点摘要：`attemptCount`、`resultState`、`reasonTextSubmitted`、`aiCompareOpened`
- 教师聚合：`posttest_distribution`、`remaining_confusion_tags`

### AI 边界
- 页面目标：完成课末纠偏，而不是重新讲一遍本课。
- 允许范围：遗漏点提示、错因对照。
- 禁止范围：自动生成后测标准答案。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-12`
- 对齐要求：未作答状态下三题、解释栏和 AI 对照说明同时可见。

## 步骤 13｜收束：从指标走到结构选择

### 页面骨架
- 模板：`summary_infographic`
- 区域：
  - `summary`：三句结论
  - `media`：课程信息图
  - `exit`：退出反思与下节去向

### 模块清单
- `summary-card-row`：三句结论卡
- `info-graphic`：`3-6-info.png`
- `next-lesson-card`：去向卡
- `exit-reflection`：退出反思栏

### 静态承载内容
- 三句结论固定写明：
  - 时域设计先翻译成目标区域；
  - 频域设计先翻译成补角与交叉频率；
  - 非最小相对象先重审目标，再谈结构与参数。
- 去向卡固定写明：`3-7` 将转入稳态改善线，回答“为什么误差还能继续变小”。

### 互动升级点
- 组件类型：`exit_reflection`
- 学生任务：补全一句“本节我学到的不是哪种装置更强，而是 ________。”
- 反馈规则：只保存个人收束句，不即时判错

### 埋点与教师数据
- 埋点摘要：`reflectionSubmitted`、`reflectionLength`
- 教师聚合：`reflection_word_cloud`、`completion_rate`

### AI 边界
- 页面目标：把本课主线收束成可复述的判断语言。
- 允许范围：三句结论、前后课衔接。
- 禁止范围：扩写成新知识点。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-13`
- 对齐要求：信息图、三句结论和退出反思栏必须同屏。

## 实践训练时长统计

- 目标入口前测：6min
- 目标分类与任务确认：4min
- 指标翻译：8min
- `PD` 时域设计：12min
- 测速反馈时域设计：10min
- 超前频域设计：10min
- 同指标下的 `PD` 对照：8min
- 非最小相边界选择：6min
- 后测与纠偏：6min
- 合计：70min
