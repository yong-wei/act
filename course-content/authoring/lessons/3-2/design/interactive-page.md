━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
互动页面设计 | 单元 3-2：劳斯判据——从高阶系统稳定判定到参数可行域
技术栈：Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 文档职责
- 本文件是供人审阅的页面蓝图，只描述页面模板、固定内容、互动组件、数据采集与 AI 边界。
- 同目录 [interactive-contract.yaml](./interactive-contract.yaml) 是机读契约；两者必须逐步骤一一对应。
- 本文件不是讲义摘要，不保留课堂口播，不给实现方留下“到时候再发挥”的结构空白。
- 页面默认预览口径固定为学生演示页，不以教师端模板弹窗替代真实页面。
- 本课为实践课，页面总览与步骤级说明必须给出可追踪的学生实践分钟。

## 表述规则
- 页面描述只保留客观结构：区域、模块、文本、公式、图片、表格、互动组件、反馈规则。
- 静态内容优先。互动组件只负责判断、分类、区间读取、图表对照与迁移说明，不能替代核心公式、图示与结论。
- 讲义中的核心公式必须先在“静态承载内容”中出现，再开放互动工作区。
- 预览、埋点、教师聚合与 AI 边界都要落到步骤级，避免实现方二次猜测。

## 全课总览
| 步骤 | 标题 | 页面模板 | 主体布局 | 互动组件 | 学生实践分钟 | 学生页预览 |
|------|------|----------|----------|----------|--------------|------------|
| step-01 | 回到地图——从纯极点语言走向稳定边界 | `map_hero_slide` | 路径图 + 任务卡 | `none` | 0 | `/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-01` |
| step-02 | 先看主图——参数变化下极点怎样逼近边界 | `pole-region-vote` | 主图 + 图例 + 点选区 | `region_click` | 3 | `/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-02` |
| step-03 | 学习目标与边界——本课负责什么，不负责什么 | `goal_boundary_split` | 目标卡 + 边界表 | `none` | 0 | `/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-03` |
| step-04 | 前测——高阶系统不求根也能判稳吗 | `single_concept_vote` | 问题卡 + 三选一 | `single_choice` | 4 | `/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-04` |
| step-05 | 普通劳斯表：第一列为什么是主轴 | `routh_table_workspace` | 固定对象公式 + 劳斯表 + 填空区 | `short_response` | 6 | `/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-05` |
| step-06 | 带参数劳斯表：稳定区间怎样直接读出 | `parametric_routh_workspace` | 带参数劳斯表 + 不等式链 + 区间输入区 | `interval_input` | 8 | `/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-06` |
| step-07 | 图 1 回看：代数区间怎样对应极点迁移范围 | `pole_region_linker` | 主图回看 + 参数卡 + 对应区 | `pair_match` | 5 | `/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-07` |
| step-08 | 特殊情况辨识：首位为 0 还是全零行 | `special_case_sorter` | 方法卡 + 双案例 + 分类区 | `card_sort` | 7 | `/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-08` |
| step-09 | 辅助方程：全零行为何暴露边界根结构 | `auxiliary_equation_builder` | 规则卡 + 本例公式区 + 填空区 | `formula_fill` | 7 | `/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-09` |
| step-10 | 图 2：稳定、临界、失稳的时间响应对照 | `time_response_match` | 三曲线图 + 三标签 + 配对区 | `triple_match` | 5 | `/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-10` |
| step-11 | 图 3：边界附近为什么更容易出现频域峰值 | `bode_trend_judge` | 幅频图 + 结论卡 + 判断区 | `binary_choice` | 4 | `/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-11` |
| step-12 | 变量平移：从稳定到区域约束 | `shifted_region_workspace` | 平移公式链 + 流程图 + 区间输入区 | `interval_input` | 7 | `/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-12` |
| step-13 | 收束——从劳斯判稳走向设计可行域入口 | `summary_infographic` | 四列表 + 出口短答 + 信息图 | `short_response` | 3 | `/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-13` |

> 可追踪学生实践合计：`59` 分钟。

