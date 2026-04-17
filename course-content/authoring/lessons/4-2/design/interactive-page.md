━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
互动页面设计 | 单元 4-2：控制器选型原理：不同控制结构为何适合不同任务
技术栈：Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 文档职责
- 本文件是供作者态审阅的互动页面蓝图，只描述页面结构、静态证据、互动模块、教师控制、学生访问语义与学生页预览口径。
- 同目录 [interactive-contract.yaml](./interactive-contract.yaml) 为机读契约；两者必须逐步骤同名、同序、同语义。
- 本课不承担完整参数整定、复合结构骨架或多目标优化；其唯一输出是“单结构首轮起步卡”与“前馈进入候选的边界理由”。
- 讲义中的主问题、判断链、例题题面、公式链、结构图、四联对比图与结论句必须真正落页，不留给实现阶段补写。

## 表述规则
- 页面顺序服从 `handout.md` 的证据链，不为视觉包装改写逻辑顺序。
- 图片只在它本身就是题面或首个证据时才允许靠前；验证图不得抢在公式、判断链、读图口令和结论句之前。
- 教师控制固定拆成 `release_activity`、`open_browse`、`teacher_step_reveal`、`reveal_reference_answer` 四类语义。
- 学生作答默认隐藏优先；若页面必须保留占位，再退化为锁定态。
- 例题与求解链默认做成逐步显影；首次可隐藏的是步骤，不是题面。
- 后测与收束分离：后测只检查判断链与边界判断，收束页只负责总结与去向。

## 全课总览
| 步骤 | 标题 | 页面模板 | 主体布局 | 互动组件 | 学生页预览 |
|---|---|---|---|---|---|
| step-01 | 回到地图：4-1 的任务表达卡如何接到 4-2 的结构起步判断 | `map_goal_boundary_slide` | 路径图 + 主问题卡 + 目标卡 + 边界卡 | `none` | `/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/demo?step=step-01` |
| step-02 | 前测：结构名字为什么不是答案 | `question_stack` | 三题前测 + 误区提醒卡 + 提交条 | `quiz_group` | `/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/demo?step=step-02` |
| step-03 | 单结构判断链：主矛盾先行，结构名称压后出现 | `formula_table_reasoning` | 开环公式 + 六步判断链表 + 两张作答卡 | `activity_card_set` | `/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/demo?step=step-03` |
| step-04 | 控制结构工具箱：按作用机制重组，而不是按名字平铺 | `formula_table_match` | 工具箱总表 + 语义分区 + 配对区 | `triple_match` | `/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/demo?step=step-04` |
| step-05 | 三频段职责与代价链：结构先动哪里，代价就先从哪里冒出来 | `formula_media_compare` | 三频段职责卡 + 信息图 + 代价归因区 | `structured_compare` | `/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/demo?step=step-05` |
| step-06 | 案例 A 入口：客船航向保持先看低频保持能力，而不是先追更快 | `case_evidence_board` | 任务卡 + 公式卡 + 跨域图 + 证据摘录卡 | `activity_card_set` | `/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/demo?step=step-06` |
| step-07 | 案例 A 展开：为什么客船首轮更像 `PI/滞后`，而不是先上 `PD` | `worked_example_compare` | 完整题面 + `PI/PD` 比较表 + 滞后候选卡 + 显影步骤 + 作答卡 | `worked_example_reveal` | `/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/demo?step=step-07` |
| step-08 | 案例 B 入口：稳定平台先整理中频动态品质与储备 | `case_evidence_board` | 任务卡 + 公式卡 + 跨域图 + 证据摘录卡 | `activity_card_set` | `/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/demo?step=step-08` |
| step-09 | 案例 B 展开：为什么稳定平台首轮更像 `PD/超前`，而不是先补 `PI` | `worked_example_compare` | 完整题面 + `PD/PI` 比较表 + 超前候选卡 + 显影步骤 + 作答卡 | `worked_example_reveal` | `/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/demo?step=step-09` |
| step-10 | 按输入补偿前馈：它先改参考通道，不等于把 `PD` 改写了名字 | `feedforward_compare_board` | 结构图 + 公式链 + 四联图 + 例题显影 + 作答卡 | `worked_example_reveal` | `/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/demo?step=step-10` |
| step-11 | 按扰动补偿前馈：它先削弱误差来源，不等于替代反馈保底 | `feedforward_compare_board` | 结构图 + 公式链 + 四联图 + 边界卡 + 作答卡 | `activity_card_set` | `/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/demo?step=step-11` |
| step-12 | 单结构首轮起步卡工作区：把结构、方向、收益、代价与未决项写全 | `task_card_workspace` | 模板卡 + 证据提醒区 + 工作区 | `task_card_workspace` | `/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/demo?step=step-12` |
| step-13 | 后测：是否已经形成“先看主矛盾，再选结构”的判断链 | `assessment_card_grid` | 四题后测 + 错因标签 + 提交条 | `quiz_card_grid` | `/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/demo?step=step-13` |
| step-14 | 收束与去向：4-2 的出口只交给 4-3 的复合结构骨架阶段 | `summary_route_board` | 结论卡 + 信息图 + 去向卡 | `none` | `/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/demo?step=step-14` |

