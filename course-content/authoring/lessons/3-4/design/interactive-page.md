━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
互动页面设计 | 单元 3-4：根轨迹读图与对象化验证——把法则真正用到主图、参数窗口与工程后果上
技术栈：Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 文档职责
- 本文件是供人审阅的页面蓝图，只描述页面模板、固定内容、互动组件、数据采集与 AI 边界。
- 同目录 [interactive-contract.yaml](./interactive-contract.yaml) 是机读契约；两者必须逐步骤一一对应。
- 本文件不是讲义摘要，不写教师台词，不把关键承载内容留给实现阶段临时补。
- 页面默认预览口径固定为学生演示页，不以教师端模板弹窗代替真实页面。

## 表述规则
- 页面描述只保留客观结构：区域、模块、文本、公式、图片、表格、互动组件、反馈规则。
- 动作化表述禁用：`展示`、`引导`、`让学生`、`先做一次`、`跟随推导`、`教师讲` 等。
- 静态内容优先。互动组件只负责预测、标注、判断、换算、对照与修正，不能替代核心图示、公式、结论与记录模板。
- 本课主线固定为：`关键节点读图 -> 参数窗口判断 -> 根轨迹增益换算 -> 对象化三域验证`，不回退成法则复述稿，也不越界到零点、`PD` 或模块4设计流程。

## 全课总览
| 步骤 | 标题 | 页面模板 | 主体布局 | 互动组件 | 学生页预览 |
|------|------|----------|----------|----------|------------|
| step-01 | 回到地图——从 3-3 法则走向 3-4 判断 | `map_hero_slide` | 路径图 + 今日任务卡 | `none` | `/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-01` |
| step-02 | 情境引入——稳定了，是否就已经够好 | `binary_choice_illustration` | 封面图 + 核心追问 + 二选一判断 | `binary_choice` | `/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-02` |
| step-03 | 本节目标——三项固定产出与课堂边界 | `goal_chain_slide` | 目标卡 + 产出链 + 边界卡 | `none` | `/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-03` |
| step-04 | 前测——你会先看哪个域来判断版本优劣 | `question_stack` | 三题纵向堆叠 + 提交反馈条 | `quiz_group` | `/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-04` |
| step-05 | 固定读图顺序：先骨架，再关键节点，再窗口 | `workflow_sort_board` | 四步流程卡 + 排序区 | `sequence_sort` | `/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-05` |
| step-06 | 工作区 A：A/B/C 三版本第一眼预测 | `version_prediction_workspace` | 任务说明 + 受限主图工作区 + 记录栏 | `preset_prediction_submit` | `/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-06` |
| step-07 | 工作区 B：关键节点标注与读图记录 | `keynode_annotation_workspace` | 标注说明 + 主图标注层 + 记录卡 | `annotation_submit` | `/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-07` |
| step-08 | 工作区 C：稳定窗口与可接受窗口 | `window_judgement_workspace` | 窗口判读图 + 标签区 + 判断表 | `window_tagging` | `/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-08` |
| step-09 | 工作区 D：根轨迹增益 $k$ 到控制器增益 $K$ 的换算 | `gain_conversion_workspace` | 换算卡 + 公式区 + 填写栏 | `formula_workspace` | `/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-09` |
| step-10 | AI 对照——检查换算链而不是代做判断 | `compare_then_ai` | 自己的换算链 + AI 检查区 + 修订栏 | `ai_compare_workspace` | `/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-10` |
| step-11 | 工作区 E：时域回查，谁慢、谁平衡、谁开始冒险 | `step_compare_workspace` | 时域对照图 + 版本切换区 + 记录栏 | `panel_toggle_compare` | `/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-11` |
| step-12 | 工作区 F：频域回查，风险为什么会先暴露 | `bode_compare_workspace` | Bode 对照图 + 版本切换区 + 最终判断栏 | `panel_toggle_compare` | `/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-12` |
| step-13 | 后测——完整工程判断要包含哪些证据 | `post_quiz_stack` | 两题客观题 + 一题解释题 | `quiz_group` | `/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-13` |
| step-14 | 收束——只调增益为什么很快会到边界 | `summary_infographic` | 四列表 + 结论卡 + 后续去向卡 | `exit_reflection` | `/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-14` |

