━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
互动页面设计 | 单元 3-7：型别、积分环节与稳态改善——PI 与滞后校正的低频补偿机理
技术栈：Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 文档职责
- 本文件是供人审阅的互动页面蓝图，只描述页面结构、证据顺序、静态承载内容、互动模块、教师控制、学生访问语义与预览口径。
- 同目录 [interactive-contract.yaml](./interactive-contract.yaml) 为机读契约；两者必须逐步骤同名、同序、同语义。
- 本文件不承担讲义摘要，不把例题题面、公式链、图后说明、控制语义留给实现阶段自行补足。
- 本课默认预览口径固定为学生演示页；教师端模板弹窗只用于查看课堂骨架，不代替真实页面预览。

## 表述规则
- 页面顺序服从讲义证据链，不为首屏视觉改写逻辑顺序。
- 图片不得默认抢占页面最上方；只有当图片本身属于题面首证据时，才允许靠前出现。
- 原理模块、例题模块、逐步显影模块、学生作答模块必须分离。
- 题面必须一次性完整出现；逐步显影只允许作用于求解步骤，不允许隐藏题面。
- 教师控制固定拆分为：`release_activity`、`open_browse`、`teacher_step_reveal`、`reveal_reference_answer`。
- 学生作答区默认隐藏优先；每个作答步骤为独立小卡片，单卡提交。
- 双题页的作答卡标题直接写题面，不得使用“卡片 1 / 卡片 2”之类无语义标题；单卡按钮统一写为“提交答案”。
- 逐步显影组件若已显示步骤编号，步骤标题正文不再重复写“第 1 步：……”；并要求支持点击当前已显影步骤继续显影下一层。

## 证据单元升级说明表
| 证据类型 | 来源锚点 | 目标步骤 | 升级方式 | 保留元素 | 不得删减内容 | 验收点 |
|---|---|---|---|---|---|---|
| 路径定位与主问题 | `## 一` | step-01 | 静态保留 | `3-6 -> 3-7 -> 3-8` 路径、主问题、边界卡 | “更快更稳不等于已经更准” | 首屏直接看到路径图、主问题卡、边界卡 |
| 目标与课堂边界 | `BOPPPS: O` | step-02 | 静态保留 | 四项目标、负责/不负责边界表 | 本课不进入完整频域整定 | 目标卡与边界表同屏 |
| 前测误区 | `BOPPPS: P1` | step-03 | 题组互动 | 三题前测、误区标签 | 不得只剩结论提示 | 三题题干完整落页 |
| 双通道结构与四类传函 | `### 2.1`、`### 2.2` | step-04 | 原生重绘 + 热点标注 | 结构图、四类传函、总输出、总误差、通道判断句 | 不得把四式压成一块；每式必须命名 | 结构图、四个公式卡、总输出/总误差结论先于互动出现 |
| 终值定理与例题 1 | `### 2.3`、`例题 1` | step-05 | 原理模块 + 例题显影 + 作答卡 | 三步法、终值定理、题面、全步骤链、结果 `1/K` | 不得只留终值公式或最终答案 | 题面完整，步骤显影完整，作答区默认隐藏 |
| 型别、静态误差系数与双表快判 | `### 2.4` | step-06 | 公式分组 + 并排双表 + 作答卡 | 型别定义、`K_p/K_v/K_a`、两张表、适用边界、例题 1 快判复算 | 不得把两张表合并或删掉“扰动题不能直接套表” | 公式按条目命名，双表并排，作答题面明确 |
| 例题 2：给定与扰动共同作用 | `### 2.5`、`例题 2` | step-07 | 原理模块 + 例题显影 + 作答卡 | 双输入结构、题面文字、总误差式、终值链、结果 `0.4` | 不得把结构图默认顶到页面最上方 | 题面元素顺序与讲义一致，步骤完整显影 |
| 增益变大 vs 型别提高 | `### 2.6` | step-08 | 静态对照 + 判断卡 | 压小有限误差、改变误差阶次、结构修正结论 | 不得把“压小”和“归零”混为一谈 | 对照卡先于判断卡出现 |
| 低频补偿总览 | `### 3.1` | step-09 | 公式分组 + 基本文案 + 图表 + 小卡作答 | `PI` 公式、滞后公式、三类补偿图、比较表、共同点句 | 顺序必须是公式 -> 文案 -> 图片 -> 表格 -> 作答卡 | 图表不得先于公式与文案出现 |
| 时域 `PI` 设计完整过程 | `### 3.2` | step-10 | 方法页 + 逐步显影 + 末端验证图 | 对象、目标、纯增益局限、可行域换算、`PI` 零点选择、验证结果 | 不得只留验证图；图片只能最后出现 | 题面完整、步骤完整、验证图最后出现 |
| 时域滞后设计完整过程 | `### 3.3` | step-11 | 方法页 + 逐步显影 + 末端验证图 | 对象、目标、纯增益矛盾、滞后结构、`K_v` 提升、验证结果 | 不得把滞后写成弱积分 | 题面完整、步骤完整、验证图最后出现 |
| 时域方法比较 | `### 3.2`、`### 3.3` | step-12 | 比较页 + 小卡作答 | 收益、代价、型别变化、适用问题 | 比较页不得首次承载完整过程 | 仅在两种方法页之后出现 |
| 频域 `PI` 设计完整过程 | `### 3.4` | step-13 | 方法页 + 逐步显影 + 末端验证图 | 对象、目标、纯增益不兼容、四步设计链、核验结果 | 不得只留最终控制器表达式 | 设计顺序完整且图在最后 |
| 频域 `PD` 方案读取与核验 | `### 3.5` | step-14 | 方案页 + 逐步显影 + 图像验证 | 给定 `PD` 方案、核验指标、时域形态、设计取向 | 不得臆造讲义未给出的完整整定链 | 明确这是读取/核验页，不是假造完整整定页 |
| 频域方法比较 | `### 3.4`、`### 3.5` | step-15 | 比较页 + 小卡作答 | `PI` 与 `PD` 在低频精度、截止频率、相位裕度、时域形态上的差异 | 比较页不得替代方法页 | 仅在两种频域方案页之后出现 |
| 后测 | `BOPPPS: P3` | step-16 | 小卡题组 | 四道路径判断题与错因标签 | 后测不得和总结同页 | 每题独立卡片并排显示 |
| 收束与去向 | `### 3.6`、`## 四`、`## 五`、`附录 A` | step-17 | 静态总结页 | 工程视角、小结六条、规则表、信息图、`3-8` 去向 | 不得删掉规则表与信息图 | 后测已分离；本页只做收束与去向 |

