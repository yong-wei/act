━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
互动页面设计 | 单元 2-1：建模与变换语言——从真实对象到统一分析对象
技术栈：Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 文档职责
- 本文件是供人审阅的页面蓝图，只描述页面布局、固定内容、互动组件、数据采集与 AI 边界。
- 同目录 [interactive-contract.yaml](./interactive-contract.yaml) 是机读契约；两者必须保持一一对应。
- 本文件不是讲义摘要，不写“教师讲什么、学生做什么”的动作脚本，不写实现阶段自由发挥空间。
- 页面默认预览口径固定为学生演示页，不以教师端模板弹窗替代真实页面。

## 表述规则
- 页面描述只保留客观结构：区域、模块、文本、公式、图片、表格、互动组件、反馈规则。
- 动作化表述禁用：`展示`、`完成一次`、`引导`、`跟随推导`、`让学生` 等。
- 互动描述只写组件形态与交互规则，不写课堂口播。
- 静态内容优先。互动组件只能升级练习方式，不能替代核心条目、公式、表格与图示。

## 全课总览
| 步骤 | 标题 | 页面模板 | 主体布局 | 互动组件 | 学生页预览 |
|------|------|----------|----------|----------|------------|
| step-01 | 回到地图——为什么模块 2 先从建模语言开始 | `map_hero_slide` | 全幅地图 + 任务卡 | `none` | `/interactive-learning/courses/unit-2-1-modeling-language/student/demo?step=step-01` |
| step-02 | 情境引入——为什么光有微分方程还不够 | `cover_top_formula_then_judge` | 封面图在上，公式与追问在中，判断区在下 | `binary_choice` | `/interactive-learning/courses/unit-2-1-modeling-language/student/demo?step=step-02` |
| step-03 | 学习目标——今天要建哪条对象链 | `center_chain_slide` | 主链居中 + 目标卡行 | `none` | `/interactive-learning/courses/unit-2-1-modeling-language/student/demo?step=step-03` |
| step-04 | 前测——对象、初值与结构的三个误区 | `question_stack` | 三题纵向堆叠 + 提交条 | `quiz_group` | `/interactive-learning/courses/unit-2-1-modeling-language/student/demo?step=step-04` |
| step-05 | 拉氏变换的工程动机 | `table_plus_formula_plus_short_response` | 对照表 + 公式条 + 短答栏 | `short_response` | `/interactive-learning/courses/unit-2-1-modeling-language/student/demo?step=step-05` |
| step-06 | 零初值下传递函数怎样形成 | `formula_explain_checklist` | 定义公式 + 结论卡 + 勾选区 | `multi_check` | `/interactive-learning/courses/unit-2-1-modeling-language/student/demo?step=step-06` |
| step-07 | 非零初值为什么不能混进对象定义 | `compare_then_ai` | 双列对照 + 自判框 + 页内 AI | `reflection_form` | `/interactive-learning/courses/unit-2-1-modeling-language/student/demo?step=step-07` |
| step-08 | 典型环节对象库：先看清对象由什么组成 | `courseware_top_game_stage_bottom` | 总表 + 总图 + 拖拽舞台 + 提交反馈条 | `drag_match` | `/interactive-learning/courses/unit-2-1-modeling-language/student/demo?step=step-08` |
| step-09 | 结构图三类基本连接 | `formula_strip_plus_rule_check` | 三公式条 + 规则卡 + 判断区 | `rule_judge` | `/interactive-learning/courses/unit-2-1-modeling-language/student/demo?step=step-09` |
| step-10 | 船舶航向系统：把对象真正连成系统 | `engineering_block_diagram` | 工程结构图 + 角色卡 + 热点标注区 | `hotspot_labeling` | `/interactive-learning/courses/unit-2-1-modeling-language/student/demo?step=step-10` |
| step-11 | 方框图为什么还不够：信号流图补位 | `comparison_slide` | 左右对照图 + 分工表 | `bucket_sort` | `/interactive-learning/courses/unit-2-1-modeling-language/student/demo?step=step-11` |
| step-12 | 梅森公式的最小使用集 | `formula_then_term_match` | 公式卡 + 术语卡 + 拖拽配对区 | `drag_match` | `/interactive-learning/courses/unit-2-1-modeling-language/student/demo?step=step-12` |
| step-13 | 例题一：单回路闭环对象如何收束 | `prompt_image_then_worked_example` | 题面图在上，例题三步卡在中，选择校验在下 | `choice_check` | `/interactive-learning/courses/unit-2-1-modeling-language/student/demo?step=step-13` |
| step-14 | 补充辨析：余子式为什么不一定等于 1 | `prompt_image_then_path_reasoning` | 题面信号流图在上，公式链在中，原因框在下 | `path_highlight` | `/interactive-learning/courses/unit-2-1-modeling-language/student/demo?step=step-14` |
| step-15 | 后测——会不会用对象语言复述本课 | `post_quiz_stack` | 三题后测堆叠 | `quiz_group` | `/interactive-learning/courses/unit-2-1-modeling-language/student/demo?step=step-15` |
| step-16 | 总结——对象语言已建立，下一课进入响应分析 | `summary_infographic` | 总结链 + 信息图 + 下一课入口 | `none` | `/interactive-learning/courses/unit-2-1-modeling-language/student/demo?step=step-16` |

