## 文档职责
- 本文件是 `3-3` 的作者态互动设计真源，负责把讲义中的定义、判据、完整法则、例题、读图顺序与扩展视角，重写成学生脱离讲稿也能独立理解的页面序列。
- 同目录 [interactive-contract.yaml](./interactive-contract.yaml) 负责机读契约；两者必须按 `step-01` 到 `step-17` 一一对应。
- 本文件不再接受“只保留一张图和一句结论”的压缩写法。凡是题面、公式链、法则职责、图后解释和例题求解链，均必须先落成可阅读页面，再决定互动升级。

## 设计原则
- 页面顺序服从讲义证据链，不为了首屏视觉把根轨迹图抢到题面、定义或公式链之前。
- 原理页、法则页、例题页、后测页、收束页边界清楚，不再把完整法则和三个例题压成同一类“工作区”。
- 逐步显影只能隐藏步骤，不能隐藏题面、对象、已知条件、目标问题与结论桥接。
- 例题页中的学生作答一律拆成独立小卡片并单卡提交，不使用整页统一大表单。
- 后测与收束默认分离，出口页只做回收、定位与去向说明，不再兼任测验页。

## 通用自包含验收问题
- 当前页的对象是什么。
- 当前页正在判断什么问题。
- 当前页最关键的证据在哪里，是公式、图、表还是完整题面。
- 当前页的结论如何接回“参数变化 -> 闭环极点迁移 -> 根轨迹读图 -> 动态翻译”主线。

## 节点与步骤分组
- `group-01｜导入与判据入口`：`step-01` 到 `step-05`
- `group-02｜完整法则与三组例题`：`step-06` 到 `step-10`
- `group-03｜读图扩展与参数推广`：`step-11` 到 `step-15`
- `group-04｜出口检查与收束`：`step-16` 到 `step-17`

## 全课总览
| 步骤 | 标题 | 页面模板 | 逻辑单元 | 互动组件 |
|---|---|---|---|---|
| `step-01` | 回到地图：为什么稳定边界还不等于迁移机制 | `map_hero_slide` | 路径定位、主问题、边界 | `none` |
| `step-02` | 问题引入：知道稳定区间为什么仍然不够 | `figure_question_vote` | 主图、四问、误判暴露 | `binary_choice` |
| `step-03` | 本课目标与研究对象：我们要跟踪的是谁 | `goal_boundary_slide` | 目标卡、主线链、边界表 | `none` |
| `step-04` | 根轨迹定义：参数变化下的闭环根集合 | `definition_formula_figure` | 定义卡、二阶对象、反思区 | `short_response` |
| `step-05` | 从 `1+L(s)=0` 到相角条件与幅值条件 | `equation_condition_workspace` | 方程链、几何图、顺序判断 | `reason_check` |
| `step-06` | 骨架法则板：起点终点、实轴区段与渐近线 | `rules_overview_board` | 骨架法则卡、主图、区段高亮 | `region_highlight` |
| `step-07` | 例题 1：只用骨架法则先判断整体走向 | `worked_example_workspace` | 完整题面、逐步显影链、独立作答卡 | `worked_example_workspace` |
| `step-08` | 关键节点与局部方向：分离点、虚轴交点、出射角、入射角、根之和 | `keypoint_framework_board` | 节点职责卡、公式链、配对区 | `triple_match` |
| `step-09` | 例题 2：用 `dK/ds` 与劳斯判据找关键节点 | `worked_example_workspace` | 完整题面、双方法链、独立作答卡 | `worked_example_workspace` |
| `step-10` | 例题 3：复极点附近怎样离开，整张图怎样自洽 | `worked_example_workspace` | 完整题面、出射角链、根之和校核卡 | `activity_cards` |
| `step-11` | 读图顺序：先骨架，再关键点，最后补局部方向 | `workflow_sort_board` | 七步读图法、排序区、误判提示 | `sequence_sort` |
| `step-12` | 三类开环极点：原点极点、实轴极点、共轭复极点 | `pole_type_compare_board` | 三类对象卡、趋势表、分类作答 | `classification_cards` |
| `step-13` | 广义根轨迹：一般参数如何改写成标准问题 | `equivalent_open_loop_chain` | 改写链、等效开环卡、排序区 | `formula_ordering` |
| `step-14` | 时间常数例子与 `0^\circ / 180^\circ` 根轨迹对照 | `compare_dual_root_locus` | 时间常数例图、对照表、标签切换 | `tab_switch` |
| `step-15` | 动态翻译：怎样把根轨迹重新读回稳定性、快慢与振荡 | `dynamic_translation_panel` | 翻译表、动态图、映射区 | `mapping_highlight` |
| `step-16` | 后测：条件、法则、改写与读图顺序是否已经成链 | `posttest_board` | 后测题组、错因标签、班级薄弱项 | `quiz_group` |
| `step-17` | 收束与去向：九项法则带走什么，`3-4` 从哪里接走 | `summary_exit_board` | 五条结论、信息图、去向卡 | `none` |

