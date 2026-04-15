━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
互动页面设计 | 单元 3-9：稳定—动态—稳态综合映射实验
技术栈：Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 文档职责
- 本文件是供人审阅的页面蓝图，只描述页面模板、固定内容、互动组件、反馈规则、教师聚合、AI 边界与学生页预览口径。
- 同目录 [interactive-contract.yaml](./interactive-contract.yaml) 是机读契约；两者必须逐步骤一一对应。
- 本文件不是课堂台词稿，不把关键公式、图表、判断链、任务表头或提交字段留给实现阶段补脑。
- 默认预览口径固定为学生演示页；教师端只查看步骤骨架、聚合结果和课堂同步状态，不代替真实学生页预览。

## 表述规则
- 页面描述只保留客观结构：区域、模块、固定文本、公式、图片、表格、互动组件、埋点和验收条件。
- 动作化表述禁用：`展示`、`引导`、`让学生`、`跟着做`、`教师讲`、`先听后做` 等。
- 静态证据优先。互动组件只负责贴标签、补全比较链、提交综合映射和暴露误判，不替代讲义里的关键公式、指标表与结论。
- 本课主线固定为：`统一对象 -> 任务标签前测 -> 基准锚点 -> 零点线补强 -> 为什么稳态路线改看斜坡 -> 强积分与积分校正 -> 滞后对照 -> 综合映射 -> 模块 4 入口判断`。
- 当前作者态固定把“学生自选补强版本”落为零点线补强，保证 `handout.md`、`boppps.md` 与互动页的审查口径一致。

## 证据单元升级决策表
| 证据类型 | 来源锚点 | 目标步骤 | 升级方式 | 保留元素 | 不得删减内容 | 验收点 |
|---|---|---|---|---|---|---|
| 路径定位 + 统一对象 + 比较链 | `## 一、为什么模块 3 结束前要整合三种语言`、`## 二、统一对象与统一读图口径` | step-01 | 静态保留 | `3-8 -> 3-9 -> 4-1` 路径、对象公式、比较链、边界卡 | `P(s)`、`C_0(s)`、`L_0(s)` 与“只做首轮任务判断”不得缺失 | 首屏直接看到路径图、对象卡、比较链与边界卡 |
| 前测误区 | `## 一、为什么模块 3 结束前要整合三种语言` | step-02 | 静态保留 + 快答 | 三类任务标签、四类误判题干、错因标签 | “先贴任务标签，不先报控制器名称”不得删 | 四题与任务标签提醒卡在未作答状态下完整可见 |
| 基准版本四象限 + 指标锚点 | `## 三、任务一：基准版本给出哪一类基线` | step-03 | 静态保留 + 结构化填写 | `3-9-baseline-quad.png`、指标表、基线结论、四象限读法 | 不得只保留图片或只保留指标表；“综合折中基线”结论不得缺失 | 图、指标表、基线结论和填写区同屏 |
| 零点线补强证据链 | `## 四、任务二：零点线补强如何优先改善动态` | step-04 | 静态保留 + 结构化比较 | `C_z(s)`、`3-9-zero-line-quad.png`、关键指标、任务标签结论 | 不得把“更偏动态改善”压缩成一句口号；“不直接承担更准任务”不得删 | 公式、图、关键指标和比较区同页 |
| 为什么稳态路线要改看斜坡 + 弱积分首个样例 | `## 五、任务三：积分家族如何把低频收益和中频代价同时暴露出来`、`### 5.1 为什么这一组要改看斜坡跟踪`、`### 5.2 弱积分：先看到收益，再看到慢极点` | step-05 | 静态保留 + 工作区补链 | 读图口径说明、`C_{i1}(s)`、基准/弱积分对照表、`3-9-integral-weak-quad.png` | “这一组要改看斜坡”与“低频收益先出现、慢极点代价同步出现”不得删 | 读图口径卡、公式、图、对照表和填写区同屏 |
| 强积分与积分校正的双重证据链 | `### 5.3 强积分：低频收益更彻底，动态代价也被彻底放大`、`### 5.4 积分校正：保留积分任务，同时把动态和裕度拉回可用区` | step-06 | 静态保留 + 比较矩阵 | `C_{i2}(s)`、`C_{ic}(s)`、两张 `2×2` 图、三版本比较矩阵表头 | 不得只保留强积分或只保留积分校正；“中频整理拉回”判断不得缺失 | 三个积分版本的比较维度先于矩阵输入区出现 |
| 滞后对照 + 积分家族统一结论 | `### 5.5 滞后对照：稳态改善还有另一条路径`、`### 5.6 积分家族的统一结论` | step-07 | 静态保留 + 判断 | `C_{\mathrm{lag}}(s)`、`3-9-lag-quad.png`、积分/滞后对照卡、四条统一结论 | 不得把滞后写成“弱积分”；“压小误差”和“压到零”差别不得删 | 公式、图、对照卡、统一结论和判断区同页 |
| 综合映射表 + 短报告模板 | `## 六、综合映射：同一对象上的三条典型路线怎样分工`、`## 课堂实践提交单` | step-08 | 静态保留 + 表格工作区 | 表头、六个版本行、短报告模板、风险提醒 | 不得只留空表；“最先暴露收益的域 / 代价的域”列不得缺失 | 表头、模板和输入区同页，且表头先于输入区出现 |
| 模块 4 入口判断 + 小结 | ## 七、通向 4-1 的入口判断、## 本讲小结 | step-09 | 静态保留 + 后测 | 三类入口判断、不可直接做的事、信息图、去向卡 | 不得越级写成完整选型或整定 | 入口判断卡、后测题、信息图和去向卡同页 |

