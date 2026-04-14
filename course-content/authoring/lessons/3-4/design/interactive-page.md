━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
互动页面设计 | 单元 3-4：根轨迹读图与对象化验证——把法则真正用到主图、参数窗口与工程后果上
技术栈：Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 文档职责

- 本文件是供人审阅的课堂前台页面蓝图，负责固定页面顺序、模板、静态内容、互动方式、反馈口径与验收标准。
- 同目录 [interactive-contract.yaml](./interactive-contract.yaml) 是机读契约；两者必须逐步骤同名、同序、同边界。
- 本课是 `3-3` 法则课之后的实践化读图课，先把“主图证据 -> 参数语言 -> 三域验证”写成完整课件，再决定局部互动升级。
- 页面总目标固定为：学生能够围绕同一船舶航向控制对象，把根轨迹判断写成一条完整工程判断链：`关键节点读图 -> 参数窗口判断 -> 增益换算 -> 对象化三域验证`。

## 表述规则

- 互动课首先承担完整课件职责。每一步都要先把概念、公式、图示、表格和判断语句落成可读页面，再决定是否升级互动。
- 本课主线固定为：`地图定位 -> 问题与产出 -> 同对象三版本初判 -> 固定读图顺序 -> 关键节点证据 -> 参数窗口 -> 增益换算 -> 三域补证 -> 对象化判断 -> 出口边界`。
- 页面必须严格命中讲义真实标题，不再使用脱离讲义结构的自拟锚点。
- AI 信息只作为隐藏式页面上下文交给控灵助手消费，不设计独立显式 AI 页面模块；若需要校对换算链，只能作为页面外呼起的辅助校对模式，不能代替学生写判断。
- 互动组件只负责初判、排序、标注、判断、填写和对照，不负责替代学生完成工程结论。

## 全课总览

| 步骤 | 标题 | 页面模板 | 主阅读顺序 | 互动主类型 | 学生页预览 |
|------|------|----------|------------|------------|------------|
| step-01 | 回到地图：从 3-3 法则走向 3-4 判断 | `map_hero_slide` | 路径定位 -> 主问题 -> 本课边界 | `none` | `/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-01` |
| step-02 | 问题提出与三项产出：稳定之后还要回答什么 | `goal_chain_slide` | 核心问题 -> 三项产出 -> 本课主线 | `none` | `/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-02` |
| step-03 | 固定对象与三个版本：先在同一张主图上做初判 | `version_overview_quiz` | 对象与公式 -> A/B/C 版本表 -> 三题初判 | `quiz_group` | `/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-03` |
| step-04 | 固定读图顺序：先骨架，再关键节点，再窗口，再后果 | `workflow_sort_board` | 四步法卡片 -> 排序区 -> 误判提示 | `sequence_sort` | `/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-04` |
| step-05 | 关键节点证据板：分离点、虚轴交点与参考工作点 B | `evidence_reading_board` | 主图骨架 -> 关键节点定义 -> 参考工作点结论 | `hotspot_labeling` | `/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-05` |
| step-06 | 关键节点读图记录：把主图证据写成判断句 | `keynode_annotation_workspace` | 记录模板 -> 节点标注 -> 一句读图结论 | `annotation_submit` | `/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-06` |
| step-07 | 参数窗口判断：稳定窗口不等于可接受窗口 | `window_judgement_workspace` | 双窗口定义 -> 版本对照表 -> 判断与贴标签 | `window_tagging` | `/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-07` |
| step-08 | 增益换算链：从 $k$ 到 $K$ 才能落回工程参数 | `formula_workspace` | 换算公式 -> 版本换算卡 -> 校对与修订 | `formula_workspace` | `/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-08` |
| step-09 | 总三域对照：为什么必须让主图、时域、频域互相补证 | `evidence_matrix_slide` | 三域角色 -> 总表联读 -> 进入回查 | `triple_match` | `/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-09` |
| step-10 | 时域回查：版本 B 为什么能够作为参考工作点 | `comparison_panel_with_toggle` | 阶跃对照图 -> 主导极点近似 -> B 的可信条件 | `panel_toggle_compare` | `/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-10` |
| step-11 | 频域与航迹对照：版本 C 的收益与代价必须同时落页 | `dual_evidence_compare_workspace` | Bode 对照 -> 航迹对照 -> 风险句写作 | `panel_toggle_compare` | `/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-11` |
| step-12 | 对象化验证记录与后测：写出完整工程判断 | `validation_record_workspace` | 记录模板 -> 两域以上证据 -> 后测提交 | `validation_record_workspace` | `/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-12` |
| step-13 | 收束与去向：只调增益为何很快到边界 | `summary_infographic` | 四句带走 -> 参数角色回收 -> 3-5 去向 | `exit_reflection` | `/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-13` |