## 证据单元升级决策表
| 证据类型 | 来源锚点 | 目标步骤 | 升级方式 | 保留元素 | 不得删减内容 | 验收点 |
|---|---|---|---|---|---|---|
| 路径定位与主问题 | `## 一、引入` | `step-01` | 静态保留 | `3-2 -> 3-3 -> 3-4` 路径、主问题、边界句 | “边界判断不能替代迁移机制”不得消失 | 首屏可直接看到路径图、主问题和边界 |
| 稳定区间不够的四问 | `## 一、引入` | `step-02` | 主图 + 判断题 | 极点先往哪走、何时更振荡、何时穿越、参数朝哪调 | 不得只保留一句“还不够” | 主图、四问与判断区同页 |
| 课堂目标与研究范围 | `BOPPPS｜Objective` | `step-03` | 静态保留 | 目标卡、主线链、负责/不负责边界 | 不得把目标压成口号 | 学生能读出本课要做什么、不做什么 |
| 根轨迹定义与二阶对象 | `## 二` | `step-04` | 定义卡 + 反思短答 | `1+L(s)=0`、定义句、二阶对象 | “闭环根集合”不得缩成“另一种求根法” | 定义区先于反思区出现 |
| `L(s)=-1` 与两大判据 | `## 二`、`### 2.1`、`### 2.2` | `step-05` | 公式链 + 几何图 + 顺序判断 | `L(s)=-1`、相角条件、幅值条件、先资格后参数 | 两条判据必须同页出现 | 学生能区分资格判断与参数回算 |
| 骨架法则 | `### 法则 1` 到 `### 法则 4` | `step-06` | 原生法则卡 + 图上高亮 | 起点终点、分支数、对称性、实轴区段、渐近线 | 不得只留图，不得删法则职责 | 骨架法则先于例题页出现 |
| 例题 1 骨架链 | `### 法则 4` 后例题 1 | `step-07` | 完整题面 + 逐步显影 + 双卡作答 | 题面、实轴区段、渐近线重心与角度、整体走向 | 题面必须完整，步骤不得压成答案卡 | 学生默认可见题面，步骤默认收起 |
| 关键节点与局部方向 | `### 法则 5` 到 `### 法则 9` | `step-08` | 法则职责卡 + 公式链 + 配对区 | `dK/ds=0`、劳斯临界稳定、出射角、入射角、根之和 | 不得把五类法则混成“细节补充” | 学生能说清各法则回答什么问题 |
| 例题 2 双方法链 | `法则 5/6` 后例题 2 | `step-09` | 完整题面 + 双方法显影 + 双卡作答 | 闭环特征方程、分离点筛选、`K=6`、`s=±j√2` | 题面与中间量必须可见 | 学生能区分“实轴关键点”和“稳定边界” |
| 例题 3 局部方向与全图校核 | `法则 7/9` 后例题 3 | `step-10` | 完整题面 + 出射角链 + 根之和解释卡 | 复极点、出射角、实轴对称、根和守恒 | 不得只留角度结果式 | 学生能把局部切线方向与全图自洽连起来 |
| 读图顺序 | `## 四` | `step-11` | 流程卡 + 排序区 | 七步读图法 | 不得省掉“先骨架后细节” | 排序区必须服务读图顺序，不替代正文 |
| 三类开环极点影响 | `## 五` | `step-12` | 对比表 + 分类作答 | 原点极点、实轴极点、共轭复极点的趋势差异 | 三类对象都要写出“对轨迹意味着什么” | 学生能把对象类型和轨迹趋势对应起来 |
| 广义根轨迹改写 | `BOPPPS 段 5`、手稿相关段落 | `step-13` | 改写链 + 排序区 | `B(s)+aA(s)=0` 到 `1+aA(s)/B(s)=0` | 不得把广义根轨迹写成新算法 | 学生能说明“法则不变，只是改写” |
| 时间常数例子与两类根轨迹 | `BOPPPS 段 5` | `step-14` | 例图 + 对照表 + 切换 | 时间常数例图、`0^\circ / 180^\circ` 对照 | 等效开环与相角差异必须同页 | 对照页不得吞掉前一页改写链 |
| 动态翻译 | `BOPPPS 段 6`、`## 六` | `step-15` | 翻译表 + 动态图 + 映射 | 左右半平面、离虚轴距离、主导极点位置 | 三条翻译线必须成表落页 | 学生能把图上位置重新翻回系统行为 |
| 后测与收束 | `BOPPPS｜Post-assessment`、`## 六` | `step-16`、`step-17` | 后测与收束分离 | 后测题组、五条结论、去向卡 | 不得再把后测和总结挤在同页 | 出口页只做回收与去向说明 |