---

## step-01｜回到地图——为什么模块 2 先从建模语言开始

### 页面骨架
- 模板：`map_hero_slide`
- 区域：
  - `header`：全宽，页标题区
  - `lead`：全宽，模块地图主视觉
  - `summary`：全宽，任务卡

### 模块清单
- `map-banner`：`stage-map`
- `today-task`：`key-task-card`

### 固定内容
- `map-banner`
  - 标题：模块定位
  - 正文：模块 1 停留在现象直觉层，2-1 要正式建立对象语言，2-2 才在这些对象上讨论时间响应。
- `today-task`
  - 标题：今天的任务
  - 条目：
    - 不是继续看快慢、稳不稳的表面现象。
    - 而是把对象怎样被写出来、连起来、收束起来这条链真正立住。

### 互动与反馈
- 组件类型：`none`
- 提交态：无
- 答案揭示：无

### 埋点与教师数据
- 埋点摘要：`viewed`、`timeOnStep`、`teacherFollowSync`
- 教师聚合：`view_count`、`sync_status`

### AI 边界
- 页面目标：模块 2 入口定位
- 允许范围：模块 1 现象直觉、模块 2 对象语言任务
- 禁止范围：传递函数推导、2-2 时域指标

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-1-modeling-language/student/demo?step=step-01`
- 对齐要求：首屏直接出现地图与任务卡，无作答区占位。

---

## step-02｜情境引入——为什么光有微分方程还不够

### 页面骨架
- 模板：`cover_top_formula_then_judge`
- 区域：
  - `comic`：全宽，课程封面图
  - `equation`：全宽，公式卡与追问列表
  - `interaction`：全宽，二选一判断区

### 模块清单
- `core-equation`：`formula-card`
- `three-questions`：`question-list`
- `cover-comic`：`image-card`
- `binary-judge`：`binary-choice`

### 固定内容
- 图像资源：`2-1-cover-comic.png`
- 标题：船舶航向动力学方程
- 公式：

$$
J\ddot{\theta}(t)+B\dot{\theta}(t)=Ku(t)
$$

- 列表标题：只拿着这条方程还不够的三件事
- 列表条目：
  - 能不能一眼判断它属于什么对象？
  - 它以后怎么接控制器和传感器？
  - 它进入反馈后，整体对象怎么写？

### 互动与反馈
- 组件类型：`binary_choice`
- 选项结构：
  - A：只要有微分方程，后面所有分析都能直接做
  - B：微分方程只是起点，还需要统一对象语言
- 正确项：`B`
- 错误反馈：只给出“还缺少统一对象语言”线索，不展开三问答案
- 答案揭示：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`selectedOption`、`resultState`、`teacherRevealSeen`、`timeOnStep`
- 错因标签：`equation_is_enough`
- 教师聚合：`option_distribution`、`reveal_correction_rate`

### AI 边界
- 页面目标：微分方程不是后续分析终点
- 允许范围：微分方程物理意义、统一对象语言必要性
- 禁止范围：完整拉氏推导、复杂反馈公式

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-1-modeling-language/student/demo?step=step-02`
- 对齐要求：首屏先出现课程封面图，其后才是公式、三问和判断组件。

