━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
互动页面设计 | 单元 2-2：时域响应基础——从响应曲线到动态性能指标
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
- 预览、埋点、教师聚合与 AI 边界都要落到步骤级，避免实现方二次猜测。

## 全课总览
| 步骤 | 标题 | 页面模板 | 主体布局 | 互动组件 | 学生页预览 |
|------|------|----------|----------|----------|------------|
| step-01 | 回到地图——从传函走向响应曲线 | `map_hero_slide` | 全幅路径图 + 任务卡 | `none` | `/interactive-learning/courses/unit-2-2-time-domain-response/student/demo?step=step-01` |
| step-02 | 情境引入——稳定并不等于表现一样 | `dual_response_vote` | 双曲线对照 + 三问清单 + 二选一判断 | `binary_choice` | `/interactive-learning/courses/unit-2-2-time-domain-response/student/demo?step=step-02` |
| step-03 | 学习目标——本课要建立哪套语言 | `goal_chain_slide` | 目标卡 + 三段方法链 | `none` | `/interactive-learning/courses/unit-2-2-time-domain-response/student/demo?step=step-03` |
| step-04 | 前测——快、稳、冲分别看什么 | `question_stack` | 三题纵向堆叠 + 提交反馈条 | `quiz_group` | `/interactive-learning/courses/unit-2-2-time-domain-response/student/demo?step=step-04` |
| step-05 | 时域分析对象与典型输入 | `table_plus_formula_plus_short_response` | 起点公式 + 输入对照表 + 短答区 | `short_response` | `/interactive-learning/courses/unit-2-2-time-domain-response/student/demo?step=step-05` |
| step-06 | 一阶系统阶跃响应与时间常数 | `courseware_top_slider_bottom` | 公式卡 + 锚点图示 + 工作区 | `parameter_slider` | `/interactive-learning/courses/unit-2-2-time-domain-response/student/demo?step=step-06` |
| step-07 | 二阶系统标准型：$\omega_n$、$\zeta$、$\omega_d$ | `parameter_role_match` | 标准型公式 + 三列表 + 对应区 | `triple_match` | `/interactive-learning/courses/unit-2-2-time-domain-response/student/demo?step=step-07` |
| step-08 | 四种响应家族对比 | `family_compare_switcher` | 家族说明卡 + 统一坐标图 + 切换区 | `tab_switch` | `/interactive-learning/courses/unit-2-2-time-domain-response/student/demo?step=step-08` |
| step-09 | 动态性能指标总览 | `metric_overview_overlay` | 四指标总览表 + 同图叠加区 | `metric_overlay` | `/interactive-learning/courses/unit-2-2-time-domain-response/student/demo?step=step-09` |
| step-10 | 上升时间的定义与推导 | `formula_explain_checklist` | 定义公式卡 + 趋势判断区 | `reason_check` | `/interactive-learning/courses/unit-2-2-time-domain-response/student/demo?step=step-10` |
| step-11 | 峰值时间与超调量 | `dual_formula_reason_check` | 双公式并列 + 主控结论卡 | `formula_pair_check` | `/interactive-learning/courses/unit-2-2-time-domain-response/student/demo?step=step-11` |
| step-12 | 调节时间与误差带 | `error_band_workspace` | 定义区 + 误差带切换区 + 结果摘要栏 | `parameter_workspace` | `/interactive-learning/courses/unit-2-2-time-domain-response/student/demo?step=step-12` |
| step-13 | 例题一——已知参数求指标 | `worked_example_workspace` | 题面与三步法 + 中间量面板 + 结果图 | `worked_example_workspace` | `/interactive-learning/courses/unit-2-2-time-domain-response/student/demo?step=step-13` |
| step-14 | 例题二——由指标反推参数区域 + AI 对照 | `compare_then_ai` | 逆向设计三步法 + AI 对照区 + 极点区域图 | `ai_compare_workspace` | `/interactive-learning/courses/unit-2-2-time-domain-response/student/demo?step=step-14` |
| step-15 | 方法总结与轻量桥接——从时域指标走向参数与极点趋势 | `mapping_table_with_plane` | 三条方法链 + 三域映射表 + 极点趋势联动区 | `mapping_highlight` | `/interactive-learning/courses/unit-2-2-time-domain-response/student/demo?step=step-15` |
| step-16 | 后测——公式会算，更要会解释 | `post_quiz_stack` | 两题客观题 + 一题解释题 | `quiz_group` | `/interactive-learning/courses/unit-2-2-time-domain-response/student/demo?step=step-16` |
| step-17 | 总结与后续预告 | `summary_infographic` | 五条结论 + 速查卡 + 去向卡 | `none` | `/interactive-learning/courses/unit-2-2-time-domain-response/student/demo?step=step-17` |

