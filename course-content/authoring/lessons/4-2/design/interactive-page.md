━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
互动页面设计 | 单元 4-2：控制器选型原理：不同控制结构为何适合不同任务
技术栈：Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 文档职责

- 本文件是供人审阅的页面蓝图，只描述页面模板、固定内容、互动组件、反馈规则、教师聚合、AI 边界与学生页预览口径。
- 同目录 [interactive-contract.yaml](./interactive-contract.yaml) 是机读契约；两者必须逐步骤一一对应。
- 本课是模块 4 的第二节理论课，不承担完整参数整定、复合结构骨架或多目标优化。
- 页面总目标固定为：把 `4-1` 的任务表达卡继续压成“单结构首轮起步卡”。

## 表述规则

- 页面描述只保留客观结构：区域、模块、文本、公式、图片、表格、互动组件、反馈规则、教师聚合与验收条件。
- 动作化表述禁用：`展示`、`引导`、`让学生`、`教师讲`、`实现时再补`。
- 静态内容优先。互动组件只负责分类、比较、填写和误判纠正，不替代讲义中的核心判断。
- 本课主线固定为：`任务卡回收 -> 结构工具箱 -> 四类最小语义 -> 三频段与代价链 -> 案例对照 -> 前馈边界 -> 单结构首轮起步卡`。

## 全课总览

| 步骤 | 标题 | 页面模板 | 主体布局 | 互动组件 | 学生页预览 |
|------|------|----------|----------|----------|------------|
| step-01 | 回到地图：为什么任务写清后还不能直接喊 `PID` | `map_hero_slide` | 路径图 + 主问题卡 + 边界卡 | `none` | `/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/demo?step=step-01` |
| step-02 | 学习目标与边界：4-2 只负责单结构首轮起步 | `goal_boundary_slide` | 目标卡 + 负责/不负责表 | `none` | `/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/demo?step=step-02` |
| step-03 | 前测：结构名称为什么不是答案 | `question_stack` | 三题前测 + 提交条 | `quiz_group` | `/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/demo?step=step-03` |
| step-04 | 控制结构工具箱：先按作用机制重组，而不是按名字平铺 | `formula_table_match` | 结构总表 + 任务栏 + 配对区 | `triple_match` | `/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/demo?step=step-04` |
| step-05 | 四类最小语义：建立闭环、补低频、改中频、补通道 | `comparison_panel_with_sort` | 四类语义卡 + 结构卡组 + 排序区 | `card_sort` | `/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/demo?step=step-05` |
| step-06 | 收益与代价链：结构先动哪里，代价就先从哪里冒出来 | `formula_media_compare` | 三频段职责卡 + 代价链卡 + 归因区 | `structured_compare` | `/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/demo?step=step-06` |
| step-07 | 案例 A：客船航向保持为什么首轮更像 `PI/滞后` | `case_study_dashboard` | 任务卡 + 对照表 + 判断卡 | `structured_compare` | `/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/demo?step=step-07` |
| step-08 | 案例 B：稳定平台为什么首轮更像 `PD/超前` | `case_study_dashboard` | 任务卡 + 对照表 + 判断卡 | `structured_compare` | `/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/demo?step=step-08` |
| step-09 | 通道边界：前馈为什么值得进入候选，但不能抢走反馈主线 | `formula_media_compare` | 前馈结构图 + 边界卡 + 判断区 | `binary_choice` | `/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/demo?step=step-09` |
| step-10 | 单结构首轮起步卡工作区：把理由、方向、代价写全 | `task_card_workspace` | 模板卡 + 证据区 + 填写区 | `task_card_workspace` | `/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/demo?step=step-10` |
| step-11 | 后测与收束：先说理由，再谈结构，最后交给 `4-3` | `summary_quiz_board` | 后测题组 + 小结卡 + 去向卡 | `quiz_group` | `/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/demo?step=step-11` |

## 讲义核心内容映射

