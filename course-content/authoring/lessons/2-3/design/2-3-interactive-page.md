━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
互动页面设计 | 单元 2-3：频率响应基础与 Bode 图初步
技术栈：Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 文档职责
- 本文件是供人审阅的页面蓝图，只描述页面模板、固定内容、互动组件、数据采集与 AI 边界。
- 同目录 [interactive-contract.yaml](./interactive-contract.yaml) 是机读契约；两者必须逐步骤一一对应。
- 本文件不是讲义摘要，不写课堂口播，不给实现方留下“到时候再发挥”的结构空白。
- 页面默认预览口径固定为学生演示页，不以教师端模板弹窗替代真实页面。

## 表述规则
- 页面描述只保留客观结构：区域、模块、文本、公式、图片、表格、互动组件、反馈规则。
- 动作化表述禁用：`展示`、`引导`、`让学生`、`先做一次`、`跟随推导`、`教师讲` 等。
- 静态内容优先。互动组件只负责预测、验证、对照与迁移，不能替代核心公式、图表、例题与结论。
- 本课页面主线固定为“频率分量思想 + 正弦稳态响应 + $G(j\omega)$ + Bode 首轮骨架”，不回退成傅里叶长推导页，也不越界成判据/裕度课。

## 全课总览
| 步骤 | 标题 | 页面模板 | 主体布局 | 互动组件 | 学生页预览 |
|------|------|----------|----------|----------|------------|
| step-01 | 回到地图——从时域对象走向频域对象 | `map_hero_slide` | 路径图 + 今日任务卡 | `none` | `/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/demo?step=step-01` |
| step-02 | 情境引入——系统为什么会挑节奏 | `binary_choice_illustration` | 场景图 + 二选一判断 | `binary_choice` | `/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/demo?step=step-02` |
| step-03 | 学习目标——这节课要建立哪套频域语言 | `goal_chain_slide` | 目标卡 + 主线链 | `none` | `/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/demo?step=step-03` |
| step-04 | 前测——低频、高频与正弦输入判断 | `question_stack` | 三题纵向堆叠 + 提交反馈条 | `quiz_group` | `/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/demo?step=step-04` |
| step-05 | 从时域问题走向频域问题 | `table_plus_prompt` | 对照表 + 过渡提示卡 + 短答栏 | `short_response` | `/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/demo?step=step-05` |
| step-06 | 方波、频率分量与重构直觉 | `media_plus_reconstruction_lab` | 谐波图 + 工作区 | `parameter_slider` | `/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/demo?step=step-06` |
| step-07 | 正弦输入为什么会导向同频输出 | `formula_walkthrough_with_check` | 公式卡 + 推导骨架 + 判断区 | `reason_check` | `/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/demo?step=step-07` |
| step-08 | 幅值变化与相位变化的物理意义 | `dual_wave_inspector` | 波形对照图 + 现象翻译表 | `tab_switch` | `/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/demo?step=step-08` |
| step-09 | 频率特性：$G(j\omega)$、幅频与相频 | `formula_table_match` | 三列表 + 定义卡 + 对应区 | `triple_match` | `/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/demo?step=step-09` |
| step-10 | 为什么可以令 $s=j\omega$ | `concept_bridge_card` | 复平面提示图 + 两句判断 | `single_choice` | `/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/demo?step=step-10` |
| step-11 | 为什么要画 Bode 图 | `axis_compare_slide` | 线性/对数坐标对照 + 分贝说明卡 | `highlight_toggle` | `/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/demo?step=step-11` |
| step-12 | 典型环节 Bode 第一判断 | `card_sort_with_reference` | 典型环节卡组 + 参考图 | `card_sort` | `/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/demo?step=step-12` |
| step-13 | 基础手绘骨架：标准型、转折频率与趋势 | `sketch_workflow_workspace` | 四步流程卡 + 骨架工作区 | `workspace_builder` | `/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/demo?step=step-13` |
| step-14 | 例题一——单一正弦输入下的稳态输出 | `worked_example_workspace` | 题面 + 四步解题链 + 结果卡 | `worked_example_workspace` | `/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/demo?step=step-14` |
| step-15 | 例题二——多频输入的重塑过程与 AI 对照 | `compare_then_ai` | 双频题面 + 分量重构区 + AI 对照区 | `ai_compare_workspace` | `/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/demo?step=step-15` |
| step-16 | 后测——对象会读，更要会画 | `post_quiz_stack` | 两道客观题 + 一道解释题 | `quiz_group` | `/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/demo?step=step-16` |
| step-17 | 总结与后续预告——走向 Nyquist 与频域指标 | `summary_infographic` | 五条结论 + 去向卡 + 速查表入口 | `none` | `/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/demo?step=step-17` |