## 讲义核心内容映射
| handout_anchor | core_item_type | must_appear_content | target_step | page_mode | interaction_upgrade | media_or_table_ref | acceptance_note |
|---|---|---|---|---|---|---|---|
| `### 2.1 时域分析的研究对象、任务与典型输入` | concept+formula | `$$C(s)=G(s)R(s)$$`，`$$c(t)=\mathcal{L}^{-1}\{C(s)\}$$`，并明确本课默认围绕单位阶跃输入展开。 | `step-05` | `static+form` | 短答区只补一句“为什么默认选择单位阶跃”。 | `2-2-td-01-time-domain-input-response-overview.svg` | 静态区先完整出现定义、任务和输入对照，再开放短答。 |
| `### 2.2 一阶系统的单位阶跃响应与时间常数` | concept+formula | `$$c(t)=K(1-e^{-t/T})$$`，`$$c(T)=K(1-e^{-1})\approx0.632K$$`，以及 `$$t_r\approx2.2T,\qquad t_s\approx4T$$` 的工程近似。 | `step-06` | `static+workspace` | 滑块工作区只负责观察时间尺度如何拉伸。 | `2-2-td-02-first-order-step-time-constant.svg / ic-02-first-order-time-slider` | 页面静态区必须完整给出公式、锚点和“时间尺度”解释。 |
| `### 2.3 二阶系统标准型与单位阶跃响应的严格表达` | concept+formula | `$$\Phi(s)=\frac{\omega_n^2}{s^2+2\zeta\omega_n s+\omega_n^2}$$`，`$$\omega_d=\omega_n\sqrt{1-\zeta^2}$$`，以及“$\omega_n$ 管时间尺度、$\zeta$ 管阻尼品质、$\omega_d$ 管波峰节奏”。 | `step-07` | `static+workspace` | 三列表对应任务只强化参数角色，不重复推导。 | `2-2-td-03-second-order-response-families.svg / ic-03-second-order-family-switcher` | 静态区先交代标准型与三个参数分工。 |
| `#### 二阶系统四种典型响应形态` | response-family | 无阻尼、欠阻尼、临界阻尼、过阻尼四类响应的区间、图形特征与工程语言。 | `step-08` | `static+workspace` | 切换器只负责在统一坐标下做对照。 | `2-2-td-03-second-order-response-families.svg / ic-03-second-order-family-switcher` | 不能只给切换器，静态区必须先说明四类响应的连续谱关系。 |
| `### 2.4 动态性能指标的定义、公式与物理意义` | concept+table | 四指标必须先做全景总览：$t_r$ 看起步快慢，$t_p$ 看第一个峰出现得多快，$M_p$ 看冲过头多少，$t_s$ 看多久真正稳定。 | `step-09` | `static+workspace` | 指标叠加器只负责在同一曲线上切换标注。 | `2-2-td-04-time-domain-indices-annotated.svg / ic-04-index-overlay` | 静态区必须先出现四指标问题表，再进入叠加标注器。 |
| `#### 2.4.1 上升时间 $t_r$` | formula | `$$t_r=\frac{\pi-\arccos\zeta}{\omega_n\sqrt{1-\zeta^2}}$$`，并说明“欠阻尼标准二阶系统取第一次达到终值的时刻”。 | `step-10` | `static+form` | 趋势判断区只检查参数变化方向与解释是否一致。 | `2-2-td-04-time-domain-indices-annotated.svg` | 静态区必须显式写出定义、公式和参数影响。 |
| `#### 2.4.2 峰值时间 $t_p$ / #### 2.4.3 超调量 $M_p$` | formula | `$$t_p=\frac{\pi}{\omega_n\sqrt{1-\zeta^2}}$$`，`$$M_p=e^{-\frac{\zeta\pi}{\sqrt{1-\zeta^2}}}\times100\%$$`，并强调“$M_p$ 主要由 $\zeta$ 决定”。 | `step-11` | `static+form` | 双公式配对区只强化“什么时候冲顶 / 冲多少”的分工。 | `2-2-td-04-time-domain-indices-annotated.svg` | 静态区先完整出现两条公式和一句工程结论。 |
| `#### 2.4.4 调节时间 $t_s$` | formula | `$$t_s\approx\frac{4}{\zeta\omega_n}$$`，`$$t_s\approx\frac{3}{\zeta\omega_n}$$`，`$$t_s\approx\frac{4}{\sigma}$$`。 | `step-12` | `static+workspace` | 工作区只对比误差带变化与极点实部解释。 | `2-2-td-04-time-domain-indices-annotated.svg / ic-04-index-overlay` | 静态区必须先写清“进入并保持在误差带内”的定义，再给工程近似。 |
| `### 3.1 例题一：已知二阶系统参数，求动态性能指标` | worked-example | `$$\Phi(s)=\frac{25}{s^2+4s+25}$$`，按“读 $\omega_n,\zeta$ -> 求 $\omega_d$ -> 顺推四指标”的三步法组织。 | `step-13` | `static+workspace` | 工作区只能在三步法和中间量骨架之后开启。 | `2-2-td-05-example-response-with-indices.svg / ic-05-metric-calculator` | 静态区不能只放答案，必须显式给出三步法。 |
| `### 3.2 例题二：已知性能指标要求，反推参数范围 / #### 第一步：由超调量要求求阻尼比范围 / #### 第二步：由调节时间要求求自然频率下界` | reverse-spec+formula | `$$M_p=e^{-\frac{\zeta\pi}{\sqrt{1-\zeta^2}}}\le0.1$$`，`$$t_s\approx\frac{4}{\zeta\omega_n}\le2$$`，`$$\zeta\ge0.591,\qquad \zeta\omega_n\ge2$$`。 | `step-14` | `static+ai` | AI 只核对推理链，不直接给最终数值答案。 | `2-2-td-06-time-spec-to-pole-region.svg / ic-06-ai-compare-workspace` | 静态区必须先交代逆向设计三步法和两条边界，再开放 AI 对照。 |
| `### 3.3 例题后的方法总结 / ### 2.5 从时域指标到参数与极点趋势：本课的轻量桥接` | method-summary | 正向分析、逆向设计、跨域迁移三条方法链，以及“曲线 -> 指标 -> 参数 -> 极点”的桥接表。 | `step-15` | `static+workspace` | 联动区只高亮单条翻译，不扩展为完整设计面板。 | `2-2-td-06-time-spec-to-pole-region.svg / ic-07-metric-to-pole-plane` | 静态区必须先把方法总结说清，再做轻量可视化桥接。 |
| `### 5.1 本节必须带走的五个结论 / ### 5.2 与后续课程的衔接` | summary | 五条必须带走的结论，以及与 `2-3`、`3-3`、`4-1` 的衔接语。 | `step-17` | `static` | 速查卡只做结构化收束，不新增互动负担。 | `附录A 速查表 / 2-2-info.png` | 结尾必须收束成可复习的结构化提要。 |