> 实践训练时长承接：`step-05` 到 `step-12` 中，学生实际排序、预测、标注、判断、换算、修订、对照与提交累计约 `62` 分钟，其中核心工作区 `step-06` 到 `step-12` 累计约 `56` 分钟。

## 讲义核心内容映射
| handout_anchor | core_item_type | must_appear_content | target_step | page_mode | interaction_upgrade | media_or_table_ref | acceptance_note |
|---|---|---|---|---|---|---|---|
| `### 1.1 从"系统稳定了吗"走向"系统工作得好不好"` | concept+question | “稳定只是底线，工程还要继续判断快慢、振荡、风险和后果”的主问题。 | `step-02` | `static+choice` | 二选一判断只负责暴露“稳定=够好”的误区。 | `3-4-cover-comic.png` | 封面图、主问题和结论句必须先落页。 |
| `### 1.2 三项学习产出` | summary+table | `关键节点读图记录`、`参数窗口判断表`、`对象化验证记录` 三项固定产出及其字段。 | `step-03` | `static` | 无互动，页面只负责压实本课提交物。 | `三项产出卡片` | 三项产出必须完整出现，不能只写标题。 |
| `### 1.3 知识地图定位` | concept+map | `3-3 -> 3-4 -> 3-5` 的主线定位，以及本课“不重讲法则、不进入结构改变”的边界。 | `step-01` | `static` | 无互动。 | `模块3路径图` | 路径图与边界卡必须同屏。 |
| `## 二、读图顺序：拿到主图先做什么` | workflow+method | 四步法：看骨架、找关键节点、区分稳定/可接受窗口、最后再谈参数与后果。 | `step-05` | `static+workspace` | 排序区只负责检验顺序，不替代四步卡内容。 | `3-4-root-locus-summary.png` | 四步卡必须完整可读，排序区不能吞掉方法本体。 |
| `## 三、主工作区 A：同一对象族三版本预测` | prediction+table | A/B/C 三版本的第一眼判断框架：谁最慢、谁最平衡、谁最冒险。 | `step-06` | `static+workspace` | 受限主图工作区只负责版本切换和提交初判。 | `3-4-root-locus-summary.png` | 版本表与三问必须在工作区上方静态出现。 |
| `## 四、主工作区 B：关键节点读图` | concept+record | 起点、分离点、虚轴交点、主导极点候选与 `关键节点读图记录` 模板。 | `step-07` | `static+workspace` | 标注区只负责把四类节点落到图上。 | `3-4-root-locus-keynodes.png` | 四类节点定义和记录卡字段必须先给出。 |
| `### 5.1 先把图上的增益和实际增益分开` | formula | `k = 0.01715K`，以及“图上增益先换算，才进入工程参数语言”的结论。 | `step-09` | `static+workspace` | 换算区只负责记录公式链和变量含义。 | `3-4-gain-conversion-card.png` | 公式、变量说明和记录栏必须先落页。 |
| `### 5.2 再把稳定窗口和可接受窗口分开` | concept | “稳定窗口不等于可接受窗口”的双层判断。 | `step-08` | `static+workspace` | 标签区只负责给 A/B/C 贴窗口标签。 | `3-4-conditional-stability-window.png` | 页面必须先把双窗口逻辑说清。 |
| ### 5.3 参数窗口判断表 | record | `参数窗口判断表` 的版本、稳定窗口位置、可接受窗口位置三列。 | `step-08` | `static+workspace` | 判断表只承接窗口标签的写入。 | `窗口判断表` | 页面必须显式出现表头字段。 |
| `### 5.4 [AI融入点] 让 AI 帮你检查换算链，而不是直接给出答案` | ai-boundary | AI 只检查公式、参数含义、步骤完整性，不给最终工程判断。 | `step-10` | `static+ai` | AI 对照只负责核对链条和修订说明。 | `AI 对照卡` | 页面必须写明 AI 禁止替代窗口判断和版本排序。 |
| `## 六、工程对象迁移：船舶航向控制` | concept+comparison | A/B/C 三版本在船舶航向对象上的不同含义，尤其是 B 的参考工作点意义。 | `step-11` | `static+workspace` | 时域对照区只负责验证前面对版本的直觉。 | `3-4-step-compare.png / 3-4-root-locus-reference-b.png` | 版本含义卡必须先出现，再开放时域切换。 |
| `### 7.1 A、B、C 三个版本的三域对照` | comparison | 时域对照、版本差异与三域联动观察入口。 | `step-11` | `static+workspace` | 时域切换区只负责验证前面对版本的直觉。 | `3-4-step-compare.png` | 时域证据必须写回 `对象化验证记录`。 |
| `### 7.2 主导极点近似在这里为什么可信` | concept | B 版本参考工作点和主导极点近似可信的条件。 | `step-11` | `static+workspace` | 参考工作点图只服务“为什么可信”的解释。 | `3-4-root-locus-reference-b.png` | 页面必须给出“可信但不是万能”的限制语。 |
| `### 7.3 为什么 C 的频域解读绝对不能省去` | comparison | 频域风险暴露与“还没失稳不等于舒服”的结论。 | `step-12` | `static+workspace` | 频域切换区负责补上最终证据链。 | `3-4-bode-compare.png` | 频域判断必须写成一句工程解释。 |
| ### 7.4 对象化验证记录 | record | 最终排序、至少两域证据与一句总判断。 | `step-12` | `static+workspace` | 最终判断栏承接完整记录。 | `对象化验证记录表` | 记录表必须显式出现字段。 |
| `### 7.5 [AI融入点] 让 AI 帮你找"哪一个域最先暴露出问题"` | ai-boundary | AI 只帮助对照“哪一域先暴露风险”，不替代学生写最终结论。 | `step-12` | `static+workspace` | AI 只辅助比对，不代替判断。 | `AI 风险对照卡` | 页面必须写明 AI 禁区。 |
| `## 八、课末收束：从读图走向后续的结构改变 / ## 九、小结` | summary | “会按图做判断，还没有进入结构改变；下一课转向零点与结构变化”的出口结论。 | `step-14` | `static+reflection` | 反思句只做一句出口表达。 | `3-4-info.png` | 结尾必须能独立复习，不依赖教师口头补充。 |

