━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
互动页面设计 | 单元 3-5：零点引入与动态改善——为什么改变结构后，轨迹和响应会一起变
技术栈：Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 文档职责
- 本文件是供人审阅的页面蓝图，只描述页面模板、固定内容、互动组件、反馈规则、教师聚合、AI 边界与学生页预览口径。
- 同目录 [interactive-contract.yaml](./interactive-contract.yaml) 是机读契约；两者必须逐步骤一一对应。
- 本文件不是讲义摘要，不写教师口播，不把关键公式、图片、表格、判断句或风险边界留给实现阶段补写。
- 默认预览口径固定为学生演示页；教师端模板弹窗只用于查看课堂骨架，不代替真实页面预览。

## 表述规则
- 页面描述只保留客观结构：区域、模块、文本、公式、图片、表格、互动组件、反馈规则、聚合数据与验收条件。
- 动作化表述禁用：`展示`、`引导`、`让学生`、`教师讲`、`先做一次`、`跟着算` 等。
- 静态内容优先。互动组件只负责预测、标注、判断、换算、比较、排序、纠错与提交，不替代核心知识承载。
- 本课主线固定为：`沿既有根轨迹读图为什么不够 -> 左半平面零点怎样改写轨迹骨架 -> PD 与测速反馈为什么不能混同 -> PD 与超前为何先从频域原理区分 -> 右半平面零点为何构成边界 -> 3-6 统一对象实验入口`。

## 全课总览
| 步骤 | 标题 | 页面模板 | 主体布局 | 互动组件 | 学生页预览 |
|------|------|----------|----------|----------|------------|
| step-01 | 回到地图：从沿轨迹读图转向结构改变 | `map_hero_slide` | 路径图 + 主问题卡 + 边界卡 | `none` | `/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-01` |
| step-02 | 统一对象与观察框架：四个版本、三项产出、四个观察量 | `goal_chain_slide` | 对象卡 + 版本卡 + 产出卡 + 观察量卡 | `none` | `/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-02` |
| step-03 | 前测：三类起点误判先落地 | `question_stack` | 三题前测 + 一句直觉 + 反馈条 | `quiz_group` | `/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-03` |
| step-04 | 二阶对象接入零点：先看哪条分支被拉走 | `figure_annotation_workspace` | 根轨迹图 + 对象式 + 标注区 | `annotation_choice` | `/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-04` |
| step-05 | 三阶对象接入零点：零点位置怎样改写主导分支 | `dual_figure_compare_workspace` | 对照图 + 比较卡 + 记录栏 | `compare_note` | `/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-05` |
| step-06 | 第一收束：左半平面零点改善趋势与右半平面问号 | `contrast_summary_board` | 对照表 + 风险预测卡 + 判断表 | `risk_prediction_submit` | `/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-06` |
| step-07 | 结构辨认：PD 与测速反馈不靠名字判断 | `structure_compare_slide` | 结构图 + 术语卡 + 判断区 | `binary_choice` | `/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-07` |
| step-08 | 阻尼工作区：由目标阻尼反求 $K_d$ 与 $K_t$ | `formula_workspace` | 公式卡 + 例题卡 + 填写区 | `worked_example_workspace` | `/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-08` |
| step-09 | PD 与测速反馈的三域对照：同样提阻尼，不等于结构相同 | `tri_domain_compare_workspace` | 根轨迹图 + 时域图 + 频域图 + 对照卡 | `structured_compare` | `/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-09` |
| step-10 | PD 单独装置的频域指纹：中高频抬升与高频代价 | `frequency_principle_workspace` | 公式卡 + 三频段提示 + 标注区 | `frequency_band_labeling` | `/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-10` |
| step-11 | 超前单独装置的频域指纹：相位峰、补角与作用频带 | `lead_phase_peak_workspace` | 标准式卡 + 相位峰图解 + 定位区 | `phase_peak_locator` | `/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-11` |
| step-12 | 频域对照：什么时候优先想 PD，什么时候优先想超前 | `design_rule_matrix` | 设计原则卡 + 场景矩阵 + 排序区 | `scenario_sort_matrix` | `/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-12` |
| step-13 | 非最小相入口：镜像零点、逆响应与“先反向动” | `nonminimum_phase_compare` | 镜像对象卡 + 对照图 + 术语区 | `term_explainer` | `/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-13` |
| step-14 | 频域边界：右半平面零点为何限制带宽 | `boundary_decision_workspace` | 风险表 + 频域后果卡 + 决策区 | `rule_check` | `/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-14` |
| step-15 | 后测与收束：四个观察量、风险边界与 3-6 入口 | `summary_quiz_board` | 后测题组 + 信息图 + 去向卡 | `quiz_group` | `/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-15` |