## 讲义核心内容映射
| handout_anchor | core_item_type | must_appear_content | target_step | page_mode | interaction_upgrade | media_or_table_ref | acceptance_note |
|---|---|---|---|---|---|---|---|
| `## 一、引入：高阶系统稳定分析为什么需要劳斯判据` | concept+figure | 稳定段、边界点、失稳段三段现象，以及“先看边界，再谈迁移”的课程定位。 | `step-02` | `static+workspace` | 点选区只要求标出稳定段、边界点和失稳段。 | `3-2-pole-migration.png` | 主图与三段标签必须在未作答状态下完整可见。 |
| `### 2.1 先固定一个参数值，完成普通劳斯表` | concept+formula | `$$D(s)=s^4+5s^3+9s^2+11s+6$$`。 | `step-05` | `static+form` | 填空区只补“第一列全正意味着什么”。 | `劳斯表静态区` | 静态区必须先完整出现对象方程和表格骨架。 |
| `### 2.2 从第一列直接读出稳定结论 / ### 2.3 为什么“看第一列”就够了` | formula | `$$1,\quad 5,\quad \frac{34}{5},\quad \frac{112}{17},\quad 6$$`，`$$\text{右半平面根数}=0$$`。 | `step-05` | `static+form` | 互动只强化“第一列是计数主轴”。 | `第一列结果卡` | 静态区必须显式出现第一列序列与判稳结论。 |
| `### 3.1 保留参数后，整张劳斯表一次列完 / ### 3.2 第一列不等式直接给出稳定区间` | formula | `$$D(s,k)=s^4+5s^3+9s^2+(7+k)s+(2+k)$$`，`$$-2<k<18$$`。 | `step-06` | `static+workspace` | 区间输入只负责先答后核对，不替代不等式链展示。 | `3-2-parameter-range-flow.svg` | 静态区必须先出现对象方程、不等式链和最终区间。 |
| `### 3.3 两个边界点对应两种不同的临界根结构 / ### 3.4 用三个参数点核对这一结论` | concept+figure | `k=-2` 对应原点根，`k=18` 对应纯虚根，`k=22` 对应右半平面共轭根。 | `step-07` | `static+workspace` | 匹配区只做“参数点 -> 极点结构”对应。 | `3-2-pole-migration.png` | 三个典型参数卡必须和主图同屏。 |
| `### 4.1 首位为 0 且该行不全为 0：用极小正数保持符号连续性 / ### 4.3 两类特殊情况的辨识与处理规则` | concept+table | `首位为 0` 与 `全零行` 的辨识差异、处理动作和后续关注点。 | `step-08` | `static+workspace` | 分类区只做双案例归类。 | `3-2-special-cases-card.svg` | 方法卡、双案例和分类区必须同屏。 |
| `### 4.2 出现全零行：上一行隐藏着辅助方程` | formula | `$$A(s)=as^{m+1}+bs^{m-1}+cs^{m-3}+\cdots$$`，`$$A(s)=s^2+1$$`，`$$A'(s)=2s$$`。 | `step-09` | `static+form` | 填空区只补辅助方程与导数行。 | `3-2-special-cases-card.svg` | 静态区必须完整出现一般规则与本例。 |
| `### 5.2 极点结构一旦确定，时域表现就随之确定` | concept+figure | 稳定、临界、失稳三类时间响应与极点结构的一一对应。 | `step-10` | `static+workspace` | 匹配区只做曲线与状态对照。 | `3-2-step-comparison.png` | 三曲线、三标签和一句结论同屏。 |
| `### 5.3 同一组极点在频域中留下的痕迹` | formula | `$$\omega=1\ \text{rad/s}$$` 与“靠近稳定边界时峰值抬高”的频域线索。 | `step-11` | `static+workspace` | 判断区只检查“峰值抬高/不变”结论。 | `3-2-bode-magnitude.png` | 静态区先交代边界邻近与峰值抬高的联系。 |
| `### 6.1 竖线左侧约束如何转化为普通稳定性判定 / ### 6.2 在主对象上加入“极点位于 $\operatorname{Re}(s)<-0.5$”约束 / ### 6.3 约束一旦加强，可行域会同步收缩` | formula | `$$\operatorname{Re}(s)<-\sigma$$`，`$$s=z-\sigma$$`，`$$\tilde D(z,k)=D(z-\sigma,k)$$`，`$$-\frac{3}{8}<k<4$$`。 | `step-12` | `static+workspace` | 区间输入只做加强约束后的新可行域填写。 | `3-2-parameter-range-flow.svg` | 静态区必须先出现平移公式链和新旧区间对比。 |
| `### 6.4 为何这标志着进入设计层面` | method-summary | 从“判稳工具”过渡到“参数可行域入口”，并固定四列表收束结构。 | `step-13` | `static+form` | 出口短答只要求补足“设计入口”的一句话。 | `3-2-info.png` | 四列表和信息图必须先形成复习骨架，再开放短答。 |

