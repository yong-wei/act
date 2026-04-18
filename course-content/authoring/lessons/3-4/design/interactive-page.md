## 文档职责
- 本文件是 `3-4` 的作者态互动设计真源，负责把讲义中的主图读法、参数窗口、三域验证与广义根轨迹改写成学生脱离讲稿也能独立理解的页面序列。
- 同目录 [interactive-contract.yaml](./interactive-contract.yaml) 负责机读契约；两者必须按 `step-01` 到 `step-17` 同名、同序、同边界。
- 本文件不接受“只保留一张图和一句结论”的压缩写法。凡是对象、题面、公式链、图后解释、判断表与结论桥接，均必须先落成可阅读页面，再决定互动升级。

## 设计原则
- 页面顺序服从讲义证据链，不为了首屏视觉把根轨迹图、Bode 图或航迹图抢到问题、公式链和判断动作之前。
- `关键节点读图`、`参数窗口判断`、`对象化三域验证`、`广义根轨迹改写` 四条线必须先后成链，不再把广义参数压成课末附注。
- 逐步显影只能隐藏步骤，不能隐藏对象、已知条件、题面、目标判断与结论桥接。
- 学生作答默认拆成独立小卡片并单卡提交，不使用整页统一大表单。
- 后测与收束分离，出口页只做能力回收、边界说明与去向提示。

## 通用自包含验收问题
- 当前页的对象是什么。
- 当前页正在判断什么问题。
- 当前页最关键的证据在哪里，是主图、公式链、表格还是对照图。
- 当前页的结论如何接回 `关键节点 -> 参数窗口 -> 三域验证 -> 广义参数` 主线。

## 节点与步骤分组
- `group-01｜导入与主图入口`：`step-01` 到 `step-04`
- `group-02｜关键节点与参数窗口`：`step-05` 到 `step-08`
- `group-03｜对象化三域验证`：`step-09` 到 `step-12`
- `group-04｜广义根轨迹与出口`：`step-13` 到 `step-17`

## 全课总览
| 步骤 | 标题 | 页面模板 | 逻辑单元 | 互动组件 |
|---|---|---|---|---|
| `step-01` | 回到地图：从 `3-3` 法则走向 `3-4` 判断 | `map_hero_slide` | 路径定位、主问题、边界 | `none` |
| `step-02` | 问题提出与三张记录表：稳定之后还要回答什么 | `goal_chain_slide` | 核心问题、固定产出、判断链 | `none` |
| `step-03` | 固定对象与三个版本：先暴露“稳定=可用”的第一误判 | `version_overview_quiz` | 对象、版本表、三题初判 | `quiz_group` |
| `step-04` | 固定读图顺序：先骨架，再关键节点，再窗口，再后果 | `workflow_sort_board` | 四步法、排序区、误判提示 | `sequence_sort` |
| `step-05` | 关键节点证据板：分离点、虚轴交点与参考工作点 `B` | `evidence_reading_board` | 主图、节点卡、热点定位 | `hotspot_labeling` |
| `step-06` | 关键节点读图记录：把主图证据写成一句工程判断 | `record_workspace` | 记录模板、判断句、双卡作答 | `activity_cards` |
| `step-07` | 稳定窗口与可接受窗口：`A/B/C` 各自处在哪一侧 | `comparison_judgement_board` | 双窗口定义、判断表、双卡作答 | `activity_cards` |
| `step-08` | 增益换算链：从图上的 `k` 落回工程参数 `K` | `worked_example_reveal` | 换算公式、参考工作点、双卡作答 | `worked_example_workspace` |
| `step-09` | 为什么必须三域互证：主图、时域、频域先并排对齐 | `evidence_matrix_slide` | 三域角色、总表、配对区 | `triple_match` |
| `step-10` | 时域验证：版本 `B` 为什么能够作为参考工作点 | `comparison_panel_with_toggle` | 阶跃对照、近似说明、双卡作答 | `activity_cards` |
| `step-11` | 频域验证：低中频近似成立，高频差异仍要单列记录 | `table_figure_workspace` | 频率点表、Bode 对照、双卡作答 | `activity_cards` |
| `step-12` | 版本 `C` 的收益与代价：Bode 与航迹不能只保留一边 | `dual_evidence_compare_workspace` | 频域证据、航迹证据、双卡作答 | `activity_cards` |
| `step-13` | 广义根轨迹入口：局部反馈系数 `a` 为什么不是“再调一次 `K`” | `figure_question_vote` | 新问题、结构图、误判暴露 | `binary_choice` |
| `step-14` | 改写链：从给定局部反馈结构走到等效根轨迹 | `worked_example_reveal` | 完整对象、改写显影链、双卡作答 | `worked_example_workspace` |
| `step-15` | 非增益参数窗口记录：`a` 从 `0` 到 `1` 怎样改写主导极点 | `parameter_window_compare_board` | 广义根轨迹图、窗口表、双卡作答 | `activity_cards` |
| `step-16` | 后测：读图、换算、三域与广义参数是否已经成链 | `posttest_board` | 标题卡、三题后测、统计区 | `quiz_group` |
| `step-17` | 收束与去向：沿既有结构分析的能力与边界 | `summary_exit_board` | 五条带走、边界卡、去向卡 | `none` |