> 核心互动承接：`step-03` 到 `step-14` 中，学生完成前测、图上标注、比较记录、结构辨认、参数换算、三域对照、频带判断、术语解释、风险规则判断与后测前纠错，累计约 `56` 分钟；其中 `step-04` 到 `step-14` 的工作区累计约 `49` 分钟。

## 讲义核心内容映射
| handout_anchor | core_item_type | must_appear_content | target_step | page_mode | interaction_upgrade | media_or_table_ref | acceptance_note |
|---|---|---|---|---|---|---|---|
| `### 1.1 从 3-4 的结论继续往前走 / ### 1.2 本课要解决的核心问题` | concept+map | `3-4 -> 3-5 -> 3-6` 路径切换，以及“只调增益为什么很快不够”的三条主问题。 | `step-01` | `static` | 无互动，保留路径图与主问题卡同屏。 | `课程路径图` | 路径、主问题、边界卡必须首屏直接可见。 |
| `### 1.3 统一对象与四个版本 / ### 1.4 三项学习产出` | concept+framework | 统一对象、四个版本、三项固定产出，以及“根轨迹 / 时域 / 频域 / 结构”四个观察量。 | `step-02` | `static` | 无互动。 | `对象卡 / 产出卡 / 观察量卡` | 四个观察量必须写成明确字段，不得只做页脚提示。 |
| `### 1.5 [AI融入点] 先写下你的直觉` | ai-boundary | 三题起点误判与“一句直觉”先提交、后开 AI 对照的顺序约束。 | `step-03` | `static+quiz` | AI 入口在前测与直觉提交完成后才解锁。 | `前测区` | AI 边界必须在未作答状态下静态可见。 |
| `### 2.1 例 1：二阶对象最适合用来建立第一印象` | figure+judgement | 二阶纯极点对象加零点后的分支吸引、实轴区段重排与“先看哪条分支被拉走”。 | `step-04` | `static+interactive` | 图上标记分支与实轴区段。 | `3-5-rl-01-low-order-zero-compare.png` | 对象式、图和标注区必须同屏。 |
| `### 2.2 例 2：三阶纯极点对象，零点位置不同，主导分支被拉走的方式也不同` | figure+comparison | 三阶对象在不同零点位置下的主导分支重排。 | `step-05` | `static+interactive` | 比较记录只承接“零点位置 + 主导分支变化”。 | `3-5-rl-02-high-order-zero-compare.png` | 图和句式必须同屏。 |
| `### 2.3 从这两组图立住第一组对照 / ### 2.4 如果把零点加到右半平面，会发生什么` | conclusion+risk | 左半平面零点改善趋势、右半平面零点保留问号、风险预测卡。 | `step-06` | `static+interactive` | 只记录风险预测，不提前给出完整答案。 | `对照表 / 风险预测卡` | “改善趋势”和“边界问号”必须同时落页。 |
| `### 3.1 先固定同一个对象，再并列比较两种结构` | structure+concept | `PD` 与测速反馈结构图、术语卡、测速反馈不在前向通道显式增加零点。 | `step-07` | `static+interactive` | 二选一判断只用于结构辨认。 | `3-5-md-01-pd-rate-structure.png` | 结构图和术语卡必须先于作答区出现。 |
| `### 3.1` 与 `### 3.2 不先看名字，先看等效阻尼相同的后果` | formula+example | $$\zeta_{PD}=\zeta+\frac{1}{2}K_d\omega_n,\qquad \zeta_v=\zeta+\frac{1}{2}K_t\omega_n$$ 以及 $K_d=K_t=0.3$ 例题。 | `step-08` | `static+interactive` | 工作区负责代入与填写，不替代公式本体。 | `公式卡` | 公式、变量含义和例题必须同屏。 |
| `### 3.2 / ### 3.3 / ### 3.4` | comparison+conclusion | `PD` 与测速反馈根轨迹、时域、频域对照，以及“三句课堂结论”。 | `step-09` | `static+interactive` | 对照卡负责把共同点和不同点分别落到三个域。 | `3-5-rl-03-pd-rate-compare.png` | 三域图与结论卡必须完整显式。 |
| `### 4.1 PD 为什么会让系统更快` | formula+principle | $$|G_{PD}(j\omega)|=\sqrt{1+(\omega T_d)^2},\qquad \phi_{PD}(\omega)=\arctan(\omega T_d)$$ 与“抬中高频、推交叉、代价是高频放大”。 | `step-10` | `static+interactive` | 给低频/拐点后/高频打标签。 | `PD 幅相特性卡` | 公式、频段说明和代价必须同屏。 |
| `### 4.2 超前为什么更像在关键位置补角` | formula+principle | $$G_{\text{lead}}(s)=\frac{Ts+1}{\alpha Ts+1},\ 0<\alpha<1$$、$$\omega_m=\frac{1}{T\sqrt{\alpha}}$$、$$\phi_m=\sin^{-1}\left(\frac{1-\alpha}{1+\alpha}\right)$$ 与相位峰解释。 | `step-11` | `static+interactive` | 定位区只负责找相位峰和作用频带。 | `超前标准式卡` | 标准式、峰值频率和解释句必须完整可见。 |
| `### 4.3 频域下的一般设计原则 / ### 4.4 频域设计下的适用规律` | design+matrix | `PD` 看“抬交叉”，超前看“补相角”，以及适用场景、约束和不适用边界。 | `step-12` | `static+interactive` | 场景矩阵只承接原则落地。 | `设计原则卡 / 适用矩阵` | 原则卡必须先于排序区出现。 |
| `### 5.1 先把最小相与非最小相写成一对镜像对象 / ### 5.2 非最小相最先暴露出来的，不是慢，而是先往反方向动` | concept+figure | 镜像对象、逆响应定义、最小相/非最小相对照。 | `step-13` | `static+interactive` | 术语解释区负责连起定义与现象。 | `3-5-rl-05-nmp-compare.png` | 镜像对象式和对照图必须同屏。 |
| `### 5.3 频域里为什么更难控制 / ### 5.4 如何控制不能只说原则，先看一个保守带宽实例` | risk+assessment | 右半平面零点带来的额外相位滞后、带宽上限与“先保守交叉频率”的动作。 | `step-14` | `static+interactive` | 规则判断只检查“结论 + 原因”是否同时出现。 | `风险表 / 频域后果卡` | 风险表和控制动作必须同页可见。 |
| `### 6.1 本课到底建立了什么 / ### 6.2 和前后课程怎么接 / ### 6.3 小结 / 附录A` | summary+quiz | 四个观察量、六条小结、风险边界与 `3-6` 统一对象实验入口。 | `step-15` | `static+quiz` | 后测只检查判断链，不替代结论卡。 | `3-5-info.png` | 信息图、后测题和下一课去向必须同屏。 |