| handout_anchor | core_item_type | must_appear_content | target_step | page_mode | interaction_upgrade | media_or_table_ref | acceptance_note |
|---|---|---|---|---|---|---|---|
| `## 一、引入：任务表达卡已经写好，为什么还不能直接喊出控制器名字` | concept+question | “主矛盾先行”“结构名称不是答案”两条入口判断。 | step-01 | static | 无。 | 主问题卡 | 首屏必须出现路径、主问题和边界。 |
| `### 1.1 从 4-1 接过来的是一张矛盾清单` | concept+list | 五个输入判断：主矛盾、底线边界、可接受代价、起步方向、暂缓决策。 | step-02 | static | 无。 | 目标卡 / 边界表 | 本页不得提前出现结构推荐。 |
| `## 二、控制结构按作用机制组织成工具箱 / 表2. 结构工具箱总表` | concept+table | 结构工具箱总表和按作用机制重组的逻辑。 | step-04 | static+interactive | 只做“结构 -> 主要作用”配对。 | 结构工具箱总表 | 静态表必须先于配对区出现。 |
| `### 2.2 四类最小选型语义 / ### 2.3 PID 为什么不是默认起点` | concept+comparison | 四类最小语义和 `PID/复合结构` 压后原则。 | step-05 | static+interactive | 排序区只强化“当前先动哪类语义”。 | 四类语义卡 | 必须明确写出“PID 不是默认起点”。 |
| `## 三、结构为什么会有收益，也一定会有代价 / ### 3.1~3.5` | concept+rule | 三频段职责、收益与代价链、反馈保底与前馈补偿边界。 | step-06, step-09 | static+interactive | 对照区只负责暴露“收益句缺代价句”的误判。 | `4-2-info.png` / `4-2-feedforward-block-diagram.png` | 代价链和前馈边界不可只靠交互脑补。 |
| `## 四、把规则落到三个最小案例上 / ### 4.1 客船案例` | case | 客船航向保持更像 `PI/滞后` 的理由链。 | step-07 | static+interactive | 结构化比较只负责归纳主矛盾、首选结构与代价。 | 案例 A 任务卡 | 必须保留“低频能力先站稳”的结论。 |
| `### 4.2 稳定平台案例` | case | 稳定平台更像 `PD/超前` 的理由链。 | step-08 | static+interactive | 结构化比较只负责归纳“中频动态品质先整理”。 | 案例 B 任务卡 | 必须保留“储备整理”而非只写“更快”。 |
| `### 4.3 补充判断：已测扰动出现时，为什么前馈值得进入候选但不能抢主线` | concept+figure | 前馈结构图、边界判断、反馈保底角色。 | step-09 | static+interactive | 二选一判断只暴露“前馈更高级”的误区。 | `4-2-feedforward-block-diagram.png` | 结构图和边界卡必须同屏。 |
| `## 五、把选型结论写成一张"单结构首轮起步卡"` | procedure+template | 起步卡模板七字段、三类错误写法。 | step-10 | static+interactive | 工作区只填写模板，不生成参数结果。 | 起步卡模板 / `4-2-info.png` | 模板卡和证据区必须同屏。 |
| `## 六、本节小结 / ## 课后练习` | summary+quiz | 三句带走 + `4-3` 去向。 | step-11 | static+quiz | 后测只检验理由链，不引入完整整定题。 | 小结卡 | 去向卡与后测题同页。 |

## 步骤 01｜回到地图：为什么任务写清后还不能直接喊 `PID`

### 页面骨架

- 模板：`map_hero_slide`
- 区域：`header` / `lead` / `summary`

### 模块清单

- `stage-map`：模块 4 路径图
- `core-question-card`：主问题卡
- `boundary-card`：本课边界卡

### 静态承载内容

- 路径图固定高亮 `4-1 -> 4-2 -> 4-3 -> 4-4`。
- 主问题卡固定写明：
  - 任务已经写清，为什么仍不能直接喊出结构名字？
  - 结构名字为什么不是设计答案，而只是判断链的中间结果？
- 边界卡固定写明：本课不进入参数整定、复合结构骨架和多目标优化。

### 互动升级点

- 组件类型：`none`

### AI 边界

- 页面目标：标定 `4-2` 是“单结构首轮起步课”。
- 允许范围：课程路径、任务表达卡与结构筛选之间的关系。
- 禁止范围：任何参数建议。

## 步骤 02｜学习目标与边界：4-2 只负责单结构首轮起步

### 页面骨架

- 模板：`goal_boundary_slide`
- 区域：`goals` / `boundary`

### 静态承载内容