## 步骤 01｜回到地图——从纯极点语言走向稳定边界

### 页面骨架
- 模板：`map_hero_slide`
- 区域：`header` / `lead` / `summary`

### 模块清单
- `stage-map`：模块 3 路径图
- `today-task`：本课任务卡

### 静态承载内容
- 固定高亮 `3-1 -> 3-2 -> 3-3 -> 4-1`
- 任务卡固定写明：判稳、边界识别、参数可行域入口
- 关键词固定为：劳斯判据、稳定边界、参数可行域

### 互动升级点
- 组件类型：`none`
- 提交态：无
- 答案揭示：无

### 埋点与教师数据
- 埋点摘要：`viewed`、`timeOnStep`、`teacherFollowSync`
- 教师聚合：`view_count`、`sync_status`

### AI 边界
- 页面目标：标定 3-2 在模块 3 中的位置
- 允许范围：课程路径、纯极点语言到边界语言的切换
- 禁止范围：根轨迹法则、控制器整定

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-01`
- 对齐要求：首屏直接出现路径图与任务卡，无作答区

## 步骤 02｜先看主图——参数变化下极点怎样逼近边界

### 页面骨架
- 模板：`pole-region-vote`
- 区域：`media` / `legend` / `interaction`

### 模块清单
- `pole-migration-main`：主图 `3-2-pole-migration.png`
- `region-legend`：稳定段、边界点、失稳段图例卡
- `region-click`：图上区域点选区

### 静态承载内容
- 主图必须完整呈现参数从 `k=-2` 扫描到 `k=22` 的极点迁移范围
- 图例卡固定写明：稳定段、边界点、失稳段
- 结论卡固定写明：本课先解决“边界在哪里”，不提前展开“穿越后按什么法则迁移”

### 互动升级点
- 组件类型：`region_click`
- 学生任务：依次标出稳定段、边界点和失稳段
- 答案揭示：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`selectedRegions`、`submissionState`、`teacherRevealSeen`
- 教师聚合：`region_accuracy_rate`、`common_confusion_pairs`

### AI 边界
- 页面目标：建立“参数变化 -> 极点逼近边界”的第一直觉
- 允许范围：稳定段、边界点、失稳段
- 禁止范围：劳斯表细节、根轨迹法则

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-02`
- 对齐要求：主图、图例卡和点选区在未作答状态下同屏

## 步骤 03｜学习目标与边界——本课负责什么，不负责什么

### 页面骨架
- 模板：`goal_boundary_split`
- 区域：`goals` / `boundary-table`

### 模块清单
- `goal-cards`：三项目标卡
- `scope-table`：负责/不负责边界表

### 静态承载内容
- 三项目标固定为：普通劳斯表、参数区间、特殊情况与区域约束
- 边界表固定为：负责高阶判稳与参数可行域，不负责根轨迹与整定

### 互动升级点
- 组件类型：`none`
- 提交态：无
- 答案揭示：无

### 埋点与教师数据
- 埋点摘要：`viewed`、`timeOnStep`
- 教师聚合：`view_count`

### AI 边界
- 页面目标：固定本课能力边界
- 允许范围：目标、边界
- 禁止范围：模块 4 设计任务

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-03`
- 对齐要求：目标卡和边界表同屏

## 步骤 04｜前测——高阶系统不求根也能判稳吗

### 页面骨架
- 模板：`single_concept_vote`
- 区域：`question` / `options` / `feedback`

### 模块清单
- `prompt-card`：前测问题卡
- `single-choice`：三选一判断区
- `misconception-note`：误区提示卡

### 静态承载内容
- 问题卡固定写明：对四阶特征方程，不显式求出全部根，是否仍可判断系统稳定性
- 误区提示卡固定写明：求根不是唯一入口，高阶系统更需要结构化判稳工具

### 互动升级点
- 组件类型：`single_choice`
- 选项结构：
  - A：必须显式求出全部根
  - B：能，通过系数结构与劳斯判据判断
  - C：只有低阶系统可以
- 正确项：`B`
- 错误反馈：只提示“高阶系统需要先建立不求根的判稳语言”
- 答案揭示：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`selectedOption`、`resultState`、`teacherRevealSeen`
- 教师聚合：`option_distribution`、`misconception_rate`

### AI 边界
- 页面目标：暴露“判稳必须先求根”的起点误区
- 允许范围：结构化判稳入口
- 禁止范围：完整劳斯表推导

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-04`
- 对齐要求：问题卡、三选一和误区卡同屏

