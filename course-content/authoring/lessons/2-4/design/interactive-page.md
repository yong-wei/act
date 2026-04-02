━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
互动页面设计 | 单元 2-4：Nyquist 图与频域指标入口——把 Bode 图收束为轨迹、裕度与反向识别
技术栈：Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 文档职责
- 本文件是供人审阅的页面蓝图，只描述页面模板、固定内容、互动组件、数据采集与 AI 边界。
- 同目录 [interactive-contract.yaml](./interactive-contract.yaml) 是机读契约；两者必须逐步骤一一对应。
- 本文件不是讲义摘要，不写课堂口播，不给实现方留下“到时候再发挥”的结构空白。
- 页面默认预览口径固定为学生演示页，不以教师端模板弹窗替代真实页面。

## 表述规则
- 页面描述只保留客观结构：区域、模块、文本、公式、图片、表格、互动组件、反馈规则。
- 动作化表述禁用：`展示`、`引导`、`让学生`、`先做一次`、`教师讲`、`跟着算` 等。
- 静态内容优先。互动组件只负责预测、验证、对照与迁移，不能替代核心公式、图表、例题与结论。
- 本课页面主线固定为“同一个 $G(j\omega)$ 的双图表达 + 纯极点系统 Nyquist 读图 + 频域指标第一入口 + 手工绘图入口 + 最小反向识别”，不提前进入 Nyquist 判据、Bode 判稳、闭环结论或频域校正设计。

## 全课总览
| 步骤 | 标题 | 页面模板 | 主体布局 | 互动组件 | 学生页预览 |
|------|------|----------|----------|----------|------------|
| step-01 | 回到地图——从 Bode 骨架走向图形对象 | `map_hero_slide` | 路径图 + 今日任务卡 | `none` | `/interactive-learning/courses/unit-2-4-nyquist-margin-entry/student/demo?step=step-01` |
| step-02 | 情境引入——为什么同一条频率特性还要换一张图 | `dual_view_question_slide` | 双图主视觉 + 两问清单 + 二选一判断 | `binary_choice` | `/interactive-learning/courses/unit-2-4-nyquist-margin-entry/student/demo?step=step-02` |
| step-03 | 学习目标与边界——本课负责什么、不负责什么 | `goal_boundary_slide` | 目标卡 + 边界表 | `none` | `/interactive-learning/courses/unit-2-4-nyquist-margin-entry/student/demo?step=step-03` |
| step-04 | 前测——起点、对象与指标三类误区 | `question_stack` | 三题纵向堆叠 + 提交反馈条 | `quiz_group` | `/interactive-learning/courses/unit-2-4-nyquist-margin-entry/student/demo?step=step-04` |
| step-05 | 同一个 $G(j\omega)$：Bode 拆开看，Nyquist 合起来看 | `formula_media_compare` | 公式卡 + 双图对照图 + 三列表 | `triple_match` | `/interactive-learning/courses/unit-2-4-nyquist-margin-entry/student/demo?step=step-05` |
| step-06 | Nyquist 四步读法——起点、终点、方向、总转角 | `workflow_card_with_reason_check` | 四步流程卡 + 问题表 + 判断区 | `reason_check` | `/interactive-learning/courses/unit-2-4-nyquist-margin-entry/student/demo?step=step-06` |
| step-07 | 一阶惯性轨迹——从正实轴出发，向下收敛至原点 | `courseware_top_slider_bottom` | 对象公式卡 + 轨迹图 + 读图工作区 | `parameter_slider` | `/interactive-learning/courses/unit-2-4-nyquist-margin-entry/student/demo?step=step-07` |
| step-08 | 纯极点系统比较——极点越多，轨迹通常转得更深 | `comparison_panel_with_sort` | 比较图 + 对照表 + 排序区 | `card_sort` | `/interactive-learning/courses/unit-2-4-nyquist-margin-entry/student/demo?step=step-08` |
| step-09 | 频域指标入口——$\omega_c$、$\omega_g$、$\gamma$、$K_g$、$\omega_b$ | `formula_table_match` | 定义公式卡 + 指标表 + 对应区 | `triple_match` | `/interactive-learning/courses/unit-2-4-nyquist-margin-entry/student/demo?step=step-09` |
| step-10 | 双图对照——同一指标在 Bode 和 Nyquist 上怎样找 | `dual_graph_indicator_locator` | 双图对照表 + 指标定位卡 + 连线区 | `hotspot_labeling` | `/interactive-learning/courses/unit-2-4-nyquist-margin-entry/student/demo?step=step-10` |
| step-11 | 手工绘图入口一——Bode 基线、折点与斜率 | `sketch_workflow_workspace` | 流程卡 + 检查单 + 骨架工作区 | `workspace_builder` | `/interactive-learning/courses/unit-2-4-nyquist-margin-entry/student/demo?step=step-11` |
| step-12 | 手工绘图入口二——Nyquist 端点、过轴点与渐近线 | `workflow_graph_workspace` | 检查单 + 关键点规则卡 + 标注区 | `path_highlight` | `/interactive-learning/courses/unit-2-4-nyquist-margin-entry/student/demo?step=step-12` |
| step-13 | 例题一——含积分环节对象从 Bode 基线到 Nyquist 轨迹 | `worked_example_workspace` | 题面卡 + 双步骤链 + 中间量面板 | `worked_example_workspace` | `/interactive-learning/courses/unit-2-4-nyquist-margin-entry/student/demo?step=step-13` |
| step-14 | 例题二——读取频域指标，暂不作闭环结论 | `worked_example_metric_panel` | 题面卡 + 定义锚点 + 指标结果栏 | `metric_overlay` | `/interactive-learning/courses/unit-2-4-nyquist-margin-entry/student/demo?step=step-14` |
| step-15 | 基础反向识别——先认对象轮廓，再估参数量级 | `compare_then_ai` | 特征图 + 线索表 + AI 对照区 | `ai_compare_workspace` | `/interactive-learning/courses/unit-2-4-nyquist-margin-entry/student/demo?step=step-15` |
| step-16 | 后测——图会看，更要会守边界 | `post_quiz_stack` | 两题客观题 + 一题解释题 | `quiz_group` | `/interactive-learning/courses/unit-2-4-nyquist-margin-entry/student/demo?step=step-16` |
| step-17 | 总结与后续预告——从图形对象走向结构机理 | `summary_infographic` | 五条结论 + 速查卡 + 去向卡 | `none` | `/interactive-learning/courses/unit-2-4-nyquist-margin-entry/student/demo?step=step-17` |