---

## step-03｜学习目标——今天要建哪条对象链

### 页面骨架
- 模板：`center_chain_slide`
- 区域：
  - `chain`：全宽，对象链主视觉
  - `cards`：全宽，目标卡行

### 模块清单
- `object-chain`：`formula-chain`
- `goal-cards`：`goal-card-row`

### 固定内容
- 标题：本课主线
- 主链公式：

$$
\text{微分方程} \rightarrow \text{拉氏变换} \rightarrow \text{传递函数} \rightarrow \text{典型环节} \rightarrow \text{结构表达} \rightarrow \text{总体对象}
$$

- 目标卡：与六段对象链逐段对应，不替代主链公式

### 互动与反馈
- 组件类型：`none`

### 埋点与教师数据
- 埋点摘要：`viewed`、`timeOnStep`
- 教师聚合：`view_count`

### AI 边界
- 页面目标：先建立六段对象链全景
- 允许范围：六段对象链、对象建立顺序
- 禁止范围：任一单段完整推导

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-1-modeling-language/student/demo?step=step-03`
- 对齐要求：六段对象链必须是主视觉，目标卡只作补充。

---

## step-04｜前测——对象、初值与结构的三个误区

### 页面骨架
- 模板：`question_stack`
- 区域：
  - `question-stack`：全宽，三题纵向堆叠
  - `submit-bar`：全宽，提交反馈条

### 模块清单
- `misconception-q1`：`single-choice-card`
- `misconception-q2`：`single-choice-card`
- `misconception-q3`：`single-choice-card`

### 固定内容
- 三道题干全部明文落页，不折叠为摘要：
  - 传递函数中的零初值能不能省略
  - 复杂分式先认对象还是先化简
  - 信号流图是不是方框图换个名字

### 互动与反馈
- 组件类型：`quiz_group`
- 题目数量：3
- 作答模型：允许重提一次；教师端区分首答与重提
- 答案揭示：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`attemptCount`、`resultState`、`errorBucket`、`teacherRevealSeen`
- 错因标签：
  - `omit_zero_initial_state`
  - `calculate_before_identify`
  - `block_equals_sfg`
- 教师聚合：`question_distribution`、`top_misconceptions`

### AI 边界
- 本页无独立 AI 模块

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-1-modeling-language/student/demo?step=step-04`
- 对齐要求：三题题干在未作答状态下全部完整可见。

---

## step-05｜拉氏变换的工程动机

### 页面骨架
- 模板：`table_plus_formula_plus_short_response`
- 区域：
  - `contrast`：全宽，时域语言 / 变换域语言对照表
  - `formula-strip`：全宽，最小公式条
  - `reflection`：全宽，短答栏

### 模块清单
- `language-contrast`：`comparison-table`
- `minimum-formulas`：`formula-strip`
- `one-line-reflection`：`short-response`

### 固定内容
- 对照表：
  - 时域语言：直接描述微分方程与初值演化
  - 变换域语言：把对象写成统一代数形式，便于识别、连接和收束
- 最小公式组：

$$
F(s)=\mathcal{L}\{f(t)\}
$$

$$
\mathcal{L}\{\dot f(t)\}=sF(s)
$$