## 混合证据顺序表
| 步骤 | 先出现什么 | 再出现什么 | 最后出现什么 |
|---|---|---|---|
| `step-01` | 路径图 | 主问题卡 | 边界卡 |
| `step-02` | 主图 | 四个追问 | 二选一判断区 |
| `step-03` | 目标卡 | 主线链 | 负责/不负责边界表 |
| `step-04` | 定义卡 | 二阶对象与方程 | 反思短答 |
| `step-05` | `1+L(s)=0 -> L(s)=-1` 方程链 | 几何图与两条判据 | 顺序判断区 |
| `step-06` | 骨架法则卡 | 根轨迹骨架图 | 实轴区段高亮区 |
| `step-07` | 完整题面 | 逐步显影链 | 独立作答卡与参考答案 |
| `step-08` | 节点职责卡 | 公式链与图示 | 配对区 |
| `step-09` | 完整题面 | `dK/ds` 与劳斯双链 | 独立作答卡与参考答案 |
| `step-10` | 完整题面 | 出射角链与根和校核 | 独立作答卡与解释区 |
| `step-11` | 七步读图法卡片 | 排序区 | 误判提示 |
| `step-12` | 三类开环极点对象卡 | 趋势对比表 | 分类作答卡 |
| `step-13` | 改写题眼 | 等效开环链 | 排序区与结论卡 |
| `step-14` | 时间常数例图 | `0^\circ / 180^\circ` 对照表 | 标签切换区 |
| `step-15` | 动态翻译表 | 动态图 | 映射高亮区 |
| `step-16` | 后测标题卡 | 题组区 | 错因标签与班级薄弱项 |
| `step-17` | 五条结论卡 | 信息图 | `3-4` 去向卡 |

## 步骤 01｜回到地图：为什么稳定边界还不等于迁移机制
### 页面骨架
- 模板：`map_hero_slide`
- 区域：`header / lead / summary`
### 模块清单
- `stage-map`
- `core-question-card`
- `boundary-card`
### 静态承载内容
- 高亮 `3-2 -> 3-3 -> 3-4`，把 `3-3` 标为“迁移机制与完整法则”。
- 主问题固定写明：参数连续变化时，闭环极点究竟沿什么路径移动。
- 边界卡固定写明：本课先解决根轨迹的形成、法则与读法，不进入控制器设计。
### 混合证据顺序
- 路径图 -> 主问题卡 -> 边界卡
### 互动升级点
- `none`
### 教师控制
- `release_activity / open_browse / teacher_step_reveal / reveal_reference_answer` 均不适用。
### 学生默认状态
- 页面全部可见，无作答区。
### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-01`
### 脱离讲稿自包含检查
- 学生仅看本页，也能知道 `3-3` 承接 `3-2` 的稳定边界语言，并为 `3-4` 的读图判断搭桥。