## 讲义核心内容映射
| handout_anchor | core_item_type | must_appear_content | target_step | page_mode | interaction_upgrade | media_or_table_ref | acceptance_note |
|---|---|---|---|---|---|---|---|
| `## 一、引入：为什么已有 Bode 图，还需要 Nyquist 图` | concept+media | 同一条频率特性既可拆成幅频/相频，也可合成为复平面轨迹；页面必须保留“为什么还要换一张图”的问题意识。 | `step-02` | `static+choice` | 二选一判断只负责暴露“Nyquist 不是新对象，而是新图形语言”的起点误区。 | `2-4-fd-08-bode-nyquist-consistency-panel.svg` | 双图主视觉和两问清单必须先落页，再开放判断。 |
| `## 二、明确本课程的学习边界` | boundary+table | 本课负责 Nyquist 入口、频域指标读取、基础反向识别；不负责 Nyquist 判据、Bode 判稳、闭环结论和频域校正设计。 | `step-03` | `static` | 无互动，仅保留“本课负责 / 本课不负责”边界表。 | `step-03 boundary table` | 边界表必须完整可见，不能缩成教师备注。 |
| `### 3.1 定义：它与 Bode 图观察的是同一对象` | concept+formula | 页面必须完整保留频率特性的极坐标表达、直角坐标表达，以及“Bode 拆开看 / Nyquist 合起来看”的对照。 | `step-05` | `static+match` | 三列表配对只强化同一对象、两种图形语言、不同问题类型之间的对应。 | `2-4-fd-08-bode-nyquist-consistency-panel.svg` | 两条公式和对照表必须先于互动组件出现。 |
| `### 3.2 首次阅读 Nyquist 图：固定四个观察步骤` | workflow+method | 固定四步为“起点、终点、方向、总转角”，并说明四步分别对应低频、高频、相位趋势与累计拖后。 | `step-06` | `static+check` | 判断区只检查“四步该先看什么”，不替代流程卡。 | `step-06 workflow cards` | 四步流程卡必须完整可读。 |
| `### 4.1 一阶惯性环节：从正实轴出发，向下收敛至原点` | concept+formula | `$$G(s)=\\frac{1}{Ts+1}$$`，`$$G(j\\omega)=\\frac{1}{1+j\\omega T}=\\frac{1-j\\omega T}{1+(\\omega T)^2}$$`，以及“起点在正实轴单位附近，终点收向原点，轨迹向下弯曲”的结论。 | `step-07` | `static+workspace` | 滑块工作区只负责观察 $T$ 变化如何影响轨迹形态。 | `2-4-fd-05-first-order-nyquist-track.svg` | 公式卡、轨迹图和三条读图结论必须同屏。 |
| `### 4.2 极点越多，轨迹通常旋转越深 / ### 4.3 从 Bode 图反向验证 Nyquist 图：两者应能相互印证` | comparison+table | 纯极点系统轨迹比较表，以及“Bode 图上的低频通过 / 高频衰减 / 相位拖后必须和 Nyquist 轨迹相互印证”的结论。 | `step-08` | `static+sort` | 排序区只强化“谁转得更深、为什么”这一对象比较。 | `2-4-fd-06-pure-pole-nyquist-comparison.svg` | 比较图与三类对象对照表必须静态可见。 |
| `### 5.1 为何需要"指标" / ### 5.2 四个开环指标与一个闭环带宽入口` | concept+formula | 页面必须完整保留截止频率、穿越频率、相位裕度、增益裕度和带宽频率的定义公式，并说明这些量在本课只服务定义、读图和基础计算。 | `step-09` | `static+match` | 对应区只强化“指标名称 / 图上定义 / 回答的问题”之间的对应。 | `step-09 indicator matrix` | 五个公式必须完整落页。 |
| `### 5.3 同一指标在 Nyquist 图上的几何意义` | dual-graph+table | 截止频率、穿越频率、相位裕度和增益裕度在 Bode 与 Nyquist 两张图上的对应读取方式。 | `step-10` | `static+locator` | 热点定位只负责把“单位圆 / 负实轴 / 危险方向 / (-1,0)”与指标名称连起来。 | `2-4-fd-08-bode-nyquist-consistency-panel.svg` | 双图对照表必须先出现，不能只剩图上点选。 |
| `### 6.1 本课程的"手工绘图"涵盖范围 / ### 6.2 Bode 图绘图顺序：先定基线，再逐段调整斜率` | workflow+method | 本课只保留“简单组合对象 + 双图一致性”范围；含积分环节时先用 `$$L(\\omega)=20\\log_{10}K-20r\\log_{10}\\omega$$` 定基线，再排折点、改斜率。 | `step-11` | `static+workspace` | 工作区只检查基线、折点与斜率方向，不扩成自由作图器。 | `2-4-fd-09-bode-sketch-checklist.png` | 检查单与课堂口令必须同屏。 |
| `### 6.3 Nyquist 图绘图顺序：先画正频率支，再标注关键点与渐近线 / ### 8.2 例题二：含积分环节时 Nyquist 图的渐近线与关键点` | workflow+formula | 先正频率支，再看端点、过轴点和渐近线；过实轴解 `$$\\operatorname{Im}\\{G(j\\omega)\\}=0$$`，过虚轴解 `$$\\operatorname{Re}\\{G(j\\omega)\\}=0$$`。 | `step-12` | `static+highlight` | 路径高亮只负责点亮“端点 / 过轴点 / 渐近线 / 方向”四类锚点。 | `2-4-fd-10-nyquist-sketch-checklist.png` | 两条求交规则必须显式写在静态区。 |
| `### 8.1 例题一：含积分环节的 Bode 图基准线绘制与骨架构建` | worked-example+formula | 含积分环节对象的例题必须完整保留题面、基线公式、转折频率和“三步法”工作链。 | `step-13` | `static+workspace` | 工作区只辅助填写基线、转折频率与相位趋势。 | `2-4-fd-09-bode-sketch-checklist.png` | 题面、三步法和结果摘要必须同页可见。 |
| `### 8.3 例题三：读取频域指标，暂不作闭环结论` | worked-example+formula | 频域指标例题必须完整保留题面、五个指标数值结果和“只到入口、不作判稳”的边界提醒。 | `step-14` | `static+workspace` | 指标叠加区只用于锚定定义来源，不直接下闭环结论。 | `2-4-fd-08-bode-nyquist-consistency-panel.svg / 2-4-fd-11-margin-entry.m` | 数值结果和“只到入口、不作判稳”提醒必须同时出现。 |
| `### 8.4 例题四：基础 Bode 图的最小化反向识别` | worked-example+ai | 低频平直、约 `+6 dB`、在 `\\omega \\approx 2\\ \\text{rad/s}` 左右转折、无显著峰起，对应 `$$G(s)\\approx \\frac{K}{Ts+1}$$`，并估 `$$K \\approx 2,\\ T \\approx 0.5\\ \\text{s}$$`。 | `step-15` | `static+ai` | AI 只核对“对象轮廓 + 参数量级”线索链，不代做完整辨识。 | `2-4-fd-03-typical-elements-bode-comparison.svg / 2-4-fd-07-second-order-damping-bode.svg` | 特征图、线索表和 AI 边界必须同屏。 |
| `## 九、工程视角：为何工程师需要同时掌握两种图形方法 / ## 十、本节内容总结与课程衔接` | summary | 同时掌握 Bode 与 Nyquist 是为了把“会看一个点”升级为“会读一个系统”；页面必须收束到模块2图形对象出口和模块3结构机理入口。 | `step-17` | `static` | 无互动，保留五条结论、速查卡和 `3-1` 去向卡。 | `2-4-info.png` | 结尾必须能独立复习，不依赖教师口头补充。 |

