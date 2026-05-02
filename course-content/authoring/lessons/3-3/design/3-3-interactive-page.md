# 3-3 互动页设计真源

- 本文件与同目录 [interactive-contract.yaml](./interactive-contract.yaml) 一起定义 `3-3` 的作者态双轨真源。
- 当前真源严格以 `design/3-3-handout.md` 为唯一内容依据，课程重排为连续 `step-01` 到 `step-15`。
- 当前课程页面到“读图顺序、三类开环极点影响、后测、总结”为止，不再继续扩展额外章节。
- 所有页内 AI 提示一律移出页面正文，不再出现“页内 AI 助手”“复制提示词”“打开页内 AI”等显式块。

## 设计原则

- `step-03` 只保留布鲁姆动词课程目标，不再面向学生展示边界表。
- `step-04` 必须把根轨迹定义、`1+L(s)=0 -> L(s)=-1`、相角条件、幅值条件及其推导放在同一页讲清，不再保留二阶冗余例子。
- `step-05` 用原生交互展示“先资格、后参数”：上方常显条件表达式，下方左拖右算。
- `step-06` 用原生 SVG 做骨架法则分步骤显影；图中不嵌说明文字，法则解释全部放回正文模块。
- `step-08` 必须把分离点推导逐步显影、虚轴交点法则、劳斯判据职责写完整，不再混成总表配对页。
- 例题页题面常显；逐步显影只隐藏步骤，不隐藏题面。
- 双题 / 双卡例题页的学生作答区统一双栏并排；单题页不强制改成双栏。
- 后测与总结分离；总结页只回收结论与指向下一课。

## 全课总览

| 步骤 | 标题 | 模板 | 互动形态 |
|---|---|---|---|
| `step-01` | 回到地图：为什么稳定边界还不等于迁移机制 | `map_hero_slide` | `none` |
| `step-02` | 问题引入：知道稳定区间为什么仍然不够 | `figure_question_vote` | `binary_choice` |
| `step-03` | 本课目标：完成本次课程后你应能做到什么 | `goal_focus_slide` | `none` |
| `step-04` | 根轨迹定义与两大条件：从闭环方程到资格与参数 | `definition_derivation_board` | `none` |
| `step-05` | 条件互动：拖动 `s_0` 检查相角条件与幅值条件 | `condition_drag_workspace` | `parameter_workspace` |
| `step-06` | 骨架法则：起点终点、实轴区段与渐近线 | `svg_rule_progression` | `comparison_workspace` |
| `step-07` | 例题 1：先用骨架法则判断整体走向 | `worked_example_workspace` | `worked_example_workspace` |
| `step-08` | 分离点与虚轴交点：关键节点怎样进入主图 | `keypoint_derivation_board` | `none` |
| `step-09` | 例题 2：用 `dK/ds` 与劳斯判据找关键节点 | `worked_example_workspace` | `worked_example_workspace` |
| `step-10` | 出射角、入射角与根之和：局部方向怎样与整图自洽 | `direction_rule_board` | `none` |
| `step-11` | 例题 3：复极点附近怎样离开，整张图怎样自洽 | `worked_example_workspace` | `activity_cards` |
| `step-12` | 读图顺序：先骨架，再关键点，最后补局部方向 | `workflow_sort_board` | `sequence_sort` |
| `step-13` | 三类开环极点：原点极点、实轴极点、共轭复极点 | `pole_type_compare_board` | `classification_cards` |
| `step-14` | 后测：条件、法则、例题与读图顺序是否已经成链 | `posttest_board` | `quiz_group` |
| `step-15` | 总结：九项法则带走什么，`3-4` 从哪里接走 | `summary_exit_board` | `none` |

## 证据单元升级决策表