## 证据单元升级决策表
| evidence_unit_id | handout_anchor | evidence_kind | target_steps | upgrade_mode | keep_elements | non_reducible | acceptance_checks |
|---|---|---|---|---|---|---|---|
| `3-4-eu-01` | `## 一、问题提出：稳定之后，还要回答什么` | 路径定位+课程边界 | `step-01` | 地图页静态保留 | `3-3 -> 3-4 -> 3-5` 路径、高亮“读图与验证”、主问题、边界句 | “本课不重讲 3-3 法则证明，也不进入零点、PD、模块 4 设计任务”不得消失 | 首屏必须同屏看到路径图、主问题和边界卡 |
| `3-4-eu-02` | `## 一、问题提出：稳定之后，还要回答什么` | 核心问题+课堂产出 | `step-02` | 问题链页 + 产出表 | 核心问题、三张记录表、`关键节点 -> 参数窗口 -> 三域验证 -> 广义参数` 判断链 | 不得把三张记录表压成一句口号，也不得删去“稳定只是下限” | 学生离开讲稿后仍知道本课最终要交什么 |
| `3-4-eu-03` | `### 2.1 固定对象与三个版本` | 对象公式+版本表+前测 | `step-03` | 对象卡 + 版本表 + 初判题 | `G(s)=0.01715K/[s(s+0.1)(s+2.14375)]`、`k=0.01715K`、`A/B/C` 三版本表、第一判断 | 对象、记号、版本差异必须同时出现，不能只剩排序题 | 对象卡、版本表与三题初判必须同页 |
| `3-4-eu-04` | `### 2.2 拿到主图后的固定读图顺序` | 读图流程 | `step-04` | 流程卡 + 排序区 | 看骨架、找关键节点、区分窗口、翻译后果四步法与误判提示 | 不得跳过“先节点后窗口”，不得把顺序训练改成空泛提示 | 学生能够把读图顺序排成稳定动作链 |
| `3-4-eu-05` | `### 2.3 分离点：从实极点主导走向共轭极点主导` / `### 2.4 虚轴交点：稳定窗口的上界` / `### 2.5 参考工作点 B 的位置为什么重要` | 主图关键节点 | `step-05` | 证据板 + 热点定位 | 主图、关键节点图、`B` 位置图、分离点/虚轴边界/参考工作点三条证据卡 | 节点名称、作用与 `B` 的依据不能只剩图片标注 | 学生能准确指出节点，并说清每个节点回答的问题 |
| `3-4-eu-06` | `### 2.6 关键节点读图记录` | 记录模板+判断句 | `step-06` | 模板表 + 双卡作答 | `对象版本 / 分离点判断 / 虚轴边界判断 / 主导极点候选 / 读图结论` 五字段与 `B/C` 判断句任务 | 不得只留“更靠左”“更危险”一类碎句，必须保留位置与后果 | 至少能写出一句完整工程判断 |
| `3-4-eu-07` | `### 3.2 稳定窗口不等于可接受窗口` / `### 3.3 参数窗口判断表` | 窗口语言+参数角色 | `step-07` | 双定义页 + 判断表 + 双卡作答 | `0<K<28.05`、稳定窗口/可接受窗口定义、`A/B/C` 参数角色与时频域后果 | 不得把“还稳定”直接写成“可用”，不得删去代价语言 | 学生能区分底线判断与工程判断 |
| `3-4-eu-08` | `### 3.1 先把图上的增益和工程里的增益分开` | 换算链 | `step-08` | 完整例题页 + 逐步显影 | `k=0.01715K`、`K=k/0.01715`、`B` 版本 `k=0.0104 -> K≈0.6064` 示例 | 题面、关系式、代入链与变量解释必须完整出现，不能只给结果数值 | 学生默认先见题面与公式，步骤后显影 |
| `3-4-eu-09` | `### 4.1 为什么要做三域验证` / `### 4.2 总三域对照表` | 三域角色+总表 | `step-09` | 角色卡 + 总表 + 配对区 | 根轨迹/时域/频域三域角色、`A/B/C` 总三域对照表 | 不得把三域压成“再看两张图”，必须先说明三域各回答什么 | 学生能先理解三域为何互证，再进入具体验证 |
| `3-4-eu-10` | `### 4.3 时域验证：版本 B 为什么能够作为参考工作点` | 时域验证图+说明 | `step-10` | 图后解释页 + 双卡作答 | `3-4-step-compare.png`、主导极点近似说明、局限提示 | “近似可信”与“仍有局限”必须并存 | 图、说明卡和作答卡必须同页，且先图后解释 |
| `3-4-eu-11` | `### 4.4 频域验证：低中频为什么近似成立，高频为何仍不能忽略` | 频率点表+频域解释 | `step-11` | 频率点表 + Bode 对照 + 双卡作答 | `0.01 / 0.10 / 1.00 / 5.00 rad/s` 对照表、低中频近似、高频差异 | 不得只给结论句，不得删去“高频差异仍需单列记录” | 学生能写出“哪里成立、哪里失效”的完整句 |
| `3-4-eu-12` | `### 4.5 频域代价：版本 C 为什么不能只看跟踪收益` / `### 4.6 斜坡响应与航迹对照：连续跟踪中的收益与代价` / `### 4.7 对象化验证记录` | 收益代价对照 | `step-12` | 双证据对照页 + 双卡作答 | `C` 的高带宽/低裕量/高共振峰，`B/C` 航迹与斜坡对照，收益-代价句模板，对象化验证记录口径 | 不得只写“更快”或“更危险”其中之一 | 学生能写出完整收益-代价句，并把它归回取舍型参数 |
| `3-4-eu-13` | `### 5.1 为什么这里还要补上广义根轨迹` | 新问题入口 | `step-13` | 结构图 + 误判判断 | 非增益参数问题、新问题卡、局部反馈结构图、误判提示 | 不得把 `a` 当成“再调一次 K” | 学生知道对象变了，问题也变了 |
| `3-4-eu-14` | `### 5.2 给定局部反馈结构如何改写特征方程` | 改写链 | `step-14` | 完整例题页 + 逐步显影 | `G_1(s)`、`G_{1,\mathrm{eq}}(s)`、新特征方程、`B(s)+aA(s)=0`、`1+aA(s)/B(s)=0`、`G_e(s)=A(s)/B(s)`、`180°` 根轨迹解释 | 题面与改写链必须完整出现，不能只给最后等效开环 | 学生能说清“法则不变，只是对象先被改写” |
| `3-4-eu-15` | `### 5.3 非增益参数 $a$ 改写主导极点的方式` / `### 5.4 非增益参数窗口记录` | 广义参数窗口 | `step-15` | 广义根轨迹图 + 参数窗口表 + 双卡作答 | `a=0/0.2/0.5/1.0` 极点表、三段窗口建议、`a` 的权衡句 | 不得写成“a 越大越好”，不得把窗口压成单点结论 | 学生能写出比较基线、实践窗口与边界提醒 |
| `3-4-eu-16` | `## 六、课末收束：沿既有结构分析的能力与边界` / `## 七、小结` | 后测+收束 | `step-16` `step-17` | 后测页 + 出口页 | 三题后测、五条带走、边界句、`3-5` 去向 | 后测不得与总结混页，出口页不得重新引入新任务 | 学生离开本课时能明确留下了什么能力、为什么下一课要改结构 |