## 步骤 01｜回到地图——从 Bode 骨架走向图形对象

### 页面骨架
- 模板：`map_hero_slide`
- 区域：`header` / `lead` / `summary`

### 模块清单
- `stage-map`：模块 2 路径图
- `today-task`：本课任务卡

### 静态承载内容
- 路径图固定高亮 `2-3 -> 2-4 -> 3-1`。
- 任务卡固定写明：`2-3` 解决频域对象第一次可见，`2-4` 解决图形对象怎样被读、被比、被反看。
- 本页关键词固定为：双图表达、频域指标、图形对象出口。

### 互动升级点
- 组件类型：`none`
- 提交态：无
- 答案揭示：无

### 埋点与教师数据
- 埋点摘要：`viewed`、`timeOnStep`、`teacherFollowSync`
- 教师聚合：`view_count`、`sync_status`

### AI 边界
- 页面目标：标定本课位于模块 2 的出口位置。
- 允许范围：课程路径、`2-3 -> 2-4 -> 3-1` 的衔接。
- 禁止范围：提前展开公式、例题或判据。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-4-nyquist-margin-entry/student/demo?step=step-01`
- 对齐要求：首屏直接出现路径图与任务卡，无作答区占位。

## 步骤 02｜情境引入——为什么同一条频率特性还要换一张图

### 页面骨架
- 模板：`dual_view_question_slide`
- 区域：`media` / `questions` / `interaction`

### 模块清单
- `dual-view-media`：双图主视觉
- `core-questions`：两问清单
- `binary-vote`：二选一判断区

### 静态承载内容
- 主图固定使用 `2-4-fd-08-bode-nyquist-consistency-panel.svg`。
- 两问固定为：为什么已有 Bode 图，还要再画 Nyquist 图？两张图是不是在讲两套不同对象？
- 结论卡固定写明：Nyquist 不是新对象，而是同一频率特性的另一种图形语言。

### 互动升级点
- 组件类型：`binary_choice`
- 选项结构：
  - A：Nyquist 图是在 Bode 图之外额外引入的新系统对象
  - B：Nyquist 图与 Bode 图观察的是同一个 $G(j\omega)$
- 正确项：`B`
- 错误反馈：只提示“同一个对象，不同图形语言”。
- 答案揭示：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`selectedOption`、`resultState`、`teacherRevealSeen`
- 教师聚合：`option_distribution`、`misconception_rate`

### AI 边界
- 页面目标：修正“Nyquist 是新对象”的起点误区。
- 允许范围：双图表达、同一对象、问题类型切换。
- 禁止范围：提前展开判据或裕度。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-4-nyquist-margin-entry/student/demo?step=step-02`
- 对齐要求：双图主视觉与两问清单必须先于判断按钮出现。

