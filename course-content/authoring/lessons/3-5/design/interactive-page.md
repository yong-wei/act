━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
互动页面设计 | 单元 3-5：零点引入与动态改善——为什么改变结构后，轨迹和响应会一起变
技术栈：Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 文档职责
- 本文件是供人审阅的页面蓝图，只描述页面模板、固定内容、互动组件、反馈规则、教师聚合、AI 边界与学生页预览口径。
- 同目录 [interactive-contract.yaml](./interactive-contract.yaml) 是机读契约；两者必须逐步骤一一对应。
- 本文件不是讲义摘要，不写教师台词，不把关键公式、图表或判断语言留给实现阶段临场补充。
- 默认预览口径固定为学生演示页；教师端模板弹窗只用于查看课堂骨架，不代替真实页面预览。

## 表述规则
- 页面描述只保留客观结构：区域、模块、文本、公式、图片、表格、互动组件、反馈规则、聚合数据与验收条件。
- 动作化表述禁用：`展示`、`引导`、`让学生`、`先做一次`、`跟随推导`、`教师讲` 等。
- 静态内容优先。互动组件只负责预测、标注、辨认、换算、比较、对照与纠错，不能替代核心知识承载。
- 本课主线固定为：`只调增益为什么不够 -> 左半平面零点怎样改写轨迹 -> PD 与测速反馈为什么不能混同 -> PD 与超前为何要先从频域原理看 -> 右半平面零点为何构成边界`。

## 全课总览
| 步骤 | 标题 | 页面模板 | 主体布局 | 互动组件 | 学生页预览 |
|------|------|----------|----------|----------|------------|
| step-01 | 回到地图：为什么只调增益很快不够 | `map_hero_slide` | 路径图 + 主问题卡 + 边界卡 | `none` | `/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-01` |
| step-02 | 统一对象、四个版本与三项固定产出 | `goal_chain_slide` | 对象卡 + 版本卡 + 产出卡 | `none` | `/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-02` |
| step-03 | 前测：先写下直觉，不让 AI 代替判断 | `question_stack` | 三题前测 + 直觉提交栏 | `quiz_group` | `/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-03` |
| step-04 | 二阶纯极点对象接入零点：第一眼先看哪条分支被拉走 | `figure_annotation_workspace` | 例 1 图示 + 标注区 + 判断表 | `annotation_choice` | `/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-04` |
| step-05 | 三阶对象接入零点：主导分支怎样被重新分配 | `dual_figure_compare_workspace` | 例 2 图示 + 对照说明 + 记录栏 | `compare_note` | `/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-05` |
| step-06 | 第一组结论：左半平面改善动态，右半平面先留下问号 | `contrast_summary_board` | 对照表 + 风险预测卡 | `risk_prediction_submit` | `/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-06` |
| step-07 | 结构辨认：PD 与测速反馈为什么不能混成一个名字 | `structure_compare_slide` | 结构图 + 术语卡 + 判断区 | `binary_choice` | `/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-07` |
| step-08 | 阻尼公式工作区：由目标阻尼反求 $K_d$ 与 $K_t$ | `formula_workspace` | 公式区 + 代入卡 + 填写栏 | `worked_example_workspace` | `/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-08` |
| step-09 | PD 与测速反馈的三域对照：共同点与不同点分别落在哪里 | `tri_domain_compare_workspace` | 根轨迹图 + 时域图 + 频域图 + 对照卡 | `structured_compare` | `/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-09` |
| step-10 | 这一组实例真正该留下什么：提高阻尼不等于结构相同 | `knowledge_integration_board` | 三句结论卡 + 结构判断表 | `sentence_rebuild` | `/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-10` |
| step-11 | PD 单独装置的频域原理：抬中高频、推交叉、代价是高频放大 | `frequency_principle_workspace` | 幅频相频公式卡 + 频带标注区 | `frequency_band_labeling` | `/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-11` |
| step-12 | 超前单独装置的频域原理：相位峰、补相角、作用集中在关键频带 | `lead_phase_peak_workspace` | 标准式卡 + 相位峰图解 + 选择区 | `phase_peak_locator` | `/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-12` |
| step-13 | 频域设计原则：什么时候优先想 PD，什么时候优先想超前 | `design_rule_matrix` | 设计步骤卡 + 适用规律矩阵 + 情境排序区 | `scenario_sort_matrix` | `/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-13` |
| step-14 | 非最小相：镜像对象、逆响应与额外相位滞后 | `nonminimum_phase_compare` | 镜像对象卡 + 对照图 + 定义卡 | `term_explainer` | `/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-14` |
| step-15 | 非最小相控制边界与课后纠错：先保守带宽，再纠正危险误判 | `boundary_decision_workspace` | 增益对照表 + 后测区 + AI 对照区 | `quiz_group` | `/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-15` |
| step-16 | 收束：四个观察量、信息图与 3-6 统一对象实验预告 | `summary_infographic` | 信息图 + 观察量清单 + 下一课去向卡 | `exit_reflection` | `/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-16` |

> 核心互动承接：`step-03` 到 `step-15` 中，学生实际完成前测、标注、换算、比较、排序、风险判断、后测与纠错，累计约 `58` 分钟；其中核心工作区 `step-04` 到 `step-15` 累计约 `52` 分钟。