| evidence_unit_id | handout_anchor | target_steps | keep_elements | hard_checks |
|---|---|---|---|---|
| `eu-01` | `## 一、引入：为什么稳定区间还不够` | `step-01` `step-02` | 模块路径、主问题、四个追问 | 不能把“边界判断不能替代迁移机制”压成一句空话 |
| `eu-02` | `## 二、普通根轨迹的定义与两大判据` | `step-03` `step-04` `step-05` | 根轨迹定义、`1+L(s)=0`、`L(s)=-1`、相角条件、幅值条件 | `step-03` 不得展示边界；`step-04` 不得再放二阶冗余例子；`step-05` 必须是拖点互动 |
| `eu-03` | `### 法则 1` 到 `### 法则 4` | `step-06` `step-07` | 起点终点、分支数、实轴区段、渐近线、例题 1 | `step-06` 必须用分步显影展示骨架形成，图内无长文案 |
| `eu-04` | `### 法则 5` `### 法则 6` | `step-08` `step-09` | `dK/ds=0`、候选点筛选、劳斯判据、虚轴交点、例题 2 | `step-08` 必须给出逐步推导和虚轴交点法则；`step-09` 必须完整展开两条例题链 |
| `eu-05` | `### 法则 7` `### 法则 8` `### 法则 9` | `step-10` `step-11` | 出射角、入射角、根之和、例题 3 | 公式页与例题页分开；例题 3 逐步显影，不只给结果 |
| `eu-06` | `## 四、普通根轨迹的读图顺序` | `step-12` | 七步读图法 | 排序区只服务读图顺序，不能替代正文 |
| `eu-07` | `## 五、三类开环极点对普通根轨迹的基本影响` | `step-13` | 原点极点、实轴极点、共轭复极点的趋势差异 | 三类对象都要写出“对轨迹意味着什么” |
| `eu-08` | `## 六、本讲小结` | `step-14` `step-15` | 五条带走结论、信息图、到 `3-4` 的去向 | 后测与总结分离；总结不再兼任测验 |

## 步骤设计

### `step-01` 回到地图：为什么稳定边界还不等于迁移机制

- 模板：`map_hero_slide`
- 区域：`header / lead / summary`
- 模块：
  - `stage-map`
  - `core-question-card`
  - `bridge-summary`
- 静态承载内容：
  - 高亮 `3-2 -> 3-3 -> 3-4`。
  - 主问题固定写明：参数连续变化时，闭环极点究竟沿什么路径移动。
  - 收束句固定写明：`3-2` 讲边界，`3-3` 讲路径，`3-4` 讲按图判断。
- 教师控制：无。
- 学生默认状态：整页常显。

### `step-02` 问题引入：知道稳定区间为什么仍然不够

- 模板：`figure_question_vote`
- 区域：`figure / questions / interaction`
- 模块：
  - `main-figure`
  - `question-list`
  - `binary-choice`
- 静态承载内容：
  - 主图使用 `3-3-pp-04-complete-rules-example.svg`。
  - 四个追问固定为：先往哪走、何时更振荡、何时触碰边界、参数朝哪调。
  - 结论固定为：只知道边界点，只能回答“会不会失稳”，不能回答“怎样一路走过去”。
- 互动升级：
  - 二选一判断：只知道稳定区间，是否足以解释整条极点迁移路径。
- 教师控制：
  - `release_activity` 与 `reveal_reference_answer` 独立。
- 学生默认状态：
  - 主图和四问常显；作答区默认隐藏。

### `step-03` 本课目标：完成本次课程后你应能做到什么

- 模板：`goal_focus_slide`
- 区域：`goals / chain`
- 模块：
  - `goal-cards`
  - `main-chain`
- 静态承载内容：
  - 只列布鲁姆式目标：
    - 说明根轨迹研究的是闭环极点迁移。
    - 用相角条件判断资格，用幅值条件回算参数。
    - 按层次使用九项法则。
    - 把图形翻译回稳定性、快慢与振荡趋势。
  - 主线链固定写成：`参数变化 -> 闭环极点迁移 -> 轨迹条件 -> 完整法则 -> 动态判断`。
- 禁止事项：
  - 不再出现“本课边界”“不负责什么”“不进入控制器整定”之类面向学生的边界表。

### `step-04` 根轨迹定义与两大条件：从闭环方程到资格与参数

- 模板：`definition_derivation_board`
- 区域：`definition / derivation / conclusion`
- 模块：
  - `definition-card`
  - `equation-chain`
  - `angle-condition-card`
  - `magnitude-condition-card`
- 静态承载内容：
  - 根轨迹定义完整出现。
  - 方程链完整出现：`1+L(s)=0 -> L(s)=-1`。
  - 推导必须明确说明：
    - `-1` 的模为 1，相角为奇数倍 `π`。
    - 因而分出相角条件与幅值条件。
  - 条件卡必须同时写明：
    - 相角条件回答“该点有没有资格在轨迹上”。
    - 幅值条件回答“若在轨迹上，它对应哪一个增益”。