## 讲义核心内容映射
| handout_anchor | core_item_type | must_appear_content | target_step | page_mode | interaction_upgrade | media_or_table_ref | acceptance_note |
|---|---|---|---|---|---|---|---|
| `## 一、引入：系统为何具有频率选择性` | concept+media | 低频命令与高频扰动对同一对象的不同效果，以及“系统并非对所有变化一视同仁”的结论。 | `step-02` | `static+choice` | 二选一判断只负责暴露“系统应对不同节奏有选择”的直觉。 | `2-3-fr-01-command-vs-disturbance.svg` | 场景图与结论句必须先落页，再开放判断组件。 |
| `### 2.1 从时域问题到频域问题的过渡` | concept+table | 时域分析与频域分析对照表，以及“时域描述整体，频域揭示规则”的主结论。 | `step-05` | `static+form` | 短答栏只补一句“为什么频域不是替代时域”。 | `表 1. 时域分析与频域分析对照` | 对照表必须完整出现，不能只保留提问。 |
| `### 2.2 为何需要基于傅里叶思想展开 / ### 2.6 频率分量重构：为何频域分析能解释阶跃响应` | concept+media | “复杂信号可分解为不同频率分量；系统分别响应；最后再重构”为本页固定主链。 | `step-06` | `static+workspace` | 滑块工作区只负责观察“谐波个数 / 高频衰减”如何改变重构波形。 | `2-3-fr-02-square-wave-harmonics.svg` | 主链三句话必须在工作区上方静态呈现。 |
| `### 2.3 正弦输入为何导出“同频输出”` | concept+formula | `$$r(t)=A\sin(\omega t)$$`，`$$c_{ss}(t)=A|G(j\omega)|\sin\bigl(\omega t+\angle G(j\omega)\bigr)$$`，并明确“频率不变、幅值改变、相位改变”。 | `step-07` | `static+check` | 判断区只检查“哪一项变、哪一项不变”。 | `step-07 formula cards` | 静态区必须完整给出两条公式和三条结论。 |
| `#### 2.3.1 典型物理解释示例` | concept+media | 将低频命令、高频扰动与“放大/衰减、提前/滞后”的工程语言对应起来。 | `step-08` | `static+workspace` | 波形切换只负责对照物理含义，不新增推导。 | `2-3-fr-03-sine-in-sine-out.svg` | 输入/输出波形、幅值差和相位差必须同屏可见。 |
| `### 2.4 频率特性、幅频特性与相频特性` | concept+formula | `$$G(j\omega)$$`，`$$M(\omega)=|G(j\omega)|$$`，`$$\varphi(\omega)=\angle G(j\omega)$$` 三项必须完整落页。 | `step-09` | `static+match` | 三列表配对只负责加深“对象/含义/回答问题”之间的对应关系。 | `step-09 definition matrix` | 先给定义卡，再开放配对组件。 |
| `### 2.5 从 $G(s)$ 到 $G(j\omega)$：为何允许 $s=j\omega$ 的替换` | concept+formula | `$$s=\sigma+j\omega$$`，并说明频域分析只把注意力放在正弦稳态响应对应的虚轴信息上。 | `step-10` | `static+choice` | 单选题只检查“是不是抛弃拉氏变量”这一误区。 | `step-10 bridge card` | 静态区必须写明“不是抛弃，而是限制到虚轴观察线”。 |
| `#### 2.4.2 为何采用 Bode 图表达频率特性` | concept+formula | `$$L(\omega)=20\log_{10}|G(j\omega)|$$`，以及对数坐标、分贝、乘法变加法的三条理由。 | `step-11` | `static+toggle` | 高亮切换只负责比较线性频率坐标和对数频率坐标。 | `2-3-fr-04-linear-vs-log-frequency.svg` | 三条理由与分贝公式必须先完整出现。 |
| `#### 2.4.1 典型例子：一阶惯性环节` | concept+formula | `$$G(s)=\frac{1}{Ts+1}$$`，`$$G(j\omega)=\frac{1}{1+j\omega T}$$`，以及低频/转折/高频三段判断。 | `step-12` | `static+sort` | 卡片分类只负责让学生按“易通过 / 易抑制 / 相位滞后”归类。 | `2-3-fr-05-bode-axes-and-typical-cards.svg` | 一阶惯性环节公式与三段语言必须在卡组上方静态呈现。 |
| `#### 2.4.3 典型环节的 Bode 初步判断与基础手绘骨架` | workflow+method | 四步法固定为“写标准型 -> 列转折频率 -> 判最低频段 -> 依次画趋势变化”。 | `step-13` | `static+workspace` | 工作区只允许完成首轮骨架，不扩成复杂组合对象作图器。 | `2-3-fr-06-bode-skeleton-workflow.svg` | 四步流程卡必须完整可读，工作区不能独占整页。 |
| `### 3.1 例题一：单一正弦输入下的稳态输出` | worked-example+formula | `$$G(s)=\frac{1}{0.5s+1}$$`，`$$r(t)=2\sin(4t)$$`，`$$c_{ss}(t)=0.894\sin(4t-63.4^\circ)$$`。 | `step-14` | `static+workspace` | 工作区只辅助填写中间量，不替代题面、步骤和结论卡。 | `step-14 worked example` | 题面、四步解题链和最终表达式必须同页可见。 |
| `### 3.2 例题二：多频输入的“重塑”过程 / ### 3.3 例题总结与方法归纳` | worked-example+method-summary | `$$G(s)=\frac{1}{s+1}$$`，`$$r(t)=\sin(0.2t)+0.5\sin(5t)$$`，以及“分量独立处理 -> 输出重构 -> 低频保留更明显”的方法链。 | `step-15` | `static+ai` | AI 只核验分量处理顺序和解释链，不直接代写结论。 | `2-3-fr-02-square-wave-harmonics.svg / step-15 ai compare` | 题面、方法链与 AI 对照边界必须同时写清。 |
| `### 5.1 核心结论整理 / ### 5.2 课程体系衔接` | summary | 五条必须带走的结论，以及与 `2-4`、`3-5`、`3-8` 的衔接语。 | `step-17` | `static` | 速查卡只负责结构化收束，不新增作答。 | `2-3-info.png` | 结尾必须能独立复习，不依赖教师口头补充。 |