## 步骤 03｜学习目标与边界——本课负责什么、不负责什么

### 页面骨架
- 模板：`goal_boundary_slide`
- 区域：`goals` / `boundary`

### 模块清单
- `goal-cards`：四项目标卡
- `boundary-table`：负责 / 不负责边界表

### 静态承载内容
- 四项目标卡固定对应：会解释双图表达、会按四步读纯极点 Nyquist、会读频域指标、会做最小反向识别。
- 边界表固定写明：
  - 本课负责：Nyquist 入口、频域指标读取、手工绘图入口、基础反向识别。
  - 本课不负责：Nyquist 判据、Bode 判稳、闭环结论、频域校正设计。

### 互动升级点
- 组件类型：`none`
- 页面不设置作答区，边界表承担全量静态表达。

### 埋点与教师数据
- 埋点摘要：`viewed`、`timeOnStep`
- 教师聚合：`view_count`

### AI 边界
- 页面目标：建立明确的课程边界。
- 允许范围：目标卡、边界表、模块2出口定位。
- 禁止范围：把任一边界偷换成后续模块内容。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-4-nyquist-margin-entry/student/demo?step=step-03`
- 对齐要求：目标卡与边界表必须同屏，不折叠为摘要。

## 步骤 04｜前测——起点、对象与指标三类误区

### 页面骨架
- 模板：`question_stack`
- 区域：`question-stack` / `submit-bar`

### 模块清单
- `pretest-q1`：双图对象判断题
- `pretest-q2`：Nyquist 起点判断题
- `pretest-q3`：指标边界判断题

### 静态承载内容
- 三道题干全部明文落页。
- 误区提示固定列出：Nyquist 不是新对象、起点与低频信息相连、裕度不等于本节就能下闭环结论。

### 互动升级点
- 组件类型：`quiz_group`
- 题目数量：3
- 作答模型：允许重提一次；教师端区分首答与重提。
- 答案揭示：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`attemptCount`、`resultState`、`errorBucket`
- 教师聚合：`question_distribution`、`top_misconceptions`

### AI 边界
- 页面目标：暴露起点误区，不拉开成绩差距。
- 允许范围：错因归类、术语纠偏。
- 禁止范围：代替作答或提前讲完整结论。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-4-nyquist-margin-entry/student/demo?step=step-04`
- 对齐要求：三题在未作答状态下全部可见。

## 步骤 05｜同一个 $G(j\omega)$：Bode 拆开看，Nyquist 合起来看

### 页面骨架
- 模板：`formula_media_compare`
- 区域：`formula` / `media` / `interaction`

### 模块清单
- `polar-formula-card`：极坐标形式公式卡
- `cartesian-formula-card`：直角坐标形式公式卡
- `consistency-panel`：双图一致性对照图
- `triple-match`：三列表对应区

### 静态承载内容
- 公式卡必须完整出现：

$$
G(j\omega)=|G(j\omega)|e^{j\phi(\omega)}
$$

$$
G(j\omega)=\operatorname{Re}\{G(j\omega)\}+j\operatorname{Im}\{G(j\omega)\}
$$

- 三列表固定为：图形语言 / 主要观察对象 / 更适合回答的问题。
- 主图固定使用 `2-4-fd-08-bode-nyquist-consistency-panel.svg`。