- 禁止事项：
  - 不再保留二阶冗余例子。
  - 不在本页放学生作答区。

### `step-05` 条件互动：拖动 `s_0` 检查相角条件与幅值条件

- 模板：`condition_drag_workspace`
- 区域：`formula-strip / workspace`
- 模块：
  - `formula-strip`
  - `root-locus-svg`
  - `condition-breakdown`
- 静态承载内容：
  - 顶部常显相角条件与幅值条件表达式。
  - 左侧图像区用单色虚线显示根轨迹与极点/零点。
  - 学生手工拖动 `s_0` 后，右侧实时更新：
    - 每个极点/零点对 `s_0` 的相角贡献。
    - 相角和是否满足奇数倍 `π`。
    - 对应模值乘积与当前增益计算。
    - 当前点“是否在轨迹上”的资格结论。
- 教师控制：无额外释放；默认可操作。
- 学生默认状态：整页交互可见，不附独立作答表单。

### `step-06` 骨架法则：起点终点、实轴区段与渐近线

- 模板：`svg_rule_progression`
- 区域：`rules / svg / legend`
- 模块：
  - `rule-cards`
  - `progressive-svg`
  - `reading-cue`
- 静态承载内容：
  - 法则 1-4 逐条给出完整文字与公式。
  - 实轴区段法则必须写成“右侧开环实极点与实零点总数为奇数”。
  - 渐近线条数、重心、角度公式完整出现。
- 互动升级：
  - 原生 SVG 分步显影顺序固定为：
    - 空白坐标轴
    - 列出极点
    - 绘制实轴根轨迹
    - 绘制渐近线
    - 绘制完整轨迹
- 禁止事项：
  - 图中不写长说明句；说明文字必须挪到法则模块。
  - 不再把关键节点混进本页。

### `step-07` 例题 1：先用骨架法则判断整体走向

- 模板：`worked_example_workspace`
- 区域：`principle / problem / workspace`
- 模块：
  - `principle-card`
  - `problem-card`
  - `step-reveal-board`
  - `dual-activity-cards`
- 静态承载内容：
  - 完整题面：`G(s)H(s)=K/[s(s+2)(s+4)]`。
  - 方法链固定为：起点终点 -> 实轴区段 -> 渐近线 -> 总体走向。
  - 主图使用 `3-3-example-01-skeleton.svg`。
- 互动升级：
  - 逐步显影链按上面四步展开。
  - 双栏作答卡：
    - 左卡：判断哪些实轴区段属于轨迹。
    - 右卡：给出渐近线重心与角度。

### `step-08` 分离点与虚轴交点：关键节点怎样进入主图

- 模板：`keypoint_derivation_board`
- 区域：`rules / derivation / cue`
- 模块：
  - `breakaway-rule-card`
  - `breakaway-derivation-reveal`
  - `imaginary-axis-rule-card`
  - `routh-cue`
- 静态承载内容：
  - 分离点页必须完整出现：
    - `K(s)=-D(s)/N(s)`
    - `dK/ds=0`
    - 候选点还需满足“位于实轴根轨迹区段 + 代回后 K>0”。
  - 虚轴交点页必须完整出现：
    - 写闭环特征方程。
    - 以 `K` 为参数列劳斯表。
    - 由临界稳定条件求 `K`，再由辅助方程求交点频率。
  - 分离点推导要逐步显影，不一次性全出。
- 禁止事项：
  - 不再用“关键节点配对题”替代这一页。

### `step-09` 例题 2：用 `dK/ds` 与劳斯判据找关键节点

- 模板：`worked_example_workspace`
- 区域：`principle / problem / workspace`
- 模块：
  - `principle-card`
  - `problem-card`
  - `dual-reveal-board`
  - `dual-activity-cards`
- 静态承载内容：
  - 完整题面：`G(s)H(s)=K/[s(s+1)(s+2)]`，闭环特征方程 `s^3+3s^2+2s+K=0`。
  - 主图使用 `3-3-example-02-breakaway-crossing.svg`。
  - 显影链分成两条：
    - 分离点链：写出 `K(s)` -> 求 `dK/ds=0` -> 筛选真实候选点。
    - 虚轴交点链：列劳斯表 -> 求临界增益 -> 求虚轴交点 -> 回到稳定范围。