> 实践训练时长承接：`step-03` 到 `step-12` 中，学生实际初判、排序、标注、判断、换算、对照、记录与提交累计约 `58` 分钟；其中核心工作区 `step-04` 到 `step-12` 累计约 `52` 分钟，满足实践课不少于 `45` 分钟的参与式训练要求。

## 讲义证据单元映射

| handout_anchor | evidence_unit_id | evidence_kind | must_appear_content | target_step | page_mode | interaction_archetype | media_or_table_ref | acceptance_note |
|---|---|---|---|---|---|---|---|---|
| `## 一、问题提出：稳定之后，还要回答什么` | `eu-01-entry-question` | `concept_card` | “稳定只是底线，还要继续判断快慢、振荡、风险和后果”的主问题。 | step-02 | static | `entry_overview` | 核心问题卡 | 本页必须把主问题和三项产出同时落页。 |
| `## 一、问题提出：稳定之后，还要回答什么` | `eu-02-output-table` | `deliverable_table` | `关键节点读图记录`、`参数窗口判断表`、`对象化验证记录` 三项固定产出及字段。 | step-02 | static | `deliverable_alignment` | 学习产出表 | 产出字段必须完整出现，不能只保留名称。 |
| `### 2.1 固定对象与三个版本` | `eu-03-version-table` | `comparison_table` | 船舶航向控制对象公式、`k=0.01715K` 与 A/B/C 三版本表。 | step-03 | static+interactive | `diagnostic_quiz` | `3-4-root-locus-summary.png` / 版本表 | 公式、版本表和三题初判必须同页可见。 |
| `### 2.2 拿到主图后的固定读图顺序` | `eu-04-reading-workflow` | `workflow_card` | 四步法：看骨架、找关键节点、区分窗口、最后谈参数与后果。 | step-04 | static+interactive | `sequence_sort` | `3-4-root-locus-summary.png` | 四步法卡片必须先于排序区出现。 |
| `### 2.3 分离点：从实极点主导走向共轭极点主导` | `eu-05-separation-point` | `annotated_figure` | 分离点的位置、合法性检查和“越过分离点后进入复极点主导”的结论。 | step-05 | static+interactive | `hotspot_labeling` | `3-4-root-locus-keynodes.png` | 分离点公式与图示必须同时出现。 |
| `### 2.4 虚轴交点：稳定窗口的上界` | `eu-06-imaginary-boundary` | `annotated_figure` | 稳定边界 `K≈28.05`、虚轴交点与“稳定窗口上界”结论。 | step-05 | static+interactive | `hotspot_labeling` | `3-4-root-locus-keynodes.png` | 不能只写数值，必须写清窗口意义。 |
| `### 2.5 参考工作点 B 的位置为什么重要` | `eu-07-reference-b` | `reference_case` | B 同时满足“越过分离点”“远离虚轴边界”“实虚部量级接近”。 | step-05 | static+interactive | `hotspot_labeling` | `3-4-root-locus-reference-b.png` | B 的三条证据必须独立落页。 |
| `### 2.6 关键节点读图记录` | `eu-08-keynode-record` | `record_template` | 三版本的节点位置、主导极点候选与一句读图结论。 | step-06 | static+interactive | `annotation_record` | 记录模板 | 记录模板字段必须先给出，再开放提交。 |
| `### 3.2 稳定窗口不等于可接受窗口` | `eu-09-window-logic` | `judgement_rule` | “稳定窗口”和“可接受窗口”的双层判断逻辑。 | step-07 | static+interactive | `window_tagging` | `3-4-conditional-stability-window.png` | 页面必须明确双窗口不是同一概念。 |
| `### 3.3 参数窗口判断表` | `eu-10-window-table` | `judgement_table` | A/B/C 的窗口位置、预计时域后果、预计频域后果和参数角色。 | step-07 | static+interactive | `window_tagging` | 参数窗口判断表 | 表头字段必须完整出现。 |
| `### 3.1 先把图上的增益和工程里的增益分开` | `eu-11-gain-conversion` | `formula_card` | `k=0.01715K`、`K=k/0.01715` 与参考工作点 B 的换算链。 | step-08 | static+interactive | `formula_workspace` | `3-4-gain-conversion-card.png` | 公式、变量说明和换算记录栏必须同屏。 |
| `### 4.1 为什么必须做三域验证` | `eu-12-domain-rationale` | `concept_card` | 主图判断必须由时域、频域与近似有效性共同补证。 | step-09 | static+interactive | `evidence_role_match` | 三域角色卡 | 页面必须先解释“为何补证”，再进入配对。 |
| `### 4.2 总三域对照表` | `eu-13-domain-matrix` | `comparison_matrix` | A/B/C 在根轨迹、时域、频域中的并排总表。 | step-09 | static+interactive | `evidence_role_match` | 总三域对照表 | 总表和三域角色卡必须同页可见。 |
| `### 4.3 时域验证：版本 B 为什么能够作为参考工作点` | `eu-14-step-response` | `curve_figure` | 原系统与主导极点近似系统的阶跃响应对照，以及 B 的可信条件。 | step-10 | static+interactive | `panel_compare` | `3-4-step-compare.png` | 阶跃对照图与“可信但非万能”的限制语必须同屏。 |
| `### 4.4 频域验证：版本 C 的代价是什么` | `eu-15-bode-compare` | `curve_figure` | A/B/C 的闭环 Bode 图对照、带宽、相角裕度与共振峰。 | step-11 | static+interactive | `panel_compare` | `3-4-bode-compare.png` | 频域表与图必须同页出现。 |
| `### 4.5 航迹对照：连续跟踪中的收益与代价` | `eu-16-track-compare` | `comparison_figure` | B 与 C 在航迹任务中的收益与风险必须一起解读。 | step-11 | static+interactive | `panel_compare` | `3-4-turning-track-k06064.png` / `3-4-turning-track-k20.png` | 不允许只写“跟踪更好”而不写代价。 |
| `### 4.6 对象化验证记录` | `eu-17-validation-record` | `record_template` | 工程对象、选定参数、根轨迹判断、时域验证、频域验证与综合结论。 | step-12 | static+interactive | `validation_record_workspace` | 对象化验证记录表 | 至少要求两域以上证据加一句综合判断。 |
| `### 5.1 本课到底完成了什么` | `eu-18-summary-role` | `summary_card` | A/B/C 三类参数角色与本课完成的判断链。 | step-13 | static | `summary_exit` | 参数角色卡 | 总结页必须回收三类参数角色。 |
| `### 5.2 为什么下一课必须引入零点` | `eu-19-next-step` | `summary_card` | 只调增益会把系统推向更小稳定裕量，下一课转向零点与结构改变。 | step-13 | static | `summary_exit` | 去向卡 | 必须明确 `3-5` 的去向而不提前展开。 |
| `## 六、小结` | `eu-20-summary` | `summary_card` | 四句带走与 A/B/C 三类参数角色回收。 | step-13 | static+reflection | `summary_exit` | `3-4-info.png` | 小结页必须能独立复习，不依赖教师口头补充。 |