## 混合证据顺序表
| 步骤 | 先出现什么 | 再出现什么 | 最后出现什么 |
|---|---|---|---|
| `step-01` | 路径图 | 主问题卡 | 边界卡 |
| `step-02` | 核心问题卡 | 三张记录表 | 判断链摘要 |
| `step-03` | 对象与记号 | `A/B/C` 版本表 | 三题初判 |
| `step-04` | 四步法卡片 | 排序区 | 误判提示 |
| `step-05` | 主图与关键节点图 | 三张证据卡 | 热点定位区 |
| `step-06` | 记录模板 | `A/B/C` 读图提醒 | 双卡作答 |
| `step-07` | 双窗口定义 | 参数窗口判断表 | 双卡作答 |
| `step-08` | 完整题面与换算公式 | `B` 版本换算显影链 | 双卡作答与参考答案 |
| `step-09` | 三域角色卡 | 总三域对照表 | 配对区 |
| `step-10` | 阶跃对照图 | 近似说明卡 | 双卡作答 |
| `step-11` | 代表性频率点表 | Bode 对照图 | 双卡作答 |
| `step-12` | 频域证据 | 航迹证据 | 双卡作答 |
| `step-13` | 新问题卡 | 局部反馈结构图 | 二选一判断 |
| `step-14` | 完整对象与题面 | 改写显影链 | 双卡作答与参考答案 |
| `step-15` | 广义根轨迹图 | 非增益参数窗口表 | 双卡作答 |
| `step-16` | 后测标题卡 | 三题题面 | 提交与统计 |
| `step-17` | 五条带走 | 边界卡 | `3-5` 去向卡 |