## 步骤 01｜回到地图：从沿轨迹读图转向结构改变

### 页面骨架
- 模板：`map_hero_slide`
- 区域：`header` / `lead` / `summary`

### 模块清单
- `stage-map`：模块 3 路径图
- `core-question-card`：三个主问题
- `boundary-card`：本课边界卡

### 静态承载内容
- 路径图固定高亮 `3-4 -> 3-5 -> 3-6`。
- 主问题卡固定写明：
  - 零点为什么不是“更大增益”的别名；
  - 为什么 `PD` 与测速反馈不能因效果相似而混成一个结构；
  - 为什么右半平面零点会把“动态改善”变成带条件的判断。
- 边界卡固定写明：本课不进入模块 4 的完整整定流程。

### 互动升级点
- 本步不设互动；只保留教师跟随同步与路径高亮。

### 互动与反馈
- 组件类型：`none`
- 提交态：无
- 揭示规则：无

### 埋点与教师数据
- 埋点摘要：`viewed`、`timeOnStep`、`teacherFollowSync`
- 教师聚合：`view_count`、`sync_status`

### AI 边界
- 页面目标：标定 `3-5` 位于模块 3 的结构改变入口。
- 允许范围：课程路径、与 `3-4 / 3-6` 的衔接。
- 禁止范围：提前给出实例结论或数值结果。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-01`
- 对齐要求：首屏直接出现路径图、主问题卡和边界卡，无作答区占位。

## 步骤 02｜统一对象与观察框架：四个版本、三项产出、四个观察量

### 页面骨架
- 模板：`goal_chain_slide`
- 区域：`objects` / `outputs` / `metrics`

### 模块清单
- `object-card`：统一对象约束
- `version-card-row`：四个版本卡
- `deliverable-card-row`：三项固定产出
- `observation-card-row`：四个观察量

### 静态承载内容
- 统一对象固定写明：后续比较优先在同一对象上进行，不靠更换对象偷换结论。
- 四个版本固定列为：纯极点基准、左半平面零点、`PD / 测速反馈`、右半平面零点边界。
- 三项固定产出完整写出：`零点作用判断表`、`结构对比解释`、`风险边界卡`。
- 四个观察量固定为：根轨迹、时域、频域、结构判断。

### 互动升级点
- 本步不设互动；只压实对象约束、产出和观察框架。

### 互动与反馈
- 组件类型：`none`
- 提交态：无
- 揭示规则：无

### 埋点与教师数据
- 埋点摘要：`viewed`、`timeOnStep`
- 教师聚合：`view_count`

### AI 边界
- 页面目标：固定整课比较框架。
- 允许范围：对象、版本、产出、观察量、边界。
- 禁止范围：把本课压缩成“看几张图”。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-02`
- 对齐要求：对象卡、版本卡、产出卡和观察量卡必须同屏。

