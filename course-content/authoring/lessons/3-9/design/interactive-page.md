━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
互动页面设计 | 单元 3-9：稳定—动态—稳态综合映射实验
技术栈：Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 文档职责
- 本文件是供人审阅的页面蓝图，只描述页面模板、固定内容、互动组件、反馈规则、教师聚合、AI 边界与学生页预览口径。
- 同目录 [interactive-contract.yaml](./interactive-contract.yaml) 是机读契约；两者必须逐步骤一一对应。
- 本文件不是课堂台词稿，不把关键公式、对照表、结论或工作区字段留给实现阶段补脑。
- 默认预览口径固定为学生演示页；教师端只看聚合结果和步骤骨架，不代替真实学生页预览。

## 表述规则
- 页面描述只保留客观结构：区域、模块、固定文本、公式、图片、表格、互动组件、埋点和验收条件。
- 动作化表述禁用：`展示`、`引导`、`让学生`、`跟着做`、`讲解`、`先听后做` 等。
- 本课主线固定为：`统一对象 -> 基准标签 -> 零点线补强 -> 积分家族 -> 滞后对照 -> 综合映射工作区 -> 模块4入口判断`。
- 当前作者态固定把“学生自选补强版本”落为零点线补强，保证 handout、BOPPPS 与互动页的审查口径一致。

## 全课总览
| 步骤 | 标题 | 页面模板 | 主体布局 | 互动组件 | 学生页预览 |
|------|------|----------|----------|----------|------------|
| step-01 | 回到地图：固定统一对象与比较顺序 | `map_hero_slide` | 路径图 + 对象卡 + 公式链 | `none` | `/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-01` |
| step-02 | 前测：先贴任务标签，不先报控制器名称 | `question_stack` | 题组 + 标签卡 + 提交条 | `quiz_group` | `/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-02` |
| step-03 | 基准版本：把它判成什么标签 | `design_compare_workspace` | 基准 `2×2` 图 + 指标表 + 标签区 | `structured_compare` | `/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-03` |
| step-04 | 零点线补强：更偏动态改善的样例 | `design_compare_workspace` | 基准/零点线 `2×2` 对照 + 结论表 | `structured_compare` | `/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-04` |
| step-05 | 积分家族：低频收益与中频代价如何一起暴露 | `matrix_lab_board` | 三版本 `2×2` 对照 + 比较矩阵 | `matrix_workspace` | `/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-05` |
| step-06 | 滞后对照：稳态改善的另一条路径 | `comparison_panel_with_reason` | 滞后图 + 积分/滞后对照卡 + 判断区 | `reason_check` | `/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-06` |
| step-07 | 综合映射工作区：把收益和代价写回同一张表 | `mapping_workspace` | 综合映射表 + 风险栏 + 提交区 | `table_builder` | `/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-07` |
| step-08 | 模块 4 入口：只做首轮任务判断 | `summary_quiz_board` | 入口判断卡 + 后测题组 + 去向卡 | `quiz_group` | `/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-08` |