---

## 步骤 01｜回到地图——从传函走向响应曲线

### 页面骨架
- 模板：`map_hero_slide`
- 区域：`header` / `lead` / `summary`

### 模块清单
- `stage-map`：课程路径图
- `today-task`：本课任务卡

### 静态承载内容
- 路径图固定高亮 `2-1 -> 2-2 -> 3-3/4-1`
- 任务卡固定写明：`2-1` 解决对象怎么写，`2-2` 解决对象如何在时间中表现
- 关键词固定为：响应曲线、动态品质、指标语言

### 互动升级点
- 组件类型：`none`
- 提交态：无
- 答案揭示：无

### 埋点与教师数据
- 埋点摘要：`viewed`、`timeOnStep`、`teacherFollowSync`
- 教师聚合：`view_count`、`sync_status`

### AI 边界
- 页面目标：标定本课在模块 2 中的位置
- 允许范围：课程路径、对象语言到时间语言的切换
- 禁止范围：提前展开指标公式或例题计算

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-2-time-domain-response/student/demo?step=step-01`
- 对齐要求：首屏直接出现路径图与任务卡，无作答区占位

## 步骤 02｜情境引入——稳定并不等于表现一样

### 页面骨架
- 模板：`dual_response_vote`
- 区域：`chart` / `questions` / `interaction`

### 模块清单
- `response-compare`：双曲线对照图
- `core-questions`：三问列表
- `binary-vote`：二选一判断区

### 静态承载内容
- 同终值但不同动态过程的两条响应曲线必须同屏可见
- 三问固定为：谁更快、谁更容易让操作者觉得不稳当、为什么最终稳定还不够
- 结论卡固定写明：稳定是底线，动态过程也是评价对象

### 互动升级点
- 组件类型：`binary_choice`
- 选项结构：
  - A：只要最终稳定，控制品质就足够好
  - B：动态过程也必须纳入评价
- 正确项：`B`
- 错误反馈：只提示“动态过程本身也是品质信息”
- 答案揭示：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`selectedOption`、`resultState`、`teacherRevealSeen`、`timeOnStep`
- 教师聚合：`option_distribution`、`reveal_correction_rate`

### AI 边界
- 页面目标：把“稳定”和“动态品质”区分开
- 允许范围：稳定、快慢、超调、平稳性这些工程语言
- 禁止范围：完整指标公式与极点解释

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-2-time-domain-response/student/demo?step=step-02`
- 对齐要求：两条曲线与三问在未作答状态下都完整可见