## 步骤 01｜回到地图——从 3-3 法则走向 3-4 判断

### 页面骨架
- 模板：`map_hero_slide`
- 区域：`header` / `lead` / `summary`

### 模块清单
- `stage-map`：模块 3 路径图
- `today-task`：本课任务卡
- `boundary-card`：本课边界卡

### 静态承载内容
- 路径图固定高亮 `3-3 -> 3-4 -> 3-5`。
- 任务卡固定写明：`3-3` 建立法则，`3-4` 把法则压成读图动作，`3-5` 才进入结构改变。
- 边界卡固定写明：本课不重讲根轨迹法则证明，不进入零点、`PD`、超前校正和模块4设计任务。

### 互动升级点
- 组件类型：`none`
- 提交态：无
- 答案揭示：无

### 埋点与教师数据
- 埋点摘要：`viewed`、`timeOnStep`、`teacherFollowSync`
- 教师聚合：`view_count`、`sync_status`

### AI 边界
- 页面目标：标定本课在模块 3 中的位置。
- 允许范围：课程路径、法则课到判断课的切换。
- 禁止范围：提前解释版本差异和计算结果。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-01`
- 对齐要求：首屏直接出现路径图、任务卡和边界卡，无作答区占位。

## 步骤 02｜情境引入——稳定了，是否就已经够好

### 页面骨架
- 模板：`binary_choice_illustration`
- 区域：`media` / `questions` / `interaction`

### 模块清单
- `cover-media`：封面漫画或导入视频封面
- `core-question`：核心追问卡
- `binary-vote`：二选一判断区

### 静态承载内容
- 主图固定使用 `3-4-cover-comic.png` 或其首帧静态图。
- 追问卡固定为：如果 A、B、C 都还稳定，是否就已经能直接说它们一样可用？
- 结论卡固定写明：稳定是底线，工程判断还必须继续比较窗口、换算与跨域后果。

### 互动升级点
- 组件类型：`binary_choice`
- 选项结构：
  - A：只要还稳定，就已经足够好
  - B：不一定，还要继续判断
- 正确项：`B`
- 错误反馈：只提示“稳定和可接受不是同一个结论”
- 答案揭示：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`selectedOption`、`resultState`、`teacherRevealSeen`
- 教师聚合：`option_distribution`、`misconception_rate`

### AI 边界
- 页面目标：打破“稳定=够好”的直觉闭合。
- 允许范围：稳定、窗口、风险、后果。
- 禁止范围：提前给出 A/B/C 的最终排序。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-02`
- 对齐要求：封面图、追问卡和判断按钮在未作答状态下同时可见。