## 步骤 01｜回到地图：从 3-3 法则走向 3-4 判断

### 页面骨架

- 模板：`map_hero_slide`
- 区域：`header` / `lead` / `summary`

### 主阅读顺序

- `路径定位` -> `主问题` -> `本课边界`

### 模块清单

- `stage-map`：模块 3 路径图
- `today-task`：本课任务卡
- `boundary-card`：本课边界卡

### 静态承载内容

- 路径图固定高亮 `3-3 -> 3-4 -> 3-5`，把 `3-4` 标为“读图与验证”。
- 任务卡固定写明：
  - `3-3` 解决“为什么这样走”；
  - `3-4` 解决“怎样按图判断”；
  - `3-5` 才进入“如何改变轨迹”。
- 边界卡固定写明：本课不重讲根轨迹法则证明，不进入零点、`PD`、超前校正和模块 4 设计任务。

### 互动升级点

- 组件类型：`none`

### 埋点与教师数据

- 埋点摘要：`viewed`、`timeOnStep`、`teacherFollowSync`
- 教师聚合：`view_count`、`sync_status`

### AI 边界

- 页面目标：标定本课位于模块 3 中的位置。
- 交付方式：隐藏式页面上下文。
- 允许范围：课程路径、法则课到判断课的切换。
- 禁止范围：提前给出 A/B/C 排序和数值结论。