## 步骤 03｜前测：三类起点误判先落地

### 页面骨架
- 模板：`question_stack`
- 区域：`question-stack` / `record` / `feedback`

### 模块清单
- `pretest-q1`：零点是不是更大增益
- `pretest-q2`：`PD` 与测速反馈是不是同一结构
- `pretest-q3`：右半平面零点会不会继续帮忙
- `intuition-record`：一句直觉提交栏

### 静态承载内容
- 三道题干全部明文落页。
- 固定提示语：先提交自己的判断，再打开 AI 对照；AI 只用于误判对照，不代答。

### 互动升级点
- 学生先完成三题前测与一句直觉提交。
- AI 对照入口在前测与直觉均提交后才解锁。

### 互动与反馈
- 组件类型：`quiz_group`
- 作答模型：允许重提一次；教师端区分首答与重提
- 反馈规则：只显示正确率与误区标签，不直接给完整标准答案
- 揭示规则：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`attemptCount`、`resultState`、`errorBucket`、`intuitionTextSubmitted`
- 教师聚合：`question_distribution`、`top_misconceptions`

### AI 边界
- 页面目标：暴露起点误区并守住“先独立判断”的顺序。
- 允许范围：错因归类、术语纠偏、误判对照。
- 禁止范围：直接生成答案或替学生写直觉句。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-03`
- 对齐要求：三题、直觉提交栏与 AI 锁定提示同时可见。

## 步骤 04｜二阶对象接入零点：先看哪条分支被拉走

### 页面骨架
- 模板：`figure_annotation_workspace`
- 区域：`figure` / `legend` / `workspace`

### 模块清单
- `low-order-compare-figure`：二阶对象对照图
- `object-formula-card`：`L_0(s)`、`L_1(s)`、`L_2(s)` 对象式
- `branch-annotation-layer`：分支标注层
- `judgement-table`：零点作用判断表首列

### 静态承载内容
- 根轨迹区必须统一接入 `useControlEngine -> control-analysis.worker.ts -> Rust/WASM compute_analysis` 链路，只保留一个根轨迹面板，不再并排放第二个根轨迹截图。
- 完整写明：
  $$
  L_0(s)=\frac{K}{s(s+1)},\quad
  L_1(s)=\frac{K(s+2)}{s(s+1)},\quad
  L_2(s)=\frac{K(s+0.5)}{s(s+1)}
  $$
- 提示卡固定写明：先看哪条分支被零点拉走，再看实轴区段如何重排。
- 工作区固定要求：
  - 单根轨迹工作区；
  - 讲义示例切换；
  - 添加零点；
  - 添加极点；
  - 拖动零极点；
  - 默认零极点位置与讲义一致。

### 互动升级点
- 在统一根轨迹工作区中切换讲义示例、拖动零极点位置，再完成“被拉走的分支 + 被重排的实轴区段”记录。

### 互动与反馈
- 组件类型：`annotation_choice`
- 反馈规则：只提示标注是否落在正确区域，不自动生成判断句
- 揭示规则：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`selectedBranchRegion`、`selectedRealAxisSegment`、`attemptCount`
- 教师聚合：`branch_choice_distribution`、`real_axis_confusion_map`

### AI 边界
- 页面目标：建立“零点改写轨迹骨架”的第一印象。
- 允许范围：分支终点、实轴区段、轨迹重排。
- 禁止范围：只说“因为更快所以更好”。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-04`
- 对齐要求：图、对象式和标注区同屏可见。

## 步骤 05｜三阶对象接入零点：零点位置怎样改写主导分支