### 互动升级点
- 组件类型：`triple_match`
- 任务：把 `Bode`、`Nyquist`、`同一频率特性` 与其职责对应起来。
- 反馈规则：即时标对错，可重试。

### 埋点与教师数据
- 埋点摘要：`matchAttempted`、`matchCorrected`、`timeOnStep`
- 教师聚合：`common_mismatch_pairs`、`completion_rate`

### AI 边界
- 页面目标：把“同一对象，两种图形表达”立住。
- 允许范围：双图职责、幅值与相位、复平面轨迹。
- 禁止范围：Nyquist 判据、判稳或设计语言。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-4-nyquist-margin-entry/student/demo?step=step-05`
- 对齐要求：两条公式与对照图必须先于配对区出现。

## 步骤 06｜Nyquist 四步读法——起点、终点、方向、总转角

### 页面骨架
- 模板：`workflow_card_with_reason_check`
- 区域：`workflow` / `meaning` / `interaction`

### 模块清单
- `four-step-workflow`：四步流程卡
- `question-matrix`：观察步骤问题表
- `reason-check`：顺序判断区

### 静态承载内容
- 四步流程卡固定为：起点、终点、方向、总转角。
- 问题表固定写明：
  - 起点对应低频如何通过；
  - 终点对应高频极限；
  - 方向对应相位趋势；
  - 总转角对应累计拖后。

### 互动升级点
- 组件类型：`reason_check`
- 任务：判断“应该先看哪一步，哪一步不能跳过”。
- 反馈规则：只回显四步顺序和对应问题，不补新知识。
- 答案揭示：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`selectionState`、`resultState`、`teacherRevealSeen`
- 教师聚合：`confusion_matrix`、`correction_rate`

### AI 边界
- 页面目标：建立固定读图顺序。
- 允许范围：四步法与对应问题。
- 禁止范围：把四步法扩成稳定判据。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-4-nyquist-margin-entry/student/demo?step=step-06`
- 对齐要求：流程卡与问题表必须同屏，互动区不可替代流程卡。

## 步骤 07｜一阶惯性轨迹——从正实轴出发，向下收敛至原点

### 页面骨架
- 模板：`courseware_top_slider_bottom`
- 区域：`formula-card` / `media` / `workspace`

### 模块清单
- `first-order-formulas`：对象与频率特性公式卡
- `nyquist-track-figure`：一阶惯性 Nyquist 轨迹图
- `parameter-slider`：参数观察工作区

### 静态承载内容
- 公式卡必须完整出现：

$$
G(s)=\frac{1}{Ts+1}
$$

$$
G(j\omega)=\frac{1}{1+j\omega T}=\frac{1-j\omega T}{1+(\omega T)^2}
$$

- 结论卡固定写明：
  - $\omega \to 0$ 时起点在正实轴单位附近；
  - $\omega \to \infty$ 时终点收向原点；
  - 相位持续拖后，所以轨迹向下弯曲。
- 主图固定使用 `2-4-fd-05-first-order-nyquist-track.svg`。

### 互动升级点
- 组件类型：`parameter_slider`
- 参数：`T`
- 反馈规则：联动刷新轨迹标签与“起点 / 终点 / 方向”提示。
- 答案揭示：无标准答案，仅记录观察状态。

### 埋点与教师数据
- 埋点摘要：`sliderChanged`、`stateSnapshot`、`timeOnStep`
- 教师聚合：`parameter_distribution`、`final_shape_tags`

### AI 边界
- 页面目标：把一阶惯性轨迹与 Bode 直觉绑在一起。
- 允许范围：低频通过、高频衰减、相位拖后。
- 禁止范围：判稳结论、零点系统讨论。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-4-nyquist-margin-entry/student/demo?step=step-07`
- 对齐要求：公式卡、轨迹图和工作区必须同屏，工作区不能替代公式卡。

## 步骤 08｜纯极点系统比较——极点越多，轨迹通常转得更深

### 页面骨架
- 模板：`comparison_panel_with_sort`
- 区域：`media` / `table` / `interaction`

### 模块清单
- `pure-pole-comparison`：纯极点系统比较图
- `comparison-table`：对象类型对照表
- `card-sorter`：对象排序区

### 静态承载内容
- 主图固定使用 `2-4-fd-06-pure-pole-nyquist-comparison.svg`。
- 对照表固定包含：一阶惯性、积分环节、两个实极点对象的起点 / 高频极限 / 总体趋势。
- 页面必须写明：极点越多，累计拖后越大，轨迹通常也转得更深；两张图必须彼此印证。

### 互动升级点
- 组件类型：`card_sort`
- 任务：按“谁转得更深 / 谁沿负虚轴 / 谁仍从正实轴出发”完成排序或分组。
- 反馈规则：即时标记错位，可重试。

### 埋点与教师数据
- 埋点摘要：`sortAttempted`、`sortCorrected`、`timeOnStep`
- 教师聚合：`common_sort_errors`、`misconception_rate`

### AI 边界
- 页面目标：建立纯极点对象之间的比较语言。
- 允许范围：起点、终点、方向、累计拖后。
- 禁止范围：Nyquist 判据、零点线分析。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-4-nyquist-margin-entry/student/demo?step=step-08`
- 对齐要求：比较图与对象表必须先于排序区出现。