## 步骤 02｜问题引入：知道稳定区间为什么仍然不够
### 页面骨架
- 模板：`figure_question_vote`
- 区域：`figure / questions / interaction`
### 模块清单
- `main-figure`
- `question-list`
- `binary-choice`
### 静态承载内容
- 主图固定使用 `3-3-pp-04-complete-rules-example.svg`。
- 四个追问固定写明：先往哪走、何时更振荡、何时触碰稳定边界、参数应朝哪调。
- 结论句固定写明：知道边界点只能回答“会不会失稳”，不能回答“怎样一路走过去”。
### 混合证据顺序
- 主图 -> 四问 -> 二选一判断区
### 互动升级点
- `binary_choice`
- 题干：`只知道稳定区间，是否已经足够解释整条极点迁移路径。`
### 教师控制
- `release_activity` 独立控制。
- `reveal_reference_answer` 独立控制。
- `open_browse / teacher_step_reveal` 不适用。
### 学生默认状态
- 主图与四问始终可见；判断区默认隐藏，教师释放后可作答。
### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-02`
### 脱离讲稿自包含检查
- 学生能明确本页不是在问“稳定不稳定”，而是在问“参数继续变化时极点如何迁移”。

## 步骤 03｜本课目标与研究对象：我们要跟踪的是谁
### 页面骨架
- 模板：`goal_boundary_slide`
- 区域：`goals / chain / boundary`
### 模块清单
- `goal-cards`
- `main-chain`
- `boundary-table`
### 静态承载内容
- 目标卡至少保留四项：会说清研究对象、会先用相角条件再用幅值条件、会按层次使用完整法则、会把图形翻回动态语言。
- 主线链固定写明：`参数变化 -> 闭环极点迁移 -> 轨迹条件 -> 完整法则 -> 动态翻译`。
- 边界表明确：本课不做完整手工作图训练，不做控制器整定。
### 混合证据顺序
- 目标卡 -> 主线链 -> 边界表
### 互动升级点
- `none`
### 教师控制
- 四类控制均不适用。
### 学生默认状态
- 全部静态可见。
### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-03`
### 脱离讲稿自包含检查
- 学生能读出本课的任务边界，也能知道“闭环极点迁移”是主对象而非附带话题。

## 步骤 04｜根轨迹定义：参数变化下的闭环根集合
### 页面骨架
- 模板：`definition_formula_figure`
- 区域：`definition / example / reflection`
### 模块清单
- `definition-card`
- `second-order-example`
- `short-response`
### 静态承载内容
- 定义卡完整出现“普通根轨迹是当 `K` 从 `0` 到 `+∞` 连续变化时，闭环特征方程全部根在 `s` 平面形成的轨迹集合”。
- 起始方程固定出现 `1+L(s)=0`。
- 二阶对象固定出现 `G(s)=K^\*/[s(s+2)]`，用来说明单点求根不足以展示整条迁移。
### 混合证据顺序
- 定义卡 -> 二阶对象 -> 反思短答
### 互动升级点
- `short_response`
- 题干：`为什么单点求根不足以替代根轨迹。`
### 教师控制
- `release_activity` 独立控制。
- 其余三项不适用。
### 学生默认状态
- 定义卡与二阶对象始终可见；短答区默认隐藏。
### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-04`
### 脱离讲稿自包含检查
- 学生在不翻讲稿时，也能知道“根轨迹研究的是闭环根集合，不是另一种单点求根法”。