## 讲义核心内容映射
| handout_anchor | core_item_type | must_appear_content | target_step | page_mode | interaction_upgrade | media_or_table_ref | acceptance_note |
|---|---|---|---|---|---|---|---|
| ### 1.1 从 `3-4` 的结论继续往前走 | concept+map | `3-4 -> 3-5 -> 3-6` 主线切换，以及“只调增益很快不够”的转场问题。 | `step-01` | `static` | 无，保持地图与问题卡同屏。 | `课程路径图` | 路径定位和主问题必须首屏可见。 |
| `### 1.2 本课要解决的核心问题` | concept+question | 三个主问题：零点为何不是更大增益、PD/测速反馈为何不能混同、右半平面零点为何构成边界。 | `step-01` | `static` | 无。 | `主问题卡` | 三个问题必须以完整句落页。 |
| `### 1.3 统一对象与四个版本` | concept+object | 本课统一对象、四个比较版本与“同对象上比较”的约束。 | `step-02` | `static` | 无。 | `对象卡` | 对象与版本约束不能只留标题。 |
| `### 1.4 三项学习产出` | summary+record | `零点作用判断表`、`结构对比解释`、`风险边界卡` 三项固定产出。 | `step-02` | `static` | 无。 | `产出卡` | 三项产出字段必须显式出现。 |
| `### 1.5 [AI融入点] 先写下你的直觉` | ai-boundary | 先独立提交直觉，再允许查看 AI 对照，不让 AI 代答。 | `step-03` | `static+quiz` | 前测提交后才允许打开 AI 对照提示。 | `前测与直觉提交区` | 页面必须先提交个人判断。 |
| `### 2.1 例 1：二阶对象最适合用来建立第一印象` | figure+judgement | 二阶纯极点对象接入零点后的根轨迹变化，重点是“哪条分支被拉走”。 | `step-04` | `static+interactive` | 标注被拉走分支和重排实轴区段。 | `3-5-rl-01-low-order-zero-compare.png` | 图、对象式与标注任务必须同屏。 |
| `### 2.2 例 2：三阶纯极点对象，零点位置不同，主导分支被“拉走”的方式也不同` | figure+comparison | 三阶纯极点对象在不同零点位置下的根轨迹重排。 | `step-05` | `static+interactive` | 比较两种零点位置下主导分支的变化。 | `3-5-rl-02-high-order-zero-compare.png` | 图与比较句式必须同屏。 |
| `### 2.3 从这两组图立住第一组对照` | conclusion+risk | 左半平面零点常带来动态改善趋势，但右半平面零点不能直接照搬这套语言。 | `step-06` | `static+interactive` | 先落左半平面零点与纯增益调整的静态对照。 | `对照表` | “改善趋势”和“边界问号”必须同时出现。 |
| `### 2.4 如果把零点加到右半平面，会发生什么` | conclusion+risk | 把右半平面零点保留为问号，等待后文用逆响应和相位滞后回答。 | `step-06` | `static+interactive` | 风险预测卡只记录对右半平面零点的第一判断。 | `风险预测卡` | 三个追问必须在风险卡上方静态可见。 |
| `### 3.1 先固定同一个对象，再并列比较两种结构` | concept+structure | `PD` 与测速反馈结构图，以及“测速反馈不在前向通道显式增加零点”。 | `step-07` | `static+interactive` | 结构辨认只负责判断零点是否进入前向通道。 | `3-5-md-01-pd-rate-structure.png` | 结构图与术语卡必须先落页。 |
| `### 3.2 不先看名字，先看“等效阻尼相同”的后果` | formula+example | $$\zeta_{PD}=\zeta+\frac{1}{2}K_d\omega_n,\qquad \zeta_v=\zeta+\frac{1}{2}K_t\omega_n$$ 与 $K_d=K_t=0.3$ 的例子。 | `step-08` | `static+interactive` | 工作区负责代入与填写，不替代公式本体。 | `公式卡` | 两个公式、变量含义与例子必须同时出现。 |
| `### 3.3 在根轨迹上看见的，是“同样增加阻尼”但轨迹骨架不同` | comparison+conclusion | `PD` 与测速反馈的根轨迹、时域、频域对照。 | `step-09` | `static+interactive` | 对照卡负责把证据落到根轨迹、时域和频域三个域。 | `3-5-rl-03-pd-rate-compare.png` | 三域图和共同点/不同点句式必须完整显式。 |
| `### 3.4 这一组实例应该留下的课堂结论` | comparison+conclusion | 三句课堂结论：同样提阻尼、不等于结构相同；`PD` 有前向零点；测速反馈没有。 | `step-10` | `static+interactive` | 句子重组区只承接收束，不替代三句结论本体。 | `三句结论卡` | 三句结论必须先静态完整出现。 |
| ### 4.1 `PD` 为什么会让系统更快：它先抬的是中高频幅值 | formula+principle | $$|G_{PD}(j\omega)|=\sqrt{1+(\omega T_d)^2},\qquad \phi_{PD}(\omega)=\arctan(\omega T_d)$$ 以及“抬中高频、推交叉、代价是高频放大”。 | `step-11` | `static+interactive` | 给频带打标签，辨认低频/拐点后/高频的作用。 | `PD 幅相特性卡` | 公式、链条与代价必须同屏。 |
| `### 4.2 超前为什么更像“在关键位置补角”：它的相位提升只集中在一段频带` | formula+principle | $$G_{\text{lead}}(s)=\frac{Ts+1}{\alpha Ts+1},0<\alpha<1$$、$$\omega_m=\frac{1}{T\sqrt{\alpha}}$$、$$\phi_m=\sin^{-1}\left(\frac{1-\alpha}{1+\alpha}\right)$$ 与“相位峰”解释。 | `step-12` | `static+interactive` | 找出相位峰频带并判断补的是相角裕度。 | `超前标准式卡` | 标准式、峰值频率和解释句必须完整出现。 |
| ### 4.3 频域下的一般设计原则：`PD` 看“抬交叉”，超前看“补相角” | design+matrix | `PD` 频域设计原则与超前设计步骤。 | `step-13` | `static+interactive` | 情境排序矩阵只负责把原则用到场景。 | `设计原则卡` | 原则与步骤必须在矩阵上方静态可见。 |
| ### 4.4 频域设计下的适用规律：什么时候优先想 `PD`，什么时候优先想超前 | design+matrix | `PD` 与超前的适用场景、约束与不适用边界。 | `step-13` | `static+interactive` | 情境排序矩阵只负责把适用规律落到场景。 | `适用矩阵` | 场景边界必须与排序任务同屏。 |
| `### 5.1 先把最小相与非最小相写成一对镜像对象` | concept+figure | 镜像对象与“零点位置是唯一差别”的比较前提。 | `step-14` | `static+interactive` | 术语解释区只负责让学生把定义和现象连起来。 | `镜像对象卡` | 镜像对象式必须完整落页。 |
| `### 5.2 非最小相最先暴露出来的，不是慢，而是“先往反方向动”` | concept+figure | 逆响应现象与最小相/非最小相阶跃对照。 | `step-14` | `static+interactive` | 术语解释区要把逆响应与名称来源连起来。 | `3-5-rl-05-nmp-compare.png` | 对照图与“先往反方向动”判断必须同屏。 |
| `### 5.3 频域里为什么更难控制` | concept+figure | 右半平面零点带来的额外相位滞后与带宽上限。 | `step-14` | `static+interactive` | 术语解释区要把相位滞后与速度上限连起来。 | `频域对照图` | 额外相位滞后不能只留给互动回答。 |
| `### 5.4 “如何控制”不能只说原则，先看一个保守带宽实例` | risk+assessment+ai | 保守带宽实例与“先保守交叉频率”的控制动作。 | `step-15` | `static+interactive` | 后测前先把风险表与控制动作静态落页。 | `增益对照表` | 风险表和控制动作必须同页可见。 |
| `### 5.5 [AI融入点] 用 AI 做一次“最小相与非最小相”辨认练习` | risk+assessment+ai | AI 只用于最小相与非最小相辨认对照，不代答。 | `step-15` | `static+interactive` | 后测后才开放 AI 对照，不代替学生写纠正句。 | `AI 对照区` | AI 边界必须与解锁规则同时出现。 |
| `### 7.2 [AI融入点] 让 AI 替你找一句最危险的误判` | risk+assessment+ai | 课后纠错阶段只允许 AI 返回“误判句 + 纠正句 + 关键词缺口”。 | `step-15` | `static+interactive` | AI 只承接纠错，不承接后测标准答案。 | `危险误判对照卡` | AI 输出边界必须静态写明。 |
| `### 6.1 本课到底建立了什么` | summary+checklist | 本课建立的稳定判断语言。 | `step-16` | `static+reflection` | 退出反思只收一句最重要的观察量。 | `判断语言卡` | 主线收束语必须先静态完整出现。 |
| `### 6.2 和前后课程怎么接` | summary+checklist | `3-3 / 3-4 / 3-5 / 3-6 / 3-7` 的主线衔接。 | `step-16` | `static+reflection` | 反思区不替代课程去向说明。 | `下一课去向卡` | 课程衔接必须与反思区同页。 |
| `### 6.3 小结` | summary+checklist | 六条小结与本课边界。 | `step-16` | `static+reflection` | 反思区只承接个人观察量选择。 | `小结清单` | 六条小结必须静态可读。 |
| `## 附录 A：统一比较时应盯住哪四个量` | summary+checklist | 根轨迹、时域、频域、结构判断四个观察量。 | `step-16` | `static+reflection` | 退出反思只要求学生选择一个最先查看的观察量。 | `3-5-info.png` | 信息图、四个观察量与下一课去向必须同屏。 |