## 步骤 09｜频域指标入口——$\omega_c$、$\omega_g$、$\gamma$、$K_g$、$\omega_b$

### 页面骨架
- 模板：`formula_table_match`
- 区域：`formula-strip` / `definition-matrix` / `interaction`

### 模块清单
- `indicator-formulas`：指标公式卡组
- `indicator-matrix`：指标定义表
- `triple-match`：定义对应区

### 静态承载内容
- 公式卡必须完整出现：

$$
|G(j\omega_c)|=1,\qquad \angle G(j\omega_g)=-180^\circ
$$

$$
\gamma = 180^\circ + \angle G(j\omega_c),\qquad
K_g = \frac{1}{|G(j\omega_g)|}
$$

$$
|T(j\omega_b)|=\frac{|T(0)|}{\sqrt{2}}
$$

- 指标表固定列出：名称、图上如何查找、这节课只做到什么程度。
- 页面必须写明：本课先把它们看成“离边界还有多远”的第一语言。

### 互动升级点
- 组件类型：`triple_match`
- 任务：把指标名称、定义锚点和回答的问题对应起来。
- 反馈规则：即时标对错，可重试。

### 埋点与教师数据
- 埋点摘要：`matchAttempted`、`matchCorrected`、`timeOnStep`
- 教师聚合：`common_mismatch_pairs`、`completion_rate`

### AI 边界
- 页面目标：把五个指标先作为“定义 + 读图锚点”建立起来。
- 允许范围：定义、读图、基础计算。
- 禁止范围：从裕度直接推出闭环稳定性结论。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-4-nyquist-margin-entry/student/demo?step=step-09`
- 对齐要求：五个公式与指标表必须在未交互状态下完整可见。

## 步骤 10｜双图对照——同一指标在 Bode 和 Nyquist 上怎样找

### 页面骨架
- 模板：`dual_graph_indicator_locator`
- 区域：`table` / `media` / `interaction`

### 模块清单
- `dual-graph-table`：双图对照表
- `consistency-panel`：双图一致性主图
- `hotspot-labeling`：图上定位区

### 静态承载内容
- 对照表固定写明：
  - $\omega_c$：Bode 图过 `0 dB`，Nyquist 图落在单位圆上；
  - $\omega_g$：Bode 图相位到 $-180^\circ$，Nyquist 图落在负实轴上；
  - $\gamma$：Bode 图看离 $-180^\circ$ 还差多少，Nyquist 图看离危险方向还差多少转角；
  - $K_g$：Bode 图看离 `0 dB` 还差多少，Nyquist 图看离 $(-1,0)$ 还有多少半径余量。
- 主图固定使用 `2-4-fd-08-bode-nyquist-consistency-panel.svg`。

### 互动升级点
- 组件类型：`hotspot_labeling`
- 任务：把单位圆、负实轴、危险方向与指标名称连起来。
- 反馈规则：只提示漏标区域，不补新概念。

### 埋点与教师数据
- 埋点摘要：`hotspotPlaced`、`resultState`、`timeOnStep`
- 教师聚合：`hotspot_error_heatmap`、`completion_rate`

### AI 边界
- 页面目标：把同一指标在双图中的对应关系钉牢。
- 允许范围：单位圆、负实轴、危险方向、$(-1,0)$。
- 禁止范围：把图上余量直接升级成判据。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-4-nyquist-margin-entry/student/demo?step=step-10`
- 对齐要求：双图对照表必须先出现，图上定位区位于其下方。

## 步骤 11｜手工绘图入口一——Bode 基线、折点与斜率

### 页面骨架
- 模板：`sketch_workflow_workspace`
- 区域：`workflow` / `media` / `workspace`

### 模块清单
- `workflow-cards`：Bode 绘图流程卡
- `checklist-media`：Bode 检查单
- `builder-workspace`：骨架搭建区

### 静态承载内容
- 课堂口令固定写明：先定基线、再排折点、后改斜率。
- 公式卡必须写明：

$$
L(\omega)=20\log_{10}K-20r\log_{10}\omega
$$

- 页面必须说明：本课只做到简单组合对象首轮骨架，不追求精细修正。
- 主图固定使用 `2-4-fd-09-bode-sketch-checklist.png`。

### 互动升级点
- 组件类型：`workspace_builder`
- 任务：在工作区放置基线、折点与斜率变化标记。
- 反馈规则：只检查基线是否正确、折点是否漏、斜率方向是否反。
- 答案揭示：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`checkpointSaved`、`errorBucket`、`teacherRevealSeen`
- 教师聚合：`missing_break_frequency_rate`、`baseline_error_rate`