## 步骤 03｜本节目标——三项固定产出与课堂边界

### 页面骨架
- 模板：`goal_chain_slide`
- 区域：`goals` / `outputs` / `boundaries`

### 模块清单
- `goal-cards`：三项目标卡
- `output-cards`：三项固定产出卡
- `boundary-list`：不负责内容列表

### 静态承载内容
- 三项目标固定对应：会读关键节点、会写参数窗口、会做三域验证。
- 三项固定产出卡固定对应：`关键节点读图记录`、`参数窗口判断表`、`对象化验证记录`。
- 边界列表固定写明：不重讲法则证明、不进入零点、不进入控制器设计。

### 互动升级点
- 组件类型：`none`

### 埋点与教师数据
- 埋点摘要：`viewed`、`timeOnStep`
- 教师聚合：`view_count`

### AI 边界
- 页面目标：压实本课“要交什么、不要做什么”。
- 允许范围：目标、产出、边界。
- 禁止范围：把产出内容简化成一句口号。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-03`
- 对齐要求：目标卡、产出卡和边界卡必须同屏。

## 步骤 04｜前测——你会先看哪个域来判断版本优劣

### 页面骨架
- 模板：`question_stack`
- 区域：`question-stack` / `submit-bar`

### 模块清单
- `pretest-q1`：入口域判断题
- `pretest-q2`：稳定与可接受辨析题
- `pretest-q3`：`k` 与 `K` 辨析题

### 静态承载内容
- 三道题干全部明文落页。
- 误区提示固定列出：只看一域容易误判、稳定不等于可接受、图上增益不一定等于控制器增益。

### 互动升级点
- 组件类型：`quiz_group`
- 题目数量：3
- 作答模型：允许重提一次；教师端区分首答与重提
- 答案揭示：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`attemptCount`、`resultState`、`errorBucket`
- 教师聚合：`question_distribution`、`top_misconceptions`

### AI 边界
- 页面目标：暴露起点误区。
- 允许范围：错因分类与术语纠偏。
- 禁止范围：替代学生作答。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-04`
- 对齐要求：三题在未作答状态下全部可见。

## 步骤 05｜固定读图顺序：先骨架，再关键节点，再窗口

### 页面骨架
- 模板：`workflow_sort_board`
- 区域：`workflow` / `interaction` / `feedback`

### 模块清单
- `workflow-cards`：四步流程卡
- `sort-board`：排序区
- `feedback-strip`：排序结果提示条

### 静态承载内容
- 四步流程卡固定写明：
  - 看起点、终点和分支数；
  - 找分离点、虚轴交点、主导极点候选；
  - 区分稳定窗口与可接受窗口；
  - 最后再谈参数与工程后果。
- 主图固定配用 `3-4-root-locus-summary.png` 作为流程参照图。

### 互动升级点
- 组件类型：`sequence_sort`
- 学生任务：把四步法排序成稳定读图动作链
- 反馈规则：只提示“哪一步放错了”，不直接替学生重排
- 答案揭示：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`sortOrder`、`attemptCount`、`resultState`
- 教师聚合：`common_wrong_orders`、`completion_rate`