## 混合证据顺序表
| 步骤 | 先出现什么 | 再出现什么 | 最后出现什么 | 必须同屏内容 | 不得折叠内容 |
|---|---|---|---|---|---|
| step-03 | 基准结论卡 + `2×2` 图 | 指标表 + 四象限读法 | 任务标签填写区 | 图、指标表、基线结论 | 指标表 |
| step-04 | 零点线控制器公式 | `2×2` 图 + 关键指标 | 收益域/代价域比较区 | 公式、图、指标表 | 控制器公式 |
| step-05 | “为什么改看斜坡”口径卡 | 弱积分公式 + 图 + 基准/弱积分对照表 | 证据链填写区 | 口径卡、公式、图、对照表 | 口径卡 |
| step-06 | 强积分与积分校正公式 | 两张 `2×2` 图 + 三版本矩阵表头 | 比较矩阵工作区 | 两个公式、两张图、矩阵表头 | 矩阵表头 |
| step-07 | 滞后公式 + 对照维度卡 | `2×2` 图 + 积分/滞后对照卡 + 统一结论 | 判断区 | 公式、图、对照卡、统一结论 | 对照维度卡 |
| step-08 | 综合映射表头 | 六行版本模板 + 短报告模板 | 提交区 | 表头、模板、风险提醒 | 表头 |
| step-09 | 三类入口判断卡 | 后测题组 + 信息图 | 去向卡 | 入口判断卡、后测题、信息图 | 入口判断卡 |