## 步骤 01｜回到地图——从时域对象走向频域对象

### 页面骨架
- 模板：`map_hero_slide`
- 区域：`header` / `lead` / `summary`

### 模块清单
- `stage-map`：模块 2 路径图
- `today-task`：本课任务卡

### 静态承载内容
- 路径图固定高亮 `2-2 -> 2-3 -> 2-4`。
- 任务卡固定写明：`2-2` 解决对象在时间里怎么动，`2-3` 解决对象对不同频率怎么响应，`2-4` 才推进到 Nyquist 与频域指标。
- 本页关键词固定为：频率分量、正弦稳态响应、Bode 图入口。

### 互动升级点
- 组件类型：`none`
- 提交态：无
- 答案揭示：无

### 埋点与教师数据
- 埋点摘要：`viewed`、`timeOnStep`、`teacherFollowSync`
- 教师聚合：`view_count`、`sync_status`

### AI 边界
- 页面目标：标定本课在模块 2 中的位置。
- 允许范围：课程路径、时域语言到频域语言的切换。
- 禁止范围：提前展开公式、例题、判据或裕度。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/demo?step=step-01`
- 对齐要求：首屏直接出现路径图与任务卡，无作答区占位。

## 步骤 02｜情境引入——系统为什么会挑节奏

### 页面骨架
- 模板：`binary_choice_illustration`
- 区域：`media` / `questions` / `interaction`

### 模块清单
- `command-disturbance-media`：低频命令与高频扰动对照图
- `core-questions`：两问清单
- `binary-vote`：二选一判断区

### 静态承载内容
- 主图固定使用 `2-3-fr-01-command-vs-disturbance.svg`。
- 两问固定为：哪种节奏更容易通过？为什么系统不应追每一次抖动？
- 结论卡固定写明：系统并非对所有变化一视同仁，而是对不同频率成分具有选择性。

### 互动升级点
- 组件类型：`binary_choice`
- 选项结构：
  - A：系统应对所有变化都同样敏感
  - B：系统应对不同节奏有选择
- 正确项：`B`
- 错误反馈：只提示“频率选择性是本课真正入口”
- 答案揭示：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`selectedOption`、`resultState`、`teacherRevealSeen`
- 教师聚合：`option_distribution`、`misconception_rate`

### AI 边界
- 页面目标：建立“低频命令 / 高频扰动”分流直觉。
- 允许范围：跟随、抑制、节奏、选择性。
- 禁止范围：提前引入频率特性公式。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/demo?step=step-02`
- 对齐要求：场景图、问题清单和判断按钮在未作答状态下同时可见。