### 页面骨架
- 模板：`dual_figure_compare_workspace`
- 区域：`figure` / `compare` / `record`

### 模块清单
- `high-order-compare-figure`：三阶对象对照图
- `zero-position-card`：零点位置比较卡
- `compare-note`：一句比较判断

### 静态承载内容
- 根轨迹区必须继续沿用统一仿真引擎，只保留一个根轨迹面板。
- 完整写明：
  $$
  L_3(s)=\frac{K}{s(s+1)(s+4)},\quad
  L_{3a}(s)=\frac{K(s+0.4)}{s(s+1)(s+4)},\quad
  L_{3b}(s)=\frac{K(s+2.5)}{s(s+1)(s+4)}
  $$
- 固定句式：
  `我认为 ________ 被重排得更明显，因为 ________。`
- 零点位置卡必须明确“靠近原点”和“靠近中左部极点”两种情形。
- 工作区固定要求：
  - 单根轨迹工作区；
  - 讲义示例切换；
  - 添加零点；
  - 添加极点；
  - 拖动零极点；
  - 默认零极点位置与讲义一致。

### 互动升级点
- 完成一句比较判断，且必须同时提到零点位置与主导分支变化。

### 互动与反馈
- 组件类型：`compare_note`
- 反馈规则：只判断是否覆盖关键字段，不替写参考句
- 揭示规则：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`compareNoteSubmitted`、`usedKeywords`、`attemptCount`
- 教师聚合：`keyword_coverage`、`top_missing_reasoning_fields`

### AI 边界
- 页面目标：把“零点位置差异”压成可回查的主导分支判断。
- 允许范围：零点位置、主导分支、重排位置。
- 禁止范围：泛化成“零点都会改善动态”。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-05`
- 对齐要求：图、比较卡和句式同屏。

## 步骤 06｜第一收束：左半平面零点改善趋势与右半平面问号

### 页面骨架
- 模板：`contrast_summary_board`
- 区域：`table` / `risk` / `record`

### 模块清单
- `compare-table`：纯增益 vs 零点引入对照表
- `risk-prediction-card`：右半平面零点追问卡
- `judgement-record`：零点作用判断表补全区

### 静态承载内容
- 对照表固定列为：开环结构、轨迹骨架、主导极点可达区域、时域与频域后果。
- 风险卡固定保留三个追问：
  - 轨迹还会不会继续朝有利区域重排？
  - 输出会不会仍然沿目标方向起步？
  - 相位会不会继续像左半平面零点那样给帮助？

### 互动升级点
- 只提交风险预测，不给完整正误解释。

### 互动与反馈
- 组件类型：`risk_prediction_submit`
- 反馈规则：记录选择与一句理由，教师端可统一揭示
- 揭示规则：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`selectedRiskClaim`、`reasonTag`、`attemptCount`
- 教师聚合：`risk_prediction_distribution`、`top_reason_tags`

### AI 边界
- 页面目标：把“左半平面零点改善趋势”与“右半平面零点问号”并置。
- 允许范围：改善趋势、待检验边界、风险提问。
- 禁止范围：提前给出非最小相完整结论。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-06`
- 对齐要求：对照表和风险卡必须先于提交区出现。

## 步骤 07｜结构辨认：PD 与测速反馈不靠名字判断

### 页面骨架
- 模板：`structure_compare_slide`
- 区域：`media` / `terms` / `interaction`

### 模块清单
- `pd-rate-structure-figure`：结构图
- `term-card-row`：术语卡
- `binary-vote`：结构判断区

### 静态承载内容
- 固定使用 `3-5-md-01-pd-rate-structure.png`。
- 术语卡必须写明：
  - `PD` 在前向通道显式增加零点；
  - 测速反馈保留外环单位负反馈，并在对象输入端引入速度项反馈；
  - 不能因“都能增大阻尼”就把两者混同。
- 固定公式还必须显式落页：
  $$
  G_p(s)=\frac{4}{s(s+0.8)},\qquad T_0(s)=\frac{4}{s^2+0.8s+4}
  $$
  $$
  s^2+\left(2\zeta\omega_n+K_d\omega_n^2\right)s+\omega_n^2=0,\qquad
  s^2+\left(2\zeta\omega_n+K_t\omega_n^2\right)s+\omega_n^2=0
  $$

### 互动升级点
- 二选一判断只回答：测速反馈是否在前向通道显式增加零点。

### 互动与反馈
- 组件类型：`binary_choice`
- 正确项：`否`
- 揭示规则：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`selectedOption`、`resultState`
- 教师聚合：`option_distribution`、`structure_confusion_rate`