### AI 边界
- 页面目标：把方法顺序固定下来。
- 允许范围：四步法名称与职责。
- 禁止范围：跳过顺序直接讲 A/B/C 结论。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-05`
- 对齐要求：流程卡与排序区必须同屏，主图只作参照不夺主。

## 步骤 06｜工作区 A：A/B/C 三版本第一眼预测

### 页面骨架
- 模板：`version_prediction_workspace`
- 区域：`task` / `workspace` / `record`

### 模块清单
- `version-brief`：A/B/C 三版本简表
- `root-locus-workspace`：受限主图工作区
- `prediction-record`：初始排序记录栏

### 静态承载内容
- 版本简表必须固定给出 A、B、C 的 `K` 值、`k` 值和一句版本特征。
- 三个判断问题固定为：谁最慢、谁最平衡、谁最冒险。
- 工作区约束固定写明：只开放 A/B/C 快捷切换，不允许改对象结构。

### 互动升级点
- 组件类型：`preset_prediction_submit`
- 学生任务：切换 A/B/C 后提交三条初判
- 反馈规则：只保存初判，不即时揭示标准答案
- 答案揭示：无

### 埋点与教师数据
- 埋点摘要：`presetSwitchOrder`、`predictionLabels`、`submitTime`
- 教师聚合：`first_impression_distribution`、`switch_path_heatmap`

### AI 边界
- 页面目标：先暴露学生直觉，再进入证据链。
- 允许范围：快慢、平衡、风险感。
- 禁止范围：AI 代替学生写版本排序。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-06`
- 对齐要求：任务说明、版本表和主图工作区同时可见，记录栏在下方紧邻工作区。

## 步骤 07｜工作区 B：关键节点标注与读图记录

### 页面骨架
- 模板：`keynode_annotation_workspace`
- 区域：`task` / `workspace` / `record`

### 模块清单
- `keynode-definition`：四类关键节点定义卡
- `annotation-layer`：主图标注层
- `reading-record`：`关键节点读图记录`

### 静态承载内容
- 四类关键节点固定为：分离点、虚轴交点、主导极点候选、稳定窗口边界。
- 定义卡必须说明每类节点为什么重要，不只给名称。
- 主图固定使用 `3-4-root-locus-keynodes.png` 的无标注底图版本。

### 互动升级点
- 组件类型：`annotation_submit`
- 学生任务：在图上标出四类节点并提交一句“哪个节点最决定后续判断”
- 反馈规则：允许改一次；教师端可统一揭示参考层
- 答案揭示：`teacher_overlay_toggle`

### 埋点与教师数据
- 埋点摘要：`annotationPoints`、`editCount`、`submitTime`
- 教师聚合：`annotation_heatmap`、`node_type_error_rate`

### AI 边界
- 页面目标：把“会说法则名”推进成“会抓图上证据”。
- 允许范围：关键节点定义与位置判断。
- 禁止范围：AI 自动代标节点。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-07`
- 对齐要求：定义卡、主图和记录卡三者必须同时在同一纵向流里。

## 步骤 08｜工作区 C：稳定窗口与可接受窗口

### 页面骨架
- 模板：`window_judgement_workspace`
- 区域：`task` / `workspace` / `record`

### 模块清单
- `window-logic-card`：双窗口判断卡
- `window-figure`：窗口判读图
- `window-table`：`参数窗口判断表` 上半部分

### 静态承载内容
- 判断卡固定写明：稳定窗口回答“还能不能工作”，可接受窗口回答“值不值得继续用”。
- 窗口图固定使用 `3-4-conditional-stability-window.png`。
- `参数窗口判断表` 必须先给出三列：版本、稳定窗口位置、可接受窗口位置。

### 互动升级点
- 组件类型：`window_tagging`
- 学生任务：给 A/B/C 贴上 `稳定`、`可接受`、`不宜继续推进` 标签
- 反馈规则：可修正一次；教师端可查看全班分布
- 答案揭示：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`windowTags`、`revisionCount`、`submitState`
- 教师聚合：`window_label_distribution`、`high_risk_confusions`

### AI 边界
- 页面目标：把窗口语言和版本判断连起来。
- 允许范围：稳定、可接受、边界、代价。
- 禁止范围：AI 直接给出版本优先级。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-08`
- 对齐要求：判断卡、窗口图和判断表同屏，标签区不遮挡图面。