### 预览口径

- 学生页预览：`/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-01`
- 对齐要求：首屏必须同时出现路径图、任务卡和边界卡，无作答区占位。

## 步骤 02｜问题提出与三项产出：稳定之后还要回答什么

### 页面骨架

- 模板：`goal_chain_slide`
- 区域：`question` / `outputs` / `summary`

### 主阅读顺序

- `核心问题` -> `三项产出` -> `本课主线`

### 模块清单

- `core-question-card`：核心问题卡
- `deliverable-table`：三项固定产出表
- `chain-summary-card`：判断链摘要卡

### 静态承载内容

- 核心问题卡固定写明：同样位于稳定窗口内的参数，也可能对应完全不同的速度、振荡、风险与工程后果。
- 三项固定产出表必须完整落页：
  - `关键节点读图记录`
  - `参数窗口判断表`
  - `对象化验证记录`
- 判断链摘要卡固定写明：`关键节点读图 -> 参数窗口判断 -> 对象化三域验证`。

### 互动升级点

- 组件类型：`none`

### 埋点与教师数据

- 埋点摘要：`viewed`、`timeOnStep`
- 教师聚合：`view_count`

### AI 边界

- 页面目标：压实本课要交什么、为什么不能只停在“还稳定”。
- 交付方式：隐藏式页面上下文。
- 禁止范围：把三项产出简化成口号。

### 预览口径

- 学生页预览：`/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-02`
- 对齐要求：核心问题卡、产出表和主线摘要必须同屏。

## 步骤 03｜固定对象与三个版本：先在同一张主图上做初判

### 页面骨架

- 模板：`version_overview_quiz`
- 区域：`object` / `versions` / `interaction`

### 主阅读顺序

- `对象与公式` -> `A/B/C 版本表` -> `三题初判`

### 模块清单

- `object-formula-card`：对象与记号说明
- `version-table`：A/B/C 版本表
- `prejudge-quiz`：三题初判区

### 静态承载内容

- 对象公式卡必须完整写出：
  $$
  G(s)=\frac{0.01715K}{s(s+0.1)(s+2.14375)},\qquad k=0.01715K
  $$
- 版本表必须完整给出 A/B/C 的 `K`、`k`、闭环极点特征与第一判断。
- 三道初判题固定围绕：
  - 谁最慢；
  - 谁最平衡；
  - 谁最冒险。

### 互动升级点

- 组件类型：`quiz_group`
- 作答模型：允许重提一次，教师端区分首答与重提。
- 揭示规则：`teacher_toggle`
- 反馈规则：只指出“是否把稳定直接等同于更优”或“是否忽略版本气质差异”，不提前给完整答案。

### 埋点与教师数据

- 埋点摘要：`attemptCount`、`predictionLabels`、`errorBucket`
- 教师聚合：`prediction_distribution`、`top_misconceptions`

### AI 边界

- 页面目标：让学生先暴露对 A/B/C 的第一印象。
- 交付方式：隐藏式页面上下文。
- 允许范围：版本气质、误区标签。
- 禁止范围：直接给出标准排序。

### 预览口径

- 学生页预览：`/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-03`
- 对齐要求：对象公式、版本表和三题初判必须同页可见。

## 步骤 04｜固定读图顺序：先骨架，再关键节点，再窗口，再后果

### 页面骨架

- 模板：`workflow_sort_board`
- 区域：`workflow` / `interaction` / `feedback`

### 主阅读顺序

- `四步法卡片` -> `排序区` -> `误判提示`

### 模块清单

- `workflow-cards`：四步法卡片
- `sort-board`：排序区
- `feedback-strip`：结果提示条

### 静态承载内容