### AI 边界
- 页面目标：让学生知道第一笔该从哪里下。
- 允许范围：基线、折点、斜率方向、积分环节。
- 禁止范围：AI 直接生成最终答案图。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-4-nyquist-margin-entry/student/demo?step=step-11`
- 对齐要求：流程卡、检查单和工作区必须同屏。

## 步骤 12｜手工绘图入口二——Nyquist 端点、过轴点与渐近线

### 页面骨架
- 模板：`workflow_graph_workspace`
- 区域：`workflow` / `rules` / `interaction`

### 模块清单
- `nyquist-checklist`：Nyquist 检查单
- `key-point-rules`：关键点规则卡
- `path-highlighter`：路径锚点标注区

### 静态承载内容
- 页面必须完整出现两条规则：

$$
\operatorname{Im}\{G(j\omega)\}=0
$$

$$
\operatorname{Re}\{G(j\omega)\}=0
$$

- 规则卡固定写明：过实轴解虚部为零，过虚轴解实部为零；若有积分环节，先判渐近线。
- 主图固定使用 `2-4-fd-10-nyquist-sketch-checklist.png`。

### 互动升级点
- 组件类型：`path_highlight`
- 任务：按顺序高亮端点、过轴点、渐近线和方向箭头。
- 反馈规则：只提示漏掉哪类锚点，不代算频率值。

### 埋点与教师数据
- 埋点摘要：`highlightVisited`、`resultState`、`timeOnStep`
- 教师聚合：`rule_focus_heatmap`、`common_missed_anchor`

### AI 边界
- 页面目标：让学生先按规则找关键点，再谈连轨迹。
- 允许范围：端点、过轴点、渐近线、方向。
- 禁止范围：把连轨迹做成凭感觉的自由绘图。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-4-nyquist-margin-entry/student/demo?step=step-12`
- 对齐要求：检查单和规则卡必须先于标注区出现。

## 步骤 13｜例题一——含积分环节对象从 Bode 基线到 Nyquist 轨迹

### 页面骨架
- 模板：`worked_example_workspace`
- 区域：`problem` / `method` / `workspace` / `result`

### 模块清单
- `example-problem-card`：题面卡
- `three-step-method`：三步法卡
- `calculation-workspace`：中间量工作区
- `result-summary-card`：结果摘要卡

### 静态承载内容
- 题面卡必须完整出现：

$$
G_1(s)=\frac{5}{s(0.5s+1)}
$$

- 基线公式固定写为 $L(\omega)=20\log_{10}5-20\log_{10}\omega$。
- 转折频率固定写为 $\omega_p=2\text{rad/s}$。
- 三步法固定为：
  1. 用 $K/s$ 定基线；
  2. 找转折频率 $\omega_p=2\text{rad/s}$ 并改斜率；
  3. 再把低频端、高频端和方向翻译成 Nyquist 轨迹语言。
- 结果摘要卡固定写明：含积分环节时，Bode 第一笔不是水平线；Nyquist 也不能跳过端点与渐近线判断。

### 互动升级点
- 组件类型：`worked_example_workspace`
- 任务：逐格填写基线值、转折频率和轨迹锚点。
- 反馈规则：支持按步骤揭示，不直接跳最终图。

### 埋点与教师数据
- 埋点摘要：`stepCompletion`、`errorBucket`、`timeOnStep`
- 教师聚合：`stuck_step_distribution`

### AI 边界
- 页面目标：把“Bode 下笔顺序”和“Nyquist 关键点意识”串起来。
- 允许范围：中间量核对、步骤顺序、课堂口令复核。
- 禁止范围：直接代写完整解答。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-4-nyquist-margin-entry/student/demo?step=step-13`
- 对齐要求：题面、三步法和结果摘要必须同页可见。

## 步骤 14｜例题二——读取频域指标，暂不作闭环结论

### 页面骨架
- 模板：`worked_example_metric_panel`
- 区域：`problem` / `definition` / `workspace` / `result`

### 模块清单
- `metric-problem-card`：题面卡
- `definition-anchor-cards`：定义锚点卡
- `metric-overlay`：指标读取区
- `result-card`：数值与边界提醒卡

### 静态承载内容
- 题面卡必须完整出现：

$$
G_3(s)=\frac{4}{s(0.5s+1)(0.2s+1)}
$$

- 数值锚点固定写为：$\omega_c\approx2.35\text{rad/s}$、$\omega_g\approx3.16\text{rad/s}$、$\gamma\approx15.3^\circ$、$K_g\approx1.75$、$\omega_b\approx3.68\text{rad/s}$。
- 结果卡必须完整出现：

$$
\omega_c \approx 2.35\ \text{rad/s},\quad
\omega_g \approx 3.16\ \text{rad/s}
$$

$$
\gamma \approx 15.3^\circ,\quad
K_g \approx 1.75,\quad
\omega_b \approx 3.68\ \text{rad/s}
$$

- 页面必须写明：这些量在本课只服务“定义 + 读图 + 基础计算”，不直接升级成闭环结论。

### 互动升级点
- 组件类型：`metric_overlay`
- 任务：把各指标锚点叠加到对应图形位置。
- 反馈规则：只检查锚点是否放对，不新增判稳反馈。

### 埋点与教师数据
- 埋点摘要：`indicatorLocated`、`resultState`、`timeOnStep`
- 教师聚合：`indicator_error_rate`、`completion_rate`

### AI 边界
- 页面目标：让学生知道每个数值来自哪里。
- 允许范围：定义锚点、数值核对、边界提醒。
- 禁止范围：让 AI 直接给出“稳定 / 不稳定”等闭环判断。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-4-nyquist-margin-entry/student/demo?step=step-14`
- 对齐要求：题面、数值结果和边界提醒必须在未交互状态下可见。