## 证据单元升级决策表
| 证据类型 | 来源锚点 | 目标步骤 | 升级方式 | 保留元素 | 不得删减内容 | 验收点 |
|---|---|---|---|---|---|---|
| 课程入口主问题、目标与边界 | `## 一`、`## 二` | step-01 | 静态保留 | `4-1 -> 4-2 -> 4-3` 路径、主问题、四项目标、负责/不负责边界 | “4-2 不直接喊 PID、也不做完整方案” | 首屏可回答本课做什么、不做什么 |
| 结构名称误判 | `BOPPPS: P1`、`## 一` | step-02 | 题组互动 | `PID` 默认答案误判、前馈替代反馈误判、只追更快误判 | 三道题干与误区提醒 | 未作答状态下题干完整可见 |
| 六步判断链 | `### 3.1` | step-03 | 表格保留 + 小卡作答 | `L(s)=C(s)P(s)`、主矛盾到代价的六步链、参数方向句式 | “结构名称只是中间结果” | 公式、链表与作答卡同页 |
| 结构工具箱总表与 `PID` 压后原则 | `### 3.2`、`### 3.4` | step-04 | 表格保留 + 配对互动 | `P/PI/PD/PID/超前/滞后/前馈` 最小语义与代价 | `PID` 进入候选的三个条件 | 静态工具箱总表先于配对区 |
| 三频段职责、收益与代价链 | `### 3.3`、`## 九` 信息图 | step-05 | 信息图升级 + 归因互动 | 低频/中频/高频职责、收益句后补代价句 | “结构先动哪里，代价就先从哪里冒出来” | 信息图、职责卡与互动区同屏 |
| 客船案例入口证据 | `### 4.1`、`表6` | step-06 | 跨域图保留 + 证据摘录 | `P_h(s)`、`C_0(s)`、`L_h(s)`、客船跨域图、低频主矛盾 | “不是先提速，而是先站稳低频保持能力” | 公式、图、主矛盾和代价边界同页 |
| 客船完整例题与 `PI/PD` 比较链 | `### 4.2`、`### 4.3`、`### 4.4`、`7.1` | step-07 | 例题显影 + 比较表 + 作答卡 | 完整题面、`PI` 与 `PD` 的低频/截止频率比较、滞后候选、起步卡字段 | 题面不得隐藏；逐步显影只隐藏求解步骤 | 题面、比较表、显影步骤、作答卡同页 |
| 稳定平台案例入口证据 | `### 5.1`、`表8` | step-08 | 跨域图保留 + 证据摘录 | `P_p(s)`、平台跨域图、中频主矛盾与储备整理 | “速度已快，不等于继续盲目提速” | 公式、图、主矛盾和目标句同页 |
| 稳定平台完整比较链 | `### 5.2`、`### 5.3`、`### 5.4` | step-09 | 比较表 + 例题显影 + 作答卡 | `PD` 与 `PI` 在截止频率附近的比较、超前相位公式、平台起步卡 | “超前是 PD 的工程化写法” | 比较表和显影步骤必须同页 |
| 按输入补偿前馈完整路径 | `### 6.2`、`6.2.1`、`6.2.2`、`7.2` | step-10 | 结构图 + 四联图 + 例题显影 | 两自由度结构公式、输入前馈与 `PD` 结构对比、四联图、误差公式、完整例题 | “输入前馈不是 PD 改名；根轨迹几乎重合有原因” | 结构图、公式链、图、题面同页 |
| 按扰动补偿前馈完整路径 | `### 6.3`、`6.3.1`、`6.3.2` | step-11 | 结构图 + 四联图 + 边界卡 | 扰动补偿理想条件、残余扰动公式、结构对比图、四联图、三类工程风险 | “反馈仍然保底，前馈不能万能化” | 结构图、公式链、边界卡同页 |
| 单结构起步卡模板 | `## 六`、`### 4.4`、`### 5.4` | step-12 | 工作区升级 | 七字段模板、四类路径提醒、错误写法 | 不得生成完整参数整定结果 | 模板卡、提醒区和工作区同页 |
| 后测与出口 | `BOPPPS: P3`、`## 九` | step-13、step-14 | 后测与收束分离 | 四道后测题、错因标签、五句带走、`4-3` 去向 | 后测不得与总结混写 | 后测页只测判断链，收束页只做出口 |

## 混合证据顺序表
| 步骤 | 先出现什么 | 再出现什么 | 最后出现什么 | 必须同屏内容 | 不得折叠内容 |
|---|---|---|---|---|---|
| step-03 | 开环公式与六步判断链表 | 参数方向句式提示 | 两张作答卡 | 公式、链表、句式提示 | 六步链表 |
| step-04 | 工具箱总表 | `PID` 压后原则卡 | 结构语义配对区 | 工具箱总表、压后原则卡 | 工具箱总表 |
| step-05 | 三频段职责卡 | `4-2-info.png` 与核心判断句 | 代价归因互动区 | 职责卡、信息图、核心判断句 | 核心判断句 |
| step-06 | 客船任务卡与公式卡 | 客船跨域图与证据摘录卡 | 两张判断卡 | 任务卡、公式卡、跨域图 | 主矛盾句 |
| step-07 | 完整题面与 `PI/PD` 比较表 | 滞后候选卡与客船起步卡摘要 | 显影步骤与两张作答卡 | 题面、比较表、显影步骤 | 题面 |
| step-08 | 平台任务卡与公式卡 | 平台跨域图与证据摘录卡 | 两张判断卡 | 任务卡、公式卡、跨域图 | 主矛盾句 |
| step-09 | 完整题面与 `PD/PI` 比较表 | 超前候选卡与平台起步卡摘要 | 显影步骤与两张作答卡 | 题面、比较表、显影步骤 | 题面 |
| step-10 | 输入前馈结构图与题面 | 公式链与四联图 | 显影步骤与两张作答卡 | 结构图、公式链、四联图、题面 | 题面 |
| step-11 | 扰动前馈结构图与理想条件 | 残余扰动公式与四联图 | 边界卡与两张作答卡 | 结构图、公式链、边界卡 | 理想条件公式 |
| step-12 | 起步卡七字段模板 | 四类路径提醒与错误写法卡 | 工作区提交区 | 模板卡、提醒区、工作区 | 七字段模板 |
| step-13 | 四道后测题干 | 错因标签卡 | 提交条 | 四题卡片、错因标签 | 任一题干 |