## 步骤 01｜回到地图：为什么只调增益很快不够

### 页面骨架
- 模板：`map_hero_slide`
- 区域：
  - `header`：路径定位
  - `lead`：主问题卡
  - `summary`：本课边界卡

### 模块清单
- `stage-map`：模块 3 路径图
- `core-question-card`：三个主问题
- `boundary-card`：本课边界卡

### 固定内容
- 路径图固定高亮 `3-4 -> 3-5 -> 3-6`。
- 主问题卡固定写明：
  - 零点为什么不是“更大增益”的别名；
  - 为什么 `PD` 与测速反馈不能因效果相似而混成一个结构；
  - 为什么右半平面零点会把“零点改善动态”变成带条件的判断。
- 边界卡固定写明：本课不进入模块 4 的完整超前校正整定流程。

### 静态承载内容
- 路径图静态呈现 `3-4 -> 3-5 -> 3-6` 的课程位置，并把“只调增益为什么很快不够”作为首屏主问题。
- 三个主问题与“本课不进入模块 4 完整超前校正整定流程”的边界卡必须直接落在静态区，不交给互动组件承载。

### 互动升级点
- 本步不设学生作答；升级点仅限教师跟随同步与路径高亮，不把主问题改写成弹窗提示或测验题。

### 互动与反馈
- 组件类型：`none`
- 提交态：无
- 揭示规则：无

### 埋点与教师数据
- 埋点摘要：`viewed`、`timeOnStep`、`teacherFollowSync`
- 教师聚合：`view_count`、`sync_status`

### AI 边界
- 页面目标：标定本课在模块 3 中的位置。
- 允许范围：课程路径、从读图判断走向结构改变的转折。
- 禁止范围：提前解释实例结论和数值结果。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-01`
- 对齐要求：首屏直接出现路径图、主问题卡和边界卡，不出现作答区占位。

## 步骤 02｜统一对象、四个版本与三项固定产出

### 页面骨架
- 模板：`goal_chain_slide`
- 区域：
  - `objects`：统一对象与版本卡
  - `outputs`：三项固定产出
  - `boundaries`：本课不负责内容

### 模块清单
- `object-card`：统一对象说明
- `version-card-row`：四个版本对照
- `deliverable-card-row`：三项产出卡
- `scope-card`：边界说明

### 固定内容
- 统一对象固定写明：后续所有比较都优先在同一对象上进行，不靠更换对象偷换结论。
- 四个版本固定列为：纯极点基准、左半平面零点改善、`PD/测速反馈` 动态改善、右半平面零点边界。
- 三项固定产出完整写出字段：
  - `零点作用判断表`
  - `结构对比解释`
  - `风险边界卡`

### 静态承载内容
- 页面静态列出“同一对象上比较”的约束、四个版本和三项固定产出，不允许只保留标题占位。
- `零点作用判断表`、`结构对比解释`、`风险边界卡` 三项产出字段必须在同一屏内完整可见。

### 互动升级点
- 本步不设互动；升级点仅为后续步骤沿用三项固定产出，不在此页提前抽空成可点击占位卡。

### 互动与反馈
- 组件类型：`none`
- 提交态：无
- 揭示规则：无

### 埋点与教师数据
- 埋点摘要：`viewed`、`timeOnStep`
- 教师聚合：`view_count`

### AI 边界
- 页面目标：压实“比较同一个对象”和“三项固定产出”。
- 允许范围：对象、版本、产出、边界。
- 禁止范围：把本课压缩成“看几张图”。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-02`
- 对齐要求：对象卡、版本卡和产出卡必须同屏可见。