## 步骤 15｜基础反向识别——先认对象轮廓，再估参数量级

### 页面骨架
- 模板：`compare_then_ai`
- 区域：`media` / `logic` / `ai-panel`

### 模块清单
- `feature-figure`：对象特征图
- `clue-table`：线索链对照表
- `ai-compare-workspace`：AI 对照区

### 静态承载内容
- 主图固定使用 `2-4-fd-03-typical-elements-bode-comparison.svg` 与 `2-4-fd-07-second-order-damping-bode.svg`。
- 线索表固定写明：
  - 低频平直且约 `+6 dB`；
  - 在 $\omega \approx 2\ \text{rad/s}$ 左右开始下降；
  - 相位逐步拖后；
  - 无显著峰起。
- 结论卡固定写明：

$$
G(s)\approx \frac{K}{Ts+1},\qquad
K \approx 2,\quad T \approx 0.5\ \text{s}
$$

- 页面必须写明：本课只做到对象轮廓与参数量级，不做完整系统辨识。

### 互动升级点
- 组件类型：`ai_compare_workspace`
- 任务：先写自己的判断，再与 AI 输出逐条对照。
- AI 提示词固定要求：只依据低频、高频、转折和峰起四条线索回答。
- 答案揭示：无统一标准答案卡，只保留线索链对照。

### 埋点与教师数据
- 埋点摘要：`selfAnswerSubmitted`、`aiUsed`、`compareCompleted`
- 教师聚合：`ai_usage_rate`、`common_reason_tags`

### AI 边界
- 页面目标：建立“先认轮廓，再估量级”的对象化判断。
- 允许范围：对象轮廓、低频、高频、转折、峰起、参数量级。
- 禁止范围：AI 直接输出完整辨识模型或越界到设计建议。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-4-nyquist-margin-entry/student/demo?step=step-15`
- 对齐要求：特征图、线索表和 AI 对照区必须同屏。

## 步骤 16｜后测——图会看，更要会守边界

### 页面骨架
- 模板：`post_quiz_stack`
- 区域：`question-stack` / `submit-bar`

### 模块清单
- `post-q1`：Nyquist 起点判断题
- `post-q2`：相位裕度计算题
- `post-q3`：课程边界解释题

### 静态承载内容
- 三道后测题全部明文落页。
- 题干固定覆盖：双图一致性、相位裕度数值、为何本课不能直接下闭环结论。

### 互动升级点
- 组件类型：`quiz_group`
- 题目数量：3
- 作答模型：客观题即时反馈，解释题保存文本后由教师揭示参考答案。
- 答案揭示：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`attemptCount`、`resultState`、`errorBucket`
- 教师聚合：`question_distribution`、`top_misconceptions`

### AI 边界
- 页面目标：检查学生是否既会读图，也会守住本课位阶。
- 允许范围：错因纠偏、术语复核。
- 禁止范围：让 AI 直接代答解释题。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-4-nyquist-margin-entry/student/demo?step=step-16`
- 对齐要求：三题在未作答状态下全部可见，解释题不可折叠。

## 步骤 17｜总结与后续预告——从图形对象走向结构机理

### 页面骨架
- 模板：`summary_infographic`
- 区域：`summary` / `bridge` / `resources`

### 模块清单
- `five-takeaways`：五条结论卡
- `next-course-card`：后续课程去向卡
- `quick-reference-entry`：速查表入口

### 静态承载内容
- 五条结论固定为：
  1. Bode 图与 Nyquist 图看的是同一个 $G(j\omega)$；
  2. Nyquist 图先按“起点、终点、方向、总转角”读；
  3. 频域指标本课只做到定义、读图和基础计算；
  4. 手工绘图入口重在下笔顺序与关键锚点，不重在技巧堆砌；
  5. 基础反向识别先认对象轮廓，再估参数量级。
- 去向卡固定连接 `3-1`，并写明：模块3将继续解释极点、零点与型别为何会让图这样变化。
- 速查表入口固定引用 `2-4-info.png`。

### 互动升级点
- 组件类型：`none`
- 页面仅承担结构化收束，不新增作答负担。

### 埋点与教师数据
- 埋点摘要：`viewed`、`timeOnStep`
- 教师聚合：`view_count`

### AI 边界
- 页面目标：把本课收束成可复习的结构化提要。
- 允许范围：结论复核、课程衔接。
- 禁止范围：在总结页新增判据或设计内容。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-4-nyquist-margin-entry/student/demo?step=step-17`
- 对齐要求：五条结论、速查卡和去向卡必须同屏。