## 混合证据顺序表
| 步骤 | 先出现什么 | 再出现什么 | 最后出现什么 | 必须同屏内容 |
|---|---|---|---|---|
| step-04 | 双通道结构图与信号位置 | 四类传函卡、总输出与总误差结论 | 热点标注区 | 结构图、四个命名公式卡、两条结论式 |
| step-05 | 三步法卡与终值定理 | 例题 1 完整题面 | 逐步显影区、作答卡 | 原理模块、题面模块、结果摘要 |
| step-06 | 型别定义与误差系数命名公式 | 两张表并排与适用边界 | 例题 1 快判作答卡 | 公式组、双表、边界句 |
| step-07 | 例题 2 题面文字与结构说明 | 结构图与总误差通式 | 逐步显影区、作答卡 | 题面、结构图、总误差式 |
| step-09 | `PI` 与滞后公式组 | 基本文案 | 补偿图、比较表、作答卡 | 公式、文案、图、表 |
| step-10 | 对象与目标 | 纯增益矛盾、可行域换算、`PI` 零点选择 | 验证图、作答卡 | 题面、步骤链、验证结论 |
| step-11 | 对象与目标 | 纯增益矛盾、滞后结构与 `K_v` 推导 | 验证图、作答卡 | 题面、步骤链、验证结论 |
| step-12 | 比较维度卡 | 指标并列表 | 选择题卡 | 收益、代价、型别与场景同屏 |
| step-13 | 对象与频域目标 | 纯增益矛盾、四步设计链 | 验证图、作答卡 | 目标、步骤链、核验结果 |
| step-14 | 方案题面 | 指标核验链与时域形态说明 | 对比图、作答卡 | 给定方案、核验结果、解释句 |
| step-15 | 比较维度卡 | 指标并列表 | 选择题卡 | 精度、速度、裕量、误差保留同屏 |
| step-16 | 四道后测题卡 | 错因标签 | 提交与教师点评区 | 每题题面、提交按钮 |
| step-17 | 工程视角卡 | 小结六条、规则表、信息图 | `3-8` 去向卡 | 规则表、小结、信息图、去向卡 |

## 全课总览
| 步骤 | 标题 | 页面模板 | 主体布局 | 互动组件 | 学生页预览 |
|---|---|---|---|---|---|
| step-01 | 回到地图：为什么动态改善之后还可能不够准 | `map_hero_slide` | 路径图 + 主问题卡 + 边界卡 | `none` | `/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-01` |
| step-02 | 学习目标与边界：本课先回答“为什么更准” | `goal_boundary_slide` | 目标卡 + 边界表 | `none` | `/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-02` |
| step-03 | 前测：给定、扰动、型别三类混淆 | `question_stack` | 三题前测 + 反馈条 | `quiz_group` | `/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-03` |
| step-04 | 双通道骨架：四类传函分卡命名 | `formula_media_compare` | 结构图 + 四式卡 + 热点区 | `hotspot_labeling` | `/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-04` |
| step-05 | 终值定理直接求：原理模块与例题 1 分离 | `worked_example_workspace` | 原理卡 + 题面卡 + 显影区 + 作答卡 | `worked_example_workspace` | `/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-05` |
| step-06 | 型别与静态误差系数：双表并排快判 | `formula_table_workspace` | 公式组 + 双表 + 作答卡 | `activity_card_set` | `/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-06` |
| step-07 | 复合例题：给定与扰动共同作用时为什么不能只套表 | `worked_example_workspace` | 题面卡 + 结构图 + 显影区 + 作答卡 | `worked_example_workspace` | `/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-07` |
| step-08 | 增益变大 vs 型别提高：哪一种会改变误差阶次 | `contrast_summary_board` | 对照卡 + 判断卡 | `binary_choice` | `/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-08` |
| step-09 | 低频补偿总览：`PI`、滞后与超前的结构差别 | `formula_figure_table_stack` | 公式组 + 文案卡 + 图 + 表 + 小卡作答 | `activity_card_set` | `/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-09` |
| step-10 | 时域 `PI` 设计：先证明纯增益不够，再改结构 | `method_reveal_page` | 题面卡 + 显影步骤 + 验证图 + 作答卡 | `worked_example_workspace` | `/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-10` |
| step-11 | 时域滞后设计：型别不变时怎样抬高低频增益 | `method_reveal_page` | 题面卡 + 显影步骤 + 验证图 + 作答卡 | `worked_example_workspace` | `/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-11` |
| step-12 | 时域两法比较：收益、代价与适用场景 | `comparison_board` | 维度卡 + 指标表 + 小卡作答 | `activity_card_set` | `/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-12` |
| step-13 | 频域 `PI` 设计：纯增益为何不能两头兼顾 | `method_reveal_page` | 题面卡 + 显影步骤 + 验证图 + 作答卡 | `worked_example_workspace` | `/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-13` |
| step-14 | 频域 `PD` 方案读取：速度优先方案的核验结果 | `method_reveal_page` | 方案卡 + 显影步骤 + 对比图 + 作答卡 | `worked_example_workspace` | `/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-14` |
| step-15 | 频域两法比较：低频精度优先 vs 动态速度优先 | `comparison_board` | 维度卡 + 指标表 + 小卡作答 | `activity_card_set` | `/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-15` |
| step-16 | 后测：路径选择与方法判断 | `assessment_card_grid` | 四题卡片并排 + 点评条 | `quiz_card_grid` | `/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-16` |
| step-17 | 收束与去向：规则表、信息图与 3-8 入口 | `summary_route_board` | 工程视角 + 小结 + 规则表 + 信息图 + 去向卡 | `none` | `/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-17` |