## 步骤 03｜前测：先写下直觉，不让 AI 代替判断

### 页面骨架
- 模板：`question_stack`
- 区域：
  - `question-stack`：三题前测
  - `record`：一句直觉提交栏
  - `feedback`：前测状态条

### 模块清单
- `pretest-q1`：零点是不是更大增益
- `pretest-q2`：`PD` 与测速反馈是不是同一个结构
- `pretest-q3`：右半平面零点会不会继续帮忙
- `intuition-record`：直觉句提交栏

### 固定内容
- 三道题干全部明文落页。
- 固定提醒语：先提交自己的判断，再打开 AI 对照；AI 只能用来比较你的误判，不替你给答案。

### 静态承载内容
- 三道前测题和“一句直觉”提交栏必须同页静态出现，并明确写出“先独立判断，再打开 AI 对照”的顺序约束。
- AI 边界提示必须作为静态说明先落页，不能隐藏到交互反馈之后。

### 互动升级点
- 学生先完成三题前测与一句直觉提交，系统只返回正确率与误区标签。
- AI 对照入口在前测与直觉均提交后才解锁，且只用于误判对照，不回填标准答案。

### 互动与反馈
- 组件类型：`quiz_group`
- 作答模型：三题前测 + 一句直觉提交
- 反馈规则：只显示正确率与误区标签，不显示完整标准答案
- 揭示规则：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`attemptCount`、`resultState`、`errorBucket`、`intuitionTextSubmitted`
- 教师聚合：`question_distribution`、`top_misconceptions`

### AI 边界
- 页面目标：暴露起点误区，同时保住“先独立判断”的顺序。
- 允许范围：错因归类、术语纠偏、误判对照。
- 禁止范围：直接生成完整答案或替学生写直觉句。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-03`
- 对齐要求：未作答状态下三题和直觉提交栏同时可见，AI 入口默认锁定。

## 步骤 04｜二阶纯极点对象接入零点：第一眼先看哪条分支被拉走

### 页面骨架
- 模板：`figure_annotation_workspace`
- 区域：
  - `figure`：例 1 根轨迹图
  - `legend`：对象式与提示卡
  - `workspace`：标注区与判断表

### 模块清单
- `low-order-compare-figure`：二阶对象图
- `object-formula-card`：`L_0,L_1,L_2` 对象式
- `branch-annotation-layer`：分支标注层
- `judgement-table`：零点作用判断表首列

### 固定内容
- 完整出现 `L_0(s)`、`L_1(s)`、`L_2(s)` 的对象式。
- 图固定使用 `3-5-rl-01-low-order-zero-compare.png`。
- 提示卡固定写明：先看哪条分支被零点拉走，再看实轴区段如何重排。

### 静态承载内容
- `L_0(s)`、`L_1(s)`、`L_2(s)` 的对象式、二阶对象对照图，以及“先看分支、再看实轴区段”的判断顺序必须静态同屏。
- `3-5-rl-01-low-order-zero-compare.png` 直接承载“零点改变轨迹骨架”的第一眼证据，不能只留下图号。

### 互动升级点
- 学生在图上标记被零点拉走的分支，并勾选被重排的实轴区段。
- 反馈只指出标注区域是否正确，不直接替学生生成判断句。

### 互动与反馈
- 组件类型：`annotation_choice`
- 学生任务：标记被零点拉走的分支，并勾选被重排的实轴区段
- 反馈规则：只提示标注是否落在正确区域，不直接写出最终判断句
- 揭示规则：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`selectedBranchRegion`、`selectedRealAxisSegment`、`attemptCount`
- 教师聚合：`branch_choice_distribution`、`real_axis_confusion_map`

### AI 边界
- 页面目标：建立“零点改变轨迹骨架”而非“只是在原图上选点”。
- 允许范围：分支终点、实轴区段、重排。
- 禁止范围：只说“因为有零点所以更快”。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-04`
- 对齐要求：图、对象式和标注区同屏可见，不能把图折叠到二级区域。

## 步骤 05｜三阶对象接入零点：主导分支怎样被重新分配

### 页面骨架
- 模板：`dual_figure_compare_workspace`
- 区域：
  - `figure`：例 2 对照图
  - `compare`：零点位置比较卡
  - `record`：一句判断记录栏

### 模块清单
- `high-order-compare-figure`：三阶对象图
- `zero-position-card`：两种零点位置说明
- `compare-note`：一句完整判断提交栏

### 固定内容
- 图固定使用 `3-5-rl-02-high-order-zero-compare.png`。
- 比较卡固定写明：零点靠近原点与零点位于中左部时，被重排的主导分支位置不同。
- 固定句式：`我认为 ________ 被重排得更明显，因为 ________。`

### 静态承载内容
- 三阶对象对照图、零点位置比较卡和固定句式必须同屏，静态写明“比较的是哪一条主导分支被重新分配”。
- 页面静态部分要先给出“零点靠近原点 / 零点位于中左部”的位置差异，再让学生作答。

### 互动升级点
- 学生完成一句比较判断，说明哪一侧主导分支被重排得更明显以及原因。
- 系统先检查回答里是否同时提到“零点位置”和“主导分支”，再决定是否允许教师端揭示参考表述。

### 互动与反馈
- 组件类型：`compare_note`
- 学生任务：完成一句比较判断
- 反馈规则：先按“是否同时提到零点位置和主导分支”给结构反馈，再允许教师端揭示参考表述
- 揭示规则：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`compareNoteSubmitted`、`usedKeywords`、`attemptCount`
- 教师聚合：`keyword_coverage`、`top_missing_reasoning_fields`