## 讲义核心内容映射
| handout_anchor | core_item_type | must_appear_content | target_step | page_mode | interaction_upgrade | media_or_table_ref | acceptance_note |
|---|---|---|---|---|---|---|---|
| `## 一`、`## 二` | concept+boundary | 主问题、四项目标、路径与本课边界 | step-01 | `static` | 无 | 路径图 / 目标卡 / 边界卡 | 首屏必须能回答“4-2 做什么” |
| `BOPPPS: P1`、`## 一` | misconception | `PID`、前馈、`PD/超前` 三类误判题干 | step-02 | `static+quiz` | 题组只暴露误区，不替代题干 | 误区提醒卡 | 题干完整可见 |
| `### 3.1` | concept+rule | `L(s)=C(s)P(s)` 与六步判断链 | step-03 | `static+cards` | 两张小卡分别写主矛盾与参数方向 | 六步判断链表 | 公式和链表不得缺失 |
| `### 3.2`、`### 3.4` | table+comparison | 工具箱总表、四类最小语义、`PID` 压后原则 | step-04 | `static+match` | 结构与语义配对 | 工具箱总表 | 静态表必须先于互动区 |
| `### 3.3`、`## 九` | concept+graphic | 三频段职责、收益代价链、信息图 | step-05 | `static+compare` | 补写代价句 | `4-2-info.png` | 信息图与职责卡必须同屏 |
| `### 4.1`、`表6` | case | 客船公式、跨域图、低频主矛盾、起步方向 | step-06 | `static+cards` | 两张小卡分别写主矛盾与首个代价 | `../../4-1/media/processed/4-1-ship-heading-quad.png` | 图、公式、主矛盾同页 |
| `### 4.2`、`### 4.3`、`7.1` | worked_example | 客船完整题面、`PI/PD` 比较、滞后候选、显影求解链 | step-07 | `worked_example+cards` | 逐步显影 + 两张独立作答卡 | 比较表 / 题面卡 | 题面不得隐藏 |
| `### 5.1`、`表8` | case | 平台公式、跨域图、中频主矛盾与储备整理 | step-08 | `static+cards` | 两张小卡分别写主矛盾与首个收益 | `../../4-1/media/processed/4-1-platform-pitch-quad.png` | 图、公式、主矛盾同页 |
| `### 5.2`、`### 5.3` | worked_example | 平台完整比较链、超前相位公式、平台起步卡摘要 | step-09 | `worked_example+cards` | 逐步显影 + 两张独立作答卡 | 比较表 / 题面卡 | 比较链不可只剩结论 |
| `### 6.2`、`6.2.1`、`7.2` | worked_example+figure | 输入前馈结构图、误差公式、四联图、完整题面与显影步骤 | step-10 | `worked_example+cards` | 逐步显影 + 两张独立作答卡 | `4-2-input-feedforward-vs-pd-structure.png` / `4-2-input-feedforward-quad.png` | 结构图区分必须先于四联图 |
| `### 6.3`、`6.3.1`、`6.3.2` | figure+comparison | 扰动前馈结构图、理想条件、残余扰动公式、四联图、风险三条 | step-11 | `static+cards` | 两张独立作答卡 | `4-2-disturbance-feedforward-structure-compare.png` / `4-2-disturbance-feedforward-quad.png` | 边界卡与风险三条不得缺失 |
| `## 六`、`## 九` | template+summary | 起步卡七字段、错误写法、五句带走与 `4-3` 去向 | step-12、step-14 | `workspace` / `static` | 工作区填写 | 起步卡模板 / `4-2-info.png` | 工作区不得自动生成参数表 |

## 步骤 01｜回到地图：4-1 的任务表达卡如何接到 4-2 的结构起步判断

### 页面骨架
- 模板：`map_goal_boundary_slide`
- 区域：`header` / `lead` / `summary`

### 模块清单
- `stage-map`：高亮 `4-1 -> 4-2 -> 4-3`
- `core-question-card`：主问题卡
- `goal-cards`：四项目标卡
- `boundary-card`：边界卡

### 静态承载内容
- 主问题固定写明：
  - 任务已经写清，为什么第一步仍不能直接喊 `PID`。
  - 控制器名称为什么只是判断链的中间结果，而不是设计答案。
- 四项目标固定写明：
  - 会判断主矛盾落在低频、中频还是通道补偿；
  - 会把 `P/PI/PD/PID/超前/滞后/前馈` 重新组织成任务工具箱；
  - 会写出“参数先朝哪个方向起”的首轮起步语句；
  - 会说明前馈为什么进入候选但不能替代反馈。
- 边界卡固定写明：本课不做完整参数整定、不做复合结构骨架、不做多目标优化。

### 混合证据顺序
- 先出现路径图与主问题卡。
- 再出现目标卡。
- 最后出现边界卡。

### 互动升级点
- 组件类型：`none`
- 学生任务：只阅读路径、目标与边界。

### 教师控制
- `release_activity`：`not_applicable`
- `open_browse`：`not_applicable`
- `teacher_step_reveal`：`not_applicable`
- `reveal_reference_answer`：`not_applicable`

### 学生默认状态
- 全部静态内容默认可见。
- 无作答区，无答案区。