$$
\mathcal{L}\{\ddot f(t)\}=s^2F(s)
$$

- 最小对应关系表：
  - $1(t) \leftrightarrow 1/s$
  - $\dot f(t) \leftrightarrow sF(s)-f(0^-)$
  - $\ddot f(t) \leftrightarrow s^2F(s)-sf(0^-)-\dot f(0^-)$
  - $\int_0^t f(\tau)\,d\tau \leftrightarrow F(s)/s$

### 互动与反馈
- 组件类型：`short_response`
- 短答句式：拉氏变换在本课里的核心价值，是把 ________ 改写成 ________。
- 答案揭示：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`submitted`、`aiUsed`、`resultState`、`durationBand`
- 错因标签：`laplace_as_integration_trick`
- 教师聚合：`keyword_cloud`、`ai_usage_rate`

### AI 边界
- 页面目标：拉氏变换的工程动机
- 允许范围：微分变代数、对象统一化
- 禁止范围：积分技巧展开

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-1-modeling-language/student/demo?step=step-05`
- 对齐要求：对照表与最小公式组同屏，短答组件位于页面底部。

---

## step-06｜零初值下传递函数怎样形成

### 页面骨架
- 模板：`formula_explain_checklist`
- 区域：
  - `formula-card`：全宽，定义公式
  - `explain-cards`：全宽，对象分离结论卡
  - `reason-checklist`：全宽，勾选区

### 模块清单
- `transfer-definition`：`formula-card`
- `object-separation`：`conclusion-cards`
- `checklist`：`multi-check`

### 固定内容
- 定义公式：

$$
G(s)=\frac{Y(s)}{U(s)}\bigg|_{\text{零初值}}
$$

- 固定结论：
  - 这是系统对象，不是某次输入输出过程的偶然结果
  - 零初值是对象定义成立的前提，不能省略

### 互动与反馈
- 组件类型：`multi_check`
- 校验主题：对象与输入分离的三个理由
- 答案揭示：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`attemptCount`、`resultState`、`teacherRevealSeen`
- 错因标签：`transfer_function_is_rewritten_equation`
- 教师聚合：`checklist_accuracy`、`reveal_correction_rate`

### AI 边界
- 页面目标：对象定义与零初值前提
- 允许范围：对象 / 输入分离、统一分析对象
- 禁止范围：非零初值辨析细节

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-1-modeling-language/student/demo?step=step-06`
- 对齐要求：公式与结论先出现，勾选组件后出现或位于下方同页区域。

---

## step-07｜非零初值为什么不能混进对象定义

### 页面骨架
- 模板：`compare_then_ai`
- 区域：
  - `compare-table`：全宽，对象项 / 初值项对照
  - `self-judgment`：全宽，三字段自判表单
  - `ai-panel`：全宽，页内 AI 对照区

### 模块清单
- `object-state-compare`：`two-column-compare`
- `reflection-form`：`three-field-form`
- `bounded-ai`：`ai-assistant`

### 固定内容
- 公式组：

$$
Y(s)=G(s)U(s)
$$

$$
Y(s)=G(s)U(s)+\text{初值项}
$$

- 一阶系统示例：

$$
Y(s)=\frac{K}{Ts+1}U(s)+\frac{T\,y(0^-)}{Ts+1}
$$

- 固定结论：初始状态带来额外项，不能进入对象定义本体

### 互动与反馈
- 组件类型：`reflection_form`
- 结构：先写个人判断，再打开页内 AI 对照区
- 答案揭示：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`submitted`、`aiUsed`、`resultState`、`teacherRevealSeen`
- 错因标签：`mix_object_and_state`
- 教师聚合：`ai_usage_rate`、`misconception_tags`、`keyword_cloud`