### AI 边界
- 页面目标：先守住结构差异，再进入阻尼公式。
- 允许范围：前向零点、局部速度反馈、双层结构。
- 禁止范围：只凭响应图像判断结构。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-07`
- 对齐要求：结构图与术语卡必须先于判断按钮出现。

## 步骤 08｜阻尼工作区：由目标阻尼反求 $K_d$ 与 $K_t$

### 页面骨架
- 模板：`formula_workspace`
- 区域：`formula` / `example` / `workspace`

### 模块清单
- `damping-formula-card`：阻尼比公式卡
- `example-card`：目标阻尼例题
- `fill-workspace`：参数填写区

### 静态承载内容
- 固定公式：
  $$
  \zeta_{PD}=\zeta+\frac{1}{2}K_d\omega_n,\qquad
  \zeta_v=\zeta+\frac{1}{2}K_t\omega_n
  $$
  $$
  K_d=K_t=\frac{2(\zeta^\star-\zeta)}{\omega_n}
  $$
- 例题固定参数：$\omega_n=2$、$\zeta=0.2$、$\zeta^\star=0.5$。
- 公式区必须额外包含“等效阻尼推导链”，把特征方程改写成标准二阶形式，再推出 $\zeta_{PD}$、$\zeta_v$ 和 $K_d=K_t=0.3$；不得只保留最终公式和答案。

### 互动升级点
- 在填写区完成 `K_d=K_t=0.3`，并写出“同样增加阻尼，不等于同样增加零点”一句解释。

### 互动与反馈
- 组件类型：`worked_example_workspace`
- 反馈规则：先判数值，再判解释句是否同时出现“阻尼”和“零点”
- 揭示规则：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`numericAnswer`、`reasonKeywords`、`attemptCount`
- 教师聚合：`numeric_error_distribution`、`missing_keyword_rate`

### AI 边界
- 页面目标：把公式工作链和结构辨认绑在一起。
- 允许范围：阻尼比、目标阻尼、参数反求。
- 禁止范围：把公式练习变成脱离结构的纯算题。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-08`
- 对齐要求：公式卡、例题卡和填写区必须同屏。

## 步骤 09｜PD 与测速反馈的三域对照：同样提阻尼，不等于结构相同

### 页面骨架
- 模板：`tri_domain_compare_workspace`
- 区域：`graphs` / `summary` / `record`

### 模块清单
- `tri-domain-figure`：三域对照图
- `conclusion-card-row`：三句结论卡
- `structured-compare`：结构化对照区

### 静态承载内容
- 固定使用 `3-5-rl-03-pd-rate-compare.png`。
- 三句结论卡固定写明：
  - 同样提高阻尼，不等于结构相同；
  - `PD` 有前向零点，测速反馈没有；
  - 频域与时域的差异要读回结构来源。
- 闭环传递函数必须显式落页：
  $$
  T_{PD}(s)=\frac{4(1+0.3s)}{s^2+2s+4},\qquad
  T_v(s)=\frac{4}{s^2+2s+4}
  $$

### 互动升级点
- 把共同点和不同点分别落到根轨迹、时域、频域三个域。

### 互动与反馈
- 组件类型：`structured_compare`
- 反馈规则：必须至少填写一个共同点和两个不同点
- 揭示规则：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`domainCoverage`、`differenceCount`、`attemptCount`
- 教师聚合：`domain_missing_rate`、`top_confused_domains`

### AI 边界
- 页面目标：把“同样提阻尼”拆回结构来源。
- 允许范围：根轨迹、时域、频域、结构。
- 禁止范围：把三域比较简化成单一指标比较。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-09`
- 对齐要求：三域图、结论卡和填写区同屏可见。

## 步骤 10｜PD 单独装置的频域指纹：中高频抬升与高频代价

### 页面骨架
- 模板：`frequency_principle_workspace`
- 区域：`formula` / `bands` / `interaction`

### 模块清单
- `pd-formula-card`：幅相特性公式卡
- `band-note-card`：三频段提示
- `band-labeling-zone`：频带标注区

### 静态承载内容
- 固定传函：
  $$
  G_{PD}(s)=1+T_d s
  $$
- 固定公式：
  $$
  |G_{PD}(j\omega)|=\sqrt{1+(\omega T_d)^2},\qquad
  \phi_{PD}(\omega)=\arctan(\omega T_d)
  $$
- 三频段提示必须写明：低频影响小、拐点后中高频抬升明显、高频代价是放大噪声与控制动作。
- 公式卡后必须补一组 `PD` 基本特性文案：中高频幅值持续抬升、交叉频率右移机会增加、高频噪声与控制动作一起放大。

### 互动升级点
- 对低频、拐点后和高频区域做标签，并为每段匹配“影响小 / 推交叉 / 代价增加”。

### 互动与反馈
- 组件类型：`frequency_band_labeling`
- 反馈规则：即时判对错，可重试
- 揭示规则：`instant_feedback`

### 埋点与教师数据
- 埋点摘要：`bandLabelsPlaced`、`attemptCount`
- 教师聚合：`band_confusion_heatmap`

### AI 边界
- 页面目标：让 `PD` 的频域原理先以频带分工出现。
- 允许范围：中高频抬升、交叉频率、噪声放大。
- 禁止范围：直接把 `PD` 等同为“更强的超前”。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-10`
- 对齐要求：公式卡、频段提示和标注区必须同屏。