## 步骤 05｜普通劳斯表：第一列为什么是主轴

### 页面骨架
- 模板：`routh_table_workspace`
- 区域：`equation` / `table` / `interaction`

### 模块清单
- `fixed-object-equation`：固定对象公式卡
- `routh-table-static`：普通劳斯表静态区
- `first-column-fill`：第一列意义填空区

### 静态承载内容
- 对象方程固定为：

$$
D(s)=s^4+5s^3+9s^2+11s+6
$$

- 劳斯表静态区必须完整出现：

$$
\begin{array}{c|ccc}
s^4 & 1 & 9 & 6 \\
s^3 & 5 & 11 & 0 \\
s^2 & \frac{34}{5} & 6 & 0 \\
s^1 & \frac{112}{17} & 0 & 0 \\
s^0 & 6 & 0 & 0
\end{array}
$$

- 第一列结果卡必须固定写明：

$$
1,\quad 5,\quad \frac{34}{5},\quad \frac{112}{17},\quad 6
$$

以及

$$
\text{右半平面根数}=0
$$

### 互动升级点
- 组件类型：`short_response`
- 学生任务：补全“第一列如果全为正，意味着 ________”
- 标准答案要点：右半平面根数为零、系统稳定
- 答案揭示：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`responseSubmitted`、`keywordCoverage`、`timeOnStep`
- 教师聚合：`keyword_hit_rate`、`missing_concepts`

### AI 边界
- 页面目标：建立“第一列 -> 右半平面根数”的直接翻译
- 允许范围：第一列、符号变化、稳定结论
- 禁止范围：跳过表格直接报答案

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-05`
- 对齐要求：对象方程、劳斯表和填空区同屏

## 步骤 06｜带参数劳斯表：稳定区间怎样直接读出

### 页面骨架
- 模板：`parametric_routh_workspace`
- 区域：`equation` / `inequality-chain` / `interaction`

### 模块清单
- `parametric-object-equation`：带参数对象公式卡
- `parametric-routh-table`：带参数劳斯表
- `interval-input`：区间输入区

### 静态承载内容
- 带参数对象公式固定为：

$$
D(s,k)=s^4+5s^3+9s^2+(7+k)s+(2+k)
$$

- 带参数劳斯表静态区必须完整出现：

$$
\begin{array}{c|ccc}
s^4 & 1 & 9 & 2+k \\
s^3 & 5 & 7+k & 0 \\
s^2 & \frac{38-k}{5} & 2+k & 0 \\
s^1 & \frac{(18-k)(k+12)}{38-k} & 0 & 0 \\
s^0 & 2+k & 0 & 0
\end{array}
$$

- 不等式链固定为：

$$
\frac{38-k}{5}>0,\qquad
\frac{(18-k)(k+12)}{38-k}>0,\qquad
2+k>0
$$

- 最终区间卡固定写明：

$$
-2<k<18
$$

### 互动升级点
- 组件类型：`interval_input`
- 学生任务：先独立输入稳定区间，再与标准答案核对
- 标准答案：`-2<k<18`
- 答案揭示：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`submittedInterval`、`intervalCorrectness`、`attemptCount`
- 教师聚合：`interval_accuracy_rate`、`common_interval_errors`

### AI 边界
- 页面目标：把带参数劳斯表翻译成稳定可行域
- 允许范围：第一列条件、区间合并、漏条件检查
- 禁止范围：AI 直接代替学生给出最终区间

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-06`
- 对齐要求：公式卡、劳斯表、不等式链和区间输入区同屏

## 步骤 07｜图 1 回看：代数区间怎样对应极点迁移范围

### 页面骨架
- 模板：`pole_region_linker`
- 区域：`media` / `cards` / `interaction`

### 模块清单
- `pole-migration-return`：主图回看
- `parameter-cards`：`k=-2`、`k=18`、`k=22` 三张参数卡
- `pair-match`：参数点与极点结构对应区

### 静态承载内容
- 参数卡固定写明：
  - `k=-2`：一个极点落在原点
  - `k=18`：出现一对纯虚根
  - `k=22`：出现右半平面共轭根
- 对应关系结论卡固定写明：代数区间的端点和区外点，都必须回到复平面结构上理解

### 互动升级点
- 组件类型：`pair_match`
- 学生任务：将三个参数点拖拽到“原点根 / 纯虚根 / 右半平面根”标签下
- 答案揭示：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`pairingResult`、`attemptCount`
- 教师聚合：`pairing_accuracy_rate`、`confused_parameter_points`