### AI 边界
- 页面目标：对象项 / 初值项分离
- 允许范围：额外初值项来源、对象定义边界
- 禁止范围：代替学生直接生成完整答案

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-1-modeling-language/student/demo?step=step-07`
- 对齐要求：双列对照必须先于 AI 区出现，自判表单位于两者之间。

---

## step-08｜典型环节对象库：先看清对象由什么组成

### 页面骨架
- 模板：`courseware_top_game_stage_bottom`
- 区域：
  - `table-zone`：全宽，五类典型环节总表
  - `map-zone`：全宽，典型环节总图
  - `game-stage`：全宽，三列拖拽配对舞台
  - `submit-zone`：全宽，提交反馈条

### 模块清单
- `elements-table`：`table-card`
- `elements-map`：`image-or-table-fallback`
- `drag-board`：`drag-match-board`
- `result-bar`：`submit-feedback-bar`

### 固定内容
- 表题：五类典型环节及其第一判断
- 表头：
  - 典型环节
  - 传递函数形式
  - 你应先抓住的物理或工程含义
  - 第一眼判断
- 表格正文：
  - 比例环节 | $G(s)=K$ | 只有比例放大或缩小，不引入动态记忆 | 改变强弱，不改变动态阶次
  - 积分环节 | $G(s)=1/s$ | 输出是输入随时间的累积 | 引入记忆，常使系统慢慢积累
  - 微分环节 | $G(s)=s$ | 输出更敏感于输入变化率 | 强调变化趋势，对快变化敏感
  - 一阶惯性环节 | $G(s)=1/(Ts+1)$ | 存在滞后，响应不会立刻到位 | 不振荡，主要体现快慢差异
  - 振荡环节 | $G(s)=\omega_n^2/(s^2+2\zeta\omega_n s+\omega_n^2)$ | 同时包含快慢与振荡特征 | 可能超调、振荡、再稳定
- 图像资源：`2-1-md-01-typical-elements-map.png`
- 图像缺席时的硬约束：保留完整总表，不得删成简化卡片
- 规则说明文字：先看上方总表，再进入下方拖拽舞台。舞台中的卡片分为公式卡、名称卡、第一眼工程判断卡。

### 互动与反馈
- 组件类型：`drag_match`
- 舞台形态：三列拖拽配对舞台
- 目标槽位：
  - 比例对象槽位
  - 积分对象槽位
  - 微分对象槽位
  - 惯性对象槽位
  - 振荡对象槽位
- 可拖拽卡片：
  - `G(s)=K`
  - `G(s)=1/s`
  - `G(s)=s`
  - `G(s)=1/(Ts+1)`
  - `G(s)=\omega_n^2/(s^2+2\zeta\omega_n s+\omega_n^2)`
  - 比例环节 / 积分环节 / 微分环节 / 惯性环节 / 振荡环节
  - 改变强弱，不改变动态阶次
  - 引入记忆，常使系统慢慢积累
  - 强调变化趋势，对快变化敏感
  - 不振荡，主要体现快慢差异
  - 可能超调、振荡、再稳定
- 干扰项：
  - `G(s)=1/(s(Ts+1))`
  - `先直接算总式`
  - `所有对象都先看稳态误差`
- 提交规则：允许重试；反馈只指出错位槽位数量和类型，不直接公布完整答案
- 成功反馈：正确槽位锁定，高亮描边与亮牌反馈
- 失败反馈：错位槽位高亮，提示“先回到上方对象总表核对”
- 揭示方式：`teacher_toggle_stepwise`

### 埋点与教师数据
- 埋点摘要：`attemptCount`、`resultState`、`durationBand`、`hintUsed`、`teacherRevealSeen`、`misconceptionTags`
- 高频事件禁用：`drag_pointer_trace`、`every_slot_hover`
- 错因标签：
  - `identify_after_calculation`
  - `integral_meaning_missing`
  - `inertia_vs_oscillation_confusion`
- 教师聚合：
  - `first_pass_rate`
  - `retry_rate`
  - `error_hotspots`
  - `misconception_tag_distribution`

### AI 边界
- 页面目标：五类典型环节的第一眼识别
- 允许范围：对象识别、先认对象再运算、五类对象最小判断
- 禁止范围：2-2 时域响应分析、直接代答拖拽、复杂组合对象化简

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-1-modeling-language/student/demo?step=step-08`
- 对齐要求：
  - 默认预览直接进入学生演示页
  - 演示页直接出现真实拖拽舞台
  - 不允许退化为单选、文本问答或占位卡