## 步骤 11｜超前单独装置的频域指纹：相位峰、补角与作用频带

### 页面骨架
- 模板：`lead_phase_peak_workspace`
- 区域：`formula` / `graphic` / `interaction`

### 模块清单
- `lead-formula-card`：超前标准式卡
- `phase-peak-graphic`：相位峰图解
- `phase-peak-locator`：定位区

### 静态承载内容
- 固定公式：
  $$
  G_{\text{lead}}(s)=\frac{Ts+1}{\alpha Ts+1},\qquad 0<\alpha<1
  $$
  $$
  \left|G_{\text{lead}}(j\omega)\right|
  =
  \sqrt{\frac{1+(\omega T)^2}{1+(\alpha \omega T)^2}},\qquad
  \phi_{\text{lead}}(\omega)=\arctan(\omega T)-\arctan(\alpha \omega T)
  $$
  $$
  \omega_m=\frac{1}{T\sqrt{\alpha}},\qquad
  \phi_m=\sin^{-1}\left(\frac{1-\alpha}{1+\alpha}\right)
  $$
- 图解卡必须写明：超前不是持续抬整个中高频，而是在关键频带制造相位峰。

### 互动升级点
- 定位相位峰所在频带，并为其匹配“主要改善相角裕度”。

### 互动与反馈
- 组件类型：`phase_peak_locator`
- 反馈规则：先判频带，再判结论词是否为“相角裕度”
- 揭示规则：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`peakBandSelection`、`targetMetricSelection`、`attemptCount`
- 教师聚合：`peak_band_distribution`、`target_metric_confusion_rate`

### AI 边界
- 页面目标：把超前的“相位峰”与 `PD` 的“持续抬升”区分开。
- 允许范围：相位峰、补相角、关键频带。
- 禁止范围：只拿零点位置做唯一比较。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-11`
- 对齐要求：标准式卡、峰值图解与定位区必须同屏。

## 步骤 12｜频域对照：什么时候优先想 PD，什么时候优先想超前

### 页面骨架
- 模板：`design_rule_matrix`
- 区域：`rules` / `matrix` / `interaction`

### 模块清单
- `design-rule-card`：设计原则卡
- `scenario-matrix`：场景矩阵
- `scenario-sort-zone`：排序区

### 静态承载内容
- 图 6 必须显式落页，固定使用 `3-5-rl-04-pd-lead-compare.png`，并保留“先看频域图，再回头看根轨迹和阶跃响应”的阅读顺序提示。
- 原则卡固定写明：
  - `PD` 先看是否需要抬交叉、提响应积极性；
  - 超前先看是否需要在截止频率附近补相角、守住稳定裕度；
  - 二者都不直接等于完整整定答案。
- 场景矩阵必须列出：速度优先、裕度优先、高频代价敏感、模型不确定性较强。
- 本页必须追加两张原生表格：
  - `| 结构 | 交叉频率 | 相角裕度 | 频域解释 |`
  - `| 结构 | 更适合的场景 | 不适合的场景 | 一句话概括 |`

### 互动升级点
- 将四个场景拖放到“优先想 PD / 优先想超前 / 需要再判边界”三栏。

### 互动与反馈
- 组件类型：`scenario_sort_matrix`
- 反馈规则：给出正确栏位与一句理由标签
- 揭示规则：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`scenarioPlacements`、`attemptCount`
- 教师聚合：`scenario_confusion_matrix`

### AI 边界
- 页面目标：把频域原理收束成初步选项判断，而不是完整设计流程。
- 允许范围：速度、裕度、高频代价、模型不确定性。
- 禁止范围：提前进入模块 4 的多目标排序。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-12`
- 对齐要求：原则卡和场景矩阵必须先于拖放区出现。