## 步骤 01｜回到地图：从 3-3 法则走向 3-4 判断
### 页面骨架
- 模板：`map_hero_slide`
- 区域：`header / lead / summary`
### 模块清单
- `stage-map`
- `core-question-card`
- `boundary-card`
### 静态承载内容
- 路径图固定高亮 `3-3 -> 3-4 -> 3-5`，把 `3-4` 标为“读图与验证”。
- 主问题卡固定写明：沿既有根轨迹继续调增益，哪些工作点只是“还稳定”，哪些工作点才值得选用。
- 边界卡固定写明：本课不重讲 `3-3` 的法则证明，不进入零点、`PD`、模块 4 设计任务。
### 混合证据顺序
- 路径图 -> 主问题卡 -> 边界卡
### 互动升级点
- `none`
### 教师控制
- `release_activity / open_browse / teacher_step_reveal / reveal_reference_answer` 均不适用。
### 学生默认状态
- 页面全部可见，无作答区。
### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-01`
### 脱离讲稿自包含检查
- 学生仅看本页，也能知道 `3-4` 的主任务是把 `3-3` 的法则翻译成可执行判断。

## 步骤 02｜问题提出与三张记录表：稳定之后还要回答什么
### 页面骨架
- 模板：`goal_chain_slide`
- 区域：`question / outputs / summary`
### 模块清单
- `core-question-card`
- `deliverable-table`
- `chain-summary-card`
### 静态承载内容
- 核心问题卡固定写明：同样位于稳定窗口内的参数，也可能对应完全不同的速度、振荡、风险与工程后果。
- 三张记录表必须完整落页：`关键节点读图记录`、`参数窗口判断表`、`对象化验证记录`。
- 判断链摘要卡固定写明：`关键节点读图 -> 参数窗口判断 -> 对象化三域验证 -> 广义参数验证`。
### 混合证据顺序
- 核心问题卡 -> 三张记录表 -> 判断链摘要
### 互动升级点
- `none`
### 教师控制
- 四类控制均不适用。
### 学生默认状态
- 全部静态可见。
### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-02`
### 脱离讲稿自包含检查
- 学生能明确本课最终要交的不是一句结论，而是三份可回看的判断记录。

## 步骤 03｜固定对象与三个版本：先暴露“稳定=可用”的第一误判
### 页面骨架
- 模板：`version_overview_quiz`
- 区域：`object / versions / interaction`
### 模块清单
- `object-formula-card`
- `version-table`
- `prejudge-quiz`
### 静态承载内容
- 对象卡必须完整写出
  $$
  G(s)=\frac{0.01715K}{s(s+0.1)(s+2.14375)},\qquad k=0.01715K
  $$
- 版本表必须完整给出 `A/B/C` 的 `K`、`k`、闭环极点特征与第一判断。
- 三题初判固定围绕：谁最慢、谁最均衡、谁最冒险。
### 混合证据顺序
- 对象与记号 -> `A/B/C` 版本表 -> 三题初判
### 互动升级点
- `quiz_group`
- 三题只暴露误判，不提前公布标准排序。
### 教师控制
- `release_activity` 与 `reveal_reference_answer` 独立控制。
- `open_browse / teacher_step_reveal` 不适用。
### 学生默认状态
- 对象卡与版本表始终可见；题卡默认隐藏，教师释放后作答。
### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-03`
### 脱离讲稿自包含检查
- 学生能读出 `A/B/C` 在同一对象、同一口径下比较，而不是三道无背景选择题。

## 步骤 04｜固定读图顺序：先骨架，再关键节点，再窗口，再后果
### 页面骨架
- 模板：`workflow_sort_board`
- 区域：`workflow / interaction / feedback`
### 模块清单
- `workflow-cards`
- `sort-board`
- `feedback-strip`
### 静态承载内容
- 四步法卡片固定写明：看骨架、找关键节点、区分窗口、翻译后果。
- 误判提示固定写明：不能因为某个点“看起来顺眼”，就跳过前两步直接说哪个版本更好。
### 混合证据顺序
- 四步法卡片 -> 排序区 -> 误判提示
### 互动升级点
- `sequence_sort`
- 学生任务：把四步法排成稳定读图动作链。
### 教师控制
- `release_activity` 与 `reveal_reference_answer` 独立控制。
- `open_browse / teacher_step_reveal` 不适用。
### 学生默认状态
- 四步法卡片始终可见；排序区默认隐藏。
### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-04`
### 脱离讲稿自包含检查
- 学生能明确本课先处理读图顺序，再进入单个节点与参数判断。