## 步骤 05｜从 `1+L(s)=0` 到相角条件与幅值条件
### 页面骨架
- 模板：`equation_condition_workspace`
- 区域：`equation / geometry / interaction`
### 模块清单
- `equation-chain`
- `geometry-figure`
- `condition-cards`
- `reason-check`
### 静态承载内容
- 方程链完整出现 `1+L(s)=0 -> L(s)=-1`。
- 几何图固定使用 `3-3-pp-03-angle-and-magnitude-geometry.svg`。
- 条件卡必须同时出现相角条件与幅值条件，并写明“先资格、后参数”。
### 混合证据顺序
- 方程链 -> 几何图与条件卡 -> 顺序判断区
### 互动升级点
- `reason_check`
- 任务：判断“某点是否先看相角条件还是先算增益”。
### 教师控制
- `release_activity` 独立控制。
- `reveal_reference_answer` 独立控制。
- `open_browse / teacher_step_reveal` 不适用。
### 学生默认状态
- 公式链、几何图、条件卡始终可见；判断区默认隐藏。
### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-05`
### 脱离讲稿自包含检查
- 学生能清楚回答：相角条件负责资格审查，幅值条件负责把轨迹点对应到参数值。

## 步骤 06｜骨架法则板：起点终点、实轴区段与渐近线
### 页面骨架
- 模板：`rules_overview_board`
- 区域：`main-figure / rule-cards / interaction`
### 模块清单
- `main-figure`
- `skeleton-rule-cards`
- `real-axis-figure`
- `region-highlight`
### 静态承载内容
- 法则卡至少写清：起点与终点、分支数与对称性、实轴区段、渐近线条数/重心/角度。
- 主图固定使用 `3-3-pp-04-complete-rules-example.svg`，实轴补图固定使用 `3-3-pp-05-real-axis-parity.svg`。
- 每张法则卡都要写明它回答的判断问题。
### 混合证据顺序
- 法则卡 -> 主图与补图 -> 区段高亮区
### 互动升级点
- `region_highlight`
- 任务：在图上点选“属于骨架判断”的区段或元素。
### 教师控制
- `release_activity` 独立控制。
- `reveal_reference_answer` 独立控制。
- `open_browse / teacher_step_reveal` 不适用。
### 学生默认状态
- 法则卡与主图始终可见；高亮区默认隐藏。
### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-06`
### 脱离讲稿自包含检查
- 学生能仅凭当前页知道：画根轨迹不是先找细节点，而是先搭整张图的骨架。

## 步骤 07｜例题 1：只用骨架法则先判断整体走向
### 页面骨架
- 模板：`worked_example_workspace`
- 区域：`principle / problem / workspace`
### 模块清单
- `principle-card`
- `problem-card`
- `step-reveal-board`
- `activity-cards`
- `reference-answer`
### 静态承载内容
- 原理卡先概括：先看起点终点，再判实轴区段，最后算渐近线。
- 完整题面固定写出 `G(s)H(s)=K/[s(s+2)(s+4)]`。
- 主图固定使用 `3-3-example-01-skeleton.svg`。
### 混合证据顺序
- 原理卡 -> 完整题面 -> 逐步显影链 -> 独立作答卡 -> 参考答案
### 互动升级点
- `worked_example_workspace`
- 双卡作答：`哪些实轴区段属于轨迹`、`渐近线重心与角度如何确定`。
### 教师控制
- `release_activity` 与 `open_browse` 分离。
- `teacher_step_reveal` 独立于学生浏览权限。
- `reveal_reference_answer` 独立控制。
### 学生默认状态
- 原理卡与完整题面始终可见。
- 显影步骤默认收起。
- 作答卡默认隐藏；教师释放后可提交。
- 参考答案默认隐藏。
### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-07`
### 脱离讲稿自包含检查
- 学生不看讲稿也能知道本题对象、已知条件、要判断的三项内容，以及最后要得出的总体走向。