## 步骤 09｜工作区 D：根轨迹增益 $k$ 到控制器增益 $K$ 的换算

### 页面骨架
- 模板：`gain_conversion_workspace`
- 区域：`task` / `formula` / `record`

### 模块清单
- `conversion-card`：换算提示卡
- `formula-strip`：核心公式区
- `conversion-record`：`参数窗口判断表` 下半部分

### 静态承载内容
- 公式区必须完整出现：

$$
k = 0.01715K
$$

- 提示卡固定使用 `3-4-gain-conversion-card.png`。
- 记录栏固定要求填写：读到的 `k`、换算得到的 `K`、换算步骤、不能把 `k` 直接当 `K` 的原因。

### 互动升级点
- 组件类型：`formula_workspace`
- 学生任务：完成版本 B 的换算，并补写一句提醒
- 反馈规则：保存计算链，不即时给最终值
- 答案揭示：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`formulaInputs`、`mistakeType`、`submitState`
- 教师聚合：`kK_confusion_rate`、`formula_chain_completeness`

### AI 边界
- 页面目标：把图上参数翻译成工程参数。
- 允许范围：公式、变量含义、换算链。
- 禁止范围：把换算结果当成最终工程判断。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-09`
- 对齐要求：公式、换算卡和填写栏必须同屏。

## 步骤 10｜AI 对照——检查换算链而不是代做判断

### 页面骨架
- 模板：`compare_then_ai`
- 区域：`self-work` / `ai-panel` / `revision`

### 模块清单
- `self-chain`：本人换算链
- `ai-checker`：AI 检查区
- `revision-note`：修订说明栏

### 静态承载内容
- 页面固定写明：AI 只检查公式、变量含义、步骤完整性，不负责给窗口判断和最终版本排序。
- 修订说明栏固定句式：`AI 帮我纠正的不是答案，而是 ________。`

### 互动升级点
- 组件类型：`ai_compare_workspace`
- 学生任务：发送自己的换算链，读取 AI 的链条检查结果，再写一条修订说明
- 反馈规则：保存修订前后差异
- 答案揭示：无

### 埋点与教师数据
- 埋点摘要：`aiRequestSent`、`revisionDelta`、`finalSubmitState`
- 教师聚合：`common_chain_gaps`、`ai_helpfulness_tags`

### AI 边界
- 页面目标：让 AI 做“链条校对器”，不做“替代判断器”。
- 允许范围：公式检查、变量解释、漏步提醒。
- 禁止范围：直接给出 A/B/C 工程结论。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-10`
- 对齐要求：自己的换算链、AI 检查区和修订栏三块同屏。

## 步骤 11｜工作区 E：时域回查，谁慢、谁平衡、谁开始冒险

### 页面骨架
- 模板：`step_compare_workspace`
- 区域：`task` / `workspace` / `record`

### 模块清单
- `version-meaning-card`：A/B/C 版本含义卡
- `step-compare-panel`：时域对照图
- `validation-record-time`：`对象化验证记录` 的时域部分

### 静态承载内容
- 版本含义卡必须先说明：A 保守但慢，B 是参考工作点候选，C 仍稳定但风险感更强。
- 时域图固定使用 `3-4-step-compare.png`。
- 记录栏固定要求填写：哪个最慢、哪个最平衡、哪个开始冒险，以及对应的一条时域证据。

### 互动升级点
- 组件类型：`panel_toggle_compare`
- 学生任务：切换单版本或叠加对照后提交时域判断
- 反馈规则：允许基于前面窗口判断做一次修正
- 答案揭示：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`panelTogglePath`、`dwellTimeByVersion`、`revisionFlag`
- 教师聚合：`time_domain_choice_distribution`、`late_revision_rate`