## 全课总览
| 步骤 | 标题 | 页面模板 | 主体布局 | 互动组件 | 学生页预览 |
|------|------|----------|----------|----------|------------|
| step-01 | 回到地图：固定统一对象与比较顺序 | `map_hero_slide` | 路径图 + 对象卡 + 比较链 | `none` | `/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-01` |
| step-02 | 前测：先贴任务标签，不先报控制器名称 | `question_stack` | 四题快答 + 标签卡 + 提交条 | `quiz_group` | `/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-02` |
| step-03 | 基准锚点：先把综合折中基线读完整 | `design_compare_workspace` | 基准 `2×2` 图 + 指标表 + 标签区 | `structured_compare` | `/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-03` |
| step-04 | 零点线补强：更偏动态改善的证据链 | `design_compare_workspace` | 公式卡 + 对照 `2×2` 图 + 比较区 | `structured_compare` | `/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-04` |
| step-05 | 稳态路线先改看斜坡：弱积分的第一组证据 | `formula_media_compare` | 口径卡 + 弱积分图 + 对照表 + 填写区 | `structured_compare` | `/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-05` |
| step-06 | 强积分与积分校正：低频收益与中频整理怎样同时落表 | `matrix_lab_board` | 两张 `2×2` 图 + 三版本矩阵表头 + 工作区 | `matrix_workspace` | `/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-06` |
| step-07 | 滞后对照：稳态改善的另一条路径与积分家族统一结论 | `comparison_panel_with_reason` | 滞后图 + 对照卡 + 统一结论 + 判断区 | `reason_check` | `/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-07` |
| step-08 | 综合映射工作区：把六个版本写回同一张机制地图 | `mapping_workspace` | 映射表 + 短报告模板 + 提交区 | `table_builder` | `/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-08` |
| step-09 | 模块 4 入口：只做首轮任务判断，不给完整方案 | `summary_quiz_board` | 判断卡 + 后测题组 + 去向卡 | `quiz_group` | `/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-09` |

## 讲义核心内容映射
| handout_anchor | core_item_type | must_appear_content | target_step | page_mode | interaction_upgrade | media_or_table_ref | acceptance_note |
|---|---|---|---|---|---|---|---|
| `## 一、为什么模块 3 结束前要整合三种语言 / ## 二、统一对象与统一读图口径` | concept+formula | `P(s)`、`C_0(s)`、`L_0(s)`、比较链、统一 `2×2` 读图口径、本课边界。 | `step-01` | `static` | 无。 | 路径图 / 对象卡 / 比较链卡 | 对象公式、比较链和边界卡必须首屏可见。 |
| `## 一、为什么模块 3 结束前要整合三种语言` | question+misconception | 三类任务标签、四类误判问题、“先贴任务标签”提醒。 | `step-02` | `static+quiz` | 快答组件只暴露误区，不替代题干。 | 任务标签卡 | 四题与任务标签提醒卡必须同页。 |
| `## 三、任务一：基准版本给出哪一类基线` | worked-example+table | 基准 `2×2` 图、关键指标表、综合折中基线结论、四象限读法。 | `step-03` | `static+interactive` | 只让学生填写任务标签、第一风险点和首个观察域。 | `3-9-baseline-quad.png` | 图、指标表和基线结论必须同页。 |
| `## 四、任务二：零点线补强如何优先改善动态` | comparison+formula | `C_z(s)=2.25\frac{12.5s+1}{2s+1}`、校正前后 `2×2` 对照、关键指标与动态改善结论。 | `step-04` | `static+interactive` | 比较区只负责写出收益域、代价域、任务标签与“不承担更准任务”的理由。 | `3-9-zero-line-quad.png` | 公式、图和比较区必须同页。 |
| `## 五、任务三：积分家族如何把低频收益和中频代价同时暴露出来 / ### 5.1 为什么这一组要改看斜坡跟踪 / ### 5.2 弱积分：先看到收益，再看到慢极点` | concept+comparison | 为什么改看斜坡、`C_{i1}(s)`、弱积分的图、基准/弱积分对照与判断句。 | `step-05` | `static+interactive` | 填写区只负责补全“首个收益域 / 首个代价域 / 是否改型别”。 | `3-9-integral-weak-quad.png` | 读图口径卡、公式、图、对照表必须同页。 |
| `### 5.3 强积分：低频收益更彻底，动态代价也被彻底放大 / ### 5.4 积分校正：保留积分任务，同时把动态和裕度拉回可用区` | comparison+formula | `C_{i2}(s)`、`C_{ic}(s)`、两张图、三版本矩阵表头与“是否把中频整理拉回”判断。 | `step-06` | `static+interactive` | 矩阵工作区只负责比较，不隐藏表头。 | `3-9-integral-strong-quad.png / 3-9-integral-corrected-quad.png` | 两公式、两图和矩阵表头必须同页。 |
| `### 5.5 滞后对照：稳态改善还有另一条路径 / ### 5.6 积分家族的统一结论` | comparison+summary | `C_{\mathrm{lag}}(s)`、滞后图、积分/滞后对照维度、四条统一结论。 | `step-07` | `static+interactive` | 判断区只检查“压小误差”和“压到零”的分工。 | `3-9-lag-quad.png` | 公式、图、对照卡和统一结论必须同页。 |
| `## 六、综合映射：同一对象上的三条典型路线怎样分工 / ## 课堂实践提交单` | table+workspace | 六个版本的综合映射表、短报告模板、风险提醒。 | `step-08` | `static+interactive` | 表格工作区允许重提，但不隐藏标准表头。 | 综合映射表 / 短报告模板 | 表头和模板必须先于输入区出现。 |
| ## 七、通向 4-1 的入口判断 / ## 本讲小结 | summary+quiz | 三类入口判断、不可直接做的事、`3-9-info.png`、模块 4 去向。 | `step-09` | `static+quiz` | 后测只检查入口判断，不越级到整定。 | `3-9-info.png` | 入口判断卡、后测题、信息图和去向卡必须同页。 |