## 步骤 08｜关键节点与局部方向：分离点、虚轴交点、出射角、入射角、根之和
### 页面骨架
- 模板：`keypoint_framework_board`
- 区域：`cards / formulas / interaction`
### 模块清单
- `keypoint-role-cards`
- `formula-chain`
- `departure-arrival-figure`
- `triple-match`
### 静态承载内容
- 节点职责卡必须区分：分离点/汇合点回答实轴分支何时分开或汇合，虚轴交点回答何时触碰稳定边界，出射角/入射角回答复平面局部方向，根之和原则回答整图自洽。
- 公式链至少出现 `dK/ds=0`、劳斯临界稳定、出射角公式、入射角公式与根之和原则。
- 图示固定使用 `3-3-pp-06-departure-arrival-angle.svg`。
### 混合证据顺序
- 职责卡 -> 公式链与图示 -> 配对区
### 互动升级点
- `triple_match`
- 任务：把不同法则与其所回答的问题做配对。
### 教师控制
- `release_activity` 独立控制。
- `reveal_reference_answer` 独立控制。
- `open_browse / teacher_step_reveal` 不适用。
### 学生默认状态
- 节点职责卡与公式链始终可见；配对区默认隐藏。
### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-08`
### 脱离讲稿自包含检查
- 学生能仅凭当前页说出：为什么骨架法则之后还必须补关键节点与局部方向。

## 步骤 09｜例题 2：用 `dK/ds` 与劳斯判据找关键节点
### 页面骨架
- 模板：`worked_example_workspace`
- 区域：`principle / problem / workspace`
### 模块清单
- `principle-card`
- `problem-card`
- `dual-method-board`
- `activity-cards`
- `reference-answer`
### 静态承载内容
- 原理卡固定写明：`dK/ds` 用于实轴关键点，劳斯判据用于稳定边界。
- 完整题面固定写出 `G(s)H(s)=K/[s(s+1)(s+2)]` 与闭环特征方程 `s^3+3s^2+2s+K=0`。
- 主图固定使用 `3-3-example-02-breakaway-crossing.svg`。
### 混合证据顺序
- 原理卡 -> 完整题面 -> 双方法显影链 -> 独立作答卡 -> 参考答案
### 互动升级点
- `worked_example_workspace`
- 双卡作答：`哪一个候选点是真实分离点`、`临界增益与虚轴交点如何对应`。
### 教师控制
- `release_activity` 与 `open_browse` 分离。
- `teacher_step_reveal` 独立控制逐步显影。
- `reveal_reference_answer` 独立控制。
### 学生默认状态
- 题面始终可见。
- 显影步骤默认收起。
- 作答卡默认隐藏。
- 参考答案默认隐藏。
### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-09`
### 脱离讲稿自包含检查
- 学生能明确本题不是把所有法则混算，而是在同一题里分别定位“实轴关键点”和“稳定边界”。

## 步骤 10｜例题 3：复极点附近怎样离开，整张图怎样自洽
### 页面骨架
- 模板：`worked_example_workspace`
- 区域：`principle / problem / workspace`
### 模块清单
- `principle-card`
- `problem-card`
- `departure-angle-chain`
- `activity-cards`
- `reference-answer`
### 静态承载内容
- 原理卡固定写明：局部方向要看出射角，全图自洽要看实轴对称与根之和。
- 完整题面固定写出 `G(s)H(s)=K/[(s+2)(s^2+2s+5)]` 与开环极点 `-2`、`-1±j2`。
- 主图固定使用 `3-3-example-03-departure-sum.svg`。
### 混合证据顺序
- 原理卡 -> 完整题面 -> 出射角链 -> 独立作答卡 -> 参考答案
### 互动升级点
- `activity_cards`
- 双卡作答：`上半平面复极点的出射角`、`根之和原则如何限制另一实根的位置`。
### 教师控制
- `release_activity` 与 `open_browse` 分离。
- `teacher_step_reveal` 独立控制。
- `reveal_reference_answer` 独立控制。
### 学生默认状态
- 完整题面始终可见。
- 显影步骤默认收起。
- 作答卡默认隐藏。
- 参考答案默认隐藏。
### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-10`
### 脱离讲稿自包含检查
- 学生能从当前页同时读到“局部切线方向”与“整图守恒约束”，而不是只记住一个角度结果。