### AI 边界
- 页面目标：用时域证据回查主图判断。
- 允许范围：快慢、振荡、拖尾、参考工作点。
- 禁止范围：AI 直接代填验证记录。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-11`
- 对齐要求：版本含义卡、时域图和记录栏必须同时可见。

## 步骤 12｜工作区 F：频域回查，风险为什么会先暴露

### 页面骨架
- 模板：`bode_compare_workspace`
- 区域：`task` / `workspace` / `record`

### 模块清单
- `risk-question-card`：频域追问卡
- `bode-compare-panel`：Bode 对照图
- `validation-record-final`：`对象化验证记录` 的频域与总判断部分

### 静态承载内容
- 追问卡固定为：哪个版本的风险在频域里最先暴露？为什么“还没失稳”不等于“频域仍然舒服”？
- 频域图固定使用 `3-4-bode-compare.png`。
- 最终判断栏固定要求写出：最终排序、至少两域证据、总判断一句话。

### 互动升级点
- 组件类型：`panel_toggle_compare`
- 学生任务：切换版本后提交频域判断与最终工程结论
- 反馈规则：提交后锁定 `对象化验证记录`
- 答案揭示：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`panelTogglePath`、`finalRanking`、`evidenceDomainCount`
- 教师聚合：`final_ranking_distribution`、`single_domain_overuse_rate`

### AI 边界
- 页面目标：把主图、时域、频域闭合成最终判断。
- 允许范围：风险暴露、带宽变化、交叉验证。
- 禁止范围：AI 代替学生给最终结论。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-12`
- 对齐要求：追问卡、频域图和最终判断栏必须同屏。

## 步骤 13｜后测——完整工程判断要包含哪些证据

### 页面骨架
- 模板：`post_quiz_stack`
- 区域：`question-stack` / `submit-bar`

### 模块清单
- `post-q1`：稳定与可接受辨析题
- `post-q2`：`k -> K` 换算题
- `post-q3`：B 版本证据题

### 静态承载内容
- 三道题干全部明文落页。
- 提醒卡固定写明：回答解释题时，至少说出 `关键节点 / 窗口 / 换算 / 三域` 中的两个关键词。

### 互动升级点
- 组件类型：`quiz_group`
- 题目数量：3
- 作答模型：提交后查看个人结果，教师端查看全班分布
- 答案揭示：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`attemptCount`、`resultState`、`keywordCoverage`
- 教师聚合：`correct_rate`、`missing_keyword_distribution`

### AI 边界
- 页面目标：检查学生是否真正形成完整判断链。
- 允许范围：错因解释与关键词提醒。
- 禁止范围：AI 代写解释题答案。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-13`
- 对齐要求：三题在未作答状态下全部可见。

## 步骤 14｜收束——只调增益为什么很快会到边界

### 页面骨架
- 模板：`summary_infographic`
- 区域：`summary-grid` / `exit-card` / `next-step`

### 模块清单
- `four-column-summary`：四列表
- `exit-reflection`：一句出口表达
- `next-lesson-card`：3-5 去向卡

### 静态承载内容
- 四列表固定为：关键节点、参数窗口、增益换算、三域验证。
- 去向卡固定写明：本课学会的是按图做判断，下一课才进入零点与结构改变。
- 信息图固定使用 `3-4-info.png`。

### 互动升级点
- 组件类型：`exit_reflection`
- 学生任务：补全一句话“只调增益很快会到边界，因为 ________。”
- 反馈规则：保存出口表达，不评分
- 答案揭示：无

### 埋点与教师数据
- 埋点摘要：`reflectionSubmitted`、`reflectionKeywords`、`timeOnStep`
- 教师聚合：`exit_keyword_cloud`、`boundary_understanding_tags`

### AI 边界
- 页面目标：把本课收束为一条可带走的判断链。
- 允许范围：读图、窗口、换算、验证、后续结构改变。
- 禁止范围：把 3-5 的零点内容提前写进本页主体。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/demo?step=step-14`
- 对齐要求：四列表、出口表达和去向卡必须同屏。