### 本页脱离讲稿后的自包含检查
- 学生仅看本页即可知道 4-2 的角色是“单结构首轮起步判断”。
- 页面不依赖教师口头补充“为什么不能直接上复合结构”。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/demo?step=step-01`
- 对齐要求：主问题卡、目标卡和边界卡必须首屏可见。

## 步骤 02｜前测：结构名字为什么不是答案

### 页面骨架
- 模板：`question_stack`
- 区域：`question-stack` / `summary` / `submit-bar`

### 模块清单
- `pretest-q1`：既然 `PID` 看起来最全，能否默认先从 `PID` 开始
- `pretest-q2`：前馈能提前补偿，是否就比反馈更高级
- `pretest-q3`：只要目标是“更快更稳”，`PD/超前` 是否一定优先
- `misconception-card`：误区提醒卡

### 静态承载内容
- 三道题干必须完整明文落页。
- 误区提醒卡固定写明：
  - 结构名称不是答案；
  - 前馈不是反馈替代品；
  - “更快”不等于“更适合当前任务”。

### 混合证据顺序
- 先完整呈现三道题干。
- 再呈现误区提醒卡。
- 最后呈现提交条。

### 互动升级点
- 组件类型：`quiz_group`
- 学生任务：完成三道前测题。
- 反馈规则：允许重提一次；教师端区分首答与重提。

### 教师控制
- `release_activity`：页面载入即开放
- `open_browse`：`not_applicable`
- `teacher_step_reveal`：`not_applicable`
- `reveal_reference_answer`：教师切换整组答案与错因标签

### 学生默认状态
- 题干默认可见。
- 作答区默认可用。
- 参考答案默认隐藏。

### 本页脱离讲稿后的自包含检查
- 学生仅看本页即可知道本课先检查哪三类入口误判。
- 每一道题的判断对象都足够明确，不需要教师另行解释题意。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/demo?step=step-02`
- 对齐要求：未作答状态下三题题干完整可见。

## 步骤 03｜单结构判断链：主矛盾先行，结构名称压后出现

### 页面骨架
- 模板：`formula_table_reasoning`
- 区域：`formula` / `table` / `interaction`

### 模块清单
- `loop-formula-card`：开环表达卡
- `reasoning-chain-table`：六步判断链表
- `direction-hint-card`：参数方向句式提示卡
- `reasoning-cards`：两张作答卡

### 静态承载内容
- 必须完整保留：
$$
L(s)=C(s)P(s)
$$
- 六步判断链表固定写明：
  - 当前最紧的矛盾是什么；
  - 矛盾主要落在哪段频率或哪条通道；
  - 哪类单结构更直接；
  - 第一轮参数先朝哪个方向起；
  - 最先想验证什么改善；
  - 最可能先透支什么代价。
- 参数方向句式提示卡固定写明：
  - “先补低频，让低频增益向更能托住精度的方向移动”
  - “先整理中频，让截止频率附近的相位与阻尼更可控”
  - “先打开补偿通道，让误差尽量少形成”

### 混合证据顺序
- 先出现开环公式与六步判断链表。
- 再出现参数方向句式提示卡。
- 最后出现两张作答卡。

### 互动升级点
- 组件类型：`activity_card_set`
- 学生任务：
  - 卡 1：写出当前任务的主矛盾落点；
  - 卡 2：补出一条“参数先朝哪个方向起”的句子。
- 反馈规则：单卡提交，教师端切换参考表达。

### 教师控制
- `release_activity`：教师控制开放
- `open_browse`：页面静态内容默认可读
- `teacher_step_reveal`：`not_applicable`
- `reveal_reference_answer`：教师切换参考表达

### 学生默认状态
- 公式、链表、句式提示默认可见。
- 两张作答卡默认隐藏，教师释放后可提交。
- 参考表达默认隐藏。

### 本页脱离讲稿后的自包含检查
- 学生仅看本页即可知道“结构名称之前还有一条判断链”。
- 页面已给出参数方向的书写口径，不依赖教师临场口授模板。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/demo?step=step-03`
- 对齐要求：公式、六步链表与两张作答卡必须同页。

## 步骤 04｜控制结构工具箱：按作用机制重组，而不是按名字平铺

### 页面骨架
- 模板：`formula_table_match`
- 区域：`table` / `summary` / `interaction`

### 模块清单
- `toolbox-table`：控制结构工具箱总表
- `semantic-summary-card`：四类最小语义卡
- `pid-boundary-card`：`PID` 压后原则卡
- `toolbox-match-zone`：结构语义配对区

### 静态承载内容
- 工具箱总表必须完整出现：结构、常见形式、主要作用、更适合先解决什么问题、常见代价。
- 四类语义卡固定写明：
  - 建立基本闭环；
  - 补低频能力；
  - 改中频动态品质；
  - 隔离给定/扰动通道。
- `PID` 压后原则卡固定写明：
  - 低频精度问题确实明显存在；
  - 中频动态品质或储备问题也同样紧迫；
  - 单一结构已经无法解释当前任务。

### 混合证据顺序
- 先出现工具箱总表。
- 再出现四类语义卡与 `PID` 压后原则卡。
- 最后出现结构语义配对区。

### 互动升级点
- 组件类型：`triple_match`
- 学生任务：把结构卡拖入“建立闭环 / 补低频 / 改中频 / 补通道”对应区，并标记哪些应压后到 `4-3`。
- 反馈规则：即时反馈，可重试。

### 教师控制
- `release_activity`：页面载入即开放
- `open_browse`：`not_applicable`
- `teacher_step_reveal`：`not_applicable`
- `reveal_reference_answer`：教师切换参考分组

### 学生默认状态
- 工具箱总表与语义卡默认可见。
- 互动区默认可用。
- 参考分组默认隐藏。

### 本页脱离讲稿后的自包含检查
- 学生仅看本页即可知道为什么控制结构要先按语义分组。
- `PID` 不是默认起点的条件被清楚写成静态证据，而非教师口头附加。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/demo?step=step-04`
- 对齐要求：工具箱总表必须先于互动区出现。

## 步骤 05｜三频段职责与代价链：结构先动哪里，代价就先从哪里冒出来

### 页面骨架
- 模板：`formula_media_compare`
- 区域：`summary` / `media` / `interaction`

### 模块清单
- `band-duty-cards`：三频段职责卡
- `info-graphic`：本讲信息图
- `core-rule-card`：核心判断句卡
- `cost-reasoning-zone`：代价归因区

### 静态承载内容
- 三频段职责卡固定写明：
  - 低频：稳态误差、慢扰动抑制、长期保持精度；
  - 中频：截止频率、相角裕度、阻尼与超调；
  - 高频：噪声放大与执行器负担。