### AI 边界
- 页面目标：把“零点位置不同”压成可回查的主导分支判断。
- 允许范围：零点位置、主导分支、分配变化。
- 禁止范围：只复述“零点改善动态”而不指出哪里变了。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-05`
- 对齐要求：对照图和一句判断栏必须同屏，不能把图切成分页轮播。

## 步骤 06｜第一组结论：左半平面改善动态，右半平面先留下问号

### 页面骨架
- 模板：`contrast_summary_board`
- 区域：
  - `summary`：第一组结论表
  - `risk-prompt`：右半平面零点问号卡
  - `interaction`：风险预测提交区

### 模块清单
- `contrast-table`：左半平面零点 vs 右半平面零点
- `rhp-question-card`：三连问
- `risk-prediction`：风险边界卡首答

### 固定内容
- 对照表固定写明：
  - 左半平面零点常使主导极点有机会进入更有利区域；
  - 右半平面零点不能直接套用同一套改善语言。
- 三连问固定为：
  - 轨迹还会继续朝更有利区域移动吗；
  - 输出会不会继续朝目标方向起步；
  - 相位会不会继续帮忙。

### 静态承载内容
- 对照表必须先静态写出“左半平面零点改善趋势”和“右半平面零点边界问号”两条信息。
- 三连问必须作为静态风险提示卡落页，为后续非最小相证据埋下问题链。

### 互动升级点
- 学生只在风险边界卡上提交对右半平面零点的第一判断，不立即公布标准答案。
- 本步保留认知张力，互动只负责记录预测，不提前揭晓“逆响应 / 非最小相”。

### 互动与反馈
- 组件类型：`risk_prediction_submit`
- 学生任务：在风险边界卡上写出自己对右半平面零点的第一判断
- 反馈规则：只保存预测，不立即纠正
- 揭示规则：无

### 埋点与教师数据
- 埋点摘要：`riskPredictionSubmitted`、`riskTag`、`submitTime`
- 教师聚合：`risk_prediction_distribution`、`optimistic_bias_rate`

### AI 边界
- 页面目标：保留认知张力，把右半平面零点的危险留到后段用证据揭示。
- 允许范围：风险预测、问题保留。
- 禁止范围：提前给出“逆响应”和“非最小相”完整答案。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-06`
- 对齐要求：第一组结论表和风险预测卡必须同屏出现。

## 步骤 07｜结构辨认：PD 与测速反馈为什么不能混成一个名字

### 页面骨架
- 模板：`structure_compare_slide`
- 区域：
  - `figure`：结构图
  - `notes`：术语说明卡
  - `interaction`：判断区

### 模块清单
- `pd-rate-structure-figure`：结构图
- `structure-note-card`：前向通道 / 局部反馈说明
- `binary-check`：结构判断题

### 固定内容
- 图固定使用 `3-5-md-01-pd-rate-structure.png`。
- 术语卡固定写明：测速反馈保留单位负反馈外环与速度项局部反馈内环，不在前向通道显式增加零点。

### 静态承载内容
- `3-5-md-01-pd-rate-structure.png` 与术语说明卡必须一起静态出现，明确区分“前向通道显式零点”和“局部速度反馈”。
- 页面静态文字要先写明测速反馈保留单位负反馈外环，不能把结构辨认完全交给判断题。

### 互动升级点
- 学生只判断“测速反馈是否在前向通道显式增加零点”，并回到结构图核对。
- 反馈只提示“零点进入了哪里”，不把结构差异改写成效果比较题。

### 互动与反馈
- 组件类型：`binary_choice`
- 学生任务：判断“测速反馈是否在前向通道显式增加零点”
- 正确项：`否`
- 反馈规则：错误时只指出“请回到结构图判断零点进入了哪里”
- 揭示规则：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`selectedOption`、`resultState`、`teacherRevealSeen`
- 教师聚合：`structure_misread_rate`、`option_distribution`

### AI 边界
- 页面目标：先把结构辨认压实，再进入公式与结果比较。
- 允许范围：前向通道、局部反馈、显式零点。
- 禁止范围：把“效果相似”直接解释成“结构相同”。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-07`
- 对齐要求：结构图和判断题必须同屏，不允许先隐藏结构图。

## 步骤 08｜阻尼公式工作区：由目标阻尼反求 $K_d$ 与 $K_t$

### 页面骨架
- 模板：`formula_workspace`
- 区域：
  - `formula`：公式卡
  - `example`：例题代入卡
  - `workspace`：填写与校验区

### 模块清单
- `damping-formula-card`：两条等效阻尼公式
- `parameter-card`：$\omega_n=2,\zeta=0.2,\zeta^\star=0.5$
- `worked-example-input`：填写区

### 固定内容
- 必须完整出现：
$$
\zeta_{PD}=\zeta+\frac{1}{2}K_d\omega_n,\qquad
\zeta_v=\zeta+\frac{1}{2}K_t\omega_n
$$
- 例题卡固定写明：目标结果应满足 $K_d=K_t=0.3$，但在学生提交前不直接明示。
- 变量说明固定写出：阻尼比、自然频率、目标阻尼。

### 静态承载内容
- 页面必须静态完整承载
$$
\zeta_{PD}=\zeta+\frac{1}{2}K_d\omega_n,\qquad
\zeta_v=\zeta+\frac{1}{2}K_t\omega_n
$$
以及参数卡 $\omega_n=2,\zeta=0.2,\zeta^\star=0.5$。
- 页面静态区必须直接写出例值 $K_d=K_t=0.3$，不能只在提交反馈后出现。
- 例题区静态说明目标是由目标阻尼反求 $K_d$ 与 $K_t$，并在页面上直接给出变量含义。

### 互动升级点
- 学生填写 $K_d$、$K_t$ 和代入链，系统先检查推导链是否完整，再检查数值是否到达 $0.3$。
- 工作区只升级“求参动作”，不替代公式本体和参数说明。

### 互动与反馈
- 组件类型：`worked_example_workspace`
- 学生任务：填写 $K_d$、$K_t$ 及代入链
- 反馈规则：先校验代入链是否完整，再校验数值
- 揭示规则：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`submittedKd`、`submittedKt`、`derivationCompleteness`、`attemptCount`
- 教师聚合：`numeric_accuracy_rate`、`missing_derivation_fields`

### AI 边界
- 页面目标：让学生把公式变成可执行的求参动作。
- 允许范围：公式校验、变量含义检查。
- 禁止范围：直接代做代入过程。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-08`
- 对齐要求：两条公式、例题参数和填写区同屏出现。