## 证据单元升级决策表
| evidence_unit_id | handout_anchor | evidence_kind | target_steps | upgrade_mode | keep_elements | non_reducible | acceptance_checks |
|---|---|---|---|---|---|---|---|
| intro-route-question | `## 一、引入：系统已经稳定了，为什么还可能不够准` | concept | `step-01` | `static_keep` | 路径、主问题、边界卡 | 不得删去“更快更稳不等于已经更准” | 首屏看到路径图、主问题卡、边界卡 |
| goal-boundary | `## 一、引入：系统已经稳定了，为什么还可能不够准` | concept | `step-02` | `static_keep` | 四项目标、负责/不负责边界表 | 不得提前进入完整频域整定 | 目标卡与边界表同屏 |
| pretest-misconceptions | `## 一、引入：系统已经稳定了，为什么还可能不够准` | misconception | `step-03` | `quiz_group` | 三题前测、误区标签 | 不得只剩结论提示 | 未作答时三题全部可见 |
| dual-channel-formulas | `### 2.2 给定与扰动为何必须分通道` | formula+figure | `step-04` | `native_redraw_plus_hotspot` | 结构图、四类传函、总输出、总误差 | 不得把四式压成一块 | 四个命名公式卡先于互动出现 |
| final-value-example-1 | `### 2.3 终值定理：稳态误差的直接求法` | principle+example | `step-05` | `worked_example_reveal` | 三步法、终值定理、题面、结果 `1/K` | 不得只留终值公式或最终答案 | 原理模块、题面模块、作答卡边界清楚 |
| type-and-error-constants | `### 2.4 型别与静态误差系数：稳态误差的快速判断` | formula+table | `step-06` | `formula_table_with_activity_cards` | 型别定义、`K_p/K_v/K_a`、双表、适用边界 | 不得把两张表合并 | 双表并排，作答区默认隐藏 |
| compound-example-2 | `### 2.5 给定与扰动共同作用下如何求稳态误差` | example | `step-07` | `worked_example_reveal` | 双输入结构、题面文字、总误差式、结果 `0.4` | 不得把结构图顶到页面最前 | 题面顺序与讲义一致 |
| gain-vs-type | `### 2.6 为什么结构性误差不能靠纯调增益消除` | comparison | `step-08` | `contrast_board` | 压小有限误差、改变误差阶次 | 不得把“压小”和“归零”混为一谈 | 对照卡先于判断卡 |
| low-frequency-overview | `### 3.1 两种低频补偿的结构差别` | formula+figure+table | `step-09` | `formula_figure_table_stack` | `PI` 公式、滞后公式、三类补偿图、比较表 | 图表不得先于公式与文案 | 顺序必须是公式 -> 文案 -> 图 -> 表 -> 作答卡 |
| time-domain-pi-design | `### 3.2 基于时域指标的 `PI` 设计：先证明纯增益不够，再改结构` | design_method | `step-10` | `method_reveal_page` | 对象、目标、纯增益局限、可行域换算、`PI` 零点选择、验证结果 | 不得只留验证图 | 验证图最后出现 |
| time-domain-lag-design | `### 3.3 基于时域指标的滞后校正：同样要先画可行域` | design_method | `step-11` | `method_reveal_page` | 对象、目标、纯增益矛盾、滞后结构、`K_v` 提升、验证结果 | 不得把滞后写成弱积分 | 题面完整，步骤完整显影 |
| time-domain-compare | `## 三、`PI` 与滞后校正：同属低频补偿，但设计逻辑不同` | comparison | `step-12` | `comparison_board` | 收益、代价、型别变化、适用问题 | 比较页不得首次承载完整过程 | 仅在两种方法页之后出现 |
| frequency-domain-pi-design | `### 3.4 基于频域指标的 `PI` 设计：先说明纯增益为什么不可能两头兼顾` | design_method | `step-13` | `method_reveal_page` | 对象、目标、纯增益不兼容、四步设计链、核验结果 | 不得只留最终控制器表达式 | 设计顺序完整且图在最后 |
| frequency-domain-pd-readout | `### 3.5 频域设计下 `PI` 与 `PD` 的性能差异` | design_readout | `step-14` | `method_reveal_page` | 给定 `PD` 方案、核验指标、时域形态、设计取向 | 不得臆造讲义未给出的完整整定链 | 明确这是方案读取与核验页 |
| frequency-domain-compare | `### 3.5 频域设计下 `PI` 与 `PD` 的性能差异` | comparison | `step-15` | `comparison_board` | `PI` 与 `PD` 在低频精度、截止频率、相位裕度、时域形态上的差异 | 比较页不得替代方法页 | 仅在两种频域方案页之后出现 |
| post-assessment | `## 五、本节小结与前后衔接` | assessment | `step-16` | `quiz_card_grid` | 四道路径判断题与错因标签 | 后测不得和总结同页 | 每题独立卡片并排显示 |
| summary-and-next | `### 3.6 收束：为什么这会自然过渡到 3-8` | summary | `step-17` | `summary_route_board` | 工程视角、小结六条、规则表、信息图、`3-8` 去向 | 不得删掉规则表与信息图 | 本页只做收束与去向 |

## 步骤 01｜回到地图：为什么动态改善之后还可能不够准

### 页面骨架
- 模板：`map_hero_slide`
- 区域：`header` / `lead` / `summary`

### 模块清单
- `stage-map`：高亮 `3-6 -> 3-7 -> 3-8`
- `core-question-card`：主问题卡
- `boundary-card`：本课边界卡

### 静态承载内容
- 主问题卡固定写明：
  - 系统稳定了，为什么误差还可能留在比较点上？
  - 为什么“更快更稳”并没有自动回答“为什么更准”？
- 边界卡固定写明：本课先解决误差通道、求解路径与低频补偿逻辑，不进入完整频域整定。

### 互动升级点
- 组件类型：`none`
- 学生任务：只阅读，不提交