- 核心判断句卡固定写明：结构先动哪里，代价就先从哪里冒出来。
- 图片固定使用 `../media/processed/4-2-info.png`。

### 混合证据顺序
- 先出现三频段职责卡。
- 再出现信息图与核心判断句卡。
- 最后出现代价归因互动区。

### 互动升级点
- 组件类型：`structured_compare`
- 学生任务：给三条“只有收益没有代价”的句子补出缺失代价，并归类到低频 / 中频 / 高频 / 通道边界。
- 反馈规则：即时反馈，按错因桶返回。

### 教师控制
- `release_activity`：页面载入即开放
- `open_browse`：`not_applicable`
- `teacher_step_reveal`：`not_applicable`
- `reveal_reference_answer`：教师切换参考归因

### 学生默认状态
- 职责卡、信息图、核心判断句默认可见。
- 互动区默认可用。
- 参考归因默认隐藏。

### 本页脱离讲稿后的自包含检查
- 学生仅看本页即可知道“收益与代价一定成对出现”的原因。
- 页面已交代三频段职责，不依赖教师临场重讲模块 3。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/demo?step=step-05`
- 对齐要求：信息图与三频段职责卡必须同屏。

## 步骤 06｜案例 A 入口：客船航向保持先看低频保持能力，而不是先追更快

### 页面骨架
- 模板：`case_evidence_board`
- 区域：`case` / `media` / `interaction`

### 模块清单
- `ship-task-card`：客船任务卡
- `ship-formula-card`：客船公式卡
- `ship-quad-graphic`：客船跨域图
- `ship-evidence-card`：证据摘录卡
- `ship-entry-cards`：两张判断卡

### 静态承载内容
- 客船公式必须完整出现：
$$
P_h(s)=\frac{0.01715}{s(s+0.1)(s+2.14375)}
$$
$$
C_0(s)=K_h=2.25,\qquad
L_h(s)=\frac{0.0385875}{s(s+0.1)(s+2.14375)}
$$
- 客船任务卡固定写明：
  - 当前任务：在风浪扰动下完成航向修正并保持平顺；
  - 最紧矛盾：低频保持能力与慢扰动抑制不足；
  - 当前不是先比谁更快，而是先看谁更能托住长期保持。
- 证据摘录卡固定写明：超调约 `32.01%`、调节时间约 `83.24s`、`ω_c≈0.1169rad/s`、相角裕度约 `37.43°`。
- 图固定使用 `../../4-1/media/processed/4-1-ship-heading-quad.png`。

### 混合证据顺序
- 先出现任务卡与公式卡。
- 再出现跨域图与证据摘录卡。
- 最后出现两张判断卡。

### 互动升级点
- 组件类型：`activity_card_set`
- 学生任务：
  - 卡 1：补出客船当前主矛盾为何属于低频问题；
  - 卡 2：写出第一条需要警惕的代价。
- 反馈规则：单卡提交，教师端切换参考判断。

### 教师控制
- `release_activity`：教师控制开放
- `open_browse`：页面静态内容默认可读
- `teacher_step_reveal`：`not_applicable`
- `reveal_reference_answer`：教师切换参考判断

### 学生默认状态
- 任务卡、公式卡、图与证据摘录默认可见。
- 两张作答卡默认隐藏，教师释放后可提交。
- 参考判断默认隐藏。

### 本页脱离讲稿后的自包含检查
- 学生仅看本页即可知道客船当前为什么先看低频保持能力。
- 页面已给出跨域证据值，不依赖教师现场念图。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/demo?step=step-06`
- 对齐要求：任务卡、公式卡、跨域图与证据摘录卡必须同页。

## 步骤 07｜案例 A 展开：为什么客船首轮更像 `PI/滞后`，而不是先上 `PD`

### 页面骨架
- 模板：`worked_example_compare`
- 区域：`problem` / `comparison` / `worked-example` / `interaction`

### 模块清单
- `ship-example-problem-card`：完整题面卡
- `ship-pi-pd-compare-table`：`PI/PD` 比较表
- `lag-candidate-card`：滞后候选卡
- `ship-worked-steps`：显影步骤区
- `ship-activity-cards`：两张作答卡

### 静态承载内容
- 题面必须完整写明：
  - 长期受慢扰动影响时偏差仍然偏大；
  - 当前相角裕度只有中等余量；
  - 过程超调偏大，但速度不是最紧矛盾；
  - 第一轮希望先看长期偏差下降，而不是先看速度进一步提升。
- 比较表至少保留：
  - `C_{PI}(s)=K_p(1+\omega_i/s)`
  - `C_{PD}(s)=K_p(1+T_d s)`
  - 低频工作带 `ω_l=0.01rad/s` 下的增益与相位比较；
  - 截止频率附近的增益与相位比较；
  - “低频增益明显提升 / 截止频率附近引入滞后或超前”的解释句。
- 滞后候选卡固定写明：
$$
C_{lag}(s)=K\frac{Ts+1}{\beta Ts+1},\qquad \beta>1
$$
  并写清“更温和补低频，少碰积分漂移与长时饱和边界”。

### 混合证据顺序
- 先出现完整题面卡与 `PI/PD` 比较表。
- 再出现滞后候选卡与客船起步卡摘要。
- 最后出现显影步骤区与两张作答卡。

### 互动升级点
- 组件类型：`worked_example_reveal`
- 学生任务：
  - 先阅读完整题面；
  - 再按教师控制或浏览权限逐步展开求解链；
  - 最后完成两张作答卡：`首选单结构`、`主要代价`。
- 显影步骤固定为：
  1. 识别主要矛盾属于低频保持能力不足；
  2. 说明为何要先压低低频灵敏度；
  3. 比较 `PI` 与 `PD` 在低频和截止频率附近的作用；
  4. 解释为什么滞后可作为更温和候选；
  5. 写出客船起步卡摘要结论。

