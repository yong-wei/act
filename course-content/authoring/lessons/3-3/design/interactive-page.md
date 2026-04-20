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
| evidence_unit_id | handout_anchor | evidence_kind | target_steps | upgrade_mode | keep_elements | non_reducible | acceptance_checks |
|---|---|---|---|---|---|---|---|
| `3-3-eu-01` | `## 一、引入：为什么稳定区间还不够` | 路径定位与主问题 | `step-01` | `static_map_intro` | `3-2 -> 3-3 -> 3-4` 路径、主问题、边界句 | “边界判断不能替代迁移机制”不得消失 | 首屏可直接看到路径图、主问题和边界 |
| `3-3-eu-02` | `## 一、引入：为什么稳定区间还不够` | 稳定区间不够的四问 | `step-02` | `figure_question_vote` | 极点先往哪走、何时更振荡、何时穿越、参数朝哪调 | 不得只保留一句“还不够” | 主图、四问与判断区同页 |
| `3-3-eu-03` | `## O｜Objective 课堂目标（3 分钟）` | 课堂目标与研究范围 | `step-03` | `goal_boundary_slide` | 目标卡、主线链、负责/不负责边界 | 不得把目标压成口号 | 学生能读出本课要做什么、不做什么 |
| `3-3-eu-04` | `## 二、普通根轨迹的定义与两大判据` | 根轨迹定义与二阶对象 | `step-04` | `definition_plus_reflection` | `1+L(s)=0`、定义句、二阶对象 | “闭环根集合”不得缩成“另一种求根法” | 定义区先于反思区出现 |
| `3-3-eu-05` | `## 二、普通根轨迹的定义与两大判据` `### 2.1 相角条件` `### 2.2 幅值条件` | `L(s)=-1` 与两大判据 | `step-05` | `equation_condition_workspace` | `L(s)=-1`、相角条件、幅值条件、先资格后参数 | 两条判据必须同页出现 | 学生能区分资格判断与参数回算 |
| `3-3-eu-06` | `### 法则 1：起点与终点` `### 法则 2：分支数、连续性与实轴对称` `### 法则 3：实轴区段判据` `### 法则 4：渐近线条数、交点与角度` | 骨架法则 | `step-06` | `rule_board_with_highlight` | 起点终点、分支数、对称性、实轴区段、渐近线 | 不得只留图，不得删法则职责 | 骨架法则先于例题页出现 |
| `3-3-eu-07` | `### 法则 4：渐近线条数、交点与角度` | 例题 1 骨架链 | `step-07` | `worked_example_workspace` | 题面、实轴区段、渐近线重心与角度、整体走向 | 题面必须完整，步骤不得压成答案卡 | 学生默认可见题面，步骤默认收起 |
| `3-3-eu-08` | `### 法则 5：分离点与汇合点` `### 法则 6：虚轴交点` `### 法则 7：复极点出射角` `### 法则 8：复零点入射角` `### 法则 9：根之和原则` | 关键节点与局部方向 | `step-08` | `role_formula_match_board` | `dK/ds=0`、劳斯临界稳定、出射角、入射角、根之和 | 不得把五类法则混成“细节补充” | 学生能说清各法则回答什么问题 |
| `3-3-eu-09` | `### 法则 6：虚轴交点` | 例题 2 双方法链 | `step-09` | `worked_example_workspace` | 闭环特征方程、分离点筛选、`K=6`、`s=±j√2` | 题面与中间量必须可见 | 学生能区分“实轴关键点”和“稳定边界” |
| `3-3-eu-10` | `### 法则 9：根之和原则` | 例题 3 局部方向与全图校核 | `step-10` | `worked_example_workspace` | 复极点、出射角、实轴对称、根和守恒 | 不得只留角度结果式 | 学生能把局部切线方向与全图自洽连起来 |
| `3-3-eu-11` | `## 四、普通根轨迹的读图顺序` | 读图顺序 | `step-11` | `workflow_sort_board` | 七步读图法 | 不得省掉“先骨架后细节” | 排序区必须服务读图顺序，不替代正文 |
| `3-3-eu-12` | `## 五、三类开环极点对普通根轨迹的基本影响` | 三类开环极点影响 | `step-12` | `compare_board_with_classification` | 原点极点、实轴极点、共轭复极点的趋势差异 | 三类对象都要写出“对轨迹意味着什么” | 学生能把对象类型和轨迹趋势对应起来 |
| `3-3-eu-13` | `### 段 5（7 分钟）：广义根轨迹` | 广义根轨迹改写 | `step-13` | `rewrite_chain_plus_sort` | `B(s)+aA(s)=0` 到 `1+aA(s)/B(s)=0` | 不得把广义根轨迹写成新算法 | 学生能说明“法则不变，只是改写” |
| `3-3-eu-14` | `### 段 5（7 分钟）：广义根轨迹` | 时间常数例子与两类根轨迹 | `step-14` | `compare_tabbed_board` | 时间常数例图、`0^\circ / 180^\circ` 对照 | 等效开环与相角差异必须同页 | 对照页不得吞掉前一页改写链 |
| `3-3-eu-15` | `### 段 6（8 分钟）：动态翻译` `## 六、本讲小结` | 动态翻译 | `step-15` | `translation_panel` | 左右半平面、离虚轴距离、主导极点位置 | 三条翻译线必须成表落页 | 学生能把图上位置重新翻回系统行为 |
| `3-3-eu-16` | `## P₃｜Post-assessment 后测（5 分钟）` `## S｜Summary 总结（3 分钟）` | 后测与收束 | `step-16` `step-17` | `posttest_plus_exit` | 后测题组、五条结论、去向卡 | 不得再把后测和总结挤在同页 | 出口页只做回收与去向说明 |

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
- 页面定向句固定写明：同一闭环系统中，参数连续变化时，极点会沿一条完整路径迁移，这一页先看“为什么只知道稳定区间还不够”。
- 主图固定使用 `3-3-pp-04-complete-rules-example.svg`。
- 主图下固定补两句读图口令：先看“极点从哪里出发、先往哪走”，再看“它何时逼近或触碰稳定边界”。
- 四个追问固定写明：先往哪走、何时更振荡、何时触碰稳定边界、参数应朝哪调。
- 结论句固定写明：知道边界点只能回答“会不会失稳”，不能回答“怎样一路走过去”。
### 混合证据顺序
- 页面定向句 -> 主图与读图口令 -> 四问 -> 结论句 -> 二选一判断区
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
- 定义卡后固定补一句：根轨迹研究的不是某一个 `K` 下的一个根，而是 `K` 连续变化时全部闭环根在 `s` 平面的轨迹集合。
- 起始方程固定出现 `1+L(s)=0`。
- 二阶对象固定出现 `G(s)=K^\*/[s(s+2)]`，用来说明单点求根不足以展示整条迁移。
- 二阶对象下固定补一句：若只取某一个 `K`，只能得到一个时刻的根位置，无法看到整条迁移过程。
- 反思区后固定补一句收束：因此，单点求根只能回答“此刻根在哪里”，根轨迹才回答“参数连续变化时根怎样一路迁移”。
### 混合证据顺序
- 定义卡与定义回扣句 -> 二阶对象与示例收束句 -> 反思短答 -> 页面收束句
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
- 方程链后固定补一句桥接语：把闭环方程改写成 `L(s)=-1` 后，问题分成两步——先判某点有没有资格在根轨迹上，再由参数确定它对应哪一个增益。
- 几何图固定使用 `3-3-pp-03-angle-and-magnitude-geometry.svg`。
- 条件卡必须同时出现相角条件与幅值条件，并写明“先资格、后参数”。
### 混合证据顺序
- 方程链与桥接语 -> 几何图与条件卡 -> 顺序判断区
### 互动升级点
- `reason_check`
- 题干：`相角条件与幅值条件，谁先决定资格，谁再决定参数。`
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
- 实轴区段判据固定写成明确规则：实轴某点右侧的开环实极点与开环实零点总数为奇数，则该段属于根轨迹。
- 法则卡末尾固定补一句：普通根轨迹先靠这些法则搭出整体骨架，再去判断分离点、虚轴交点和局部方向。
- 主图固定使用 `3-3-pp-04-complete-rules-example.svg`，实轴补图固定使用 `3-3-pp-05-real-axis-parity.svg`。
- 主图与补图前固定补读图口令：先找起点终点与分支数，再判实轴哪些区段属于根轨迹，最后用渐近线补出远端走向。
- 每张法则卡都要写明它回答的判断问题。
### 混合证据顺序
- 法则卡与页面收束句 -> 主图与补图及读图口令 -> 区段高亮区
### 互动升级点
- `region_highlight`
- 题面：`请在实轴上标出属于根轨迹的区段，并说明依据是右侧奇偶判据。`
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
- 逐步显影链固定写成三步：先判起点终点；再判实轴区段；最后算渐近线并判断总体走向。
- 双卡作答题面固定写明：第一张卡判断哪些实轴区段属于轨迹；第二张卡给出渐近线重心与角度。
- 参考答案前固定补一句：本题只用骨架法则即可完成，不进入分离点、虚轴交点和局部方向。
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
- 职责卡末尾固定补一句：骨架确定以后，要靠这些法则继续回答关键点在哪里、轨迹怎样离开或进入、整条图形是否自洽。
- 公式链至少出现 `dK/ds=0`、劳斯临界稳定、出射角公式、入射角公式与根之和原则。
- 公式链前固定补桥接语：分离点看 `dK/ds=0`，虚轴交点看稳定边界条件，出射角与入射角看局部方向，根之和看全图平衡。
- 图示固定使用 `3-3-pp-06-departure-arrival-angle.svg`。
### 混合证据顺序
- 职责卡与页面收束句 -> 公式链、桥接语与图示 -> 配对区
### 互动升级点
- `triple_match`
- 题面：`请把每一类法则与它回答的问题配对。`
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
- 双方法显影链固定拆成两条：分离点链写“由特征方程写出 `K(s)` 并求 `dK/ds=0`，再筛选真实分离点”；虚轴交点链写“由劳斯判据确定穿越稳定边界的临界增益，再求虚轴交点”。
- 双卡作答题面固定写明：第一张卡判断哪一个候选点是真实分离点；第二张卡说明临界增益与虚轴交点如何对应。
- 参考答案前固定补一句：这两种方法分别回答不同问题，不能互相替代。
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
- 显影区固定分成两条链：第一条“出射角链”说明复极点附近如何离开；第二条“根之和自洽链”说明局部方向还必须与实轴对称和根之和约束一致。
- 双卡作答题面固定写明：第一张卡判断上半平面复极点的出射角；第二张卡说明根之和原则如何限制另一实根的位置与全图走向。
- 页面末尾固定补一句收束：局部方向不能脱离全图约束，根之和帮助我们检查整条轨迹是否自洽。
### 混合证据顺序
- 原理卡 -> 完整题面 -> 出射角链与根之和自洽链 -> 独立作答卡 -> 参考答案 -> 页面收束句
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
- 教师开放浏览后，学生必须能够完整查看出射角链与根之和自洽链，不能只看到题目而看不到分析链。
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
- 七步卡片后固定补一句总收束：普通根轨迹的读图顺序始终是先搭骨架，再找关键点，最后补局部方向并做全图复核。
- 误判提示固定写明：不要先抓分离点而忽略骨架。
- 误判提示后固定补一句正向回扣：分离点和局部方向都建立在骨架已经明确之后。
### 混合证据顺序
- 流程卡与总收束句 -> 排序区 -> 误判提示与正向回扣句
### 互动升级点
- `sequence_sort`
- 题面：`请按根轨迹读图顺序排列下面七个动作。`
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
- 趋势表固定比较“起始离开方式”“对实轴区段与分离/汇合的影响”“是否更容易表现出振荡趋势”。
- 页面末尾固定补一句：开环极点类型不同，根轨迹的起步方式、走向特征与振荡倾向也会不同。
### 混合证据顺序
- 对象卡 -> 趋势表 -> 分类作答卡 -> 页面收束句
### 互动升级点
- `classification_cards`
- 题面：`请把下列轨迹趋势归到对应的开环极点类型。`
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
- 改写链后固定补一句桥接语：完成等效改写后，后面的判断仍按普通根轨迹法则进行。
- 等效开环卡固定写明：法则没有变，变化的是参数被放回了“等效开环”的位置。
- 结论卡固定写明：广义根轨迹并没有换法则，只是先把问题改写成标准根轨迹问题。
### 混合证据顺序
- 改写题眼 -> 改写链 -> 排序区与结论卡
### 互动升级点
- `formula_ordering`
- 题面：`请按从原问题到等效开环、再到按普通根轨迹法则读图的顺序排列。`
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
- 开头固定补一句桥接：沿着上一页的等效开环改写链，这里把时间常数例子分别读成 `0°` 与 `180°` 根轨迹来对照。
- 时间常数例图固定使用 `3-3-pp-07-generalized-time-constant-example.svg`。
- 对照表前固定补读表口令：先看改写后的等效形式，再比较两类根轨迹的相角条件、参数方向与研究对象差异。
- 对照表固定比较研究对象、相角条件与参数方向差异。
- 扩展图固定使用 `3-3-pp-02-generalized-root-locus-map.svg`。
- 页面末尾固定补一句：改写对象不同，但读图仍回到同一套根轨迹法则。
### 混合证据顺序
- 改写桥接句 -> 时间常数例图 -> 对照表与读表口令 -> 标签切换区 -> 页面收束句
### 互动升级点
- `tab_switch`
- 题面：`请切换判断当前例子应按 0° 还是 180° 根轨迹来读。`
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
- 翻译表后固定补读图口令：先看极点位于稳定边界哪一侧，再看离虚轴远近与虚部大小如何对应快慢和振荡。
- 动态图固定使用 `3-3-pp-08-dynamics-translation.svg`。
- 页面末尾固定补一句：根轨迹不是只看几何位置，它最终要翻译成系统是否稳定、响应有多快、振荡有多强。
### 混合证据顺序
- 翻译表与读图口令 -> 动态图 -> 映射区 -> 页面收束句
### 互动升级点
- `mapping_highlight`
- 题面：`请把图上极点位置与对应的稳定性、响应快慢和振荡程度连起来。`
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
- 标题卡下固定补一句：这一页只检查你是否形成完整判断链，不再承担课程总结。
- 题组区固定写明三道题的题面：第一题检查相角条件与幅值条件的先后；第二题检查读图顺序为何先骨架后关键点；第三题检查广义改写或动态翻译的关键结论。
- 错因回看区固定写成三条误判入口：把幅值条件当成资格条件；先抓分离点忽略骨架；把广义改写误当成新法则。
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
- 五条结论卡固定写明：
  - 参数连续变化会推动闭环极点沿轨迹迁移。
  - 相角条件先判资格，幅值条件再定参数。
  - 普通根轨迹先搭骨架，再补关键点与局部方向。
  - 广义根轨迹只是改写，法则本身不变。
  - 图上位置最终要翻译成稳定性、快慢与振荡。
- 信息图固定使用 `3-3-info.png`。
- 去向卡明确写明：`3-4` 将接着用这套读图与翻译规则，进入主图判断、参数窗口与对象化验证。
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