## 步骤 03｜学习目标——这节课要建立哪套频域语言

### 页面骨架
- 模板：`goal_chain_slide`
- 区域：`goals` / `chain`

### 模块清单
- `goal-cards`：三项目标卡
- `method-chain`：本课主链图

### 静态承载内容
- 三张目标卡固定对应：会拆频率成分、会读单频响应、会画 Bode 首轮骨架。
- 主链固定为：`阶跃/方波 -> 频率分量 -> 正弦响应 -> G(j\omega) -> Bode 骨架`。
- 本页不承载新公式，只建立全课预期。

### 互动升级点
- 组件类型：`none`

### 埋点与教师数据
- 埋点摘要：`viewed`、`timeOnStep`
- 教师聚合：`view_count`

### AI 边界
- 页面目标：明确本课能力边界。
- 允许范围：目标卡与主线链。
- 禁止范围：代替后续步骤提前解释公式。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/demo?step=step-03`
- 对齐要求：目标卡和主线链必须同屏，不折叠为摘要。

## 步骤 04｜前测——低频、高频与正弦输入判断

### 页面骨架
- 模板：`question_stack`
- 区域：`question-stack` / `submit-bar`

### 模块清单
- `pretest-q1`：低频/高频反应差异题
- `pretest-q2`：正弦输入稳态输出题
- `pretest-q3`：高频衰减对时域现象影响题

### 静态承载内容
- 三道题干全部明文落页。
- 误区提示固定列出：系统不是所有频率都一样、同频不等于同幅、滤掉高频后波形更平滑。

### 互动升级点
- 组件类型：`quiz_group`
- 题目数量：3
- 作答模型：允许重提一次；教师端区分首答与重提
- 答案揭示：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`attemptCount`、`resultState`、`errorBucket`
- 教师聚合：`question_distribution`、`top_misconceptions`

### AI 边界
- 页面目标：暴露本课起点误区。
- 允许范围：错因归类与术语纠偏。
- 禁止范围：代替学生作答。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/demo?step=step-04`
- 对齐要求：三题在未作答状态下全部可见。

## 步骤 05｜从时域问题走向频域问题

### 页面骨架
- 模板：`table_plus_prompt`
- 区域：`table` / `prompt` / `interaction`

### 模块清单
- `time-vs-frequency-table`：时域/频域对照表
- `transition-card`：过渡提示卡
- `short-response`：一句话短答区

### 静态承载内容
- 对照表固定写明：时域看整体曲线，频域看不同节奏如何被处理。
- 过渡卡固定写明：时域描述整体，频域揭示规则。
- 本页必须出现“正弦输入为何是天然测试信号”的过渡提示。

### 互动升级点
- 组件类型：`short_response`
- 短答句式：频域分析不是替代时域分析，而是把 ________ 拆成按频率逐项观察的规则。
- 反馈规则：保存文本，不即时判错

### 埋点与教师数据
- 埋点摘要：`responseSubmitted`、`responseLength`、`timeOnStep`
- 教师聚合：`response_word_cloud`、`common_reason_tags`