### AI 边界
- 页面目标：建立“代数边界 -> 极点结构”的映射
- 允许范围：原点根、纯虚根、右半平面根
- 禁止范围：提前展开根轨迹法则

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-07`
- 对齐要求：主图、参数卡和匹配区必须同屏

## 步骤 08｜特殊情况辨识：首位为 0 还是全零行

### 页面骨架
- 模板：`special_case_sorter`
- 区域：`method-card` / `cases` / `interaction`

### 模块清单
- `special-case-card`：方法卡 `3-2-special-cases-card.svg`
- `case-d1`：`D_1(s)` 局部劳斯表卡
- `case-d2`：`D_2(s)` 局部劳斯表卡
- `card-sort`：双类拖拽区

### 静态承载内容
- 方法卡必须明确两类现象：`首位为 0` 与 `全零行`
- 双案例卡固定写明：
  - `D_1(s)=s^4+2s^3+3s^2+6s+5`
  - `D_2(s)=s^4+2s^3+2s^2+2s+1`
- 处理动作卡固定写明：
  - `首位为 0` -> 用极小正数 $\varepsilon$ 连续化
  - `全零行` -> 用上一行构造辅助方程

### 互动升级点
- 组件类型：`card_sort`
- 学生任务：将 `D_1` 与 `D_2` 分别归入“首位为 0”或“全零行”
- 答案揭示：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`sortResult`、`attemptCount`
- 教师聚合：`classification_accuracy_rate`、`misclassified_cases`

### AI 边界
- 页面目标：先识别结构差异，再谈处理动作
- 允许范围：两类特殊情况的辨识依据
- 禁止范围：把两类情况混成同一套算法

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-08`
- 对齐要求：方法卡、双案例和分类区必须同屏

## 步骤 09｜辅助方程：全零行为何暴露边界根结构

### 页面骨架
- 模板：`auxiliary_equation_builder`
- 区域：`rule` / `example` / `interaction`

### 模块清单
- `general-rule-card`：一般规则卡
- `worked-example-card`：`D_2(s)` 辅助方程示例
- `formula-fill`：辅助方程与导数填空区

### 静态承载内容
- 一般规则卡固定写明：

$$
A(s)=as^{m+1}+bs^{m-1}+cs^{m-3}+\cdots
$$

- 本例静态区必须完整出现：

$$
A(s)=s^2+1
$$

以及

$$
A'(s)=2s
$$

- 结论卡固定写明：必须先写辅助方程，再由其根结构判断边界类型

### 互动升级点
- 组件类型：`formula_fill`
- 学生任务：补全本例辅助方程与导数行
- 标准答案：`A(s)=s^2+1`，`A'(s)=2s`
- 答案揭示：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`formulaSubmitted`、`formulaCorrectness`、`attemptCount`
- 教师聚合：`formula_accuracy_rate`、`common_missing_terms`

### AI 边界
- 页面目标：固定辅助方程的构造逻辑
- 允许范围：上一行取系数、幂次递降、先求辅助方程再求导
- 禁止范围：跳过规则卡直接给最终根

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-09`
- 对齐要求：一般规则、本例公式和填空区同屏

## 步骤 10｜图 2：稳定、临界、失稳的时间响应对照

### 页面骨架
- 模板：`time_response_match`
- 区域：`media` / `labels` / `interaction`

### 模块清单
- `time-response-compare`：三曲线对照图 `3-2-step-comparison.png`
- `state-labels`：稳定、临界、失稳标签卡
- `triple-match`：曲线与状态配对区

### 静态承载内容
- 标签卡固定写明：
  - 稳定：响应衰减并收敛
  - 临界：保留不衰减模态或等幅振荡
  - 失稳：振荡包络放大或直接发散
- 一句结论固定为：极点结构一旦确定，时域表现就随之确定

### 互动升级点
- 组件类型：`triple_match`
- 学生任务：将三条曲线匹配到稳定、临界、失稳三类状态
- 答案揭示：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`matchResult`、`attemptCount`
- 教师聚合：`state_match_accuracy`、`most_confused_curve`

### AI 边界
- 页面目标：把劳斯结论翻译到时域现象
- 允许范围：收敛、边界振荡、发散振荡
- 禁止范围：新增时域指标计算题

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-10`
- 对齐要求：三曲线图和三标签配对区同屏

## 步骤 11｜图 3：边界附近为什么更容易出现频域峰值