## 步骤 01｜回到地图：固定统一对象与比较顺序

### 页面骨架
- 模板：`map_hero_slide`
- 区域：`header` / `lead` / `summary`

### 模块清单
- `stage-map`：模块路径图
- `object-card`：统一对象卡
- `comparison-chain-card`：比较链卡
- `boundary-card`：本课边界卡

### 静态承载内容
- 路径图固定高亮 `3-8 -> 3-9 -> 4-1`。
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
- 固定边界：
  - 本课不新增控制机制；
  - 本课不写完整最优方案；
  - 本课只输出模块 4 的首轮任务判断。

### 互动升级点
- 组件类型：`none`

### 埋点与教师数据
- 埋点摘要：`viewed`、`timeOnStep`、`teacherFollowSync`
- 教师聚合：`view_count`、`sync_status`

### AI 边界
- 页面目标：固定统一对象、比较顺序与本课边界。
- 允许范围：对象公式、比较链、`3-8 / 3-9 / 4-1` 衔接。
- 禁止范围：提前给版本优劣排名。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-01`
- 对齐要求：对象公式、比较链和边界卡必须首屏可见。

## 步骤 02｜前测：先贴任务标签，不先报控制器名称

### 页面骨架
- 模板：`question_stack`
- 区域：`question-stack` / `tag-card` / `submit-bar`

### 模块清单
- `pretest-q1`：更快先回看哪条机制线
- `pretest-q2`：更准时先问什么
- `pretest-q3`：收益是否总在同一域暴露
- `pretest-q4`：带宽变大是否必然更优
- `task-label-card`：任务标签提醒卡

### 静态承载内容
- 固定任务标签三类：
  - 更偏动态改善
  - 更偏稳态改善
  - 更偏综合折中
- 固定提醒：
  - 先贴任务标签，再回看机制线；
  - 不先报控制器名称；
  - 不只写收益，不省略代价。

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
- 禁止范围：AI 直接代答。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-02`
- 对齐要求：四题和任务标签提醒卡必须同页。

## 步骤 03｜基准锚点：先把综合折中基线读完整

### 页面骨架
- 模板：`design_compare_workspace`
- 区域：`media` / `table` / `interaction`

### 模块清单
- `baseline-quad`：基准 `2×2` 图
- `baseline-metrics`：指标表
- `baseline-summary-card`：基线结论卡
- `baseline-tag-zone`：任务标签与风险填写区