---

## step-09｜结构图三类基本连接

### 页面骨架
- 模板：`formula_strip_plus_rule_check`
- 区域：
  - `formula-strip`：全宽，三条基础公式
  - `rule-cards`：全宽，规则卡行
  - `judge-zone`：全宽，判断区

### 模块清单
- `three-formulas`：`formula-strip`
- `rule-cards`：`rule-card-row`
- `judge-zone`：`judge-form`

### 固定内容
- 三条基础公式：

$$
G(s)=G_1(s)G_2(s)
$$

$$
G(s)=G_1(s)+G_2(s)
$$

$$
\frac{Y(s)}{R(s)}=\frac{G(s)}{1+G(s)H(s)}
$$

- 三类结构图资源：
  - `2-1-md-02-series-equivalent.png`
  - `2-1-md-03-parallel-equivalent.png`
  - `2-1-md-04-feedback-equivalent.png`

### 互动与反馈
- 组件类型：`rule_judge`
- 校验内容：串联、并联、反馈分别对应哪条规则；反馈为何关键
- 答案揭示：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`attemptCount`、`resultState`、`misconceptionTags`
- 错因标签：`feedback_as_sum`、`parallel_as_product`
- 教师聚合：`option_distribution`、`feedback_explanation_keywords`

### AI 边界
- 页面目标：三种基本连接与对应规则
- 允许范围：串联、并联、反馈
- 禁止范围：复杂结构化简技巧

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-1-modeling-language/student/demo?step=step-09`
- 对齐要求：三条公式在作答前完整可见。

---

## step-10｜船舶航向系统：把对象真正连成系统

### 页面骨架
- 模板：`engineering_block_diagram`
- 区域：
  - `diagram`：全宽，工程结构图
  - `role-cards`：全宽，角色卡
  - `feedback-task`：全宽，热点标注区

### 模块清单
- `ship-diagram`：`engineering-diagram`
- `role-cards`：`role-card-row`
- `feedback-task`：`short-response`

### 固定内容
- 结构图资源：`2-1-md-05-ship-heading-physical-blocks.png`
- 固定角色卡：
  - 控制器
  - 舵机
  - 船体
  - 传感器
- 固定说明：反馈信号在闭环中的回送位置与传感器作用

### 互动与反馈
- 组件类型：`hotspot_labeling`
- 校验内容：反馈信号位置、传感器闭环作用
- 答案揭示：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`attemptCount`、`resultState`、`teacherRevealSeen`
- 错因标签：`sensor_role_unclear`
- 教师聚合：`hotspot_accuracy`、`common_feedback_errors`

### AI 边界
- 页面目标：把对象真正连接成系统
- 允许范围：四个模块角色、反馈信号位置
- 禁止范围：闭环总式推导展开

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-1-modeling-language/student/demo?step=step-10`
- 对齐要求：结构图与四个角色说明同屏。

---

## step-11｜方框图为什么还不够：信号流图补位

### 页面骨架
- 模板：`comparison_slide`
- 区域：
  - `left-diagram`：`1/2`，方框图
  - `right-diagram`：`1/2`，信号流图
  - `comparison-table`：全宽，任务分工表

### 模块清单
- `diagram-comparison`：`dual-diagram`
- `task-table`：`comparison-table`

### 固定内容
- 对照图资源：`2-1-md-06-block-vs-sfg.png`
- 分工表固定结论：
  - 方框图：看模块与连接
  - 信号流图：看路径与回路