### 教师控制
- `release_activity`：教师控制开放作答卡
- `open_browse`：教师控制学生是否可自主展开步骤
- `teacher_step_reveal`：教师可逐步显影步骤链
- `reveal_reference_answer`：教师切换参考起步卡

### 学生默认状态
- 题面与比较表默认可见。
- 显影步骤默认收缩。
- 作答卡默认隐藏。
- 参考起步卡默认隐藏。

### 本页脱离讲稿后的自包含检查
- 学生只看本页即可知道为何不先上 `PD`。
- 题面、比较链、滞后候选与结论都已落页，不依赖教师口头补齐题意。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/demo?step=step-07`
- 对齐要求：题面不得隐藏；显影步骤默认收缩且与上一页状态独立。

## 步骤 08｜案例 B 入口：稳定平台先整理中频动态品质与储备

### 页面骨架
- 模板：`case_evidence_board`
- 区域：`case` / `media` / `interaction`

### 模块清单
- `platform-task-card`：平台任务卡
- `platform-formula-card`：平台公式卡
- `platform-quad-graphic`：平台跨域图
- `platform-evidence-card`：证据摘录卡
- `platform-entry-cards`：两张判断卡

### 静态承载内容
- 平台公式必须完整出现：
$$
P_p(s)=\frac{2960\left(\frac{s}{15}+1\right)}{s\left(\frac{s}{3}+1\right)\left[(1.7s+1)(0.005s+1)(0.001s+1)+100\right]}
$$
$$
C_0(s)=K_p=5
$$
- 平台任务卡固定写明：
  - 当前任务：在较高恢复速度下抑制姿态扰动，避免过程峰化过大；
  - 最紧矛盾：阻尼不足，中频动态品质与储备整理仍偏紧；
  - 速度已经很快，不应把“继续提速”当成第一优先级。
- 证据摘录卡固定写明：调节时间约 `0.17s`、超调约 `37.55%`、`ω_c≈31.07rad/s`、相角裕度约 `39.69°`。
- 图固定使用 `../../4-1/media/processed/4-1-platform-pitch-quad.png`。

### 混合证据顺序
- 先出现任务卡与公式卡。
- 再出现跨域图与证据摘录卡。
- 最后出现两张判断卡。

### 互动升级点
- 组件类型：`activity_card_set`
- 学生任务：
  - 卡 1：写出平台主矛盾为何落在中频；
  - 卡 2：写出首个预期收益为何不是“更快”。
- 反馈规则：单卡提交，教师端切换参考判断。

### 教师控制
- `release_activity`：教师控制开放
- `open_browse`：页面静态内容默认可读
- `teacher_step_reveal`：`not_applicable`
- `reveal_reference_answer`：教师切换参考判断

### 学生默认状态
- 任务卡、公式卡、图与证据摘录默认可见。
- 两张作答卡默认隐藏。
- 参考判断默认隐藏。

### 本页脱离讲稿后的自包含检查
- 学生仅看本页即可知道平台案例不是在补低频静态精度。
- 页面已给出速度、超调与裕度证据，不依赖教师口头再读图。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/demo?step=step-08`
- 对齐要求：任务卡、公式卡、跨域图与证据摘录卡必须同页。

## 步骤 09｜案例 B 展开：为什么稳定平台首轮更像 `PD/超前`，而不是先补 `PI`

### 页面骨架
- 模板：`worked_example_compare`
- 区域：`problem` / `comparison` / `worked-example` / `interaction`

### 模块清单
- `platform-problem-card`：完整题面卡
- `platform-pd-pi-compare-table`：`PD/PI` 比较表
- `lead-candidate-card`：超前候选卡
- `platform-worked-steps`：显影步骤区
- `platform-activity-cards`：两张作答卡

### 静态承载内容
- 题面卡必须完整写明：
  - 恢复速度已经很快；
  - 超调仍偏大；
  - 截止频率附近储备偏紧；
  - 第一轮希望先整理阻尼与动态品质。
- 比较表至少保留：
  - `C_{PD}(s)=K_p(1+T_d s)`；
  - `C_{PI}(s)=K_p(1+\omega_i/s)`；
  - 在当前截止频率附近的增益与相位比较；
  - “`PD` 给正相位、`PI` 在同频段再带来相位滞后”的解释。
- 超前候选卡固定写明：
$$
C_{lead}(s)=K\frac{Ts+1}{\alpha Ts+1},\qquad 0<\alpha<1
$$
$$
\phi_{\max}=\sin^{-1}\frac{1-\alpha}{1+\alpha}
$$
  并写清“超前是 `PD` 的工程化写法，用于兼顾补相位与不过分放大高频”。

### 混合证据顺序
- 先出现完整题面卡与 `PD/PI` 比较表。
- 再出现超前候选卡与平台起步卡摘要。
- 最后出现显影步骤区与两张作答卡。

### 互动升级点
- 组件类型：`worked_example_reveal`
- 学生任务：
  - 先阅读完整题面；
  - 再按教师控制或浏览权限逐步展开求解链；
  - 最后完成两张作答卡：`首选单结构`、`不宜优先采用的结构`。
- 显影步骤固定为：
  1. 识别主矛盾属于截止频率附近的相位与阻尼问题；
  2. 比较 `PD` 与 `PI` 在当前关键频段的作用；
  3. 解释为什么超前是更工程化的中频整理写法；
  4. 写出平台起步卡摘要结论。

### 教师控制
- `release_activity`：教师控制开放作答卡
- `open_browse`：教师控制学生是否可自主展开步骤
- `teacher_step_reveal`：教师可逐步显影步骤链
- `reveal_reference_answer`：教师切换参考起步卡

### 学生默认状态
- 题面与比较表默认可见。
- 显影步骤默认收缩。
- 作答卡默认隐藏。
- 参考起步卡默认隐藏。