- 四步法卡片固定写明：
  1. 先看起点、终点和分支数；
  2. 再找分离点、虚轴交点和主导极点候选；
  3. 再区分稳定窗口与可接受窗口；
  4. 最后才谈参数和工程后果。
- 误判提示固定写明：不能因为局部位置“看起来顺眼”就跳过前两步直接下结论。

### 互动升级点

- 组件类型：`sequence_sort`
- 学生任务：把四步法排成稳定读图动作链。
- 反馈规则：只提示哪一步放错，不直接替学生重排。
- 揭示规则：`teacher_toggle`

### 埋点与教师数据

- 埋点摘要：`sortOrder`、`attemptCount`、`resultState`
- 教师聚合：`common_wrong_orders`、`completion_rate`

### AI 边界

- 页面目标：把读图顺序固定下来。
- 交付方式：隐藏式页面上下文。
- 禁止范围：跳过顺序直接评价某一版本。

### 预览口径

- 学生页预览：`/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-04`
- 对齐要求：四步法卡片必须先于排序区出现。

## 步骤 05｜关键节点证据板：分离点、虚轴交点与参考工作点 B

### 页面骨架

- 模板：`evidence_reading_board`
- 区域：`figure` / `evidence` / `conclusion`

### 主阅读顺序

- `主图骨架` -> `关键节点定义` -> `参考工作点结论`

### 模块清单

- `keynode-figure`：关键节点标注图
- `boundary-figure`：参考工作点 B 图
- `evidence-cards`：三张证据卡

### 静态承载内容

- 必须完整保留三条证据：
  - 分离点约为 $s\approx -0.0494$，并且要说明“候选点计算 + 区段合法性检查 + 参数范围检查”；
  - 稳定边界约为 $K\approx 28.05$，对应虚轴交点 $s=\pm j0.4626$；
  - B 的价值来自“越过分离点、远离虚轴边界、实虚部量级接近”。
- 图像固定使用：
  - `3-4-root-locus-keynodes.png`
  - `3-4-root-locus-reference-b.png`

### 互动升级点

- 组件类型：`hotspot_labeling`
- 学生任务：在图上点选“分离点”“虚轴边界”“B 的参考位置”三个热点。
- 反馈规则：只判定是否命中对应区域，不替代学生写意义解释。
- 揭示规则：`teacher_toggle`

### 埋点与教师数据

- 埋点摘要：`hotspotSelections`、`resultState`、`retryCount`
- 教师聚合：`hotspot_accuracy`、`missed_node_type`

### AI 边界

- 页面目标：把关键节点从“看过”变成“叫得准、说得出作用”。
- 交付方式：隐藏式页面上下文。
- 禁止范围：绕过节点定义直接讲版本优劣。

### 预览口径

- 学生页预览：`/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-05`
- 对齐要求：关键节点图、参考工作点图和三张证据卡必须同页可见。

## 步骤 06｜关键节点读图记录：把主图证据写成判断句

### 页面骨架

- 模板：`keynode_annotation_workspace`
- 区域：`template` / `workspace` / `record`

### 主阅读顺序

- `记录模板` -> `节点标注` -> `一句读图结论`

### 模块清单

- `record-template`：`关键节点读图记录` 模板
- `annotation-layer`：主图标注层
- `result-card`：一句判断卡

### 静态承载内容

- 记录模板字段必须固定写明：
  - 分离点判断
  - 虚轴边界判断
  - 主导极点候选
  - 读图结论
- 结果卡固定提醒：每个版本都必须写成一句完整判断，不能只写“更靠左”或“更危险”。

### 互动升级点

- 组件类型：`annotation_submit`
- 学生任务：为 A/B/C 三版本填写节点记录，并提交一句读图结论。
- 反馈规则：按缺项提示，不直接给结论模板。
- 揭示规则：`teacher_toggle`

### 埋点与教师数据

- 埋点摘要：`fieldCompletion`、`annotationCount`、`errorBucket`
- 教师聚合：`missing_field_rate`、`common_shortcuts`

### AI 边界

- 页面目标：把“看图”压实成“写记录”。
- 交付方式：隐藏式页面上下文。
- 禁止范围：自动生成整句判断。

### 预览口径

- 学生页预览：`/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-06`
- 对齐要求：模板字段必须先于提交区出现。