## 步骤 05｜关键节点证据板：分离点、虚轴交点与参考工作点 B
### 页面骨架
- 模板：`evidence_reading_board`
- 区域：`figure / evidence / interaction`
### 模块清单
- `root-locus-figure`
- `keynode-figure`
- `reference-b-figure`
- `evidence-cards`
- `hotspot-board`
### 静态承载内容
- 主图固定使用 `3-4-root-locus-summary.png`，关键节点图固定使用 `3-4-root-locus-keynodes.png`。
- 三张证据卡必须完整保留：
  - 分离点约为 `s≈-0.0494`，把“实极点主导”与“共轭极点主导”分开。
  - 虚轴交点对应稳定边界 `K≈28.05`，给出稳定窗口上界。
  - 参考工作点 `B` 既越过分离点，又远离虚轴边界，因此可作为均衡参考。
- `B` 位置图固定使用 `3-4-root-locus-reference-b.png`。
### 混合证据顺序
- 主图与关键节点图 -> 三张证据卡 -> 热点定位区
### 互动升级点
- `hotspot_labeling`
- 学生任务：在图上点选“分离点”“虚轴边界”“参考工作点 B”。
### 教师控制
- `release_activity` 与 `reveal_reference_answer` 独立控制。
- `open_browse / teacher_step_reveal` 不适用。
### 学生默认状态
- 图与证据卡始终可见；热点定位区默认隐藏。
### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-05`
### 脱离讲稿自包含检查
- 学生能仅凭本页说明：这三个节点各自回答什么问题，为什么它们支撑 `B` 的参考地位。

## 步骤 06｜关键节点读图记录：把主图证据写成一句工程判断
### 页面骨架
- 模板：`record_workspace`
- 区域：`template / evidence / activity`
### 模块清单
- `record-template`
- `readout-reminder`
- `activity-card-a`
- `activity-card-b`
### 静态承载内容
- 记录模板字段必须完整写明：`对象版本 / 分离点判断 / 虚轴边界判断 / 主导极点候选 / 读图结论`。
- 提醒卡固定写明：读图结论必须同时包含“位置”与“后果”，不能只写“更靠左”“更危险”。
### 混合证据顺序
- 记录模板 -> 读图提醒 -> 双卡作答
### 互动升级点
- `activity_cards`
- 卡片 1：为版本 `B` 写一句“为什么它能作为参考工作点”。
- 卡片 2：为版本 `C` 写一句“为什么它仍稳定但已偏向风险区”。
### 教师控制
- `release_activity` 与 `reveal_reference_answer` 独立控制。
- `open_browse / teacher_step_reveal` 不适用。
### 学生默认状态
- 模板与提醒始终可见；两张作答卡默认隐藏。
### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-06`
### 脱离讲稿自包含检查
- 学生能知道当前不是重新认点，而是把节点翻译成完整判断句。

## 步骤 07｜稳定窗口与可接受窗口：A/B/C 各自处在哪一侧
### 页面骨架
- 模板：`comparison_judgement_board`
- 区域：`definition / table / activity`
### 模块清单
- `window-definition-cards`
- `parameter-window-table`
- `activity-card-a`
- `activity-card-b`
### 静态承载内容
- 双定义卡必须同时写明：
  - 稳定窗口：先回答“是否仍然稳定”。
  - 可接受窗口：再回答“速度、振荡和裕量是否仍愿意接受”。
- 参数窗口判断表必须完整保留 `A/B/C` 的 `k`、`K`、稳定性判断、预计时域后果、预计频域后果和参数角色。
- 稳定窗口固定写出 `0<K<28.05`。
### 混合证据顺序
- 双窗口定义 -> 参数窗口判断表 -> 双卡作答
### 互动升级点
- `activity_cards`
- 卡片 1：把 `A/B/C` 归入“偏保守 / 参考工作点 / 取舍型参数”。
- 卡片 2：补写一句“为什么还稳定不等于可接受”。
### 教师控制
- `release_activity` 与 `reveal_reference_answer` 独立控制。
- `open_browse / teacher_step_reveal` 不适用。
### 学生默认状态
- 定义卡与判断表始终可见；作答卡默认隐藏。
### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-07`
### 脱离讲稿自包含检查
- 学生能说清：窗口判断不是单一“稳定/不稳定”，而是底线与工程语言的两层判断。