### 互动与反馈
- 组件类型：`bucket_sort`
- 任务卡：`看模块连接`、`看路径回路` 等任务拖入对应栏目
- 答案揭示：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`attemptCount`、`resultState`、`misconceptionTags`
- 错因标签：`block_equals_sfg`
- 教师聚合：`task_assignment_accuracy`

### AI 边界
- 页面目标：两类图的分工边界
- 允许范围：模块 / 连接 / 路径 / 回路
- 禁止范围：梅森公式细节

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-1-modeling-language/student/demo?step=step-11`
- 对齐要求：至少保留一张方框图 / 信号流图对照图。

---

## step-12｜梅森公式的最小使用集

### 页面骨架
- 模板：`formula_then_term_match`
- 区域：
  - `formula-zone`：全宽，梅森公式卡
  - `term-cards`：全宽，术语定义卡
  - `match-stage`：全宽，拖拽配对区

### 模块清单
- `mason-formula`：`formula-card`
- `term-defs`：`definition-cards`
- `term-match`：`drag-match-board`

### 固定内容
- 公式：

$$
\frac{Y(s)}{R(s)}=\frac{\sum P_k\Delta_k}{\Delta}
$$

- 固定术语：
  - 前向通路
  - 回路
  - 互不接触回路
  - 余子式

### 互动与反馈
- 组件类型：`drag_match`
- 配对内容：术语、定义、高亮区域
- 干扰项：`局部模块`、`传感器噪声`
- 揭示方式：`teacher_toggle_stepwise`

### 埋点与教师数据
- 埋点摘要：`attemptCount`、`resultState`、`misconceptionTags`、`teacherRevealSeen`
- 错因标签：`delta_as_loop`、`touching_definition_blur`
- 教师聚合：`term_accuracy`、`common_term_confusions`

### AI 边界
- 页面目标：梅森公式最小术语集
- 允许范围：公式本体、四个术语
- 禁止范围：跨题复杂计算

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-1-modeling-language/student/demo?step=step-12`
- 对齐要求：公式卡先于拖拽配对区出现；互动不退化为文本选择题。

---

## step-13｜例题一：单回路闭环对象如何收束

### 页面骨架
- 模板：`prompt_image_then_worked_example`
- 区域：
  - `diagram-zone`：全宽，题面图像区
  - `step-cards`：全宽，例题步骤卡
  - `check-zone`：全宽，选择校验区

### 模块清单
- `example-steps`：`worked-example-cards`
- `loop-diagram`：`diagram-pair`
- `channel-check`：`choice-check`

### 固定内容
- 图像资源：
  - `2-1-md-07-example-ship-loop.png`
  - `2-1-md-08-example-ship-sfg.png`
- 前向通道总式：

$$
G(s)=\frac{K_cK_p}{s(T_as+1)(T_ps+1)}
$$

- 闭环对象总式：

$$
\Phi(s)=\frac{K_cK_p}{s(T_as+1)(T_ps+1)+K_cK_pK_h}
$$
- 例题链固定分段：
  - 对象识别
  - 前向通道
  - 闭环对象
  - 信号流图验证

### 互动与反馈
- 组件类型：`choice_check`
- 校验内容：前向通道、反馈通道、真正分析对象
- 答案揭示：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`attemptCount`、`resultState`、`misconceptionTags`
- 错因标签：`local_module_as_final_object`
- 教师聚合：`choice_distribution`、`closed_loop_focus_rate`