## 讲义核心内容映射
| handout_anchor | core_item_type | must_appear_content | target_step | page_mode | interaction_upgrade | media_or_table_ref | acceptance_note |
|---|---|---|---|---|---|---|---|
| `## 一、为什么模块 3 结束前要整合三种语言 / ## 二、统一对象与统一读图口径` | concept+formula | `\text{结构变化} \rightarrow \text{根轨迹第一信号} \rightarrow \text{时域结果} \rightarrow \text{频域解释} \rightarrow \text{任务标签}`；`P(s)=\frac{0.01715}{s(s+0.1)(s+2.14375)}`；`C_0(s)=2.25` | `step-01` | `static` | 用路径图和对象卡固定比较顺序，不加互动。 | `统一对象卡 / 路径图` | 公式链、对象模型和基准控制器必须首屏可见。 |
| `## 三、任务一：基准版本给出哪一类基线` | worked-example+table | 基准版本的闭环极点、阶跃指标、裕度和“综合折中基线”结论。 | `step-03` | `static+interactive` | 只让学生提交任务标签与首个风险点。 | `3-9-baseline-quad.png` | 图、指标表、标签区必须同页。 |
| `## 四、任务二：零点线补强如何优先改善动态` | comparison+formula | `C_z(s)=2.25\frac{12.5s+1}{2s+1}` 以及“更偏动态改善”的判断。 | `step-04` | `static+interactive` | 结构化比较区只负责写出收益域、代价域和任务标签。 | `3-9-zero-line-quad.png` | 公式、图和比较表必须同页。 |
| `### 5.2 弱积分：先看到收益，再看到慢极点 / ### 5.3 强积分：低频收益更彻底，动态代价也被彻底放大 / ### 5.4 积分校正：保留积分任务，同时把动态和裕度拉回可用区` | comparison+formula | `C_{i1}(s)=2.25\left(1+\frac{1}{200s}\right)`；`C_{i2}(s)=2.25\left(1+\frac{1}{40s}\right)`；`C_{ic}(s)=2.25\left(1+\frac{1}{40s}\right)\frac{20s+1}{2s+1}` | `step-05` | `static+interactive` | 比较矩阵只负责记录“低频收益域 / 代价域 / 是否把中频整理拉回”。 | `3-9-integral-weak-quad.png / 3-9-integral-strong-quad.png / 3-9-integral-corrected-quad.png` | 三个公式与三张图必须同时落下。 |
| `### 5.5 滞后对照：稳态改善还有另一条路径 / ### 5.6 积分家族的统一结论` | comparison+formula | `C_{\mathrm{lag}}(s)=4.5\frac{40s+1}{80s+1}` 以及“滞后能把误差压小，但不等于改型别”的结论。 | `step-06` | `static+interactive` | 判断区只检查“压小误差”和“压到零”的差别。 | `3-9-lag-quad.png` | 公式、积分/滞后对照卡和判断区必须同页。 |
| `## 六、综合映射：同一对象上的三条典型路线怎样分工` | table+workspace | 结构变化、根轨迹第一信号、时域结果、频域代价/收益、任务标签的综合映射表。 | `step-07` | `static+interactive` | 工作区允许填写与重提，但不隐藏标准表头。 | `综合映射表` | 表头必须先于输入区出现。 |
| ## 七、通向 `4-1` 的入口判断 / ## 本讲小结 | summary+quiz | “更快 / 更准 / 兼顾稳与快”三类入口判断，以及模块 4 只接收首轮任务判断。 | `step-08` | `static+quiz` | 后测只检查首轮判断，不允许越级到完整整定。 | `3-9-info.png` | 入口判断卡、后测题和去向卡必须同页。 |

## 步骤 01｜回到地图：固定统一对象与比较顺序

### 页面骨架
- 模板：`map_hero_slide`
- 区域：`header` / `lead` / `summary`

### 模块清单
- `stage-map`：模块路径图
- `object-card`：统一对象卡
- `formula-chain-card`：比较顺序公式链

### 静态承载内容
- 固定高亮路径：`3-8 -> 3-9 -> 4-1`。
- 固定对象公式：
$$
P(s)=\frac{0.01715}{s(s+0.1)(s+2.14375)}
$$
$$
C_0(s)=2.25
$$
$$
L_0(s)=C_0(s)P(s)=\frac{0.0385875}{s(s+0.1)(s+2.14375)}
$$
- 固定比较链：
$$
\text{结构变化}
\rightarrow
\text{根轨迹第一信号}
\rightarrow
\text{时域结果}
\rightarrow
\text{频域解释}
\rightarrow
\text{任务标签}
$$
- 固定边界：本课只做首轮任务判断，不给完整最优方案。

### 互动升级点
- 组件类型：`none`

### 埋点与教师数据
- 埋点摘要：`viewed`、`timeOnStep`、`teacherFollowSync`
- 教师聚合：`view_count`、`sync_status`

### AI 边界
- 页面目标：固定统一对象与比较顺序。
- 允许范围：对象、公式链、模块衔接。
- 禁止范围：提前给方案优劣排名。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-01`
- 对齐要求：对象公式与比较链必须首屏可见。

## 步骤 02｜前测：先贴任务标签，不先报控制器名称

### 页面骨架
- 模板：`question_stack`
- 区域：`question-stack` / `tag-card` / `submit-bar`

### 模块清单
- `pretest-q1`：更快先回看哪条机制线
- `pretest-q2`：更准时先问什么
- `pretest-q3`：收益是否总在同一域暴露
- `pretest-q4`：带宽变大是否必然更优
- `task-label-reminder`：任务标签提醒卡

### 静态承载内容
- 固定任务标签三类：
  - 更偏动态改善
  - 更偏稳态改善
  - 更偏综合折中
- 固定提醒：回答时先写任务标签，再写可能的机制线。

### 互动升级点
- 组件类型：`quiz_group`
- 作答模型：允许重提一次；教师端区分首答与重提
- 揭示规则：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`attemptCount`、`resultState`、`errorBucket`
- 教师聚合：`question_distribution`、`task_label_confusion`

### AI 边界
- 页面目标：暴露“先报控制器名称”的误区。
- 允许范围：任务标签、错因标签、首轮判断顺序。
- 禁止范围：AI 代替作答。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-02`
- 对齐要求：四题和任务标签提醒卡必须同页。