## 步骤 11｜读图顺序：先骨架，再关键点，最后补局部方向
### 页面骨架
- 模板：`workflow_sort_board`
- 区域：`workflow / interaction / feedback`
### 模块清单
- `workflow-cards`
- `sequence-sort`
- `misread-note`
### 静态承载内容
- 七步读图法固定写明：极点零点、实轴区段、渐近线、实轴关键点、虚轴交点、局部方向、全图复核。
- 误判提示固定写明：不要先抓分离点而忽略骨架。
### 混合证据顺序
- 流程卡 -> 排序区 -> 误判提示
### 互动升级点
- `sequence_sort`
- 任务：按正确顺序排列读图步骤。
### 教师控制
- `release_activity` 独立控制。
- `reveal_reference_answer` 独立控制。
- `open_browse / teacher_step_reveal` 不适用。
### 学生默认状态
- 流程卡始终可见；排序区默认隐藏。
### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-11`
### 脱离讲稿自包含检查
- 学生能独立复述“先做什么、再做什么、最后做什么”，而不是把法则视为平铺清单。

## 步骤 12｜三类开环极点：原点极点、实轴极点、共轭复极点
### 页面骨架
- 模板：`pole_type_compare_board`
- 区域：`cards / table / interaction`
### 模块清单
- `pole-type-cards`
- `trend-table`
- `classification-cards`
### 静态承载内容
- 三类对象卡分别写明：它对轨迹起点、主导趋势和振荡倾向意味着什么。
- 趋势表固定比较“更慢但更稳”“何处诱发分离/汇合”“为什么必须补出射角”。
### 混合证据顺序
- 对象卡 -> 趋势表 -> 分类作答卡
### 互动升级点
- `classification_cards`
- 任务：把三种轨迹现象与对应开环极点类型匹配。
### 教师控制
- `release_activity` 独立控制。
- `reveal_reference_answer` 独立控制。
- `open_browse / teacher_step_reveal` 不适用。
### 学生默认状态
- 对象卡与趋势表始终可见；作答卡默认隐藏。
### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-12`
### 脱离讲稿自包含检查
- 学生能仅凭本页把“对象类型”和“轨迹趋势”联系起来，而不是只记法则名称。

## 步骤 13｜广义根轨迹：一般参数如何改写成标准问题
### 页面骨架
- 模板：`equivalent_open_loop_chain`
- 区域：`rewrite / equivalent / interaction`
### 模块清单
- `rewrite-chain`
- `equivalent-open-loop-card`
- `formula-ordering`
### 静态承载内容
- 改写链必须完整出现 `B(s)+aA(s)=0 -> 1+aA(s)/B(s)=0`。
- 等效开环卡固定写明：法则没有变，变化的是参数被放回了“等效开环”的位置。
### 混合证据顺序
- 改写题眼 -> 改写链 -> 排序区与结论卡
### 互动升级点
- `formula_ordering`
- 任务：给改写步骤排序。
### 教师控制
- `release_activity` 独立控制。
- `reveal_reference_answer` 独立控制。
- `open_browse / teacher_step_reveal` 不适用。
### 学生默认状态
- 改写链始终可见；排序区默认隐藏。
### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-13`
### 脱离讲稿自包含检查
- 学生能独立说明：为什么广义根轨迹不是附加章节，而是一般参数问题的标准化改写。