### 静态承载内容
- 固定图片：`3-9-baseline-quad.png`
- 指标表至少包含：闭环极点、超调量、调节时间、上升时间、相角裕度、增益裕度、增益交叉频率、单位斜坡稳态误差。
- 固定结论：
  - 基准版本是后续所有比较的统一锚点；
  - 任务标签更偏“综合折中基线”；
  - 第一风险通常先落在相位余量与超调边界。
- 固定四象限读法：
  - 左上看阶跃响应；
  - 左下看根轨迹与闭环极点；
  - 右上看幅频与交叉频率；
  - 右下看相频与稳定裕度。

### 互动升级点
- 组件类型：`structured_compare`
- 任务：填写 `任务标签 / 第一风险点 / 首先观察的域 / 一句话判断`
- 反馈规则：教师端统一揭示，不在学生端直接给答案

### 埋点与教师数据
- 埋点摘要：`draftSubmitted`、`tagChoice`、`riskChoice`
- 教师聚合：`tag_distribution`、`risk_distribution`

### AI 边界
- 页面目标：先把基准版读成统一锚点。
- 允许范围：基准图、指标表、综合折中标签。
- 禁止范围：跳过基准直接比较补强版本。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-03`
- 对齐要求：图、指标表、基线结论和填写区必须同屏。

## 步骤 04｜零点线补强：更偏动态改善的证据链

### 页面骨架
- 模板：`design_compare_workspace`
- 区域：`media` / `table` / `interaction`

### 模块清单
- `zero-line-controller-card`：控制器公式卡
- `zero-line-quad`：零点线 `2×2` 图
- `zero-line-metrics`：关键指标表
- `zero-line-compare-zone`：收益域/代价域比较区

### 静态承载内容
- 固定控制器：
$$
C_z(s)=2.25\frac{12.5s+1}{2s+1}
$$
- 固定图片：`3-9-zero-line-quad.png`
- 关键指标至少包含：新增零点、新增极点、主要复极点位置、阶跃超调量、调节时间、相角裕度、增益交叉频率、单位斜坡稳态误差。
- 固定判断：
  - 这一版优先回答“更快一些该怎么办”；
  - 它改写的是中频相位和根轨迹阻尼；
  - 它不直接承担“更准一些”的任务。

### 互动升级点
- 组件类型：`structured_compare`
- 任务：填写 `主要收益域 / 主要代价域 / 任务标签 / 与基准相比最显著变化 / 为什么不承担更准任务`
- 反馈规则：提交后只回显已填写内容，标准答案由教师统一揭示

### 埋点与教师数据
- 埋点摘要：`draftSubmitted`、`benefitDomain`、`costDomain`
- 教师聚合：`benefit_domain_distribution`、`cost_domain_distribution`

### AI 边界
- 页面目标：压实零点线更偏动态改善。
- 允许范围：中频整理、超调变化、裕度变化、根轨迹左移。
- 禁止范围：把零点线直接说成最优方案。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-04`
- 对齐要求：控制器公式、图、关键指标和比较区必须同页。

## 步骤 05｜稳态路线先改看斜坡：弱积分的第一组证据

### 页面骨架
- 模板：`formula_media_compare`
- 区域：`lead` / `media` / `table` / `interaction`

### 模块清单
- `slope-reading-card`：为什么改看斜坡口径卡
- `weak-integral-controller-card`：弱积分公式卡
- `weak-integral-quad`：弱积分 `2×2` 图
- `baseline-weak-table`：基准/弱积分对照表
- `weak-integral-zone`：证据链填写区

### 静态承载内容
- 固定读图口径：
  - 这一组左上角改看单位斜坡跟踪响应或误差响应；
  - 基准对象面对单位阶跃本来就是零静差；
  - 要看积分路线解决了什么，就必须改看斜坡误差与慢极点代价。