### 页面骨架
- 模板：`bode_trend_judge`
- 区域：`media` / `conclusion` / `interaction`

### 模块清单
- `bode-main`：幅频图 `3-2-bode-magnitude.png`
- `trend-card`：峰值趋势结论卡
- `binary-choice`：二选一判断区

### 静态承载内容
- 幅频图必须保留 `k=4`、`k=12`、`k=17.5` 三条稳定参数曲线
- 结论卡固定写明：

$$
\omega=1\ \text{rad/s}
$$

对应的临界频率示例，以及“靠近稳定边界时峰值抬高”的频域线索

### 互动升级点
- 组件类型：`binary_choice`
- 选项结构：
  - A：参数逼近稳定边界时，幅频曲线峰值通常降低
  - B：参数逼近稳定边界时，幅频曲线峰值通常抬高
- 正确项：`B`
- 错误反馈：只提示“边界邻近意味着对相关频段更敏感”
- 答案揭示：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`selectedOption`、`resultState`
- 教师聚合：`option_distribution`、`peak_trend_misconception_rate`

### AI 边界
- 页面目标：把劳斯边界语言翻译到频域现象
- 允许范围：边界邻近、峰值抬高、频段敏感性
- 禁止范围：Nyquist、裕度语言

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-11`
- 对齐要求：幅频图、结论卡和二选一判断区同屏

## 步骤 12｜变量平移：从稳定到区域约束

### 页面骨架
- 模板：`shifted_region_workspace`
- 区域：`formula-chain` / `flowchart` / `interaction`

### 模块清单
- `shift-formula-card`：变量平移公式链
- `range-flow-card`：流程图 `3-2-parameter-range-flow.svg`
- `interval-input`：加强约束后的区间输入区

### 静态承载内容
- 变量平移公式链固定写明：

$$
\operatorname{Re}(s)<-\sigma
$$

$$
s=z-\sigma
$$

$$
\tilde D(z,k)=D(z-\sigma,k)
$$

- 新区间卡固定写明：

$$
-\frac{3}{8}<k<4
$$

- 新旧区间对照卡固定写明：`-2<k<18` 与 `-\frac{3}{8}<k<4`

### 互动升级点
- 组件类型：`interval_input`
- 学生任务：填写“极点位于 $\operatorname{Re}(s)<-0.5$”约束下的新区间
- 标准答案：`-\frac{3}{8}<k<4`
- 答案揭示：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`submittedInterval`、`intervalCorrectness`、`attemptCount`
- 教师聚合：`constraint_interval_accuracy`、`old_new_range_confusion_rate`

### AI 边界
- 页面目标：把劳斯判据推进到区域约束入口
- 允许范围：变量平移、竖线左侧约束、新旧区间收缩
- 禁止范围：完整控制器设计面板

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-12`
- 对齐要求：公式链、流程图和区间输入区同屏

## 步骤 13｜收束——从劳斯判稳走向设计可行域入口

### 页面骨架
- 模板：`summary_infographic`
- 区域：`summary-table` / `exit-line` / `info`

### 模块清单
- `four-column-table`：四列表
- `exit-response`：出口句填写区
- `info-graphic`：信息图 `3-2-info.png`

### 静态承载内容
- 四列表固定为：劳斯现象、极点结构、时域表现、设计意义
- 出口卡固定写明：本课出口是“参数可行域入口”，不是完整整定方案
- 信息图固定作为本课复习骨架

### 互动升级点
- 组件类型：`short_response`
- 学生任务：补全“劳斯判据对我来说，已经从判稳工具推进成了 ________”
- 标准答案要点：设计可行域入口、边界判断入口、参数筛选入口
- 答案揭示：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`responseSubmitted`、`keywordCoverage`
- 教师聚合：`exit_line_keywords`、`summary_completion_rate`

### AI 边界
- 页面目标：完成课程出口收束
- 允许范围：判稳、边界、可行域、设计入口
- 禁止范围：模块 4 整定方案

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-13`
- 对齐要求：四列表、出口短答与信息图同屏

## 资源占位清单
- `3-2-pole-migration.png`：步骤 `02`、`07`
- `3-2-special-cases-card.svg`：步骤 `08`、`09`
- `3-2-step-comparison.png`：步骤 `10`
- `3-2-bode-magnitude.png`：步骤 `11`
- `3-2-parameter-range-flow.svg`：步骤 `06`、`12`
- `3-2-info.png`：步骤 `13`