## 步骤 03｜学习目标——本课要建立哪套语言

### 页面骨架
- 模板：`goal_chain_slide`
- 区域：`goals` / `chain`

### 模块清单
- `goal-cards`：三目标卡组
- `method-chain`：曲线到极点趋势的链式关系图

### 静态承载内容
- 三张目标卡固定对应：会看曲线、会算指标、会连参数与极点趋势
- 主链固定为：`曲线 -> 指标 -> 参数 -> 极点趋势`
- 本页不承载新公式，只建立全课预期

### 互动升级点
- 组件类型：`none`

### 埋点与教师数据
- 埋点摘要：`viewed`、`timeOnStep`
- 教师聚合：`view_count`

### AI 边界
- 页面目标：建立本课能力边界
- 允许范围：三项目标与主链关系
- 禁止范围：代替后续步骤提前解释公式细节

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-2-time-domain-response/student/demo?step=step-03`
- 对齐要求：目标卡与主链同时落页，不折叠为摘要

## 步骤 04｜前测——快、稳、冲分别看什么

### 页面骨架
- 模板：`question_stack`
- 区域：`question-stack` / `submit-bar`

### 模块清单
- `pretest-q1`：时间常数判断题
- `pretest-q2`：超调指标判断题
- `pretest-q3`：稳定与无超调辨析题

### 静态承载内容
- 三道题干全部明文落页
- 误区提示区固定列出：稳定不等于无超调、快不等于稳、指标名称不能混用

### 互动升级点
- 组件类型：`quiz_group`
- 题目数量：3
- 作答模型：允许重提一次；教师端区分首答与重提
- 答案揭示：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`attemptCount`、`resultState`、`errorBucket`、`teacherRevealSeen`
- 教师聚合：`question_distribution`、`top_misconceptions`

### AI 边界
- 页面目标：暴露概念混淆
- 允许范围：误区解释与错因归类
- 禁止范围：替代作答或提前展开完整讲解

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-2-time-domain-response/student/demo?step=step-04`
- 对齐要求：三题在未作答状态下全部可见

## 步骤 05｜时域分析对象与典型输入

### 页面骨架
- 模板：`table_plus_formula_plus_short_response`
- 区域：`formula-strip` / `contrast-table` / `reflection`

### 模块清单
- `entry-formulas`：起点公式卡
- `input-contrast`：典型输入对照表
- `step-response-note`：单位阶跃说明卡
- `short-response`：短答栏

### 静态承载内容
- 公式必须完整出现：

$$
C(s)=G(s)R(s)
$$

$$
c(t)=\mathcal{L}^{-1}\{C(s)\}
$$

- 输入对照表固定包含单位脉冲、单位阶跃、单位斜坡
- 明确本课默认围绕单位阶跃响应展开

### 互动升级点
- 组件类型：`short_response`
- 短答句式：本课默认用单位阶跃，是因为 ________
- 反馈规则：保存文本，不即时判错

### 埋点与教师数据
- 埋点摘要：`responseSubmitted`、`responseLength`、`timeOnStep`
- 教师聚合：`response_word_cloud`、`common_reason_tags`