## 步骤 09｜PD 与测速反馈的三域对照：共同点与不同点分别落在哪里

### 页面骨架
- 模板：`tri_domain_compare_workspace`
- 区域：
  - `figure`：三域对照图
  - `guide`：共同点 / 不同点提示卡
  - `record`：结构对比解释

### 模块清单
- `pd-rate-compare-figure`：三域对照图
- `compare-guide-card`：共同点 / 不同点句式
- `structured-compare-form`：结构对比解释

### 固定内容
- 图固定使用 `3-5-rl-03-pd-rate-compare.png`。
- 提示卡固定写明：
  - 共同点：都能提高阻尼，振荡显著减弱；
  - 不同点：`PD` 显式引入前向零点，测速反馈没有。
- 页面上必须同时给出根轨迹、阶跃响应和频率特性三处观察入口。

### 静态承载内容
- `3-5-rl-03-pd-rate-compare.png` 必须静态承载根轨迹、阶跃响应和频率特性三个观察入口。
- 提示卡先静态写出“共同点是都能提高阻尼”“不同点是 `PD` 有前向零点而测速反馈没有”。

### 互动升级点
- 学生分别填写“共同点”和“不同点”，并在答案中至少引用两个域的证据。
- 系统只检查是否补齐多域证据，不替学生归纳结论。

### 互动与反馈
- 组件类型：`structured_compare`
- 学生任务：分别填写“共同点”和“不同点”
- 反馈规则：若答案只写一个域，提示补齐至少两个域的证据
- 揭示规则：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`compareFieldsCompleted`、`evidenceDomainCount`、`attemptCount`
- 教师聚合：`single_domain_response_rate`、`difference_field_quality`

### AI 边界
- 页面目标：让学生把“结果相似”与“结构不同”同时写出来。
- 允许范围：阻尼、零点、根轨迹、时域、频域。
- 禁止范围：只凭名字归类结构。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-09`
- 对齐要求：三域图和填写区同屏，三域图不能被切分到二级标签页。

## 步骤 10｜这一组实例真正该留下什么：提高阻尼不等于结构相同

### 页面骨架
- 模板：`knowledge_integration_board`
- 区域：
  - `summary`：三句结论卡
  - `interaction`：句子重组区
  - `teacher-panel`：教师聚合区

### 模块清单
- `three-conclusion-cards`：三句课堂结论
- `sentence-rebuild-board`：句子重组区
- `misconception-strip`：错误提示条

### 固定内容
- 三句结论卡固定写明：
  1. `PD` 和测速反馈都可把阻尼比从 $\zeta=0.2$ 提高到目标值；
  2. `PD` 显式引入前向零点，因此前段响应更积极；
  3. 测速反馈更适合理解为“在不显式增加前向零点的前提下，提高等效阻尼”。

### 静态承载内容
- 三句课堂结论必须先完整静态出现，不能只留给句子重组组件去拼。
- 页面静态部分要把“同样提阻尼，不等于结构相同”明确压成可回查的课堂判断语言。

### 互动升级点
- 学生把打散关键词重组成一句完整结论，系统检查是否缺少“前向零点”或“等效阻尼”等核心词。
- 互动只负责收束判断语言，不替代三句结论本体。

### 互动与反馈
- 组件类型：`sentence_rebuild`
- 学生任务：把打散的关键词重组为一句完整结论
- 反馈规则：只提示是否缺少“前向零点”或“等效阻尼”等核心词
- 揭示规则：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`tokenOrder`、`missingKeywords`、`attemptCount`
- 教师聚合：`keyword_missing_rate`、`completion_rate`

### AI 边界
- 页面目标：把 `PD/测速反馈` 这一组比较压成稳定判断语言。
- 允许范围：关键词补全、句子重组。
- 禁止范围：扩展到 `PD/超前` 或非最小相边界。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-10`
- 对齐要求：三句结论卡必须先完整可读，句子重组区在其下方。

## 步骤 11｜PD 单独装置的频域原理：抬中高频、推交叉、代价是高频放大

### 页面骨架
- 模板：`frequency_principle_workspace`
- 区域：
  - `formula`：幅频相频公式卡
  - `principle`：频带解释卡
  - `interaction`：频带标注区

### 模块清单
- `pd-formula-card`：`PD` 幅频 / 相频公式
- `chain-card`：`抬中高频 -> 交叉右移 -> 截止频率增大 -> 响应更快`
- `band-labeling`：频带标注组件

### 固定内容
- 必须完整出现：
$$
\left|G_{PD}(j\omega)\right|=\sqrt{1+(\omega T_d)^2},
\qquad
\phi_{PD}(\omega)=\arctan(\omega T_d)
$$
- 解释卡固定写明：
  - 低频基本不动；
  - 越过 $\omega_d=1/T_d$ 后幅值按 `+20 dB/dec` 抬升；
  - 高频代价是噪声与未建模高频动态更容易被放大。

### 静态承载内容
- `PD` 幅频 / 相频公式、`抬中高频 -> 交叉右移 -> 截止频率增大 -> 响应更快` 链条卡，以及三条频带解释必须静态同屏。
- “高频代价是噪声与未建模高频动态更容易被放大”必须作为静态结论先落页。

### 互动升级点
- 学生给 `低频 / 拐点后中高频 / 高频代价区` 打标签，并区分“抬交叉”和“高频代价”。
- 互动只承接频带辨认，不把公式与链条缩成题干占位。

### 互动与反馈
- 组件类型：`frequency_band_labeling`
- 学生任务：给 `低频 / 拐点后中高频 / 高频代价区` 三个区域打标签
- 反馈规则：只提示是否把“抬交叉”和“高频代价”混淆
- 揭示规则：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`bandLabels`、`attemptCount`、`confusionTag`
- 教师聚合：`band_confusion_distribution`、`noise_risk_blind_rate`