### 教师控制
- `release_activity`：`not_applicable`
- `open_browse`：`not_applicable`
- `teacher_step_reveal`：`not_applicable`
- `reveal_reference_answer`：`not_applicable`

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-01`
- 对齐要求：首屏直接看到路径图、主问题卡和边界卡，不出现作答区占位

## 步骤 02｜学习目标与边界：本课先回答“为什么更准”

### 页面骨架
- 模板：`goal_boundary_slide`
- 区域：`goals` / `boundary`

### 模块清单
- `goal-cards`：四项目标卡
- `boundary-table`：负责 / 不负责边界表

### 静态承载内容
- 四项目标固定对应：会分通道、会选路径、会区分增益与型别、会比较 `PI` 与滞后。
- 边界表固定写明：
  - 本课负责：误差通道、终值定理、型别快判、低频补偿路径。
  - 本课不负责：完整频域整定、模块 4 控制器选型。

### 互动升级点
- 组件类型：`none`

### 教师控制
- `release_activity`：`not_applicable`
- `open_browse`：`not_applicable`
- `teacher_step_reveal`：`not_applicable`
- `reveal_reference_answer`：`not_applicable`

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-02`
- 对齐要求：目标卡与边界表同屏

## 步骤 03｜前测：给定、扰动、型别三类混淆

### 页面骨架
- 模板：`question_stack`
- 区域：`question-stack` / `submit-bar`

### 模块清单
- `pretest-q1`：扰动能否直接套型别表
- `pretest-q2`：I 型系统只调增益能否消除斜坡误差
- `pretest-q3`：滞后是不是更弱积分
- `misconception-note`：误区标签

### 静态承载内容
- 三道题干全部明文落页。
- 前测提示文本块固定放在题组上方，先说明本页要暴露哪三类误判，再进入学生作答区。
- 误区标签固定列出：
  - 扰动不是另一种输入型别；
  - 增益变大不等于型别提高；
  - 滞后不是更弱积分。

### 互动升级点
- 组件类型：`quiz_group`
- 学生任务：完成三道前测
- 反馈规则：允许重提一次；教师端区分首答与重提

### 教师控制
- `release_activity`：页面载入即开放
- `open_browse`：`not_applicable`
- `teacher_step_reveal`：`not_applicable`
- `reveal_reference_answer`：可切换整组答案与错因标签

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-03`
- 对齐要求：未作答时三题全部可见

## 步骤 04｜双通道骨架：四类传函分卡命名

### 页面骨架
- 模板：`formula_media_compare`
- 区域：`media` / `formula` / `interaction`

### 模块清单
- `dual-channel-figure`：双通道结构图
- `formula-card-1`：给定到输出传函
- `formula-card-2`：扰动到输出传函
- `formula-card-3`：给定到误差传函
- `formula-card-4`：扰动到误差传函
- `channel-sum-card`：总输出与总误差结论
- `channel-hotspots`：热点标注区

### 静态承载内容
- 主图固定使用 `3-7-error-dual-channel.png`。
- 四个公式卡必须分别命名并完整落页：
  - 给定到输出：$\Phi_r(s)=\dfrac{C(s)}{R(s)}=\dfrac{G_c(s)G_p(s)}{1+G_c(s)G_p(s)H(s)}$
  - 扰动到输出：$\Phi_d(s)=\dfrac{C(s)}{D(s)}=\dfrac{G_p(s)}{1+G_c(s)G_p(s)H(s)}$
  - 给定到误差：$\dfrac{E_r(s)}{R(s)}=\dfrac{1}{1+G_c(s)G_p(s)H(s)}$
  - 扰动到误差：$\dfrac{E_d(s)}{D(s)}=-\dfrac{G_p(s)H(s)}{1+G_c(s)G_p(s)H(s)}$
- 总结论卡固定写明：
  - $C(s)=\Phi_r(s)R(s)+\Phi_d(s)D(s)$
  - $E(s)=E_r(s)+E_d(s)$
  - 分母相同反映结构，分子不同反映通道。

### 互动升级点
- 组件类型：`activity_card_set`
- 学生任务：先阅读结构图与四类命名传函，再完成两道勾选提交题
- 作答卡：
  - `channel-card-1`：判断“给定到输出传函”，`single_choice`
  - `channel-card-2`：判断“扰动项应先走哪条分析路径”，`single_choice`
- 每卡单独提交，不设置整页统一提交按钮

### 教师控制
- `release_activity`：页面载入即开放
- `open_browse`：`not_applicable`
- `teacher_step_reveal`：`not_applicable`
- `reveal_reference_answer`：显示正确位置与常见错标

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-04`
- 对齐要求：结构图、四个命名公式卡、总输出/总误差结论必须先于热点区出现

## 步骤 05｜终值定理直接求：原理模块与例题 1 分离

### 页面骨架
- 模板：`worked_example_workspace`
- 区域：`principle` / `problem` / `derivation` / `activity`

### 模块清单
- `principle-card`：终值定理三步法与适用前提
- `example-1-problem`：例题 1 完整题面
- `example-1-derivation`：逐步显影步骤链
- `activity-card-row`：关键步骤作答卡

### 静态承载内容
- 原理模块固定写明：
  - 判闭环稳定；
  - 写所关心通道的误差传递函数；
  - 用 $e_{ss}=\lim_{s\to 0}sE(s)$ 求极限。
- 题面模块必须一次性完整显示：
  - $G(s)=\dfrac{K}{s^2(0.5s+1)}$
  - $r(t)=3+2t+\dfrac{1}{2}t^2$
  - $R(s)=\dfrac{3}{s}+\dfrac{2}{s^2}+\dfrac{1}{s^3}$
  - 求稳态误差
- 结果摘要固定写明：本题最终稳态误差为 `1/K`。

### 混合证据顺序
- 先出现原理模块。
- 再出现例题 1 完整题面。
- 最后出现逐步显影步骤与作答卡。

### 互动升级点
- 组件类型：`worked_example_workspace`
- 步骤显影固定完整列出：
  1. 写出 $\dfrac{E(s)}{R(s)}=\dfrac{1}{1+G(s)}$
  2. 代入 $R(s)$ 写出完整 $E(s)$
  3. 使用终值定理整理分子与分母
  4. 求得 $e_{ss}=1/K$
  5. 说明为何由抛物线分量决定最终误差