- 四项目标卡固定对应：会重组结构工具箱、会判断主矛盾与频段职责、会写起步卡、会说明前馈边界。
- 边界表固定写明：
  - 本课负责：主矛盾、结构筛选、参数起步方向、代价检查。
  - 本课不负责：完整参数整定、复合结构骨架、多目标优化。

### 互动升级点

- 组件类型：`none`

### AI 边界

- 页面目标：建立 `4-2` 与 `4-3/4-5` 的清晰边界。
- 禁止范围：偷渡复合结构与优化流程。

## 步骤 03｜前测：结构名称为什么不是答案

### 页面骨架

- 模板：`question_stack`
- 区域：`question-stack` / `submit-bar`

### 模块清单

- `pretest-q1`：`PID` 是否默认更好
- `pretest-q2`：前馈是否比反馈更高级
- `pretest-q3`：`PD/超前` 是否总比 `PI/滞后` 更先进

### 静态承载内容

- 三道题干全部明文落页。
- 误区提示固定列出：
  - 结构名字不是答案；
  - 前馈不是反馈替代品；
  - “更快”不等于“更适合当前任务”。

### 互动升级点

- 组件类型：`quiz_group`
- 作答模型：允许重提一次；教师端区分首答与重提
- 揭示规则：`teacher_toggle`

### AI 边界

- 页面目标：暴露入口误区。
- 禁止范围：直接代替学生给理由链。

## 步骤 04｜控制结构工具箱：先按作用机制重组，而不是按名字平铺

### 页面骨架

- 模板：`formula_table_match`
- 区域：`formula` / `tables` / `interaction`

### 静态承载内容

- 保留开环表达：
  $$
  L(s)=C(s)P(s)
  $$
- 结构工具箱总表必须完整落页，至少包含：结构、主要机制、优先改善什么、常见代价、不宜优先用于什么。

### 互动升级点

- 组件类型：`triple_match`
- 任务：把结构卡拖到“建立闭环 / 补低频 / 改中频 / 补通道”对应区
- 反馈规则：即时标对错，可重试

### AI 边界

- 页面目标：把结构从名词表重组为作用机制表。
- 禁止范围：跳过工具箱直接输出起步卡。

## 步骤 05｜四类最小语义：建立闭环、补低频、改中频、补通道

### 页面骨架

- 模板：`comparison_panel_with_sort`
- 区域：`rules` / `card-bank` / `sort-area`

### 静态承载内容

- 四类语义卡固定写明：
  - 建立基本闭环；
  - 补低频能力；
  - 改中频动态品质；
  - 隔离给定/扰动通道。
- 边界卡固定写明：`PID/复合校正` 只在单一结构不足时进入候选，不是默认起点。

### 互动升级点

- 组件类型：`card_sort`
- 任务：把典型任务条目拖入四类语义区，并指出是否需要压后到 `4-3`
- 反馈规则：先只提示“当前排序不一致”，答案由教师控制揭示

### AI 边界

- 页面目标：固定“先选语义，再选结构”。
- 禁止范围：把 `PID` 自动升级成最佳选项。

## 步骤 06｜收益与代价链：结构先动哪里，代价就先从哪里冒出来

### 页面骨架

- 模板：`formula_media_compare`
- 区域：`media` / `summary` / `interaction`

### 静态承载内容

- 三频段职责卡固定写明：
  - 低频：精度与慢扰动抑制；
  - 中频：截止频率、相角裕度、动态品质；
  - 高频：噪声放大与执行机构负担。
- 信息图 `4-2-info.png` 必须与“收益句 / 代价句”对照卡同屏。

### 互动升级点

- 组件类型：`structured_compare`
- 任务：给三条“只有收益没有代价”的句子补出缺失代价
- 反馈规则：按“低频代价 / 中频代价 / 高频代价 / 通道边界”分类反馈

### AI 边界

- 页面目标：把收益与代价写成一条链。
- 禁止范围：把结构评价写成单向度口号。

## 步骤 07｜案例 A：客船航向保持为什么首轮更像 `PI/滞后`

### 页面骨架

- 模板：`case_study_dashboard`
- 区域：`case` / `evidence` / `decision`

### 静态承载内容

- 案例 A 任务卡必须写明：
  - 主矛盾：低频能力不足与慢扰动抑制；
  - 首选单结构：`PI/滞后`；
  - 参数方向：先增强低频补偿；
  - 预期改善：误差下降、保持能力增强；
  - 代价：相位滞后、速度与储备压力。