## 步骤 13｜非最小相入口：镜像零点、逆响应与“先反向动”

### 页面骨架
- 模板：`nonminimum_phase_compare`
- 区域：`objects` / `media` / `interaction`

### 模块清单
- `mirror-object-card`：镜像对象卡
- `nmp-compare-figure`：最小相 / 非最小相对照图
- `term-explainer`：术语解释区

### 静态承载内容
- 固定使用 `3-5-rl-05-nmp-compare.png`。
- 镜像对象卡必须写明：唯一差别是零点位于左半平面或右半平面。
- 术语区必须写明：非最小相最先暴露的是逆响应与额外相位滞后，不是“更慢”三个字。
- 本页还必须补入 handout `5.4` 的保守带宽实例表：
  `| 增益 | 最深逆响应 | 最大峰值 | 解读 |`

### 互动升级点
- 在术语解释区完成“为什么会先反向动”一句解释。

### 互动与反馈
- 组件类型：`term_explainer`
- 反馈规则：解释中必须同时出现“右半平面零点”和“逆响应”
- 揭示规则：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`usedTerms`、`attemptCount`
- 教师聚合：`missing_term_rate`

### AI 边界
- 页面目标：把非最小相先压成现象 + 结构来源。
- 允许范围：镜像对象、逆响应、名称来源。
- 禁止范围：只给术语定义，不回到现象图。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-13`
- 对齐要求：镜像对象卡、对照图和解释区必须同屏。

## 步骤 14｜频域边界：右半平面零点为何限制带宽

### 页面骨架
- 模板：`boundary_decision_workspace`
- 区域：`risk-table` / `summary` / `interaction`

### 模块清单
- `risk-table`：非最小相风险表
- `frequency-boundary-card`：频域后果卡
- `rule-check`：规则判断区

### 静态承载内容
- 风险表固定列为：时域现象、频域后果、常见误判、保守动作。
- 频域后果卡固定写明：
  - 右半平面零点带来额外相位滞后；
  - 过度提高带宽会更早逼近稳定边界；
  - 常用保守动作是先守交叉频率与相角裕度。

### 互动升级点
- 判断三条规则陈述是否同时包含“结论 + 原因”，例如“先保守带宽，因为额外相位滞后会压缩可用裕度”。

### 互动与反馈
- 组件类型：`rule_check`
- 反馈规则：只指出缺失的是“结论”还是“原因”
- 揭示规则：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`ruleSelectionState`、`missingPartTag`、`attemptCount`
- 教师聚合：`rule_gap_distribution`

### AI 边界
- 页面目标：把非最小相边界从现象收束到控制动作。
- 允许范围：额外相位滞后、带宽上限、保守交叉频率。
- 禁止范围：把边界表述成完整校正设计流程。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-14`
- 对齐要求：风险表和频域后果卡必须先于判断区出现。

## 步骤 15｜后测与收束：四个观察量、风险边界与 3-6 入口

### 页面骨架
- 模板：`summary_quiz_board`
- 区域：`quiz` / `summary` / `next`

### 模块清单
- `post-quiz-group`：后测题组
- `info-graphic`：信息图
- `next-step-card`：去向卡

### 静态承载内容
- 固定使用 `3-5-info.png`。
- 信息图区必须完整列出四个观察量：根轨迹、时域、频域、结构判断。
- 去向卡固定写明：`3-6` 将在统一对象上把 `PD`、测速反馈、超前和非最小相边界放入实验链。

### 互动升级点
- 后测只检查三件事：
  - 零点引入为何不是纯增益调整；
  - `PD` 与测速反馈为何不能混同；
  - 右半平面零点为何先保守带宽。

### 互动与反馈
- 组件类型：`quiz_group`
- 作答模型：两题客观题 + 一题简短解释题
- 反馈规则：即时显示正确率；解释题只给关键词覆盖度
- 揭示规则：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`attemptCount`、`resultState`、`keywordCoverage`
- 教师聚合：`post_quiz_distribution`、`exit_keyword_gap`

### AI 边界
- 页面目标：把本课收束为可带入 `3-6` 的判断地图。
- 允许范围：四个观察量、风险边界、后续实验入口。
- 禁止范围：AI 直接替学生完成后测解释题。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-15`
- 对齐要求：信息图、后测题组和去向卡必须同屏。