- 学生作答卡仅要求关键步骤：
  - `ex1-card-1`：判断首步动作，`single_choice`
  - `ex1-card-2`：说明为何最终只剩 `1/K`，`fill_text`
- 每卡单独提交。

### 教师控制
- `release_activity`：控制作答卡是否显示；默认关闭
- `open_browse`：控制学生是否可自主展开步骤；默认关闭
- `teacher_step_reveal`：教师端可直接逐步显影；不受 `open_browse` 影响
- `reveal_reference_answer`：控制学生端是否可见完整标准步骤；默认关闭

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-05`
- 对齐要求：学生默认能看见原理模块和完整题面，但不能展开步骤，且作答区默认隐藏

## 步骤 06｜型别与静态误差系数：双表并排快判

### 页面骨架
- 模板：`formula_table_workspace`
- 区域：`formula-groups` / `tables` / `activity`

### 模块清单
- `type-definition-card`：型别定义
- `static-error-constants-card`：静态误差系数定义
- `steady-error-formulas-card`：典型输入稳态误差公式
- `constants-table`：表 2，各型别系统的静态误差系数
- `steady-error-table`：表 3，各型别系统对典型输入的稳态误差
- `boundary-note`：适用边界说明
- `example-1-quick-judge-cards`：例题 1 快判作答卡

### 静态承载内容
- 公式区必须按条目分开并配名称：
  - 型别定义：$G(s)H(s)=\dfrac{K_0}{s^v}G_0(s)$
  - 静态误差系数：$K_p$、$K_v$、$K_a$
  - 典型输入稳态误差：$e_{ss,\mathrm{step}}$、$e_{ss,\mathrm{ramp}}$、$e_{ss,\mathrm{para}}$
- 第一行固定保持“左侧开环低频结构与判断文案，右侧三个静态误差系数”。
- 两张表左右并排，且第一列统一为“型别”。
- 边界说明固定写明：标准给定输入可先快判；显式扰动问题必须优先列式。
- 作答区顶部必须重述问题：回到例题 1，为什么 II 型系统最后只剩抛物线分量误差？

### 互动升级点
- 组件类型：`activity_card_set`
- 作答卡为独立小卡片：
  - `type-card-1`：判断系统型别，`single_choice`
  - `type-card-2`：说明判断是否必须引入积分时先看什么，`fill_text`
- 每卡单独提交，可按半栏或通栏排布。

### 教师控制
- `release_activity`：控制快判作答卡是否显示；默认关闭
- `open_browse`：`not_applicable`
- `teacher_step_reveal`：`not_applicable`
- `reveal_reference_answer`：控制快判卡参考答案；默认关闭

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-06`
- 对齐要求：公式分组、双表、边界说明始终可见；作答区默认隐藏

## 步骤 07｜复合例题：给定与扰动共同作用时为什么不能只套表

### 页面骨架
- 模板：`worked_example_workspace`
- 区域：`principle` / `problem` / `derivation` / `activity`

### 模块清单
- `principle-card`：双通道求解原则
- `example-2-problem`：例题 2 完整题面
- `example-2-figure`：结构图，作为题面内部元素
- `example-2-derivation`：逐步显影步骤链
- `activity-card-row`：关键步骤作答卡

### 静态承载内容
- 原理模块固定写明：先写总输出，再写总误差，最后做终值极限。
- 题面模块按讲义顺序依次给出：
  - 文字说明：`G_1(s)` 为执行机构，`G_2(s)` 为被控对象，扰动加在两者之间；
  - 第一行通栏结构图：`3-7-example2-structure.png`
  - 第二行左侧系统传函：$G_1(s)=\dfrac{5}{s+5}$，$G_2(s)=\dfrac{2}{s+2}$；
  - 第二行右侧输入条件：$R(s)=\dfrac{1}{s}$，$D(s)=\dfrac{0.2}{s}$；
  - 问题：求总稳态误差。
- 结果摘要固定写明：本题最终稳态误差为 `0.4`。

### 混合证据顺序
- 先出现原理模块。
- 再出现题面文字与通栏结构图。
- 然后出现第二行左右分栏的系统传函与输入条件。
- 最后出现逐步显影步骤与作答卡。

### 互动升级点
- 组件类型：`worked_example_workspace`
- 步骤显影固定完整列出：
  1. 写出 $\Phi_r(s)$ 与 $\Phi_d(s)$
  2. 写出总误差 $E(s)$
  3. 代入 $R(s)$ 与 $D(s)$
  4. 用终值定理求 $e_{ss}$
  5. 得到 `0.4` 并解释为何不能直接套型别表
- 学生作答卡：
  - `ex2-card-1`：判断第一步动作，`single_choice`
  - `ex2-card-2`：说明为何必须先列总误差式，`fill_text`

### 教师控制
- `release_activity`：控制作答卡显示；默认关闭
- `open_browse`：控制学生是否可展开例题步骤；默认关闭
- `teacher_step_reveal`：教师端可直接逐步显影；不受 `open_browse` 影响
- `reveal_reference_answer`：控制学生端是否可见完整标准步骤；默认关闭

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-07`
- 对齐要求：结构图不得脱离题面文字被自动置顶；学生默认只能看题面，不能看步骤，且作答区默认隐藏

## 步骤 08｜增益变大 vs 型别提高：哪一种会改变误差阶次

### 页面骨架
- 模板：`contrast_summary_board`
- 区域：`contrast` / `activity`

### 模块清单
- `gain-card`：增益调节的作用
- `type-card`：结构修正的作用
- `decision-cards`：判断题卡

### 静态承载内容
- 对照卡固定写明：
  - 增益调节：压小有限误差，不改变误差阶次。
  - 结构修正：通过积分或附加零极点改变低频结构，可能改变误差阶次。
- 结论句固定写明：若题目要求把结构性误差变成零，第一步不是调增益，而是判断是否必须提高型别。

### 互动升级点
- 组件类型：`binary_choice`
- 学生任务：判断三个情境更接近“压小有限误差”还是“改变误差阶次”

### 教师控制
- `release_activity`：页面载入即开放
- `open_browse`：`not_applicable`
- `teacher_step_reveal`：`not_applicable`
- `reveal_reference_answer`：显示分类理由

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-08`
- 对齐要求：对照卡先于判断卡出现