### AI 边界
- 页面目标：单回路闭环对象收束
- 允许范围：前向通道、反馈通道、闭环对象
- 禁止范围：复杂多回路推广

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-1-modeling-language/student/demo?step=step-13`
- 对齐要求：首屏先出现题面图像，其后才进入前向通路总式、闭环总式和选择校验区。

---

## step-14｜补充辨析：余子式为什么不一定等于 1

### 页面骨架
- 模板：`prompt_image_then_path_reasoning`
- 区域：
  - `highlight-stage`：全宽，题面信号流图区
  - `formula-chain`：全宽，公式链
  - `explain-box`：全宽，原因填写框

### 模块清单
- `formula-chain`：`formula-strip`
- `sfg-stage`：`path-highlight-stage`
- `reason-box`：`single-reason-response`

### 固定内容
- 图像资源：`2-1-md-14-example2-sfg.png`
- 公式链：

$$
P_1=\frac{K_cK_p}{s(T_as+1)(T_ps+1)}
$$

$$
L_1=-\frac{K_cK_pK_h}{s(T_as+1)(T_ps+1)}
$$

$$
\Delta=1-L_1
$$

$$
\Delta_1=1
$$
- 固定辨析点：
  - 例题一本体中的 `\Delta_1=1`
  - 附录补充情形中的 `\Delta_k=1-L_1`
  - “回路之间互不接触”与“回路不接触某条前向通路”的区别

### 互动与反馈
- 组件类型：`path_highlight`
- 校验内容：前向通路高亮、局部回路高亮、接触判定、原因说明
- 揭示方式：`teacher_toggle_stepwise`

### 埋点与教师数据
- 埋点摘要：`attemptCount`、`resultState`、`misconceptionTags`、`teacherRevealSeen`
- 错因标签：`non_touching_loops_vs_non_touching_path`
- 教师聚合：`highlight_accuracy`、`common_contact_confusions`

### AI 边界
- 页面目标：余子式判定边界
- 允许范围：前向通路、局部回路、接触关系
- 禁止范围：无关的新例题拓展

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-1-modeling-language/student/demo?step=step-14`
- 对齐要求：首屏先出现题面信号流图，其后才出现公式链、路径高亮与原因填写区。

---

## step-15｜后测——会不会用对象语言复述本课

### 页面骨架
- 模板：`post_quiz_stack`
- 区域：
  - `quiz-stack`：全宽，三题后测
  - `distribution`：全宽，教师端聚合分布区

### 模块清单
- `post-quiz`：`quiz-group`
- `distribution`：`teacher-only-distribution`

### 固定内容
- 三题检查点：
  - 零初值
  - 典型环节识别
  - 余子式判断

### 互动与反馈
- 组件类型：`quiz_group`
- 题目数量：3
- 答案揭示：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`attemptCount`、`resultState`、`errorBucket`、`teacherRevealSeen`
- 错因标签：`zero_initial_state`、`typical_element_identification`、`delta_k_judgment`
- 教师聚合：`question_distribution`、`top_error_question`
- 学生端显示限制：不显示全班分布，只显示个人提交态

### AI 边界
- 本页无独立 AI 模块

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-1-modeling-language/student/demo?step=step-15`
- 对齐要求：教师端聚合仅以班级分布方式出现，不下放到学生页。

---

## step-16｜总结——对象语言已建立，下一课进入响应分析

### 页面骨架
- 模板：`summary_infographic`
- 区域：
  - `summary-chain`：全宽，总结链
  - `finished-steps`：全宽，信息图
  - `next-lesson`：全宽，下一课入口

### 模块清单
- `summary-chain`：`summary-chain`
- `summary-image`：`summary-image`

### 固定内容
- 总结链：
  - 对象建立
  - 对象识别
  - 结构表达
  - 总体对象
- 信息图资源：`2-1-info.png`
- 下一课入口：2-2 时域响应分析

### 互动与反馈
- 组件类型：`none`

### 埋点与教师数据
- 埋点摘要：`viewed`、`timeOnStep`
- 教师聚合：`session_finalize_ready`

### AI 边界
- 页面目标：全课收束与下一课入口
- 允许范围：四段主线结论、2-2 入口
- 禁止范围：提前展开 2-2 指标内容

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-1-modeling-language/student/demo?step=step-16`
- 对齐要求：总结链与信息图同屏，页面结尾直接指向下一课。