## 步骤 07｜参数窗口判断：稳定窗口不等于可接受窗口

### 页面骨架

- 模板：`window_judgement_workspace`
- 区域：`rule` / `table` / `interaction`

### 主阅读顺序

- `双窗口定义` -> `版本对照表` -> `判断与贴标签`

### 模块清单

- `window-rule-card`：双窗口规则卡
- `window-table`：参数窗口判断表
- `tagging-panel`：窗口贴标签区

### 静态承载内容

- 规则卡固定写明：
  - 稳定窗口回答“是否仍在稳定范围内”；
  - 可接受窗口回答“是否仍处于工程愿意接受的中心区域”。
- 参数窗口判断表必须完整保留列：
  - 根轨迹增益 $k$
  - 实际控制器增益 $K$
  - 稳定性判断
  - 预计时域后果
  - 预计频域后果
  - 参数角色

### 互动升级点

- 组件类型：`window_tagging`
- 学生任务：给 A/B/C 贴上“偏保守 / 参考工作点 / 取舍型参数”等标签，并补齐一句双窗口判断。
- 反馈规则：只提示“漏写稳定窗口”或“漏写可接受窗口”，不直接给标签答案。
- 揭示规则：`teacher_toggle`

### 埋点与教师数据

- 埋点摘要：`selectedTags`、`fieldCompletion`、`errorBucket`
- 教师聚合：`role_distribution`、`window_confusion_rate`

### AI 边界

- 页面目标：把窗口判断从口头印象变成双层表述。
- 交付方式：隐藏式页面上下文。
- 禁止范围：把稳定窗口和可接受窗口混写成一个词。

### 预览口径

- 学生页预览：`/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-07`
- 对齐要求：双窗口定义和表头字段必须同屏。

## 步骤 08｜增益换算链：从 $k$ 到 $K$ 才能落回工程参数

### 页面骨架

- 模板：`formula_workspace`
- 区域：`formula` / `example` / `workspace`

### 主阅读顺序

- `换算公式` -> `版本换算卡` -> `校对与修订`

### 模块清单

- `formula-card`：换算公式卡
- `conversion-example`：B 版本换算示例
- `conversion-workspace`：换算记录区

### 静态承载内容

- 公式卡必须完整保留：
  $$
  k=0.01715K,\qquad K=\frac{k}{0.01715}
  $$
- 示例卡必须完整保留：
  $$
  k=0.0104 \Rightarrow K=\frac{0.0104}{0.01715}\approx 0.6064
  $$
- 工作区提示固定写明：先写公式链，再写变量含义，最后写结果。

### 互动升级点

- 组件类型：`formula_workspace`
- 学生任务：完成 A/B/C 的换算链，至少完整写出一条参考工作点 B 的链条。
- 反馈规则：按“公式缺失 / 变量混淆 / 数值错误”三类给出提示。
- 教师可开启“校对助手模式”，仅允许对换算链做缺项校对，不允许代写工程判断。

### 埋点与教师数据

- 埋点摘要：`formulaChainComplete`、`errorBucket`、`assistantCheckUsed`
- 教师聚合：`conversion_error_rate`、`assistant_usage_rate`

### AI 边界

- 页面目标：把图上参数落回工程参数。
- 交付方式：隐藏式页面上下文；外呼校对模式仅核查换算链。
- 禁止范围：让助手直接替学生给出最终版本排序。

### 预览口径

- 学生页预览：`/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-08`
- 对齐要求：公式卡、示例卡和记录区必须同页可见。

## 步骤 09｜总三域对照：为什么必须让主图、时域、频域互相补证

### 页面骨架

- 模板：`evidence_matrix_slide`
- 区域：`rationale` / `matrix` / `interaction`

### 主阅读顺序

- `三域角色` -> `总表联读` -> `进入回查`

### 模块清单

- `domain-role-cards`：三域角色卡
- `domain-matrix`：总三域对照表
- `role-match`：角色配对区

### 静态承载内容

- 三域角色卡固定写明：
  - 根轨迹：解释节点、窗口与主导分支；
  - 时域：验证响应快慢、振荡与近似有效性；
  - 频域：验证带宽、裕量与风险暴露。