### AI 边界
- 页面目标：完成观察视角切换。
- 允许范围：时域整体、频域规则、观察对象。
- 禁止范围：直接给标准短答模板。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/demo?step=step-05`
- 对齐要求：对照表、过渡卡和短答栏必须同屏。

## 步骤 06｜方波、频率分量与重构直觉

### 页面骨架
- 模板：`media_plus_reconstruction_lab`
- 区域：`media` / `logic` / `workspace`

### 模块清单
- `harmonic-media`：方波谐波分解示意图
- `logic-chain`：三段主链卡
- `reconstruction-lab`：谐波重构工作区

### 静态承载内容
- 主图固定使用 `2-3-fr-02-square-wave-harmonics.svg`。
- 三段主链固定写明：
  - 复杂信号可分解为不同频率分量；
  - 系统对每个频率分量分别响应；
  - 各分量叠加后重构为最终时域输出。
- 页面必须点明：高频分量被压制后，波形会从尖锐转向平滑。

### 互动升级点
- 组件类型：`parameter_slider`
- 参数：`保留谐波个数`、`高频衰减强度`
- 反馈规则：联动更新重构波形与“更锋利 / 更平滑”提示语
- 答案揭示：无标准答案，仅保留趋势记录

### 埋点与教师数据
- 埋点摘要：`sliderChanged`、`stateSnapshot`、`timeOnStep`
- 教师聚合：`parameter_distribution`、`final_shape_tags`

### AI 边界
- 页面目标：建立频率分量重构直觉。
- 允许范围：谐波、重构、平滑、边缘。
- 禁止范围：要求 AI 代做傅里叶长推导。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/demo?step=step-06`
- 对齐要求：主链卡必须置于工作区上方，不能只剩滑块。

## 步骤 07｜正弦输入为什么会导向同频输出

### 页面骨架
- 模板：`formula_walkthrough_with_check`
- 区域：`formula-card` / `explain-strip` / `interaction`

### 模块清单
- `entry-formula`：输入公式卡
- `steady-output-formula`：稳态输出公式卡
- `three-conclusions`：三条结论条
- `reason-check`：判断区

### 静态承载内容
- 公式卡必须完整出现：

$$
r(t)=A\sin(\omega t)
$$

$$
c_{ss}(t)=A|G(j\omega)|\sin\bigl(\omega t+\angle G(j\omega)\bigr)
$$

- 三条结论固定写明：频率不变、幅值改变、相位改变。
- 本页不得把这两条公式缩成占位符或只留口头说明。

### 互动升级点
- 组件类型：`reason_check`
- 任务：判断“输出哪些量变了，哪些量没变”
- 反馈规则：即时纠错，只回显三条结论
- 答案揭示：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`selectionState`、`resultState`、`teacherRevealSeen`
- 教师聚合：`confusion_matrix`、`correction_rate`

### AI 边界
- 页面目标：把同频输出规律立住。
- 允许范围：同频、幅值缩放、相位偏移。
- 禁止范围：把暂态推导扩张成复分析长证明。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/demo?step=step-07`
- 对齐要求：两条公式与三条结论在未作答状态下完整可见。

## 步骤 08｜幅值变化与相位变化的物理意义

### 页面骨架
- 模板：`dual_wave_inspector`
- 区域：`media` / `meaning-table` / `interaction`

### 模块清单
- `sine-compare-media`：输入/输出波形对照图
- `meaning-table`：物理意义对照表
- `wave-switcher`：现象切换器

### 静态承载内容
- 主图固定使用 `2-3-fr-03-sine-in-sine-out.svg`。
- 对照表固定写明：
  - 幅值变化对应放大/衰减；
  - 相位变化对应提前/滞后；
  - 低频命令更应被保留，高频扰动更应被抑制。
- 本页需把 `#### 2.3.1 典型物理解释示例` 的工程语言显式落页。

### 互动升级点
- 组件类型：`tab_switch`
- 切换项：`放大/衰减`、`超前/滞后`、`命令/扰动`
- 反馈规则：切换后高亮对应说明句，不新增评分

### 埋点与教师数据
- 埋点摘要：`tabVisited`、`viewDuration`
- 教师聚合：`tab_heatmap`