### AI 边界
- 页面目标：让学生先从频域原理理解 `PD` 为什么会让系统更快。
- 允许范围：幅频斜率、交叉频率、截止频率、高频代价。
- 禁止范围：退回“因为有零点所以会补角”的抽象说法。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-11`
- 对齐要求：公式、链条和标注区同屏，链条卡不能折叠。

## 步骤 12｜超前单独装置的频域原理：相位峰、补相角、作用集中在关键频带

### 页面骨架
- 模板：`lead_phase_peak_workspace`
- 区域：
  - `formula`：标准式与峰值公式
  - `principle`：有限频带整形说明
  - `interaction`：相位峰定位区

### 模块清单
- `lead-standard-card`：标准式与参数意义
- `phase-peak-card`：$\omega_m,\phi_m$ 公式卡
- `phase-peak-locator`：相位峰定位组件

### 固定内容
- 必须完整出现：
$$
G_{\text{lead}}(s)=\frac{Ts+1}{\alpha Ts+1},\qquad 0<\alpha<1
$$
$$
\omega_m=\frac{1}{T\sqrt{\alpha}},
\qquad
\phi_m=\sin^{-1}\!\left(\frac{1-\alpha}{1+\alpha}\right)
$$
- 说明卡固定写明：
  - 超前不是把高频一路抬上去；
  - 它在目标频带制造相位峰；
  - 真正改善的是截止频率附近的相角裕度。

### 静态承载内容
- 页面必须静态完整承载
$$
G_{\text{lead}}(s)=\frac{Ts+1}{\alpha Ts+1},\qquad 0<\alpha<1
$$
$$
\omega_m=\frac{1}{T\sqrt{\alpha}},\qquad
\phi_m=\sin^{-1}\!\left(\frac{1-\alpha}{1+\alpha}\right)
$$
以及“有限频带整形”的三条解释。
- 静态区另外用行内公式再次固定：$G_{\text{lead}}(s)=\frac{Ts+1}{\alphaTs+1},0<\alpha<1$，$\phi_m=\sin^{-1}(\frac{1-\alpha}{1+\alpha})$。
- 标准式、峰值公式与“改善的是截止频率附近的相角裕度”必须在定位题上方静态可见。

### 互动升级点
- 学生定位相位峰所在频带，并判断改善的核心指标是相角裕度。
- 互动只负责把“相位峰”落到具体频带，不把超前网络解释成全频段高频抬升。

### 互动与反馈
- 组件类型：`phase_peak_locator`
- 学生任务：定位相位峰所在频带，并判断改善的核心指标是“相角裕度”
- 反馈规则：若误选“幅值无限抬升”，提示回到超前网络的极点约束
- 揭示规则：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`peakBandChoice`、`improvedMetricChoice`、`attemptCount`
- 教师聚合：`peak_band_accuracy`、`margin_metric_confusion_rate`

### AI 边界
- 页面目标：让学生把超前理解成“关键频带补相角”，而不是“更强的 `PD`”。
- 允许范围：标准式、相位峰、相角裕度、有限频带整形。
- 禁止范围：把超前解释成全频段高频抬升。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-12`
- 对齐要求：标准式、峰值公式和定位区同屏，不能把公式放入折叠抽屉。

## 步骤 13｜频域设计原则：什么时候优先想 PD，什么时候优先想超前

### 页面骨架
- 模板：`design_rule_matrix`
- 区域：
  - `rules`：设计原则与步骤卡
  - `matrix`：适用规律矩阵
  - `interaction`：情境排序区

### 模块清单
- `pd-rule-card`：`PD` 频域设计原则
- `lead-step-card`：超前设计步骤
- `scenario-matrix`：适用规律表
- `scenario-sorter`：情境排序组件

### 固定内容
- `PD` 原则卡固定写明：主要矛盾是响应慢、带宽不足、阻尼不够；高频噪声约束需先检查。
- 超前步骤卡固定写明：
  1. 读原系统截止频率与相角裕度；
  2. 估算所需附加超前角并预留余量；
  3. 由所需最大超前角确定 $\alpha$；
  4. 让 $\omega_m$ 落在期望新截止频率附近，再反算 $T$；
  5. 重新验算相角裕度与高频放大。
- 适用矩阵固定包含：
  - `PD`：适合高频噪声要求不太强、主要想提速
  - 超前：适合相角裕度不足、希望有限频带补角

### 静态承载内容
- `PD` 原则卡、超前设计步骤卡和适用规律矩阵必须同屏静态出现，先把设计判断语言立住。
- 页面静态内容必须写明“检查噪声约束”和“检查相角裕度”分别对应哪类校正优先级。

### 互动升级点
- 学生把工程情境拖入 `优先想 PD / 优先想超前 / 两者都不够` 三列。
- 互动只负责把原则迁移到场景，不替代原则卡和步骤卡本体。

### 互动与反馈
- 组件类型：`scenario_sort_matrix`
- 学生任务：把三个工程情境分别拖到 `优先想 PD / 优先想超前 / 两者都不够` 三列
- 反馈规则：错误时只指出“你忽略了噪声约束”或“你忽略了相角裕度问题”
- 揭示规则：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`scenarioPlacements`、`attemptCount`、`missedConstraintTag`
- 教师聚合：`scenario_confusion_matrix`、`top_missed_constraints`