- 固定控制器：
$$
C_{i1}(s)=2.25\left(1+\frac{1}{200s}\right)
$$
- 固定图片：`3-9-integral-weak-quad.png`
- 对照表至少包含：单位斜坡稳态误差、相角裕度、阶跃超调量、调节时间。
- 固定判断：
  - 弱积分先让低频收益开始出现；
  - 同时引入贴近虚轴的慢极点；
  - 代价先在相位余量和收束拖尾上暴露。

### 互动升级点
- 组件类型：`structured_compare`
- 任务：填写 `首个收益域 / 首个代价域 / 是否改型别 / 一句话判断`
- 反馈规则：教师端统一揭示，不即时给标准答案

### 埋点与教师数据
- 埋点摘要：`draftSubmitted`、`benefitDomain`、`costDomain`
- 教师聚合：`benefit_domain_distribution`、`cost_domain_distribution`

### AI 边界
- 页面目标：让学生先固定“稳态路线改看斜坡”的读图口径。
- 允许范围：斜坡误差、慢极点、相角裕度、型别变化。
- 禁止范围：把弱积分说成已经完成稳态设计。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-05`
- 对齐要求：读图口径卡、公式、图、对照表和填写区必须同页。

## 步骤 06｜强积分与积分校正：低频收益与中频整理怎样同时落表

### 页面骨架
- 模板：`matrix_lab_board`
- 区域：`media` / `table` / `interaction`

### 模块清单
- `strong-integral-controller-card`：强积分公式卡
- `integral-corrected-controller-card`：积分校正公式卡
- `strong-integral-quad`：强积分 `2×2` 图
- `integral-corrected-quad`：积分校正 `2×2` 图
- `integral-matrix-header`：三版本矩阵表头
- `integral-matrix`：比较矩阵工作区

### 静态承载内容
- 固定控制器：
$$
C_{i2}(s)=2.25\left(1+\frac{1}{40s}\right)
$$
$$
C_{ic}(s)=2.25\left(1+\frac{1}{40s}\right)\frac{20s+1}{2s+1}
$$
- 固定图片：
  - `3-9-integral-strong-quad.png`
  - `3-9-integral-corrected-quad.png`
- 固定矩阵列：
  - 误差趋零速度
  - 相角裕度变化
  - 超调与调节时间变化
  - 是否把中频整理拉回
  - 任务标签
- 固定比较对象：矩阵默认同时比较 `弱积分 / 强积分 / 积分校正` 三个版本。
- 固定判断：
  - 强积分说明“更准”可以更彻底，但代价被放大；
  - 积分校正说明积分路线仍要配合中频整理；
  - 这一页不能只看低频收益，不看中频代价。

### 互动升级点
- 组件类型：`matrix_workspace`
- 任务：完成三版本比较矩阵
- 反馈规则：即时保存，不即时判对错

### 埋点与教师数据
- 埋点摘要：`matrixUpdated`、`versionCompared`、`submissionState`
- 教师聚合：`completion_rate`、`common_misjudgments`

### AI 边界
- 页面目标：压实“低频收益越强，越要回看中频代价与整理动作”。
- 允许范围：积分强弱、型别改善、相位余量、长尾、中频整理。
- 禁止范围：把积分路线说成唯一答案。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-06`
- 对齐要求：两公式、两图和矩阵表头必须同页，且表头先于输入区出现。

## 步骤 07｜滞后对照：稳态改善的另一条路径与积分家族统一结论

### 页面骨架
- 模板：`comparison_panel_with_reason`
- 区域：`media` / `table` / `interaction`

### 模块清单
- `lag-controller-card`：滞后公式卡
- `lag-quad`：滞后 `2×2` 图
- `integral-lag-compare-card`：积分/滞后对照卡
- `family-summary-card`：积分家族统一结论卡
- `lag-reason-zone`：判断区