### AI 边界
- 页面目标：把数学量翻译成工程语言。
- 允许范围：放大、衰减、提前、滞后、命令、扰动。
- 禁止范围：AI 直接替学生写完整工程解释。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/demo?step=step-08`
- 对齐要求：波形图、对照表和切换区必须同屏。

## 步骤 09｜频率特性：$G(j\omega)$、幅频与相频

### 页面骨架
- 模板：`formula_table_match`
- 区域：`formula-strip` / `definition-matrix` / `interaction`

### 模块清单
- `frequency-characteristic-card`：频率特性公式卡
- `definition-matrix`：三列表
- `triple-match`：对应区

### 静态承载内容
- 公式卡必须完整出现：

$$
G(j\omega)
$$

$$
M(\omega)=|G(j\omega)|
$$

$$
\varphi(\omega)=\angle G(j\omega)
$$

- 三列表固定为：数学对象 / 表示什么 / 最适合回答什么问题。
- 页面必须说明：频率特性是按频率索引的规则表。

### 互动升级点
- 组件类型：`triple_match`
- 任务：把三种对象与其含义、问题类型正确对应
- 反馈规则：即时标对错，可重试

### 埋点与教师数据
- 埋点摘要：`matchAttempted`、`matchCorrected`、`timeOnStep`
- 教师聚合：`common_mismatch_pairs`、`completion_rate`

### AI 边界
- 页面目标：区分频率特性、幅频特性、相频特性的职责。
- 允许范围：定义、用途、频率索引。
- 禁止范围：提前展开 Nyquist 或频域判稳。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/demo?step=step-09`
- 对齐要求：三条公式与三列表在未交互状态下均完整可见。

## 步骤 10｜为什么可以令 $s=j\omega$

### 页面骨架
- 模板：`concept_bridge_card`
- 区域：`formula` / `bridge` / `interaction`

### 模块清单
- `complex-plane-card`：复变量提示卡
- `bridge-sentence`：课程级解释卡
- `single-choice`：误区判断题

### 静态承载内容
- 公式卡必须完整出现：

$$
s=\sigma+j\omega
$$

- 解释卡固定写明：写成 $G(j\omega)$ 并不是抛弃拉氏变量，而是把注意力限制到研究正弦稳态响应的虚轴观察线上。
- 页面不得把这一点写成“纯技巧记忆”。

### 互动升级点
- 组件类型：`single_choice`
- 题干：在频域分析中写 $G(j\omega)$ 是否等于把拉氏方法完全丢掉？
- 正确项：`否`
- 错误反馈：只回显“限制到虚轴观察线”

### 埋点与教师数据
- 埋点摘要：`selectedOption`、`resultState`
- 教师聚合：`misconception_rate`

### AI 边界
- 页面目标：修正常见误解。
- 允许范围：复变量分解、虚轴、正弦稳态响应。
- 禁止范围：展开复平面严格证明。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/demo?step=step-10`
- 对齐要求：公式卡与解释卡必须先于选择题出现。

## 步骤 11｜为什么要画 Bode 图

### 页面骨架
- 模板：`axis_compare_slide`
- 区域：`media` / `reasons` / `interaction`

### 模块清单
- `axis-compare-media`：线性/对数频率坐标对比图
- `reason-cards`：三条理由卡
- `highlight-toggle`：高亮切换区

### 静态承载内容
- 页面必须完整出现：

$$
L(\omega)=20\log_{10}|G(j\omega)|
$$

- 三条理由固定为：
  - 频率范围常跨越多个数量级；
  - 对数坐标更易识别转折频率；
  - 分贝表示让串联环节的乘法关系转为加法关系。
- 主图固定使用 `2-3-fr-04-linear-vs-log-frequency.svg`。

### 互动升级点
- 组件类型：`highlight_toggle`
- 任务：在同一图上切换“线性坐标拥挤区 / 对数坐标均匀区 / 分贝叠加便利”
- 反馈规则：仅高亮理由卡，不做评分

### 埋点与教师数据
- 埋点摘要：`toggleVisited`、`timeOnStep`
- 教师聚合：`reason_focus_heatmap`

### AI 边界
- 页面目标：说明 Bode 图为何成为频域对象的第一可视化入口。
- 允许范围：对数坐标、分贝、转折频率。
- 禁止范围：提前进入复杂手绘技巧。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/demo?step=step-11`
- 对齐要求：公式、三条理由和主图必须同屏。

## 步骤 12｜典型环节 Bode 第一判断

### 页面骨架
- 模板：`card_sort_with_reference`
- 区域：`reference` / `cards` / `interaction`

### 模块清单
- `first-order-reference`：一阶惯性环节参考卡
- `typical-element-cards`：比例/积分/微分/惯性/振荡卡组
- `card-sorter`：分类区