### AI 边界
- 页面目标：从对象语言切到时间语言
- 允许范围：时域分析任务、典型输入选择理由
- 禁止范围：把短答直接改写成标准答案

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-2-time-domain-response/student/demo?step=step-05`
- 对齐要求：起点公式、输入对照表和短答栏同时出现

## 步骤 06｜一阶系统阶跃响应与时间常数

### 页面骨架
- 模板：`courseware_top_slider_bottom`
- 区域：`formula-card` / `media` / `workspace`

### 模块清单
- `first-order-formulas`：一阶系统公式卡
- `time-constant-figure`：锚点图示
- `time-constant-slider`：时间常数滑块工作区

### 静态承载内容
- 公式卡必须同时包含：

$$
G(s)=\frac{K}{Ts+1},\qquad c(t)=K(1-e^{-t/T})
$$

$$
c(T)=K(1-e^{-1})\approx0.632K
$$

$$
t_r\approx2.2T,\qquad t_s\approx4T
$$

- 结论卡固定写明：$T$ 改变时间尺度，不改变最终高度

### 互动升级点
- 组件类型：`parameter_slider`
- 参数：`T`
- 反馈规则：联动曲线、63.2% 锚点、近似 $t_r/t_s$
- 答案揭示：无标准答案，仅保留趋势判断记录

### 埋点与教师数据
- 埋点摘要：`sliderChanged`、`anchorViewed`、`predictionSubmitted`
- 教师聚合：`time_constant_distribution`、`prediction_summary`

### AI 边界
- 页面目标：把时间常数与“整体拉长”绑定
- 允许范围：时间常数、63.2% 锚点、近似时间尺度
- 禁止范围：AI 直接替代趋势判断

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-2-time-domain-response/student/demo?step=step-06`
- 对齐要求：静态公式与滑块工作区同屏，滑块不可替代公式卡

## 步骤 07｜二阶系统标准型：$\omega_n$、$\zeta$、$\omega_d$

### 页面骨架
- 模板：`parameter_role_match`
- 区域：`formula-card` / `role-table` / `match-zone`

### 模块清单
- `second-order-standard-form`：标准型公式卡
- `parameter-role-table`：三列表
- `triple-match`：参数角色对应区

### 静态承载内容
- 公式卡必须完整出现：

$$
\Phi(s)=\frac{\omega_n^2}{s^2+2\zeta\omega_n s+\omega_n^2}
$$

$$
\omega_d=\omega_n\sqrt{1-\zeta^2}
$$

- 三列表固定说明：
  - $\omega_n$：时间尺度
  - $\zeta$：阻尼品质
  - $\omega_d$：波峰节奏

### 互动升级点
- 组件类型：`triple_match`
- 任务：参数名、数学式、主控现象三列对应
- 反馈规则：即时标对错，可重试

### 埋点与教师数据
- 埋点摘要：`matchAttempted`、`matchCorrected`、`timeOnStep`
- 教师聚合：`common_mismatch_pairs`、`completion_rate`

### AI 边界
- 页面目标：分清三个参数的职责
- 允许范围：标准型结构、参数角色说明
- 禁止范围：提前进入四类响应家族或指标公式

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-2-time-domain-response/student/demo?step=step-07`
- 对齐要求：公式卡与三列表必须先落页，对应区为升级层

## 步骤 08｜四种响应家族对比

### 页面骨架
- 模板：`family_compare_switcher`
- 区域：`family-summary` / `shared-chart` / `switcher`

### 模块清单
- `family-spectrum-card`：连续谱说明卡
- `family-chart`：统一坐标图
- `family-switcher`：家族切换器

### 静态承载内容
- 固定说明四类响应与阻尼比区间：
  - 无阻尼：$\zeta=0$
  - 欠阻尼：$0<\zeta<1$
  - 临界阻尼：$\zeta=1$
  - 过阻尼：$\zeta>1$
- 必须明确写出：它们是阻尼比连续变化形成的一条谱

### 互动升级点
- 组件类型：`tab_switch`
- 反馈规则：切换家族时同步刷新曲线与一句工程语言
- 答案揭示：无

### 埋点与教师数据
- 埋点摘要：`familySwitched`、`compareViewToggled`
- 教师聚合：`family_focus_distribution`

### AI 边界
- 页面目标：把“看图认形态”升级为“看阻尼比认家族”
- 允许范围：四类响应的区间、图形特征、工程语言
- 禁止范围：把临界阻尼绝对化为“永远最好”

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-2-time-domain-response/student/demo?step=step-08`
- 对齐要求：统一坐标图始终可见，切换器不单独占页

## 步骤 09｜动态性能指标总览

### 页面骨架
- 模板：`metric_overview_overlay`
- 区域：`summary-table` / `overlay-chart`

### 模块清单
- `metric-overview-table`：四指标问题表
- `metric-overlay`：同图叠加标注器

### 静态承载内容
- 总览表固定包含 $t_r$、$t_p$、$M_p$、$t_s$ 的“回答什么问题 / 在曲线上量哪里”
- 图示固定使用同一条欠阻尼响应