## 步骤 08｜增益换算链：从图上的 k 落回工程参数 K
### 页面骨架
- 模板：`worked_example_reveal`
- 区域：`principle / problem / activity / reference`
### 模块清单
- `principle-card`
- `problem-card`
- `step-reveal-board`
- `activity-card-a`
- `activity-card-b`
- `reference-answer`
### 静态承载内容
- 原理卡必须完整写出
  $$
  k=0.01715K,\qquad K=\frac{k}{0.01715}
  $$
- 题面卡固定写明：若图上读得参考工作点 `B` 对应 `k=0.0104`，实际控制器增益 `K` 应写成多少。
- 显影链至少保留三步：写关系式、代入 `k=0.0104`、得到 `K≈0.6064` 并解释变量含义。
### 混合证据顺序
- 原理卡与题面卡 -> 换算显影链 -> 双卡作答与参考答案
### 互动升级点
- `worked_example_workspace`
- 卡片 1：补全 `B` 的换算链。
- 卡片 2：解释为什么“图上的 `k` 不等于控制器中的 `K`”。
### 教师控制
- `release_activity`、`open_browse`、`teacher_step_reveal`、`reveal_reference_answer` 全部独立控制。
### 学生默认状态
- 题面与原理卡始终可见；显影链默认收起；作答卡默认隐藏。
### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-08`
### 脱离讲稿自包含检查
- 学生能仅凭本页完成一次完整换算，而不是只抄结论数值。

## 步骤 09｜为什么必须三域互证：主图、时域、频域先并排对齐
### 页面骨架
- 模板：`evidence_matrix_slide`
- 区域：`roles / matrix / interaction`
### 模块清单
- `domain-role-cards`
- `domain-matrix`
- `triple-match`
### 静态承载内容
- 三域角色卡必须写明：
  - 根轨迹回答“极点落在哪里、离边界多远”。
  - 时域回答“快慢、振荡与调节过程如何表现”。
  - 频域回答“带宽、裕量与高频代价如何暴露”。
- 总三域对照表必须并排给出 `A/B/C` 在三域中的对应结论。
### 混合证据顺序
- 三域角色卡 -> 总三域对照表 -> 配对区
### 互动升级点
- `triple_match`
- 学生任务：把同一版本的根轨迹、时域、频域证据配成完整链条。
### 教师控制
- `release_activity` 与 `reveal_reference_answer` 独立控制。
- `open_browse / teacher_step_reveal` 不适用。
### 学生默认状态
- 角色卡与总表始终可见；配对区默认隐藏。
### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-09`
### 脱离讲稿自包含检查
- 学生能明确：后续不是另开时域课和频域课，而是在给主图判断补证。

## 步骤 10｜时域验证：版本 B 为什么能够作为参考工作点
### 页面骨架
- 模板：`comparison_panel_with_toggle`
- 区域：`figure / analysis / activity`
### 模块清单
- `step-compare-figure`
- `approximation-card`
- `activity-card-a`
- `activity-card-b`
### 静态承载内容
- 阶跃对照图固定使用 `3-4-step-compare.png`。
- 近似说明卡必须写明：在 `B` 附近，原系统与主导极点近似系统在上升段、峰值附近与收敛段保持较好一致，因此“较均衡”不是感觉判断。
- 限制语固定写明：主导极点近似可信，不等于所有动态细节都可忽略。
### 混合证据顺序
- 阶跃对照图 -> 近似说明卡 -> 双卡作答
### 互动升级点
- `activity_cards`
- 卡片 1：指出哪一条时域证据最能支撑 `B` 的参考地位。
- 卡片 2：补写一句“为什么它仍不是完美无代价的工作点”。
### 教师控制
- `release_activity` 与 `reveal_reference_answer` 独立控制。
- `open_browse / teacher_step_reveal` 不适用。
### 学生默认状态
- 图与说明卡始终可见；作答卡默认隐藏。
### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-10`
### 脱离讲稿自包含检查
- 学生能从当前页独立回答：为什么 `B` 在时域上能站住脚，为什么这只是“参考”而不是“绝对最优”。