## 步骤 09｜低频补偿总览：`PI`、滞后与超前的结构差别

### 页面骨架
- 模板：`formula_figure_table_stack`
- 区域：`formula` / `copy` / `figure` / `table` / `activity`

### 模块清单
- `pi-formula-card`：`PI` 控制器
- `lag-formula-card`：一级滞后校正网络
- `copy-card`：基本文案
- `low-frequency-figure`：三类补偿图
- `comparison-table`：表 4
- `activity-card-grid`：小卡作答区

### 静态承载内容
- 页面顺序固定为：公式 -> 基本文案 -> 图片 -> 表格 -> 作答卡。
- 公式卡必须分开命名：
  - `PI` 控制器：$G_{PI}(s)=K\left(1+\dfrac{1}{T_i s}\right)=K\dfrac{T_i s+1}{T_i s}$
  - 一级滞后校正：$G_{lag}(s)=K\dfrac{Ts+1}{\beta Ts+1},\ \beta>1$
- 文案卡固定写明：
  - `PI`：在原点新增积分极点，并配一个实零点，核心目的是提高型别。
  - 滞后：不改变积分个数，而是通过“零点在左、极点在右”的附加零极点对提高低频增益。
  - 超前：极点在左、零点在右，主要服务于目标频带的相位补偿。
- 图形区改为“左侧统一 Rust/WASM 幅频工作区 + 右侧结构切换控件面板”；不再允许以单课内联 SVG 或静态截图替代运行时面板。
- 若作者态保留 `3-7-low-frequency-compensators.png`，仅作为版式与标注参考，不作为运行时主图。
- 表格保留“型别是否变化 / 主要收益 / 主要代价 / 更像哪条设计线”四列。
- 表格下方追加误判点，固定提醒“滞后不等于弱积分”“超前不等于低频补偿”。

### 互动升级点
- 组件类型：`activity_card_set`
- 作答卡每题独立：
  - `lf-card-1`：判断 `PI` 的结构抓手，`single_choice`
  - `lf-card-2`：判断滞后的核心收益，`single_choice`

### 教师控制
- `release_activity`：控制作答卡是否显示；默认关闭
- `open_browse`：`not_applicable`
- `teacher_step_reveal`：`not_applicable`
- `reveal_reference_answer`：显示表 4 对照解释

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-09`
- 对齐要求：公式组与基本文案必须位于图片和表格之前；作答卡可并排显示以节省空间

## 步骤 10｜时域 `PI` 设计：先证明纯增益不够，再改结构

### 页面骨架
- 模板：`method_reveal_page`
- 区域：`problem` / `derivation` / `validation` / `activity`

### 模块清单
- `time-pi-problem`：对象与目标
- `time-pi-derivation`：逐步显影步骤链
- `time-pi-validation-figure`：验证图
- `time-pi-activity-cards`：关键步骤作答卡

### 静态承载内容
- 题面模块一次性完整显示：
  - 对象：$G_p(s)=\dfrac{4}{s(s+4)}$
  - 目标：
    1. 斜坡输入稳态误差为 0；
    2. 超调量不超过 20%；
    3. 调节时间 $t_s(2\%) \le 12\ \mathrm{s}$。
  - 说明：超调量与调节时间看输出 $y(t)$，斜坡输入精度看误差 $e(t)=r(t)-y(t)$。
- 验证图固定使用 `3-7-pi-time-domain-design.png`，且只在步骤链末端出现。

### 混合证据顺序
- 先出现题面模块。
- 再逐步显影纯增益局限、可行域换算与 `PI` 选点。
- 最后出现验证图与作答卡。

### 互动升级点
- 组件类型：`worked_example_workspace`
- 步骤显影固定完整列出：
  1. 纯增益下开环：$L_0(s)=\dfrac{4K}{s(s+4)}$
  2. 由 $K_v=K$ 得到 $e_{ss,\mathrm{ramp}}=\dfrac{1}{K}$，说明纯增益不能把斜坡误差变为 0
  3. 闭环特征方程与极点：$s^2+4s+4K=0$，$s=-2\pm j\,2\sqrt{K-1}$
  4. 由时域指标换算可行域：$\zeta \ge 0.456$，$\sigma \ge 0.333$
  5. 引入 `PI`：$G_{PI}(s)=\dfrac{s+0.3}{s}$，并解释为何取零点 `-0.3`
  6. 总结：提高型别到 II 型，使斜坡误差从结构上变为 0
  7. 核验结果：$M_p \approx 20.0\%$，$t_s \approx 8.9\ \mathrm{s}$
- 学生作答卡：
  - `time-pi-card-1`：判断纯增益为何不够，`single_choice`
  - `time-pi-card-2`：选择 `PI` 的首要作用，`single_choice`

### 教师控制
- `release_activity`：控制作答卡显示；默认关闭
- `open_browse`：控制学生是否可自主展开步骤；默认关闭
- `teacher_step_reveal`：教师端可直接逐步显影；不受 `open_browse` 影响
- `reveal_reference_answer`：控制学生端是否可见完整标准步骤；默认关闭

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-10`
- 对齐要求：题面完整显示，验证图最后出现；学生默认不能展开步骤，作答区默认隐藏

## 步骤 11｜时域滞后设计：型别不变时怎样抬高低频增益

### 页面骨架
- 模板：`method_reveal_page`
- 区域：`problem` / `derivation` / `validation` / `activity`

### 模块清单
- `time-lag-problem`：对象与目标
- `time-lag-derivation`：逐步显影步骤链
- `time-lag-validation-figure`：验证图
- `time-lag-activity-cards`：关键步骤作答卡

### 静态承载内容
- 题面模块一次性完整显示：
  - 对象：$G_p(s)=\dfrac{4}{s(s+4)}$
  - 目标：
    1. 保持 $M_p \le 20\%$、$t_s(2\%) \le 12\ \mathrm{s}$；
    2. 在不提高型别的前提下，使 $K_v \ge 10$。