### 本页脱离讲稿后的自包含检查
- 学生只看本页即可知道为什么平台先整理中频。
- 题面、比较链、超前候选与结论都已落页，不依赖教师临时补完。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/demo?step=step-09`
- 对齐要求：题面不得隐藏；显影步骤默认收缩且状态独立。

## 步骤 10｜按输入补偿前馈：它先改参考通道，不等于把 `PD` 改写了名字

### 页面骨架
- 模板：`feedforward_compare_board`
- 区域：`problem` / `formula` / `media` / `worked-example` / `interaction`

### 模块清单
- `input-ff-problem-card`：完整题面卡
- `input-ff-structure-graphic`：输入前馈与 `PD` 结构对比图
- `input-ff-formula-chain`：输入前馈公式链
- `input-ff-quad-graphic`：四联图
- `input-ff-worked-steps`：显影步骤区
- `input-ff-activity-cards`：两张作答卡

### 静态承载内容
- 题面卡必须完整写明例题二的三问：
  - `τ=0.5/K_2` 时误差变化如何；
  - `τ=1/K_2` 时为什么说无差度提高；
  - 为什么工程上不能盲目追求任何输入都“完全不变”。
- 公式链至少保留：
$$
u(s)=C(s)\bigl(r(s)-y(s)\bigr)+F(s)r(s)
$$
$$
T_r^{(0)}(s)=\frac{4}{s^2+s+4},\qquad
T_r^{(ff)}(s)=\frac{s+4}{s^2+s+4}
$$
$$
e_{ss}^{(0)}=\frac{A}{K_1K_2},\qquad
e_{ss}^{(ff)}=\frac{A(1-\tau K_2)}{K_1K_2}
$$
- 图固定使用：
  - `../media/processed/4-2-input-feedforward-vs-pd-structure.png`
  - `../media/processed/4-2-input-feedforward-quad.png`

### 混合证据顺序
- 先出现结构对比图与完整题面卡。
- 再出现公式链与四联图。
- 最后出现显影步骤区与两张作答卡。

### 互动升级点
- 组件类型：`worked_example_reveal`
- 学生任务：
  - 先读题面与结构图区分；
  - 再逐步展开例题求解链；
  - 最后完成两张作答卡：`误差变化判断`、`为何不能盲目全补偿`。
- 显影步骤固定为：
  1. 说明输入前馈只改参考通道而不改反馈特征方程；
  2. 比较输入前馈与 `PD` 的分母差异；
  3. 代入 `τ=0.5/K_2` 与 `τ=1/K_2` 判断误差变化；
  4. 写出对象逆、微分放噪与模型失配三类风险。

### 教师控制
- `release_activity`：教师控制开放作答卡
- `open_browse`：教师控制学生是否可自主展开步骤
- `teacher_step_reveal`：教师可逐步显影步骤链
- `reveal_reference_answer`：教师切换参考解答

### 学生默认状态
- 题面、结构图、公式链、四联图默认可见。
- 显影步骤默认收缩。
- 作答卡默认隐藏。
- 参考解答默认隐藏。

### 本页脱离讲稿后的自包含检查
- 学生只看本页即可分清“输入前馈”和“`PD`”为何不是同一个结构。
- 题面、公式链、图后解释与风险句都已落页，不依赖教师额外口头说明。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/demo?step=step-10`
- 对齐要求：结构图区分必须先于四联图出现。

## 步骤 11｜按扰动补偿前馈：它先削弱误差来源，不等于替代反馈保底

### 页面骨架
- 模板：`feedforward_compare_board`
- 区域：`formula` / `media` / `summary` / `interaction`

### 模块清单
- `disturbance-ff-structure-graphic`：扰动前馈结构对比图
- `disturbance-ff-formula-chain`：扰动前馈公式链
- `disturbance-ff-quad-graphic`：四联图
- `disturbance-boundary-card`：边界卡
- `disturbance-risk-card`：风险三条卡
- `disturbance-activity-cards`：两张作答卡

### 静态承载内容
- 公式链至少保留：
$$
y(s)=G(s)u(s)+G_d(s)d(s)
$$
$$
u(s)=u_{fb}(s)+u_{ff}(s),\qquad
u_{ff}(s)=G_{ff}(s)d(s)
$$
$$
T_{yd}(s)=\frac{G(s)G_{ff}(s)+G_d(s)}{1+G(s)C(s)}
$$
$$
G_{ff}(s)=-\frac{G_d(s)}{G(s)}
$$
$$
T_{yd}^{(fb)}(s)=\frac{1}{s^2+s+4},\qquad
T_{yd}^{(ff)}(s)=\frac{0.2}{s^2+s+4}
$$
- 图固定使用：
  - `../media/processed/4-2-disturbance-feedforward-structure-compare.png`
  - `../media/processed/4-2-disturbance-feedforward-quad.png`
- 边界卡固定写明：
  - 前馈负责先削弱可测扰动来源；
  - 反馈负责稳定性与鲁棒性保底。
- 风险三条卡固定写明：
  - 扰动是否真的可测；
  - `G(s)` 与 `G_d(s)` 是否足够准确；
  - 理想前馈是否因果、稳定、不会放大高频噪声。

### 混合证据顺序
- 先出现结构对比图与理想条件公式。
- 再出现残余扰动公式、四联图与边界卡。
- 最后出现风险三条卡与两张作答卡。

### 互动升级点
- 组件类型：`activity_card_set`
- 学生任务：
  - 卡 1：解释为什么反馈仍然有价值；
  - 卡 2：写出阻止照搬理想公式的任意两类工程风险。
- 反馈规则：单卡提交，教师端切换参考答案。

### 教师控制
- `release_activity`：教师控制开放作答卡
- `open_browse`：页面静态内容默认可读
- `teacher_step_reveal`：`not_applicable`
- `reveal_reference_answer`：教师切换参考答案