- 总三域对照表必须并排保留 A/B/C 在三域中的对应结论。

### 互动升级点

- 组件类型：`triple_match`
- 学生任务：把“根轨迹判断”“时域后果”“频域后果”配成同一版本的证据链。
- 反馈规则：只提示哪一列配错，不直接替学生纠正。

### 埋点与教师数据

- 埋点摘要：`matchResult`、`attemptCount`、`errorBucket`
- 教师聚合：`domain_confusion_pairs`、`completion_rate`

### AI 边界

- 页面目标：先立住三域为什么缺一不可。
- 交付方式：隐藏式页面上下文。
- 禁止范围：把三域压缩成“再看两张图就行”的附属说明。

### 预览口径

- 学生页预览：`/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-09`
- 对齐要求：三域角色卡和总表必须同页可见。

## 步骤 10｜时域回查：版本 B 为什么能够作为参考工作点

### 页面骨架

- 模板：`comparison_panel_with_toggle`
- 区域：`figure` / `analysis` / `interaction`

### 主阅读顺序

- `阶跃对照图` -> `主导极点近似` -> `B 的可信条件`

### 模块清单

- `step-compare-figure`：阶跃响应对照图
- `approximation-card`：近似有效性说明卡
- `toggle-panel`：版本聚焦切换区

### 静态承载内容

- 必须完整保留：
  - 原系统与主导极点近似系统的阶跃响应对照；
  - “B 附近使用主导极点解释主要动态是可信的”；
  - “可信但不是万能”的限制语。
- 图像固定使用 `3-4-step-compare.png`。

### 互动升级点

- 组件类型：`panel_toggle_compare`
- 学生任务：在 A/B/C 三版本中切换，写出“哪一版最能支撑参考工作点判断，为什么”。
- 反馈规则：只检查是否同时提到“均衡”和“近似可信”，不直接给示范句。

### 曲线互动镜像说明

- 对应静态图：`3-4-step-compare.png`
- 默认状态：聚焦 B 版本，图中原系统与主导极点近似系统保持讲义默认对照状态。
- 图组排布：保持讲义中的单页对照布局，不拆分为独立小图。
- 控件策略：图像下方提供版本切换按钮，不追加自由参数滑块。

### 埋点与教师数据

- 埋点摘要：`focusedVersion`、`reasonKeywords`、`resultState`
- 教师聚合：`focus_distribution`、`missing_reason_keyword`

### AI 边界

- 页面目标：让学生知道 B 的“平衡”不是感觉，而有时域证据支撑。
- 交付方式：隐藏式页面上下文。
- 禁止范围：把主导极点近似绝对化为所有版本都同样可信。

### 预览口径

- 学生页预览：`/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-10`
- 对齐要求：阶跃对照图和限制语必须同页出现。

## 步骤 11｜频域与航迹对照：版本 C 的收益与代价必须同时落页

### 页面骨架

- 模板：`dual_evidence_compare_workspace`
- 区域：`bode` / `track` / `conclusion`

### 主阅读顺序

- `Bode 对照` -> `航迹对照` -> `风险句写作`

### 模块清单

- `bode-figure`：Bode 对照图
- `track-figures`：B 与 C 的航迹对照图
- `risk-card`：收益与代价句写作区

### 静态承载内容

- Bode 对照区必须完整保留：
  - 带宽；
  - 相角裕度；
  - 共振峰；
  - 频域解释。
- 航迹对照区必须完整保留：
  - B 的均衡表现；
  - C 的跟踪收益；
  - 以及“收益必须连同频域代价一起解读”。
- 图像固定使用：
  - `3-4-bode-compare.png`
  - `3-4-turning-track-k06064.png`
  - `3-4-turning-track-k20.png`

### 互动升级点

- 组件类型：`panel_toggle_compare`
- 学生任务：切换证据面板后写出一句完整风险句，格式为“C 在……方面更强，但以……为代价”。
- 反馈规则：必须同时出现收益与代价两个要素，否则判为不完整。

### 曲线互动镜像说明

- 对应静态图：`3-4-bode-compare.png`
- 默认状态：保持讲义中 A/B/C 三版本同屏对照。
- 图组排布：保持讲义的单页多曲线对照，不改成拆分页。
- 控件策略：只允许在“频域证据 / 航迹证据 / 合并证据”之间切换，不开放自由参数调节。