- 验证图固定使用 `3-7-lag-time-domain-design.png`，且只在步骤链末端出现。

### 混合证据顺序
- 先出现题面模块。
- 再逐步显影纯增益矛盾、滞后结构与 `K_v` 推导。
- 最后出现验证图与作答卡。

### 互动升级点
- 组件类型：`worked_example_workspace`
- 步骤显影固定完整列出：
  1. 纯增益若要满足 $K_v \ge 10$，需 $K \ge 10$
  2. 由 $\zeta=\dfrac{1}{\sqrt{10}}\approx 0.316$ 说明纯增益会跌出阻尼边界
  3. 引入滞后：$G_{lag}(s)=\dfrac{s+0.2}{s+0.02}$
  4. 解释零点在左、极点在右，作用是单独抬高低频增益而少动中频骨架
  5. 由极限求得 $K_v=10$
  6. 核验结果：$M_p \approx 12.7\%$，$t_s \approx 11.6\ \mathrm{s}$
  7. 总结：型别不变时，尽量把低频增益与中频动态分开安排
- 学生作答卡：
  - `time-lag-card-1`：判断纯增益失败原因，`single_choice`
  - `time-lag-card-2`：判断滞后的核心结构作用，`single_choice`

### 教师控制
- `release_activity`：控制作答卡显示；默认关闭
- `open_browse`：控制学生是否可自主展开步骤；默认关闭
- `teacher_step_reveal`：教师端可直接逐步显影；不受 `open_browse` 影响
- `reveal_reference_answer`：控制学生端是否可见完整标准步骤；默认关闭

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-11`
- 对齐要求：题面完整显示，验证图最后出现；学生默认不能展开步骤，作答区默认隐藏

## 步骤 12｜时域两法比较：收益、代价与适用场景

### 页面骨架
- 模板：`comparison_board`
- 区域：`dimension` / `table` / `activity`

### 模块清单
- `comparison-dimensions`：比较维度卡
- `time-methods-table`：时域两法指标并列表
- `activity-card-grid`：选择题卡

### 静态承载内容
- 比较维度固定为：型别是否变化、主要收益、主要代价、适用问题、验证结果。
- 表格并列呈现：
  - `PI`：提高型别，适合结构性误差消除；
  - 滞后：型别不变，适合在保留动态指标前提下抬高低频增益。
- 结论句固定写明：比较页只负责归纳，不重复承载完整推导链。

### 互动升级点
- 组件类型：`activity_card_set`
- 作答卡：
  - `time-compare-card-1`：把“斜坡误差为 0”对应到方法，`single_choice`
  - `time-compare-card-2`：把“型别不变但 Kv 提高”对应到方法，`single_choice`

### 教师控制
- `release_activity`：控制作答卡显示；默认关闭
- `open_browse`：`not_applicable`
- `teacher_step_reveal`：`not_applicable`
- `reveal_reference_answer`：显示比较表解释

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-12`
- 对齐要求：本页不再承担完整求解链；仅在 step-10 与 step-11 之后出现

## 步骤 13｜频域 `PI` 设计：纯增益为何不能两头兼顾

### 页面骨架
- 模板：`method_reveal_page`
- 区域：`problem` / `derivation` / `validation` / `activity`

### 模块清单
- `freq-pi-problem`：对象与频域目标
- `freq-pi-derivation`：四步设计链
- `freq-pi-validation-figure`：验证图
- `freq-pi-activity-cards`：关键步骤作答卡

### 静态承载内容
- 题面模块一次性完整显示：
  - 对象：$G_p(s)=\dfrac{4}{s(s+4)}$
  - 目标：
    1. $K_v \ge 10$；
    2. $PM \ge 55^\circ$；
    3. $\omega_c \approx 2.5\ \mathrm{rad/s}$。
- 验证图固定使用 `3-7-pi-frequency-design.png`，且只在步骤链末端出现。

### 混合证据顺序
- 先出现题面模块。
- 再逐步显影纯增益冲突与四步设计链。
- 最后出现验证图与作答卡。

### 互动升级点
- 组件类型：`worked_example_workspace`
- 步骤显影固定完整列出：
  1. 纯增益若取 $K \ge 10$，虽满足 $K_v$，但相位裕度仅约 `34.9°`
  2. 若压到 $K=4$，相位裕度回升到约 `51.8°`，但 $K_v=4$
  3. 目标截止频率取 $\omega_c^\ast=2.5\ \mathrm{rad/s}$
  4. 把 `PI` 零点放在截止频率以下：$\omega_z=0.125\ \mathrm{rad/s}$
  5. 写出控制器形式：$G_{PI}(s)=K\dfrac{s+0.125}{s}$
  6. 由幅值条件求得 $K \approx 2.94$，故取 $G_{PI}(s)=3\dfrac{s+0.125}{s}$
  7. 回查结果：$PM \approx 54.8^\circ$，$\omega_c \approx 2.54\ \mathrm{rad/s}$，$K_v=\infty$
  8. 补充时域核验：$M_p \approx 15.6\%$，$t_s \approx 6.0\ \mathrm{s}$
- 学生作答卡：
  - `freq-pi-card-1`：判断纯增益不兼容的原因，`single_choice`
  - `freq-pi-card-2`：补全设计顺序，`fill_text`