- 互动升级：
  - 双栏作答卡：
    - 左卡：哪一个候选点是真实分离点。
    - 右卡：临界增益与虚轴交点如何对应。

### `step-10` 出射角、入射角与根之和：局部方向怎样与整图自洽

- 模板：`direction_rule_board`
- 区域：`formulas / figure / summary`
- 模块：
  - `departure-angle-card`
  - `arrival-angle-card`
  - `root-sum-card`
  - `direction-figure`
- 静态承载内容：
  - 出射角公式、入射角公式、根之和原则完整出现。
  - 每条法则都要写明“它回答什么问题”。
  - 图示使用 `3-3-pp-06-departure-arrival-angle.svg`。
- 禁止事项：
  - 本页只讲法则，不把例题塞进来。

### `step-11` 例题 3：复极点附近怎样离开，整张图怎样自洽

- 模板：`worked_example_workspace`
- 区域：`principle / problem / workspace`
- 模块：
  - `principle-card`
  - `problem-card`
  - `step-reveal-board`
  - `dual-activity-cards`
- 静态承载内容：
  - 完整题面：`G(s)H(s)=K/[(s+2)(s^2+2s+5)]`。
  - 主图使用 `3-3-example-03-departure-sum.svg`。
  - 显影链固定为：
    - 写开环极点位置与对称性。
    - 展开上半平面复极点的出射角求解。
    - 用共轭对称得到下半平面结果。
    - 用根之和约束复核另一实根位置与整图走势。
- 互动升级：
  - 双栏作答卡：
    - 左卡：上半平面复极点的出射角。
    - 右卡：根之和如何限制另一实根的位置。

### `step-12` 读图顺序：先骨架，再关键点，最后补局部方向

- 模板：`workflow_sort_board`
- 区域：`workflow / interaction / feedback`
- 模块：
  - `workflow-cards`
  - `sequence-sort`
  - `misread-note`
- 静态承载内容：
  - 七步读图法固定为：极点零点 -> 实轴区段 -> 渐近线 -> 实轴关键点 -> 虚轴交点 -> 局部方向 -> 全图复核。
  - 误判提示固定写明：不要先抓分离点而忽略骨架。
- 互动升级：
  - 排序区要求按正确读图顺序重排。

### `step-13` 三类开环极点：原点极点、实轴极点、共轭复极点

- 模板：`pole_type_compare_board`
- 区域：`cards / table / interaction`
- 模块：
  - `pole-type-cards`
  - `trend-table`
  - `classification-cards`
- 静态承载内容：
  - 三类对象都要写明“对轨迹意味着什么”。
  - 趋势表固定比较：
    - 起始离开方式
    - 对实轴区段与关键点的影响
    - 对振荡趋势的影响
- 互动升级：
  - 分类卡把趋势判断归到对应的开环极点类型。

### `step-14` 后测：条件、法则、例题与读图顺序是否已经成链

- 模板：`posttest_board`
- 区域：`intro / quiz / review`
- 模块：
  - `posttest-intro`
  - `quiz-group`
  - `misconception-review`
- 静态承载内容：
  - 后测至少覆盖：
    - 相角条件与幅值条件的先后顺序。
    - 为什么读图时先骨架后关键点。
    - 例题中不同法则各自回答什么问题。
- 互动升级：
  - `quiz_group`

### `step-15` 总结：九项法则带走什么，`3-4` 从哪里接走

- 模板：`summary_exit_board`
- 区域：`summary / infographic / next-step`
- 模块：
  - `takeaway-cards`
  - `info-figure`
  - `next-step-card`
- 静态承载内容：
  - 五条带走结论固定回收：
    - 根轨迹研究的是闭环极点迁移。
    - 相角条件先判资格，幅值条件再定参数。
    - 画图先抓骨架，再找关键节点，最后补局部方向。
    - 分离点、虚轴交点、出射角、根之和各司其职。
    - 图上的路径最终要翻回稳定性、快慢与振荡判断。
  - 信息图使用 `3-3-info.png`。
  - 去向卡固定写明：`3-4` 将把今天的法则链转成读图判断。