### 静态承载内容
- 固定控制器：
$$
C_{\mathrm{lag}}(s)=4.5\frac{40s+1}{80s+1}
$$
- 固定图片：`3-9-lag-quad.png`
- 固定对照维度：
  - 是否改型别
  - 误差是压小还是压到零
  - 中频代价
  - 调节时间变化
- 固定统一结论：
  - 弱积分先看到收益，也先看到慢极点代价；
  - 强积分把精度收益和动态代价一起放大；
  - 积分校正说明积分路线必须配合中频整理；
  - 滞后说明稳态改善不只一条路，但改善程度与代价分布不同。

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
- 学生页预览：`/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-07`
- 对齐要求：公式、图、对照卡、统一结论和判断区必须同页。

## 步骤 08｜综合映射工作区：把六个版本写回同一张机制地图

### 页面骨架
- 模板：`mapping_workspace`
- 区域：`table` / `report` / `submit`

### 模块清单
- `mapping-template`：综合映射表
- `report-template-card`：短报告模板卡
- `risk-note-card`：风险提醒卡
- `submit-zone`：提交区

### 静态承载内容
- 固定表头：
  - 版本
  - 任务标签
  - 结构变化
  - 根轨迹第一信号
  - 最先暴露收益的域
  - 最先暴露代价的域
  - 时域结果
  - 频域解释
  - 主要风险
  - 一句话判断
- 固定版本行：
  - 基准版本
  - 零点线补强
  - 弱积分
  - 强积分
  - 积分校正
  - 滞后对照（教师演示后复判）
- 固定短报告模板：
  - 我把 ________ 版本判为“________”路线，因为根轨迹上的第一信号是 ________；
  - 时域证据说明 ________，频域证据说明 ________；
  - 因此它虽然完成了 ________，但也把 ________ 提前暴露出来。
- 固定提醒：每个版本都必须同时写收益与代价，不能只留下“更好”。

### 互动升级点
- 组件类型：`table_builder`
- 任务：完成综合映射表并提交短报告
- 反馈规则：允许重提；教师端聚合漏项和高频误判

### 埋点与教师数据
- 埋点摘要：`rowCompleted`、`submissionState`、`revisionCount`
- 教师聚合：`row_completion_heatmap`、`missing_field_toplist`

### AI 边界
- 页面目标：把分散观察压成统一输出格式。
- 允许范围：收益域、代价域、任务标签、机制线、短报告模板。
- 禁止范围：让 AI 代替填写整张表。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-08`
- 对齐要求：表头、版本模板、短报告模板和输入区必须同页，且表头先于输入区出现。

## 步骤 09｜模块 4 入口：只做首轮任务判断，不给完整方案

### 页面骨架
- 模板：`summary_quiz_board`
- 区域：`summary` / `quiz` / `next-step`

### 模块清单
- `entry-judgment-card`：入口判断卡
- `posttest-quiz`：后测题组
- `info-card`：信息图卡
- `next-step-card`：去向卡

### 静态承载内容
- 固定三类入口判断：
  - 我希望它更快；
  - 我希望它更准；
  - 我希望既快又准但不能太冒进。
- 固定“不可直接做的事”：
  - 不直接加最强积分；
  - 不把零点线直接认成最优方案；
  - 不把带宽变大等同于全面更好。
- 固定信息图：`3-9-info.png`
- 固定去向：
  - `3-9` 输出的是首轮任务判断；
  - `4-1` 才进入性能指标、工程约束与可行域表达。

### 互动升级点
- 组件类型：`quiz_group`
- 任务：完成模块 4 入口后测
- 揭示规则：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`attemptCount`、`resultState`、`errorBucket`
- 教师聚合：`posttest_distribution`、`module4_ready_rate`

### AI 边界
- 页面目标：把模块 3 的出口定位为“先问对问题”。
- 允许范围：入口判断、风险边界、后续模块去向。
- 禁止范围：越级给出完整选型和整定。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-09`
- 对齐要求：入口判断卡、后测题、信息图和去向卡必须同页。