### 教师控制
- `release_activity`：控制作答卡显示；默认关闭
- `open_browse`：控制学生是否可自主展开步骤；默认关闭
- `teacher_step_reveal`：教师端可直接逐步显影；不受 `open_browse` 影响
- `reveal_reference_answer`：控制学生端是否可见完整标准步骤；默认关闭

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-13`
- 对齐要求：题面完整显示，验证图最后出现；学生默认不能展开步骤，作答区默认隐藏

## 步骤 14｜频域 `PD` 方案读取：速度优先方案的核验结果

### 页面骨架
- 模板：`method_reveal_page`
- 区域：`problem` / `derivation` / `validation` / `activity`

### 模块清单
- `freq-pd-problem`：对象与方案题面
- `freq-pd-derivation`：读取与核验步骤链
- `freq-pd-validation-figure`：对比图
- `freq-pd-activity-cards`：关键步骤作答卡

### 静态承载内容
- 题面模块一次性完整显示：
  - 对象：$G_p(s)=\dfrac{4}{s(s+4)}$
  - 给定方案：$G_{PD}(s)=8(1+0.1s)$
  - 页面语义：本页是“方案读取与核验”，不是凭空补造讲义未给出的完整整定链。
- 验证图固定使用 `3-7-pi-pd-comparison.png`，且只在步骤链末端出现。

### 混合证据顺序
- 先出现题面模块。
- 再逐步显影核验指标与时域形态说明。
- 最后出现对比图与作答卡。

### 互动升级点
- 组件类型：`worked_example_workspace`
- 步骤显影固定完整列出：
  1. 给定 `PD` 方案：$G_{PD}(s)=8(1+0.1s)$
  2. 核验结果：$PM_{PD}\approx 64.9^\circ$，$\omega_{c,PD}\approx 5.41\ \mathrm{rad/s}$，$K_{v,PD}=8$
  3. 说明其仍为 I 型，因此斜坡误差有限非零
  4. 结合时域响应解释：阶跃更快、更利落，但低频误差不如 `PI`
  5. 总结：该方案代表“动态速度优先”的设计取向
- 学生作答卡：
  - `freq-pd-card-1`：判断本方案是否提高型别，`single_choice`
  - `freq-pd-card-2`：判断最能体现“动态速度优先”的指标，`single_choice`

### 教师控制
- `release_activity`：控制作答卡显示；默认关闭
- `open_browse`：控制学生是否可自主展开步骤；默认关闭
- `teacher_step_reveal`：教师端可直接逐步显影；不受 `open_browse` 影响
- `reveal_reference_answer`：控制学生端是否可见完整核验说明；默认关闭

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-14`
- 对齐要求：本页明确标注为“方案读取与核验”；图像最后出现；学生默认不能展开步骤，作答区默认隐藏

## 步骤 15｜频域两法比较：低频精度优先 vs 动态速度优先

### 页面骨架
- 模板：`comparison_board`
- 区域：`dimension` / `table` / `activity`

### 模块清单
- `comparison-dimensions`：比较维度卡
- `freq-methods-table`：`PI` 与 `PD` 指标并列表
- `activity-card-grid`：选择题卡

### 静态承载内容
- 比较维度固定为：低频精度、截止频率、相位裕度、时域形态、适用设计取向。
- 表格保留表 5 的核心判断：
  - `PI`：低频精度更强，斜坡误差可消除，截止频率较低。
  - `PD`：截止频率更高，相位裕度更高，但仍保留有限斜坡误差。
- 结论句固定写明：二者不是“谁更高级”，而是对应“低频精度优先”与“动态速度优先”两条设计线。

### 互动升级点
- 组件类型：`activity_card_set`
- 作答卡：
  - `freq-compare-card-1`：选择更适合斜坡跟踪精度优先的方案，`single_choice`
  - `freq-compare-card-2`：选择更适合动态速度优先的方案，`single_choice`

### 教师控制
- `release_activity`：控制作答卡显示；默认关闭
- `open_browse`：`not_applicable`
- `teacher_step_reveal`：`not_applicable`
- `reveal_reference_answer`：显示比较表解释

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-15`
- 对齐要求：本页只承担比较，不再次展开方法推导

## 步骤 16｜后测：路径选择与方法判断

### 页面骨架
- 模板：`assessment_card_grid`
- 区域：`cards` / `feedback`

### 模块清单
- `assessment-title-card`：后测名称卡
- `post-q1`：遇到给定 + 扰动共同作用时，第一步是什么
- `post-q2`：哪类问题可先用型别和静态误差系数快速判断
- `post-q3`：斜坡误差想从有限值变成 0，应先判断什么
- `post-q4`：`PI` 与滞后各把收益放在哪、代价推向哪
- `teacher-feedback-strip`：教师点评区

### 静态承载内容
- 页面最上方固定放“后测：路径选择与方法判断”名称卡，先交代本页任务，再进入题卡区。
- 四道后测题各自为独立小卡片，可两列或三列并排。
- 每张卡片保留独立提交按钮，不设置统一提交按钮。
- 错因标签固定覆盖：
  - 所有稳态误差都能套表；
  - `PI` 没有代价；
  - 滞后只是更弱积分。

### 互动升级点
- 组件类型：`quiz_card_grid`
- 学生任务：四题独立作答，单卡提交

### 教师控制
- `release_activity`：页面载入即开放
- `open_browse`：`not_applicable`
- `teacher_step_reveal`：`not_applicable`
- `reveal_reference_answer`：可逐题显示答案与错因

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-16`
- 对齐要求：后测单独成页，不与总结合并，且先出现名称卡，再出现题卡

## 步骤 17｜收束与去向：规则表、信息图与 3-8 入口

### 页面骨架
- 模板：`summary_route_board`
- 区域：`engineering` / `summary` / `appendix` / `next`

### 模块清单
- `engineering-perspective-card`：工程视角
- `summary-list`：本节小结六条
- `rule-table`：表 6，直接求与快速判的选用规则
- `info-graphic`：本讲信息图总结
- `next-lesson-card`：`3-8` 去向卡

### 静态承载内容
- 工程视角卡保留“长期偏一点，整段航程都在付代价”的工程语义。
- 规则表必须完整保留四类问题、建议路径与关键提醒。
- 信息图固定使用 `3-7-info.png`。
- 去向卡固定写明：`3-8` 将把“低频收益 / 中频代价 / 裕量变化”翻译成统一频域语言。

### 互动升级点
- 组件类型：`none`

### 教师控制
- `release_activity`：`not_applicable`
- `open_browse`：`not_applicable`
- `teacher_step_reveal`：`not_applicable`
- `reveal_reference_answer`：`not_applicable`

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-17`
- 对齐要求：本页只承载收束与去向，不再包含后测题，也不再额外显示“无需提交”占位模块