### 学生默认状态
- 结构图、公式链、四联图、边界卡与风险卡默认可见。
- 作答卡默认隐藏。
- 参考答案默认隐藏。

### 本页脱离讲稿后的自包含检查
- 学生只看本页即可知道扰动前馈改变的是扰动通道而非特征方程。
- 页面已写清风险三条和反馈保底职责，不依赖教师补充“前馈万能论”的反例。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/demo?step=step-11`
- 对齐要求：结构图、理想条件公式与边界卡必须同页。

## 步骤 12｜单结构首轮起步卡工作区：把结构、方向、收益、代价与未决项写全

### 页面骨架
- 模板：`task_card_workspace`
- 区域：`template` / `summary` / `workspace`

### 模块清单
- `start-card-template`：七字段模板卡
- `path-reminder-card`：四类路径提醒卡
- `bad-patterns-card`：错误写法卡
- `start-card-workspace`：工作区

### 静态承载内容
- 七字段模板必须完整出现：
  - 当前任务；
  - 最紧矛盾；
  - 首选单结构；
  - 参数起步方向；
  - 预期先改善什么；
  - 预计先透支什么；
  - 留给 `4-3` 的未决项。
- 四类路径提醒卡固定写明：客船 `PI/滞后`、平台 `PD/超前`、输入前馈、扰动前馈。
- 错误写法卡固定写明：
  - 只写结构名字；
  - 只写收益不写代价；
  - 直接把 `PID/复合结构` 写成默认答案；
  - 把前馈写成“替代反馈”的总方案。

### 混合证据顺序
- 先出现七字段模板卡。
- 再出现四类路径提醒卡与错误写法卡。
- 最后出现工作区。

### 互动升级点
- 组件类型：`task_card_workspace`
- 学生任务：基于给定任务卡完成一张最小起步卡。
- 反馈规则：先检查字段完整性，再检查理由链自洽性，不生成参数整定结果。

### 教师控制
- `release_activity`：教师控制开放工作区
- `open_browse`：页面静态内容默认可读
- `teacher_step_reveal`：`not_applicable`
- `reveal_reference_answer`：教师切换参考起步卡

### 学生默认状态
- 模板卡、提醒卡、错误写法卡默认可见。
- 工作区默认隐藏。
- 参考起步卡默认隐藏。

### 本页脱离讲稿后的自包含检查
- 学生仅看本页即可知道一张合格起步卡必须写全哪些字段。
- 页面已给出四类路径提醒，不依赖教师口头复述整堂课。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/demo?step=step-12`
- 对齐要求：模板卡、提醒区与工作区必须同页。

## 步骤 13｜后测：是否已经形成“先看主矛盾，再选结构”的判断链

### 页面骨架
- 模板：`assessment_card_grid`
- 区域：`assessment` / `summary` / `submit-bar`

### 模块清单
- `posttest-q1`：低频问题优先想到哪类结构
- `posttest-q2`：为什么收益句必须补代价句
- `posttest-q3`：前馈进入候选时为什么反馈不能退出主线
- `posttest-q4`：起步卡缺项判断
- `error-tag-card`：错因标签卡

### 静态承载内容
- 四道题干必须完整出现。
- 错因标签卡固定写明：
  - 主矛盾识别错误；
  - 结构抢跑；
  - 代价漏写；
  - 前馈边界混淆；
  - 起步卡字段不完整。

### 混合证据顺序
- 先完整呈现四道后测题干。
- 再呈现错因标签卡。
- 最后呈现提交条。

### 互动升级点
- 组件类型：`quiz_card_grid`
- 学生任务：完成四道后测题，只检查判断链与边界判断。
- 反馈规则：即时反馈，可二次作答。

### 教师控制
- `release_activity`：页面载入即开放
- `open_browse`：`not_applicable`
- `teacher_step_reveal`：`not_applicable`
- `reveal_reference_answer`：教师切换整组答案与错因标签

### 学生默认状态
- 四题题干默认可见。
- 作答区默认可用。
- 参考答案默认隐藏。

### 本页脱离讲稿后的自包含检查
- 学生仅看本页即可知道课程出口要检查的能力对象是什么。
- 题目只检查 4-2 的判断链，不越级要求完整整定。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/demo?step=step-13`
- 对齐要求：后测页只做测验，不混入收束文案。

## 步骤 14｜收束与去向：4-2 的出口只交给 4-3 的复合结构骨架阶段

### 页面骨架
- 模板：`summary_route_board`
- 区域：`summary` / `media` / `next-step`

### 模块清单
- `takeaway-cards`：五句带走卡
- `lesson-info-graphic`：本讲信息图
- `next-lesson-card`：去向卡

### 静态承载内容
- 五句带走卡固定写明：
  - 结构选择先讲主矛盾，再讲结构名称；
  - `PI/滞后` 更像低频起步，`PD/超前` 更像中频起步；
  - 前馈是补偿，不是保底；
  - 收益与代价必须同卡落地；
  - 单结构起步优先于复合结构抢跑。
- 图固定使用 `../media/processed/4-2-info.png`。
- 去向卡固定写明：`4-3` 才继续处理复合结构骨架、参数分配和验证假设。

### 混合证据顺序
- 先出现五句带走卡。
- 再出现信息图。
- 最后出现去向卡。

### 互动升级点
- 组件类型：`none`
- 学生任务：只阅读收束与去向。

### 教师控制
- `release_activity`：`not_applicable`
- `open_browse`：`not_applicable`
- `teacher_step_reveal`：`not_applicable`
- `reveal_reference_answer`：`not_applicable`

### 学生默认状态
- 全部静态内容默认可见。
- 无作答区，无答案区。

### 本页脱离讲稿后的自包含检查
- 学生仅看本页即可知道 4-2 的出口与 4-3 的入口边界。
- 页面不越级展开复合结构细节。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/demo?step=step-14`
- 对齐要求：本页只做收束与去向，不出现评分互动。