## 步骤 11｜频域验证：低中频近似成立，高频差异仍要单列记录
### 页面骨架
- 模板：`table_figure_workspace`
- 区域：`table / figure / activity`
### 模块清单
- `frequency-point-table`
- `bode-compare-figure`
- `activity-card-a`
- `activity-card-b`
### 静态承载内容
- 代表性频率点表必须完整保留 `0.01 / 0.10 / 1.00 / 5.00 rad/s` 下的幅值与相位差解释。
- Bode 对照图固定使用 `3-4-bode-compare.png` 中 `B` 的原系统与近似系统对照区域，或其等价拆分视图。
- 结论条必须同时写明：低中频基本一致，高频差异逐步放大。
### 混合证据顺序
- 代表性频率点表 -> Bode 对照图 -> 双卡作答
### 互动升级点
- `activity_cards`
- 卡片 1：判断哪一段频率最能支撑“主动态近似成立”。
- 卡片 2：补写一句“为什么高频差异仍需要单列记录”。
### 教师控制
- `release_activity` 与 `reveal_reference_answer` 独立控制。
- `open_browse / teacher_step_reveal` 不适用。
### 学生默认状态
- 表与图始终可见；作答卡默认隐藏。
### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-11`
### 脱离讲稿自包含检查
- 学生能独立说出：频域为什么支持 `B` 的主动态判断，又为什么不能把近似推广成全频段等价。

## 步骤 12｜版本 C 的收益与代价：Bode 与航迹不能只保留一边
### 页面骨架
- 模板：`dual_evidence_compare_workspace`
- 区域：`bode / track / activity`
### 模块清单
- `bode-figure`
- `track-figure-b`
- `track-figure-c`
- `activity-card-a`
- `activity-card-b`
### 静态承载内容
- Bode 区必须完整保留 `C` 的高带宽、低相角裕度和显著共振峰三条信息。
- 航迹区必须同时保留 `B` 与 `C` 的斜坡响应/回转航迹对照，不能只展示 `C` 的局部收益。
- 风险句模板固定写明：`C 在……方面更强，但以……为代价。`
### 混合证据顺序
- Bode 证据 -> 航迹证据 -> 双卡作答
### 互动升级点
- `activity_cards`
- 卡片 1：补全一条收益-代价句。
- 卡片 2：判断 `C` 仍属“稳定窗口内的取舍型参数”还是“可接受窗口中心”。
### 教师控制
- `release_activity` 与 `reveal_reference_answer` 独立控制。
- `open_browse / teacher_step_reveal` 不适用。
### 学生默认状态
- 图与句式提示始终可见；作答卡默认隐藏。
### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-12`
### 脱离讲稿自包含检查
- 学生能看懂：`C` 的工程含义不是“更快”或“更差”其中之一，而是收益与代价并存。

## 步骤 13｜广义根轨迹入口：局部反馈系数 a 为什么不是“再调一次 K”
### 页面骨架
- 模板：`figure_question_vote`
- 区域：`question / figure / interaction`
### 模块清单
- `entry-question-card`
- `local-feedback-figure`
- `binary-choice`
### 静态承载内容
- 问题卡固定写明：当变化的不是外环比例增益，而是给定局部反馈系数 `a` 时，极点还会沿原来的普通根轨迹移动吗。
- 结构图固定使用 `3-4-local-feedback-block.png`。
- 误判提示固定写明：`a` 改写的是对象内部结构，不是直接把原来的 `K` 再推大一次。
### 混合证据顺序
- 新问题卡 -> 结构图 -> 二选一判断
### 互动升级点
- `binary_choice`
- 题目：`把局部反馈系数 a 调大，是否等价于把原来的外环增益 K 再调大。`
### 教师控制
- `release_activity` 与 `reveal_reference_answer` 独立控制。
- `open_browse / teacher_step_reveal` 不适用。
### 学生默认状态
- 问题卡与结构图始终可见；判断区默认隐藏。
### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-13`
### 脱离讲稿自包含检查
- 学生能知道：这里引入广义根轨迹，是因为参数进入方式已经改变。

## 步骤 14｜改写链：从给定局部反馈结构走到等效根轨迹
### 页面骨架
- 模板：`worked_example_reveal`
- 区域：`principle / problem / activity / reference`
### 模块清单
- `object-card`
- `problem-card`
- `step-reveal-board`
- `activity-card-a`
- `activity-card-b`
- `reference-answer`
### 静态承载内容
- 对象卡必须完整保留
  $$
  G_1(s)=\frac{3.43}{s+2.14375},\qquad
  G_{1,\mathrm{eq}}(s)=\frac{3.43}{s+2.14375+3.43a}
  $$