## 步骤 14｜时间常数例子与 `0^\circ / 180^\circ` 根轨迹对照
### 页面骨架
- 模板：`compare_dual_root_locus`
- 区域：`example / compare / interaction`
### 模块清单
- `time-constant-example`
- `zero-vs-oneeighty-table`
- `tab-switch`
### 静态承载内容
- 时间常数例图固定使用 `3-3-pp-07-generalized-time-constant-example.svg`。
- 对照表固定比较研究对象、相角条件与参数方向差异。
- 扩展图固定使用 `3-3-pp-02-generalized-root-locus-map.svg`。
### 混合证据顺序
- 时间常数例图 -> 对照表 -> 标签切换区
### 互动升级点
- `tab_switch`
- 标签：`时间常数例子`、`0° vs 180°`。
### 教师控制
- `release_activity` 不适用。
- `open_browse` 允许学生自主切换标签。
- `teacher_step_reveal / reveal_reference_answer` 不适用。
### 学生默认状态
- 例图与对照表始终可见；标签切换默认开放。
### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-14`
### 脱离讲稿自包含检查
- 学生能看懂：广义根轨迹的“参数对象变了”，但判断框架仍然来自前面已经建立的普通根轨迹法则。

## 步骤 15｜动态翻译：怎样把根轨迹重新读回稳定性、快慢与振荡
### 页面骨架
- 模板：`dynamic_translation_panel`
- 区域：`table / figure / interaction`
### 模块清单
- `translation-table`
- `dynamic-figure`
- `mapping-highlight`
### 静态承载内容
- 翻译表固定三行：左右半平面对应稳定性、离虚轴远近对应快慢与拖尾、主导极点在实轴或复平面对应振荡趋势。
- 动态图固定使用 `3-3-pp-08-dynamics-translation.svg`。
### 混合证据顺序
- 翻译表 -> 动态图 -> 映射区
### 互动升级点
- `mapping_highlight`
- 任务：把图上位置变化映射到“更快 / 更振荡 / 更靠近边界”等结论。
### 教师控制
- `release_activity` 独立控制。
- `reveal_reference_answer` 独立控制。
- `open_browse / teacher_step_reveal` 不适用。
### 学生默认状态
- 翻译表与动态图始终可见；映射区默认隐藏。
### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-15`
### 脱离讲稿自包含检查
- 学生能把“图上的迁移”翻译回“系统行为如何变化”，而不是只停留在几何描述。

## 步骤 16｜后测：条件、法则、改写与读图顺序是否已经成链
### 页面骨架
- 模板：`posttest_board`
- 区域：`intro / quiz / review`
### 模块清单
- `posttest-title-card`
- `quiz-group`
- `misconception-review`
### 静态承载内容
- 标题卡固定写明：本页检查“条件入口、法则层次、广义改写、动态翻译”四项是否已经连成判断链。
- 错因回看区只列误判标签，不直接给整题答案。
### 混合证据顺序
- 标题卡 -> 后测题组 -> 错因回看区
### 互动升级点
- `quiz_group`
- 题量：3，分别对应判据顺序、法则层次、广义改写或动态翻译。
### 教师控制
- `release_activity` 独立控制。
- `reveal_reference_answer` 独立控制。
- `open_browse / teacher_step_reveal` 不适用。
### 学生默认状态
- 标题卡始终可见；题组默认隐藏，教师释放后可作答。
### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-16`
### 脱离讲稿自包含检查
- 学生能明确本页是在检查是否已经形成完整判断链，而不是再引入新概念。

## 步骤 17｜收束与去向：九项法则带走什么，`3-4` 从哪里接走
### 页面骨架
- 模板：`summary_exit_board`
- 区域：`summary / infographic / next-step`
### 模块清单
- `summary-cards`
- `info-graphic`
- `next-lesson-card`
### 静态承载内容
- 五条总结至少覆盖：研究对象、两大判据、九项法则、读图顺序、动态翻译。
- 信息图固定使用 `3-3-info.png`。
- 去向卡明确写明：`3-4` 将把这些法则用于主图判断、参数窗口与对象化验证。
### 混合证据顺序
- 五条结论卡 -> 信息图 -> 去向卡
### 互动升级点
- `none`
### 教师控制
- 四类控制均不适用。
### 学生默认状态
- 全部静态可见。
### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-17`
### 脱离讲稿自包含检查
- 学生能独立回收本课带走的判断链，也能知道下一课不是重复法则，而是把法则真正用于读图与验证。