### 互动升级点
- 组件类型：`metric_overlay`
- 反馈规则：点击指标标签切换相应标注点与说明
- 答案揭示：无

### 埋点与教师数据
- 埋点摘要：`metricToggled`、`timeOnStep`
- 教师聚合：`metric_attention_distribution`

### AI 边界
- 页面目标：先建全景，再进入分项推导
- 允许范围：四指标定义与问题映射
- 禁止范围：跳过总览直接引用单项公式

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-2-time-domain-response/student/demo?step=step-09`
- 对齐要求：总览表必须完整落页，叠加器只是升级层

## 步骤 10｜上升时间的定义与推导

### 页面骨架
- 模板：`formula_explain_checklist`
- 区域：`definition-card` / `formula-card` / `reason-check`

### 模块清单
- `rise-time-definition`：定义卡
- `rise-time-formula`：公式卡
- `rise-time-reason-check`：趋势判断区

### 静态承载内容
- 定义卡固定写明：欠阻尼标准二阶系统的 $t_r$ 取第一次达到终值的时刻
- 公式卡必须完整出现：

$$
t_r=\frac{\pi-\arccos\zeta}{\omega_n\sqrt{1-\zeta^2}}
$$

- 结论卡固定写明：$\omega_n$ 和 $\zeta$ 都会影响 $t_r$

### 互动升级点
- 组件类型：`reason_check`
- 任务：判断固定 $\zeta$ 时增大 $\omega_n$ 对 $t_r$ 的影响，并提交一句理由
- 反馈规则：先收集理由，再开放参考解释

### 埋点与教师数据
- 埋点摘要：`predictionSubmitted`、`reasonLength`、`teacherRevealSeen`
- 教师聚合：`prediction_distribution`、`reason_tag_cloud`

### AI 边界
- 页面目标：把公式读成参数趋势
- 允许范围：定义、公式、参数变化方向
- 禁止范围：只给对错、不要求解释

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-2-time-domain-response/student/demo?step=step-10`
- 对齐要求：定义、公式、判断区三者同屏

## 步骤 11｜峰值时间与超调量

### 页面骨架
- 模板：`dual_formula_reason_check`
- 区域：`formula-pair` / `key-claim` / `check-zone`

### 模块清单
- `peak-time-formula`：峰值时间公式卡
- `overshoot-formula`：超调量公式卡
- `main-claim-card`：主控结论卡
- `formula-pair-check`：配对判断区

### 静态承载内容
- 公式卡必须完整出现：

$$
t_p=\frac{\pi}{\omega_n\sqrt{1-\zeta^2}}
$$

$$
M_p=e^{-\frac{\zeta\pi}{\sqrt{1-\zeta^2}}}\times100\%
$$

- 主控结论卡固定写明：$M_p$ 主要由 $\zeta$ 决定

### 互动升级点
- 组件类型：`formula_pair_check`
- 任务：区分“什么时候冲顶”与“冲了多少”
- 反馈规则：即时判定，可重试一次

### 埋点与教师数据
- 埋点摘要：`formulaMatched`、`claimViewed`
- 教师聚合：`formula_confusion_rate`

### AI 边界
- 页面目标：拆开两个常被混淆的指标
- 允许范围：峰值时间、超调量、主控参数
- 禁止范围：把 $\omega_n$ 误写成 $M_p$ 主控量

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-2-time-domain-response/student/demo?step=step-11`
- 对齐要求：两条公式与主控结论必须先完整出现

## 步骤 12｜调节时间与误差带

### 页面骨架
- 模板：`error_band_workspace`
- 区域：`definition-card` / `formula-card` / `workspace` / `summary`

### 模块清单
- `settling-definition`：定义卡
- `settling-formulas`：近似公式卡
- `settling-workspace`：误差带工作区
- `settling-summary`：结果摘要栏

### 静态承载内容
- 定义卡固定写明：进入并保持在允许误差带内所需的最短时间
- 公式卡必须完整出现：

$$
t_s\approx\frac{4}{\zeta\omega_n}\qquad (2\%\text{误差带})
$$

$$
t_s\approx\frac{3}{\zeta\omega_n}\qquad (5\%\text{误差带})
$$

$$
t_s\approx\frac{4}{\sigma},\qquad \sigma=\zeta\omega_n
$$

### 互动升级点
- 组件类型：`parameter_workspace`
- 参数：`settleBand`、`\zeta`、`\omega_n`
- 反馈规则：联动误差带、估算结果与极点实部说明

### 埋点与教师数据
- 埋点摘要：`bandChanged`、`parameterChanged`、`teacherRevealAdvanced`
- 教师聚合：`band_selection_distribution`、`common_reason_tags`

### AI 边界
- 页面目标：把误差带定义与极点实部联系起来
- 允许范围：2% / 5% 误差带、$\sigma=\zeta\omega_n$
- 禁止范围：把近似公式当作无条件精确结论

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-2-time-domain-response/student/demo?step=step-12`
- 对齐要求：定义卡和近似公式卡必须先落页，工作区用于对照