## 步骤 03｜基准版本：把它判成什么标签

### 页面骨架
- 模板：`design_compare_workspace`
- 区域：`media` / `table` / `interaction`

### 模块清单
- `baseline-quad`：基准 `2×2` 图
- `baseline-metrics`：指标表
- `baseline-tag-zone`：任务标签与风险填写区

### 静态承载内容
- 固定图片：`3-9-baseline-quad.png`
- 指标表至少包含：闭环极点、超调量、调节时间、相角裕度、增益裕度、单位斜坡误差。
- 固定结论：基准版本是后续所有比较的统一锚点，更像“综合折中基线”。

### 互动升级点
- 组件类型：`structured_compare`
- 任务：填写 `任务标签 / 第一风险点 / 首先观察的域`
- 反馈规则：教师端统一揭示，不在学生端直接给答案

### 埋点与教师数据
- 埋点摘要：`draftSubmitted`、`tagChoice`、`riskChoice`
- 教师聚合：`tag_distribution`、`risk_distribution`

### AI 边界
- 页面目标：让学生先用统一顺序读基准对象。
- 允许范围：根轨迹、时域、频域、基线标签。
- 禁止范围：跳过基准直接比补强版本。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-03`
- 对齐要求：图、指标表和标签区必须同屏。

## 步骤 04｜零点线补强：更偏动态改善的样例

### 页面骨架
- 模板：`design_compare_workspace`
- 区域：`media` / `table` / `interaction`

### 模块清单
- `zero-line-quad`：零点线 `2×2` 图
- `zero-line-metrics`：关键指标表
- `zero-line-compare-zone`：收益/代价/标签填写区

### 静态承载内容
- 固定控制器：
$$
C_z(s)=2.25\frac{12.5s+1}{2s+1}
$$
- 固定图片：`3-9-zero-line-quad.png`
- 固定判断：这一版优先回答“更快一些该怎么办”，但不直接承担“更准一些”的任务。

### 互动升级点
- 组件类型：`structured_compare`
- 任务：填写 `主要收益域 / 主要代价域 / 任务标签 / 与基准相比最显著变化`
- 反馈规则：提交后只回显已填写内容，答案由教师统一揭示

### 埋点与教师数据
- 埋点摘要：`draftSubmitted`、`benefitDomain`、`costDomain`
- 教师聚合：`benefit_domain_distribution`、`cost_domain_distribution`

### AI 边界
- 页面目标：压实零点线更偏动态改善。
- 允许范围：中频整理、超调变化、裕度变化。
- 禁止范围：把零点线直接说成最优方案。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-04`
- 对齐要求：控制器公式、图和比较区必须同页。

## 步骤 05｜积分家族：低频收益与中频代价如何一起暴露

### 页面骨架
- 模板：`matrix_lab_board`
- 区域：`media` / `table` / `interaction`

### 模块清单
- `integral-weak-quad`：弱积分图
- `integral-strong-quad`：强积分图
- `integral-corrected-quad`：积分校正图
- `integral-matrix`：比较矩阵

### 静态承载内容
- 固定控制器：
$$
C_{i1}(s)=2.25\left(1+\frac{1}{200s}\right)
$$
$$
C_{i2}(s)=2.25\left(1+\frac{1}{40s}\right)
$$
$$
C_{ic}(s)=2.25\left(1+\frac{1}{40s}\right)\frac{20s+1}{2s+1}
$$
- 固定图片：
  - `3-9-integral-weak-quad.png`
  - `3-9-integral-strong-quad.png`
  - `3-9-integral-corrected-quad.png`
- 固定矩阵列：`低频收益先出现在哪 / 代价先暴露在哪 / 是否已把中频整理拉回 / 任务标签`