### 互动升级点

- 组件类型：`structured_compare`
- 任务：在给定选项中补全“首选结构 / 参数方向 / 代价说明”
- 反馈规则：错因标签化，不直接给完整标准答案

### AI 边界

- 页面目标：把“低频先站稳”写成完整理由链。
- 禁止范围：直接推到复合结构或整定结果。

## 步骤 08｜案例 B：稳定平台为什么首轮更像 `PD/超前`

### 页面骨架

- 模板：`case_study_dashboard`
- 区域：`case` / `evidence` / `decision`

### 静态承载内容

- 案例 B 任务卡必须写明：
  - 主矛盾：中频动态品质与储备整理；
  - 首选单结构：`PD/超前`；
  - 参数方向：先增强中频相位改善；
  - 预期改善：超调压低、阻尼更利落；
  - 代价：高频敏感性与实现复杂度上升。

### 互动升级点

- 组件类型：`structured_compare`
- 任务：比较案例 A / B 的主矛盾为什么不同
- 反馈规则：按“主矛盾误判 / 代价漏写 / 结构抢跑”分类反馈

### AI 边界

- 页面目标：把“中频先整理”写清，不把“更快”误写成唯一目标。
- 禁止范围：把案例 B 说成“无条件更先进”。

## 步骤 09｜通道边界：前馈为什么值得进入候选，但不能抢走反馈主线

### 页面骨架

- 模板：`formula_media_compare`
- 区域：`media` / `formula` / `interaction`

### 静态承载内容

- 主图固定使用 `4-2-feedforward-block-diagram.png`。
- 保留公式：
  $$
  u(s)=u_{\mathrm{fb}}(s)+u_{\mathrm{ff}}(s),\qquad
  u_{\mathrm{ff}}(s)=-G_{\mathrm{ff}}(s)d_m(s)
  $$
- 边界卡固定写明：
  - 前馈负责通道定向补偿；
  - 反馈负责稳定性与鲁棒性保底。

### 互动升级点

- 组件类型：`binary_choice`
- 任务：判断给定说法是“前馈边界内”还是“抢走反馈主线”
- 反馈规则：错因标签化

### AI 边界

- 页面目标：把前馈重新压回通道补偿语义。
- 禁止范围：把前馈写成比反馈更高级的总方案。

## 步骤 10｜单结构首轮起步卡工作区：把理由、方向、代价写全

### 页面骨架

- 模板：`task_card_workspace`
- 区域：`template` / `evidence` / `workspace`

### 静态承载内容

- 起步卡模板必须完整出现：
  - 当前任务；
  - 最紧矛盾；
  - 首选单结构；
  - 参数起步方向；
  - 预期先改善什么；
  - 预计先透支什么；
  - 留给 `4-3` 的未决项。
- 三类错误写法卡固定写明：
  - 只写结构名字；
  - 只写收益不写代价；
  - 直接把 `PID/复合结构` 写成默认答案。

### 互动升级点

- 组件类型：`task_card_workspace`
- 任务：基于给定案例完成最小起步卡
- 反馈规则：先检查字段完整性，再检查理由链是否自洽

### AI 边界

- 页面目标：输出一张可交给 `4-3/4-4` 的首轮输入卡。
- 禁止范围：自动生成完整参数表。

## 步骤 11｜后测与收束：先说理由，再谈结构，最后交给 `4-3`

### 页面骨架

- 模板：`summary_quiz_board`
- 区域：`quiz` / `summary` / `next-step`

### 静态承载内容

- 小结卡固定写明：
  - 先定主矛盾，再选结构；
  - 单结构起步优先于复合结构抢跑；
  - 收益与代价必须同卡落地；
  - 前馈是补偿，不是保底。
- 去向卡固定写明：`4-3` 将继续回答“单结构不够时，怎样长成复合结构骨架与可验证方案”。

### 互动升级点

- 组件类型：`quiz_group`
- 任务：完成三道后测题，只检验理由链与边界判断
- 反馈规则：即时反馈，可二次作答

### AI 边界

- 页面目标：完成本课收束并把学生送到 `4-3`。
- 禁止范围：提前展开 `4-3` 的完整方案内容。