## 步骤 13｜例题一——已知参数求指标

### 页面骨架
- 模板：`worked_example_workspace`
- 区域：`problem` / `method` / `workspace` / `chart`

### 模块清单
- `example-problem`：题面卡
- `three-step-method`：三步法卡
- `metric-workspace`：中间量计算面板
- `example-chart`：响应曲线与结果图

### 静态承载内容
- 题面卡必须完整出现：

$$
\Phi(s)=\frac{25}{s^2+4s+25}
$$

- 三步法固定为：读 $\omega_n,\zeta$ -> 求 $\omega_d$ -> 顺推四指标
- 结果图固定强调“数值与曲线位置一一对应”

### 互动升级点
- 组件类型：`worked_example_workspace`
- 任务：先填写解题顺序，再填写中间量
- 反馈规则：中间量有即时校验，最终结果允许重算

### 埋点与教师数据
- 埋点摘要：`methodCompleted`、`intermediateValueEdited`、`resultChecked`
- 教师聚合：`wrong_step_distribution`、`common_error_fields`

### AI 边界
- 页面目标：把四指标顺推流程固定成可复用模板
- 允许范围：参数识别、中间量、曲线对应关系
- 禁止范围：跳过三步法直接只给答案

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-2-time-domain-response/student/demo?step=step-13`
- 对齐要求：题面、三步法、结果图同页并列，不折叠成抽屉

## 步骤 14｜例题二——由指标反推参数区域 + AI 对照

### 页面骨架
- 模板：`compare_then_ai`
- 区域：`method` / `constraints` / `ai-panel` / `pole-region`

### 模块清单
- `reverse-design-method`：逆向设计三步法
- `constraint-formulas`：约束公式区
- `ai-compare-workspace`：AI 对照区
- `pole-region-card`：参数区域图

### 静态承载内容
- 题面要求固定为：$M_p\le10\%$、2% 误差带下 $t_s\le2\,\text{s}$
- 公式区必须完整出现：

$$
M_p=e^{-\frac{\zeta\pi}{\sqrt{1-\zeta^2}}}\le0.1
$$

$$
t_s\approx\frac{4}{\zeta\omega_n}\le2
$$

$$
\zeta\ge0.591,\qquad \zeta\omega_n\ge2
$$

- 区域图必须说明“不能太冲”和“不能太慢”各自对应的边界

### 互动升级点
- 组件类型：`ai_compare_workspace`
- 任务：先提交自己的约束翻译，再开启 AI 对照
- 反馈规则：AI 第一轮只指出逻辑缺口，不直接给最终答案
- 答案揭示：`draft_gate`

### 埋点与教师数据
- 埋点摘要：`draftSubmitted`、`aiOpened`、`aiRoundCompleted`、`revisionConfirmed`
- 教师聚合：`draft_completion_rate`、`ai_usage_rate`、`common_logic_gaps`

### AI 边界
- 页面目标：坚持“先做 -> 再问 AI -> 再修正”
- 允许范围：约束翻译、方向判断、漏项提醒
- 禁止范围：直接返回完整数值解或代替完成反推

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-2-time-domain-response/student/demo?step=step-14`
- 对齐要求：三步法、公式区、AI 对照区与区域图都在同一页结构内

## 步骤 15｜方法总结与轻量桥接——从时域指标走向参数与极点趋势

### 页面骨架
- 模板：`mapping_table_with_plane`
- 区域：`method-links` / `mapping-table` / `highlight-plane`

### 模块清单
- `method-links`：三条方法链
- `metric-parameter-pole-table`：映射表
- `metric-to-pole-highlight`：高亮联动区

### 静态承载内容
- 三条方法链固定为：正向分析、逆向设计、跨域迁移
- 映射表固定包含：
  - 更快 -> $\omega_n$ 更大、$\sigma$ 更大 -> 极点更靠左
  - 更小超调 -> $\zeta$ 更大 -> 阻尼角度约束更强
  - 更短调节时间 -> $\zeta\omega_n$ 更大 -> 实部边界左移