- 题面卡固定写明：在参考工作点 `K=0.6064` 下，把局部反馈系数 `a` 引入舵机环节后，如何把问题改写回根轨迹形式。
- 显影链至少依次给出：新特征方程、`B(s)+aA(s)=0`、`1+aA(s)/B(s)=0`、等效开环 `G_e(s)=A(s)/B(s)`、为何此处对应标准 `180°` 根轨迹。
### 混合证据顺序
- 对象卡与题面卡 -> 改写显影链 -> 双卡作答与参考答案
### 互动升级点
- `worked_example_workspace`
- 卡片 1：判断本题为什么不能直接沿原普通根轨迹处理。
- 卡片 2：判断这里应按 `180°` 还是 `0°` 根轨迹理解，并说明理由。
### 教师控制
- `release_activity`、`open_browse`、`teacher_step_reveal`、`reveal_reference_answer` 全部独立控制。
### 学生默认状态
- 题面与对象卡始终可见；显影链默认收起；作答卡默认隐藏。
### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-14`
### 脱离讲稿自包含检查
- 学生能仅凭当前页说清：广义根轨迹不是另一套法则，而是先把参数问题改写回标准形式。

## 步骤 15｜非增益参数窗口记录：a 从 0 到 1 怎样改写主导极点
### 页面骨架
- 模板：`parameter_window_compare_board`
- 区域：`figure / table / activity`
### 模块清单
- `generalized-root-locus-figure`
- `parameter-window-table`
- `activity-card-a`
- `activity-card-b`
### 静态承载内容
- 广义根轨迹图固定使用 `3-4-generalized-root-locus.png`。
- 参数窗口表必须完整保留 `a=0 / 0.2 / 0.5 / 1.0` 的代表性极点、主导变化与第一判断。
- 记录建议必须明确三段窗口：比较基线、实践窗口、边界提醒。
### 混合证据顺序
- 广义根轨迹图 -> 参数窗口表 -> 双卡作答
### 互动升级点
- `activity_cards`
- 卡片 1：把 `a=0 / 0.2 / 0.5 / 1.0` 归入“比较基线 / 实践窗口 / 边界提醒”。
- 卡片 2：补写一句“为什么 `a` 越大并不等于整体更优”。
### 教师控制
- `release_activity` 与 `reveal_reference_answer` 独立控制。
- `open_browse / teacher_step_reveal` 不适用。
### 学生默认状态
- 图与参数窗口表始终可见；作答卡默认隐藏。
### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-15`
### 脱离讲稿自包含检查
- 学生能读懂：当前页不是在给设计答案，而是在写非增益参数的可接受窗口。

## 步骤 16｜后测：读图、换算、三域与广义参数是否已经成链
### 页面骨架
- 模板：`posttest_board`
- 区域：`title / questions / feedback`
### 模块清单
- `posttest-title-card`
- `posttest-q1`
- `posttest-q2`
- `posttest-q3`
- `feedback-strip`
### 静态承载内容
- 标题卡固定写明：本页只检查四段判断链是否已经连成一句完整话。
- 三题题面固定围绕：
  - 为什么“还稳定”不足以构成完整工程判断。
  - 若图上读得 `k=0.0104`，实际控制器增益 `K` 应是多少。
  - 为什么局部反馈系数 `a` 不能按普通增益根轨迹直接理解。
### 混合证据顺序
- 标题卡 -> 三题题面 -> 提交与统计
### 互动升级点
- `quiz_group`
- 三题独立作答，不合并成一条长题。
### 教师控制
- `release_activity` 与 `reveal_reference_answer` 独立控制。
- `open_browse / teacher_step_reveal` 不适用。
### 学生默认状态
- 标题卡始终可见；题卡默认隐藏，教师释放后作答。
### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-16`
### 脱离讲稿自包含检查
- 学生能知道这页是在收口全课主线，而不是再开一组新任务。

## 步骤 17｜收束与去向：沿既有结构分析的能力与边界
### 页面骨架
- 模板：`summary_exit_board`
- 区域：`takeaways / boundary / next`
### 模块清单
- `takeaway-list`
- `boundary-card`
- `next-step-card`
### 静态承载内容
- 五条带走必须覆盖：关键节点、参数窗口、增益换算、三域验证、广义参数改写。
- 边界卡固定写明：沿既有结构分析可以帮助我们选点与辨识窗口，但不能替代后续通过结构变化主动改写轨迹。
- 去向卡固定写明：下一课 `3-5` 将从零点进入，讨论怎样改变轨迹本身，而不只是沿既有轨迹选点。
### 混合证据顺序
- 五条带走 -> 边界卡 -> 去向卡
### 互动升级点
- `none`
### 教师控制
- 四类控制均不适用。
### 学生默认状态
- 页面全部可见，无作答区。
### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-17`
### 脱离讲稿自包含检查
- 学生能明确本课留下了什么能力，也能知道为什么 `3-5` 必须进入结构改变。