### 互动升级点
- 组件类型：`matrix_workspace`
- 任务：完成三版本比较矩阵
- 反馈规则：即时保存，不即时判对错

### 埋点与教师数据
- 埋点摘要：`matrixUpdated`、`versionCompared`、`submissionState`
- 教师聚合：`completion_rate`、`common_misjudgments`

### AI 边界
- 页面目标：让学生看见“低频收益越强，越要单独回看中频代价”。
- 允许范围：积分强弱、型别改善、相位余量与长尾。
- 禁止范围：把积分路线说成唯一稳态改善路线。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-05`
- 对齐要求：三公式、三图和矩阵表头必须同页。

## 步骤 06｜滞后对照：稳态改善的另一条路径

### 页面骨架
- 模板：`comparison_panel_with_reason`
- 区域：`media` / `table` / `interaction`

### 模块清单
- `lag-quad`：滞后图
- `lag-compare-card`：积分 vs 滞后对照卡
- `lag-reason-zone`：判断区

### 静态承载内容
- 固定控制器：
$$
C_{\mathrm{lag}}(s)=4.5\frac{40s+1}{80s+1}
$$
- 固定图片：`3-9-lag-quad.png`
- 固定对照维度：`是否改型别 / 误差改善程度 / 中频代价 / 调节时间变化`
- 固定结论：滞后能压小误差，但不等于像积分那样把某类误差直接压到零。

### 互动升级点
- 组件类型：`reason_check`
- 任务：判断“压小误差”和“压到零”分别更对应哪条稳态改善路径
- 反馈规则：教师端统一揭示

### 埋点与教师数据
- 埋点摘要：`selectedOption`、`resultState`
- 教师聚合：`option_distribution`、`integral_lag_confusion`

### AI 边界
- 页面目标：压实积分与滞后的分工差异。
- 允许范围：型别、低频收益、中频代价、动态影响。
- 禁止范围：展开完整滞后-超前联合设计。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-06`
- 对齐要求：公式、对照卡和判断区必须同页。

## 步骤 07｜综合映射工作区：把收益和代价写回同一张表

### 页面骨架
- 模板：`mapping_workspace`
- 区域：`table` / `risk` / `submit`

### 模块清单
- `mapping-template`：综合映射表
- `risk-note-card`：风险提醒卡
- `submit-zone`：提交区

### 静态承载内容
- 固定表头：
  - 结构变化
  - 根轨迹第一信号
  - 时域结果
  - 频域解释
  - 任务标签
  - 主要风险
- 固定提醒：每个版本都要写“最先暴露收益的域”和“最先暴露代价的域”。

### 互动升级点
- 组件类型：`table_builder`
- 任务：完成四个版本的综合映射表并提交
- 反馈规则：允许重提；教师端聚合常见漏项

### 埋点与教师数据
- 埋点摘要：`rowCompleted`、`submissionState`、`revisionCount`
- 教师聚合：`row_completion_heatmap`、`missing_field_toplist`

### AI 边界
- 页面目标：把分散观察压成统一输出格式。
- 允许范围：收益域、代价域、任务标签、机制线。
- 禁止范围：让 AI 代替填写整张表。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-07`
- 对齐要求：表头必须先于输入区出现，不能只剩空表单。

## 步骤 08｜模块 4 入口：只做首轮任务判断

### 页面骨架
- 模板：`summary_quiz_board`
- 区域：`summary` / `quiz` / `next-step`

### 模块清单
- `entry-judgment-card`：入口判断卡
- `posttest-quiz`：后测题组
- `next-step-card`：去向卡

### 静态承载内容
- 固定三类入口判断：
  - 我希望它更快；
  - 我希望它更准；
  - 我希望既快又准但不能太冒进。
- 固定去向：`3-9` 输出的是首轮任务判断，`4-1` 才进入性能指标、约束与可行域。
- 固定总结图：`3-9-info.png`

### 互动升级点
- 组件类型：`quiz_group`
- 任务：完成入口判断后测
- 揭示规则：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`attemptCount`、`resultState`、`errorBucket`
- 教师聚合：`posttest_distribution`、`module4_ready_rate`

### AI 边界
- 页面目标：把模块 3 的出口定位为“先问对问题”。
- 允许范围：入口判断、风险边界、后续模块去向。
- 禁止范围：越级给出完整选型和整定。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-08`
- 对齐要求：入口判断卡、后测题和去向卡必须同页。