- 明确声明：本页只做轻量桥接，不进入完整设计面板

### 互动升级点
- 组件类型：`mapping_highlight`
- 反馈规则：点击单行后高亮对应参数语与极点趋势
- 答案揭示：无

### 埋点与教师数据
- 埋点摘要：`mappingRowSelected`、`hoverFormula`
- 教师聚合：`mapping_focus_distribution`

### AI 边界
- 页面目标：把时域语言翻译到参数与极点趋势
- 允许范围：映射关系、趋势说明
- 禁止范围：扩展成完整设计器或完整根轨迹教学

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-2-time-domain-response/student/demo?step=step-15`
- 对齐要求：映射表是主视觉，高亮区只做单条翻译强化

## 步骤 16｜后测——公式会算，更要会解释

### 页面骨架
- 模板：`post_quiz_stack`
- 区域：`quiz-stack` / `submit-bar`

### 模块清单
- `posttest-q1`：调节时间判断题
- `posttest-q2`：超调参数判断题
- `posttest-q3`：解释题

### 静态承载内容
- 提示区固定写明：后测同时检查“会不会算”和“会不会解释”
- 三道题全部明文落页

### 互动升级点
- 组件类型：`quiz_group`
- 题目数量：3
- 答案揭示：`teacher_toggle`
- 反馈规则：客观题即时统计，解释题进入教师聚合摘要

### 埋点与教师数据
- 埋点摘要：`attemptCount`、`resultState`、`teacherRevealSeen`
- 教师聚合：`question_distribution`、`explanation_tag_summary`

### AI 边界
- 页面目标：检验是否能把结果说回工程语言
- 允许范围：后测结果解释
- 禁止范围：AI 代答解释题

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-2-time-domain-response/student/demo?step=step-16`
- 对齐要求：两题客观题与一题解释题必须同页可见

## 步骤 17｜总结与后续预告

### 页面骨架
- 模板：`summary_infographic`
- 区域：`takeaways` / `cheatsheet` / `next-links`

### 模块清单
- `five-takeaways`：五条必须带走的结论
- `quick-reference-card`：速查卡
- `next-course-links`：后续课程去向卡

### 静态承载内容
- 五条结论必须完整落页
- 去向卡固定指向 `2-3`、`3-3`、`4-1`
- 速查卡资源使用 `2-2-info.png`

### 互动升级点
- 组件类型：`none`

### 埋点与教师数据
- 埋点摘要：`viewed`、`quickReferenceOpened`
- 教师聚合：`quick_reference_open_rate`

### AI 边界
- 页面目标：把本课收束成可复习结构
- 允许范围：本课结论与后续去向
- 禁止范围：新增未在讲义出现的新知识点

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-2-2-time-domain-response/student/demo?step=step-17`
- 对齐要求：五条结论、速查卡、后续去向卡在同页完成收束

## 资源占位清单
| 编号 | 资源名称 | 所在步骤 | 类型 | 优先级 |
|------|----------|----------|------|--------|
| R-01 | 2-2-td-01-time-domain-input-response-overview.svg | step-05 | 代码直出图 | P0 |
| R-02 | 2-2-td-02-first-order-step-time-constant.svg | step-06 | 代码直出图 | P0 |
| R-03 | 2-2-td-03-second-order-response-families.svg | step-08 | 代码直出图 | P0 |
| R-04 | 2-2-td-04-time-domain-indices-annotated.svg | step-09~12 | 代码直出图 | P0 |
| R-05 | 2-2-td-05-example-response-with-indices.svg | step-13 | 代码直出图 | P1 |
| R-06 | 2-2-td-06-time-spec-to-pole-region.svg | step-14~15 | 代码直出图 | P0 |
| R-07 | ic-02-first-order-time-slider | step-06 | 前端绘制 | P0 |
| R-08 | ic-03-second-order-family-switcher | step-08 | 前端绘制 | P0 |
| R-09 | ic-04-index-overlay | step-09~12 | 前端绘制 | P0 |
| R-10 | ic-05-metric-calculator | step-13 | 前端绘制 | P1 |
| R-11 | ic-06-ai-compare-workspace | step-14 | 前端绘制 | P0 |
| R-12 | ic-07-metric-to-pole-plane | step-15 | 前端绘制 | P0 |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