### 静态承载内容
- 参考卡必须完整出现：

$$
G(s)=\frac{1}{Ts+1}
$$

$$
G(j\omega)=\frac{1}{1+j\omega T}
$$

- 三段判断固定写明：
  - $\omega T \ll 1$：低频基本通过；
  - $\omega T \approx 1$：转折附近出现明显衰减与滞后；
  - $\omega T \gg 1$：高频显著被抑制。
- 主图可引用 `2-3-fr-05-bode-axes-and-typical-cards.svg` 作为卡组背景示意。

### 互动升级点
- 组件类型：`card_sort`
- 任务：按“谁偏低频 / 谁偏高频 / 谁会明显滞后”完成首轮分类
- 反馈规则：即时标记分类结果，可重试

### 埋点与教师数据
- 埋点摘要：`sortAttempted`、`sortCorrected`、`timeOnStep`
- 教师聚合：`common_sort_errors`

### AI 边界
- 页面目标：建立典型环节的第一层频域直觉。
- 允许范围：低频通过、高频抑制、滞后、超前、敏感频段。
- 禁止范围：复杂组合对象的精细读图。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/demo?step=step-12`
- 对齐要求：参考卡必须静态可见，卡组不能脱离静态解释单独存在。

## 步骤 13｜基础手绘骨架：标准型、转折频率与趋势

### 页面骨架
- 模板：`sketch_workflow_workspace`
- 区域：`workflow` / `media` / `workspace`

### 模块清单
- `workflow-cards`：四步流程卡
- `skeleton-media`：骨架示意图
- `builder-workspace`：首轮骨架工作区

### 静态承载内容
- 四步流程卡固定写明：
  1. 写标准型；
  2. 列转折频率；
  3. 判最低频段；
  4. 依次画趋势变化。
- 主图固定使用 `2-3-fr-06-bode-skeleton-workflow.svg`。
- 页面必须强调：本页只完成首轮渐近骨架，不追求精细修正。

### 互动升级点
- 组件类型：`workspace_builder`
- 任务：在工作区放置转折频率标记并连接斜率趋势
- 反馈规则：允许 AI 或系统仅检查“转折频率有没有漏、斜率变化方向对不对”
- 答案揭示：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`checkpointSaved`、`errorBucket`、`teacherRevealSeen`
- 教师聚合：`missing_break_frequency_rate`、`slope_error_rate`

### AI 边界
- 页面目标：让学生把频率特性第一次画成图形对象。
- 允许范围：转折频率、斜率变化方向、四步法。
- 禁止范围：AI 直接生成最终答案图。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/demo?step=step-13`
- 对齐要求：流程卡和工作区必须同屏，工作区不可替代流程卡。

## 步骤 14｜例题一——单一正弦输入下的稳态输出

### 页面骨架
- 模板：`worked_example_workspace`
- 区域：`problem` / `method` / `workspace` / `result`

### 模块清单
- `example-problem-card`：题面卡
- `four-step-method`：四步法卡
- `calculation-workspace`：中间量工作区
- `result-card`：最终表达式与工程解释卡

### 静态承载内容
- 题面卡必须完整出现：

$$
G(s)=\frac{1}{0.5s+1}
$$

$$
r(t)=2\sin(4t)
$$

- 四步法固定为：识别频率 -> 计算 $G(j\omega)$ -> 求模与相位 -> 写出稳态输出并解释。
- 结果卡必须完整出现：

$$
c_{ss}(t)=0.894\sin(4t-63.4^\circ)
$$

- 结果卡需同步写明：频率未变、振幅缩小、相位滞后。

### 互动升级点
- 组件类型：`worked_example_workspace`
- 任务：逐格填写 $\omega$、$|G(j\omega)|$、$\angle G(j\omega)$ 与输出振幅
- 反馈规则：支持按步骤揭示，不直接跳最终答案

### 埋点与教师数据
- 埋点摘要：`stepCompletion`、`errorBucket`、`timeOnStep`
- 教师聚合：`stuck_step_distribution`