### AI 边界
- 页面目标：把频域原则变成可迁移的设计判断。
- 允许范围：截止频率、相角裕度、噪声约束、适用边界。
- 禁止范围：越界进入模块 4 的完整整定计算。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-13`
- 对齐要求：原则卡、步骤卡和矩阵必须同屏，情境排序区在其下方。

## 步骤 14｜非最小相：镜像对象、逆响应与额外相位滞后

### 页面骨架
- 模板：`nonminimum_phase_compare`
- 区域：
  - `objects`：镜像对象卡
  - `figure`：对照图
  - `interaction`：术语解释区

### 模块清单
- `mirror-object-card`：最小相 / 非最小相对象
- `nmp-compare-figure`：对照图
- `term-explainer`：术语解释区

### 固定内容
- 必须完整出现：
$$
L_{\text{mp}}(s)=K\frac{4(s+1)}{s(s+2)(s+5)},
\qquad
L_{\text{nmp}}(s)=K\frac{4(1-s)}{s(s+2)(s+5)}
$$
- 图固定使用 `3-5-rl-05-nmp-compare.png`。
- 定义卡固定写明：
  - 右半平面零点对应非最小相；
  - 最典型时域现象是逆响应；
  - 频域上会带来额外相位滞后。

### 静态承载内容
- 镜像对象式、`3-5-rl-05-nmp-compare.png` 和定义卡必须同屏静态承载“右半平面零点 -> 逆响应 -> 额外相位滞后”的完整链条。
- 页面静态部分要先把“非最小相名称来源”和“更快会更早撞上边界”写明，再进入术语解释。

### 互动升级点
- 学生补全“非最小相这个名字的来源是 ________”，把名称来源与相位最小性连接起来。
- 互动只承接名称解释，不把镜像对象、逆响应或相位滞后藏进提交后反馈。

### 互动与反馈
- 组件类型：`term_explainer`
- 学生任务：补全一句话“非最小相这个名字的来源是 ________”
- 反馈规则：答案若只提定义、不提相位最小性，提示补充“相位滞后”线索
- 揭示规则：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`termExplanationSubmitted`、`usedKeywords`、`attemptCount`
- 教师聚合：`definition_quality`、`missing_phase_reasoning_rate`

### AI 边界
- 页面目标：把名称来源、时域现象和频域后果同时压实。
- 允许范围：镜像零点、逆响应、相位滞后。
- 禁止范围：只背“右半平面零点=非最小相”而不解释原因。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-14`
- 对齐要求：对象式、对照图和术语解释区同屏可见。

## 步骤 15｜非最小相控制边界与课后纠错：先保守带宽，再纠正危险误判

### 页面骨架
- 模板：`boundary_decision_workspace`
- 区域：
  - `table`：增益对照表
  - `quiz`：后测区
  - `ai-compare`：AI 对照区

### 模块清单
- `gain-risk-table`：三种增益下的非最小相响应对照表
- `post-quiz`：三组比较后测
- `ai-compare-card`：危险误判对照卡

### 固定内容
- 风险表固定列为：
  - `K=0.6`：较保守，逆响应较轻；
  - `K=1.0`：能跟踪但代价已显现；
  - `K=2.0`：过激，逆响应和峰值同时恶化。
- 核心控制动作固定写明：对非最小相对象，第一反应通常不是继续把带宽往上推，而是先保守交叉频率。
- 后测题固定覆盖：
  - 纯增益调整 vs 零点引入；
  - `PD` vs 测速反馈；
  - 超前为什么不是更强的 `PD`；
  - 非最小相为何先保守带宽。

### 静态承载内容
- 风险表、控制动作“先保守交叉频率”和四类后测覆盖面必须在同页静态出现。
- 页面静态部分要把 AI 对照区的输出边界写明：只返回“误判句 + 纠正句 + 所缺关键词”。

### 互动升级点
- 学生先完成后测，再输入“我最容易说错的一句话”，之后才解锁 AI 对照区。
- AI 只承接纠错句对照，不代写后测答案或整段总结。

### 互动与反馈
- 组件类型：`quiz_group`
- 学生任务：完成后测后，再在 AI 对照区输入“我最容易说错的一句话”
- 反馈规则：AI 只返回“误判句 + 纠正句 + 所缺关键词”，不返回完整解析
- 揭示规则：后测提交后解锁 `ai-compare-card`

### 埋点与教师数据
- 埋点摘要：`postQuizScore`、`errorBucket`、`aiCompareUsed`、`dangerousMisjudgementTag`
- 教师聚合：`post_quiz_distribution`、`most_dangerous_misjudgement`

### AI 边界
- 页面目标：用后测和纠错把本课最危险的误判压下去。
- 允许范围：误判句、纠正句、缺失关键词、证据域提醒。
- 禁止范围：替学生完成后测答案或代写完整总结。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-15`
- 对齐要求：风险表、后测题和 AI 对照区同页出现，但 AI 对照区默认锁定到后测提交之后。

## 步骤 16｜收束：四个观察量、信息图与 3-6 统一对象实验预告

### 页面骨架
- 模板：`summary_infographic`
- 区域：
  - `infographic`：信息图
  - `checklist`：四个观察量
  - `next-step`：下一课去向卡

### 模块清单
- `lesson-infographic`：本讲信息图
- `observation-checklist`：四个观察量清单
- `next-lesson-card`：`3-6` 预告卡
- `exit-reflection`：一句退出反思

### 固定内容
- 图固定使用 `3-5-info.png`。
- 四个观察量清单固定列为：
  - 根轨迹观察量
  - 时域观察量
  - 频域观察量
  - 结构判断量
- 预告卡固定写明：`3-6` 将把基准、`PD`、测速反馈、简单超前放入统一对象实验台做三域联动对照。

### 静态承载内容
- `3-5-info.png`、四个观察量清单和 `3-6` 预告卡必须同屏静态出现，形成课末完整收束页。
- 静态区先给出“根轨迹 / 时域 / 频域 / 结构判断”四个观察量，再让学生写退出反思。

### 互动升级点
- 学生只提交一句“我以后先看哪一个观察量”，互动只负责收束个人判断语言。
- 退出反思不引入新例题或新设计流程，只把注意力拉回四个观察量。

### 互动与反馈
- 组件类型：`exit_reflection`
- 学生任务：只写一句“我以后先看哪一个观察量”
- 反馈规则：无标准答案，只收束个人判断语言
- 揭示规则：无

### 埋点与教师数据
- 埋点摘要：`selectedObservationFocus`、`exitReflectionSubmitted`
- 教师聚合：`observation_focus_distribution`、`exit_completion_rate`

### AI 边界
- 页面目标：让学生带着稳定判断语言离开本课。
- 允许范围：观察量、主线回顾、下一课去向。
- 禁止范围：引入新例题或新设计流程。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/student/demo?step=step-16`
- 对齐要求：信息图、四个观察量和下一课去向卡同屏，退出反思区放在页面底部。