### 埋点与教师数据

- 埋点摘要：`evidencePanelPath`、`riskSentenceComplete`、`resultState`
- 教师聚合：`panel_path_distribution`、`missing_tradeoff_rate`

### AI 边界

- 页面目标：把 C 的工程含义写成“收益与代价并存”的完整句。
- 交付方式：隐藏式页面上下文。
- 禁止范围：只保留“更快”或只保留“更危险”的单边表述。

### 预览口径

- 学生页预览：`/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-11`
- 对齐要求：Bode 图、航迹图和风险句区域必须同页可见。

## 步骤 12｜对象化验证记录与后测：写出完整工程判断

### 页面骨架

- 模板：`validation_record_workspace`
- 区域：`template` / `workspace` / `quiz`

### 主阅读顺序

- `记录模板` -> `两域以上证据` -> `后测提交`

### 模块清单

- `validation-template`：对象化验证记录模板
- `summary-workspace`：综合判断填写区
- `post-quiz`：三题后测区

### 静态承载内容

- 记录模板字段必须完整保留：
  - 工程对象
  - 选定参数
  - 根轨迹判断
  - 时域验证
  - 频域验证
  - 主导极点近似是否可信
  - 综合结论
- 三道后测题固定围绕：
  - 为什么“还稳定”不足以构成完整工程判断；
  - 若图上读得 `k=0.0104`，实际 `K` 应是多少；
  - A/B/C 中谁更适合作为参考工作点，并至少写出两条证据。

### 互动升级点

- 组件类型：`validation_record_workspace`
- 学生任务：完成一条对象化验证记录，并回答三题后测。
- 反馈规则：记录区按缺项提示；后测区允许重提一次，教师端区分首答与重提。
- 揭示规则：`teacher_toggle`

### 埋点与教师数据

- 埋点摘要：`recordCompletion`、`evidenceDomainCount`、`quizResult`
- 教师聚合：`completion_rate`、`domain_count_distribution`、`top_posttest_errors`

### AI 边界

- 页面目标：把前面分散的证据链收束成完整工程判断。
- 交付方式：隐藏式页面上下文。
- 禁止范围：自动生成综合结论整句。

### 预览口径

- 学生页预览：`/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-12`
- 对齐要求：记录模板必须先于后测区出现，且至少要求两域以上证据。

## 步骤 13｜收束与去向：只调增益为何很快到边界

### 页面骨架

- 模板：`summary_infographic`
- 区域：`takeaways` / `roles` / `next`

### 主阅读顺序

- `四句带走` -> `参数角色回收` -> `3-5 去向`

### 模块清单

- `takeaway-list`：四句带走
- `role-summary`：A/B/C 参数角色卡
- `next-step-card`：下一课去向卡

### 静态承载内容

- 四句带走固定写明：
  1. `3-4` 的核心不是重讲法则，而是把法则压成判断动作；
  2. 参数判断至少分为稳定窗口与可接受窗口两层；
  3. 根轨迹增益必须先换算回工程控制器参数；
  4. 三域验证是为主图判断补证据，不是重复看图。
- 参数角色卡固定回收：
  - A：稳定下界，偏保守；
  - B：参考工作点；
  - C：收益与代价并存的取舍型参数。
- 去向卡固定写明：下一课 `3-5` 将从零点进入，讨论如何改变轨迹本身，而不再只在既有轨迹上选点。

### 互动升级点

- 组件类型：`exit_reflection`
- 学生任务：写一句“如果只继续增大增益，会先失去什么”。
- 反馈规则：只检查是否提到“稳定裕量 / 振荡风险 / 结构改变”中的至少一个关键词。

### 埋点与教师数据

- 埋点摘要：`reflectionKeywords`、`viewed`、`timeOnStep`
- 教师聚合：`reflection_keyword_distribution`

### AI 边界

- 页面目标：完成本课收束，并把问题自然送往 `3-5`。
- 交付方式：隐藏式页面上下文。
- 禁止范围：提前展开零点机理或 `PD` 设计。

### 预览口径

- 学生页预览：`/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-13`
- 对齐要求：四句带走、参数角色卡和去向卡必须同页可见。