### AI 边界
- 页面目标：把“代入 $j\omega$ -> 模与相位 -> 稳态输出”链条跑通。
- 允许范围：中间量核对、错因提示、工程解释复核。
- 禁止范围：直接代写整题答案。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/demo?step=step-14`
- 对齐要求：题面、四步法和结果卡必须同页可见，不能只剩计算面板。

## 步骤 15｜例题二——多频输入的重塑过程与 AI 对照

### 页面骨架
- 模板：`compare_then_ai`
- 区域：`problem` / `method` / `workspace` / `ai-panel`

### 模块清单
- `multi-frequency-problem`：双频题面卡
- `rebuild-chain`：方法链卡
- `component-workspace`：分量处理工作区
- `ai-compare-panel`：AI 对照区

### 静态承载内容
- 题面卡必须完整出现：

$$
G(s)=\frac{1}{s+1}
$$

$$
r(t)=\sin(0.2t)+0.5\sin(5t)
$$

- 方法链固定为：分量独立处理 -> 输出重构 -> 低频保留更明显。
- 结论卡固定写明：低频分量在输出中保留更充分，高频分量被明显压低，因此输出更接近平滑低频波形。

### 互动升级点
- 组件类型：`ai_compare_workspace`
- 任务：先在工作区写出两条分量处理判断，再提交给 AI 仅做链条核验
- 反馈规则：AI 只评价顺序是否正确、解释是否越界；不给最终成稿

### 埋点与教师数据
- 埋点摘要：`workspaceSubmitted`、`aiCheckRequested`、`revisionCount`
- 教师聚合：`ai_usage_rate`、`common_reason_gaps`

### AI 边界
- 页面目标：把“单频规则”升级到“多频重塑”。
- 允许范围：分量独立处理、重构、低频保留、高频压制。
- 禁止范围：AI 直接代写结论或绕过学生先判断。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/demo?step=step-15`
- 对齐要求：题面卡、方法链与 AI 边界必须同屏，AI 面板不能脱离题面单独漂浮。

## 步骤 16｜后测——对象会读，更要会画

### 页面骨架
- 模板：`post_quiz_stack`
- 区域：`question-stack` / `explain-box` / `submit-bar`

### 模块清单
- `post-q1`：为什么正弦输入天然合适
- `post-q2`：高频压制后的时域现象
- `post-q3`：Bode 首轮骨架第一步

### 静态承载内容
- 三题题干全部明文落页。
- 提示卡固定写明：既要会说出对象对什么频率更敏感，也要会把这种敏感性画成首轮骨架。

### 互动升级点
- 组件类型：`quiz_group`
- 作答模型：两题客观题 + 一题解释题
- 答案揭示：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`attemptCount`、`resultState`、`explainQualityTag`
- 教师聚合：`question_distribution`、`concept_transfer_rate`

### AI 边界
- 页面目标：检验本课是否真正从“会说”推进到“会画”。
- 允许范围：错因归类与关键词提醒。
- 禁止范围：AI 代答解释题。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/demo?step=step-16`
- 对齐要求：三题在未提交状态下全部可见。

## 步骤 17｜总结与后续预告——走向 Nyquist 与频域指标

### 页面骨架
- 模板：`summary_infographic`
- 区域：`summary` / `bridge` / `resources`

### 模块清单
- `five-takeaways`：五条结论卡
- `next-course-card`：后续课程去向卡
- `quick-reference-entry`：速查表入口

### 静态承载内容
- 五条结论固定为：
  1. 频域分析研究系统如何处理不同频率成分；
  2. 正弦输入稳态后仍是同频输出；
  3. $G(j\omega)$ 把传递函数对象翻译成频域对象；
  4. Bode 图是频率特性第一次稳定可见的入口；
  5. 下节课将推进到 Nyquist 与频域指标，而不是重讲本节。
- 去向卡固定连接 `2-4`、`3-5`、`3-8`。
- 速查入口可引用 `2-3-info.png` 作为课后复习视觉锚点。

### 互动升级点
- 组件类型：`none`
- 速查入口：只做跳转，不引入作答

### 埋点与教师数据
- 埋点摘要：`viewed`、`resourceClicked`
- 教师聚合：`resource_click_rate`

### AI 边界
- 页面目标：完成收束与桥接。
- 允许范围：五条结论、后续课程关系、复习建议。
- 禁止范围：在结尾新加未讲过的判稳内容。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/demo?step=step-17`
- 对齐要求：五条结论与去向卡必须是主视觉，不被资源入口盖过。
