━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
互动页面设计 | 单元 3-8：频域判别与跨域综合语言
技术栈：Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 文档职责
- 本文件是供人审阅的页面蓝图，只描述页面模板、固定内容、互动组件、反馈规则、教师聚合、AI 边界与学生页预览口径。
- 同目录 [interactive-contract.yaml](./interactive-contract.yaml) 是机读契约；两者必须逐步骤一一对应。
- 本文件不是讲义摘要，不写教师台词，不把关键公式、图表、例题或结论留给实现阶段补脑。
- 默认预览口径固定为学生演示页；教师端模板弹窗只用于查看课堂骨架，不代替真实页面预览。

## 表述规则
- 页面描述只保留客观结构：区域、模块、文本、公式、图片、表格、互动组件、反馈规则、教师聚合与验收条件。
- 动作化表述禁用：`展示`、`引导`、`让学生`、`先做一次`、`教师讲`、`跟着算` 等。
- 静态内容优先。互动组件只负责预测、判稳、配对、对照和误判纠正，不替代核心公式、图表、例题与判断链。
- 本课主线固定为：`结构变化的频域指纹 -> Nyquist / Bode 判稳统一 -> 三频段分工 -> 工程案例读回 -> 3-9 / 模块4 入口`。

## 全课总览
| 步骤 | 标题 | 页面模板 | 主体布局 | 互动组件 | 学生页预览 |
|------|------|----------|----------|----------|------------|
| step-01 | 回到地图：把 3-5 与 3-7 收成同一个频域问题 | `map_hero_slide` | 路径图 + 主问题卡 + 边界卡 | `none` | `/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-01` |
| step-02 | 情境引入：为什么同样是结构变了，频域里看起来完全不同 | `comparison_gallery_with_prompt` | 四图对照 + 两问清单 + 判断区 | `binary_choice` | `/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-02` |
| step-03 | 学习目标与边界：本课统一翻译，不重开新章 | `goal_boundary_slide` | 目标卡 + 边界表 | `none` | `/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-03` |
| step-04 | 前测：四类典型误判先暴露出来 | `question_stack` | 四题前测 + 提交反馈条 | `quiz_group` | `/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-04` |
| step-05 | 频域翻译总表：增益、零点、积分与非最小相各改哪一段 | `formula_table_match` | 总表 + 频带说明 + 配对区 | `triple_match` | `/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-05` |
| step-06 | 从 $F(s)=1+L(s)$ 到 $(-1,0)$：Nyquist 判稳为什么成立 | `formula_media_compare` | 推导卡 + 几何示意 + 顺序区 | `reason_check` | `/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-06` |
| step-07 | 快速判稳：先数 $P$，再数 $N$，最后算 $Z$ | `comparison_panel_with_sort` | 四图判稳表 + 排序区 | `card_sort` | `/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-07` |
| step-08 | Bode 判稳：截止频率、相角裕度、增益裕度不是另一套规则 | `dual_graph_indicator_locator` | Bode 图 + 指标表 + 标注区 | `hotspot_labeling` | `/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-08` |
| step-09 | 三频段分工：精度、速度和代价该分开看 | `compare_then_ai` | 三频段总图 + 目标切换卡 + AI 对照区 | `ai_compare_workspace` | `/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-09` |
| step-10 | 航向控制案例：中频超前为什么能同时更快且更稳 | `design_compare_workspace` | 基线/校正 2×2 对照 + 指标卡 + 比较区 | `structured_compare` | `/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-10` |
| step-11 | 稳定平台案例：只降增益为什么不如中频定向校正 | `design_compare_workspace` | 三方案 2×2 对照 + 结论表 + 比较区 | `structured_compare` | `/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-11` |
| step-12 | 后测与收束：频域不是新章，而是模块 3 的统一判断地图 | `summary_quiz_board` | 后测题组 + 结论卡 + 去向卡 | `quiz_group` | `/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-12` |

## 讲义核心内容映射
| handout_anchor | core_item_type | must_appear_content | target_step | page_mode | interaction_upgrade | media_or_table_ref | acceptance_note |
|---|---|---|---|---|---|---|---|
| `## 一、引入：为什么同样是结构变了，频域图上的反应却完全不同` | concept+question | 四类结构变化的并排问题意识：同样是结构变化，为何落在不同频带、带来不同收益与代价。 | `step-02` | `static+choice` | 二选一判断只用于暴露“频域只是新公式章节”的误区。 | `3-8-gain-effect.png / 3-8-zero-effect.png / 3-8-pole-effect.png / 3-8-rhp-zero-effect.png` | 四图与两问必须先于判断区完整可见。 |
| `### 2.1 频域是统一翻译器 / ### 2.2 四类结构变化的频域指纹` | concept+table | 结构变化 -> 开环频率特性改写 -> 稳定边界变化 -> 闭环后果 的统一判断链，以及四类变化优先改写哪一段频率。 | `step-05` | `static+interactive` | 配对区只负责把“变化类型 / 主要频带 / 典型收益代价”对应起来。 | `频域翻译总表` | 总表与频带说明必须先于配对区出现。 |
| `### 2.3 从幅角原理到 Nyquist 判据` | formula+concept | $F(s)=1+L(s)$、幅角原理、临界点 $(-1,0)$ 与 `Z=P-N` 的统一链。 | `step-06` | `static+interactive` | 顺序判断只负责固定“先看什么、后看什么”，不替代推导卡。 | `3-8-nyquist-example-check.png` | 公式卡、几何示意和顺序区必须同屏。 |
| `#### 例题 2：第一组快速判稳题 / #### 例题 3：第二组设计型例题` | worked-example+table | 四图判稳表、`P/N/Z` 固定顺序，以及“靠近边界”和“已越界”的图区分。 | `step-07` | `static+interactive` | 排序区只负责按稳定状态或边界接近程度归类。 | `3-8-nyquist-quickcheck.png / 3-8-nyquist-example.png` | 判稳表和图例必须在未作答状态下可见。 |
| `### 2.4 Bode 判稳与稳定裕度 / #### 例题 4：由 Bode 图直接判稳` | formula+graph | 截止频率、相位穿越频率、相角裕度、增益裕度的定义线与“开环读余量”的边界。 | `step-08` | `static+interactive` | 标注区只负责把线和量对上，不代替指标表。 | `3-8-bode-example.png` | Bode 图与指标表必须完整落页。 |
| `### 2.5 三频段分工：谁负责精度，谁负责速度，谁负责代价 / #### 例题 5：按频段安排校正目标` | concept+ai | 低频/中频/高频任务分工，以及目标切换时优先改哪一段频率的判断。 | `step-09` | `static+ai` | AI 对照区只核对“先判断频段、再问 AI”的链条。 | `3-8-three-band-overview.png` | 三频段总图、目标切换卡和 AI 边界必须同屏。 |
| `#### 2.6.1 船舶航向控制：超前校正把“较慢且超调偏大”改成“更快且更稳”` | case+comparison | 基线与超前校正后的 2×2 对照、相角裕度/截止频率/带宽/超调/调节时间联动读回。 | `step-10` | `static+interactive` | 结构化比较只负责归纳“主要改写哪一段频率、换来什么”。 | `3-8-heading-baseline.png / 3-8-heading-case.png` | 两组 2×2 图和指标卡必须同页可见。 |
| `#### 2.6.2 稳定平台：单纯降增益不够，超前校正更能兼顾速度与平稳` | case+comparison | 激进基线、仅降增益、超前校正三方案比较，以及“只降增益不如中频超前”的结论。 | `step-11` | `static+interactive` | 结构化比较只负责对照“速度 / 超调 / 余量 / 高频代价”。 | `3-8-platform-block-diagram.png / 3-8-platform-baseline.png / 3-8-platform-case.png` | 控制框图和三方案对照必须同页落下。 |
| `## 三、本节小结` | summary+quiz | 统一翻译器、判稳统一链、三频段分工和工程判断地图四条结论，以及去往 `3-9 / 4-1` 的路径。 | `step-12` | `static+quiz` | 后测只检查判断顺序与边界，不替代结论卡。 | `3-8-info.png` | 小结卡、去向卡和后测题必须同页。 |

## 步骤 01｜回到地图：把 3-5 与 3-7 收成同一个频域问题

### 页面骨架
- 模板：`map_hero_slide`
- 区域：`header` / `lead` / `summary`

### 模块清单
- `stage-map`：模块 3 路径图
- `core-question-card`：主问题卡
- `boundary-card`：边界卡

### 静态承载内容
- 路径图固定高亮 `3-5 -> 3-7 -> 3-8 -> 3-9`。
- 主问题卡固定写明：
  - 同样是结构变了，为什么频域里看起来完全不同？
  - 为什么频域不只是判稳，还能读出收益与代价？
- 边界卡固定写明：本课不重讲 Bode / Nyquist 作图基础，不进入模块 4 的完整选型与整定。

### 互动升级点
- 组件类型：`none`

### 埋点与教师数据
- 埋点摘要：`viewed`、`timeOnStep`、`teacherFollowSync`
- 教师聚合：`view_count`、`sync_status`

### AI 边界
- 页面目标：标定 `3-8` 位于模块 3 理论收束点。
- 允许范围：课程路径、`3-5 / 3-7 / 3-8 / 3-9` 的衔接。
- 禁止范围：提前展开判据与公式细节。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-01`
- 对齐要求：首屏直接出现路径图、主问题卡和边界卡。

## 步骤 02｜情境引入：为什么同样是结构变了，频域里看起来完全不同

### 页面骨架
- 模板：`comparison_gallery_with_prompt`
- 区域：`gallery` / `questions` / `interaction`

### 模块清单
- `fingerprint-gallery`：四图对照区
- `core-questions`：两问清单
- `binary-vote`：二选一判断区

### 静态承载内容
- 四图固定使用：
  - `3-8-gain-effect.png`
  - `3-8-zero-effect.png`
  - `3-8-pole-effect.png`
  - `3-8-rhp-zero-effect.png`
- 两问固定为：
  - 为什么同样是结构变化，首先改写的频率段却不同？
  - 为什么右半平面零点可能“看起来更强”，却不一定更好控？
- 结论卡固定写明：频域判断必须同时看幅值和相位，不能只看“曲线抬高了没有”。

### 互动升级点
- 组件类型：`binary_choice`
- 选项：
  - A：只要幅频曲线抬高，系统一定更快更好
  - B：还要同时看相位代价和被改写的频段
- 正确项：`B`
- 揭示规则：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`selectedOption`、`resultState`
- 教师聚合：`option_distribution`、`misconception_rate`

### AI 边界
- 页面目标：修正“只看幅值”的第一层误判。
- 允许范围：四类变化的落点、幅值与相位双判断。
- 禁止范围：提前展开 Nyquist 判据或模块 4 设计结论。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-02`
- 对齐要求：四图与两问清单必须先于判断区出现。

## 步骤 03｜学习目标与边界：本课统一翻译，不重开新章

### 页面骨架
- 模板：`goal_boundary_slide`
- 区域：`goals` / `boundary`

### 模块清单
- `goal-cards`：四项目标卡
- `boundary-table`：负责 / 不负责边界表

### 静态承载内容
- 四项目标卡固定对应：会翻译四类结构变化、会做 `P/N/Z` 判稳、会读裕度、会按三频段读回工程后果。
- 边界表固定写明：
  - 本课负责：统一翻译、判稳、裕度、三频段与工程案例读回。
  - 本课不负责：作图基础重练、完整补偿参数计算、模块 4 方案排序。

### 互动升级点
- 组件类型：`none`

### 埋点与教师数据
- 埋点摘要：`viewed`、`timeOnStep`
- 教师聚合：`view_count`

### AI 边界
- 页面目标：建立清晰课堂边界。
- 允许范围：目标卡、边界表、模块 3 出口定位。
- 禁止范围：偷渡后续模块内容。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-03`
- 对齐要求：目标卡与边界表必须同屏。

## 步骤 04｜前测：四类典型误判先暴露出来

### 页面骨架
- 模板：`question_stack`
- 区域：`question-stack` / `submit-bar`

### 模块清单
- `pretest-q1`：增益 vs 积分频段误判
- `pretest-q2`：Nyquist 判稳顺序误判
- `pretest-q3`：截止频率 vs 带宽误判
- `pretest-q4`：非最小相速度直觉误判

### 静态承载内容
- 四道题干全部明文落页。
- 误区提示固定列出：
  - 频域变化先看频段，不先看结论；
  - Nyquist 判稳先数 `P`；
  - 开环读余量，闭环看带宽；
  - 非最小相不能简单追求更大带宽。

### 互动升级点
- 组件类型：`quiz_group`
- 作答模型：允许重提一次；教师端区分首答与重提
- 揭示规则：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`attemptCount`、`resultState`、`errorBucket`
- 教师聚合：`question_distribution`、`top_misconceptions`

### AI 边界
- 页面目标：暴露起点误区，不拉开成绩差距。
- 允许范围：错因标签、术语纠偏。
- 禁止范围：代替作答。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-04`
- 对齐要求：四题在未作答状态下全部可见。

## 步骤 05｜频域翻译总表：增益、零点、积分与非最小相各改哪一段

### 页面骨架
- 模板：`formula_table_match`
- 区域：`table` / `summary` / `interaction`

### 模块清单
- `translation-table`：频域翻译总表
- `frequency-band-note`：频带说明卡
- `match-zone`：配对区

### 静态承载内容
- 总表列固定为：
  - 结构变化类型；
  - 主要改写频带；
  - 幅值 / 相位主变化；
  - 典型收益；
  - 典型代价。
- 频带说明固定写明：
  - 增益提升更像整体抬高；
  - 左半平面零点更偏中频；
  - 积分 / 滞后优先低频；
  - 非最小相先暴露相位代价。

### 互动升级点
- 组件类型：`triple_match`
- 任务：把“变化类型 / 首要频带 / 典型收益与代价”对应起来
- 反馈规则：即时标对错，可重试

### 埋点与教师数据
- 埋点摘要：`matchAttempted`、`matchCorrected`
- 教师聚合：`common_mismatch_pairs`

### AI 边界
- 页面目标：把“先看哪一段频率”立成固定动作。
- 允许范围：结构变化、频带、幅值与相位落点。
- 禁止范围：直接跳到设计方案排序。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-05`
- 对齐要求：总表和频带说明必须先于配对区出现。

## 步骤 06｜从 $F(s)=1+L(s)$ 到 $(-1,0)$：Nyquist 判稳为什么成立

### 页面骨架
- 模板：`formula_media_compare`
- 区域：`formula` / `media` / `interaction`

### 模块清单
- `f-of-s-card`：辅助函数公式卡
- `argument-principle-card`：幅角原理卡
- `critical-point-graphic`：临界点几何示意
- `reason-check`：顺序判断区

### 静态承载内容
- 公式卡必须完整出现：
  $$
  F(s)=1+L(s)
  $$
  $$
  \Delta \arg F(s)=2\pi(Z-P)
  $$
  $$
  Z=P-N
  $$
- 几何示意固定写明：闭环稳定问题被改写成“Nyquist 曲线怎样对待 $(-1,0)$”。

### 互动升级点
- 组件类型：`reason_check`
- 任务：判断“先写辅助函数 / 先数 P / 先数 N / 先下稳定结论”的正确顺序
- 反馈规则：只回显顺序，不补新推导

### 埋点与教师数据
- 埋点摘要：`selectionState`、`resultState`
- 教师聚合：`confusion_matrix`

### AI 边界
- 页面目标：把 Nyquist 判稳的逻辑链固定下来。
- 允许范围：辅助函数、幅角原理、临界点。
- 禁止范围：把判据重新简化成只背口号。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-06`
- 对齐要求：三条公式与临界点示意必须同屏。

## 步骤 07｜快速判稳：先数 $P$，再数 $N$，最后算 $Z$

### 页面骨架
- 模板：`comparison_panel_with_sort`
- 区域：`media` / `table` / `interaction`

### 模块清单
- `quickcheck-graphic`：四图判稳总图
- `pnz-table`：判稳结果表
- `sort-zone`：归类区

### 静态承载内容
- 主图固定使用 `3-8-nyquist-quickcheck.png`。
- 判稳表固定列为：对象、`P`、`N`、`Z`、结论。
- 边界提示固定写明：右半平面零点不等于右半平面极点。

### 互动升级点
- 组件类型：`card_sort`
- 任务：把四个对象按“闭环稳定 / 闭环不稳定 / 开环不稳定但闭环稳定”归类
- 反馈规则：即时反馈，可重试

### 埋点与教师数据
- 埋点摘要：`sortAttempted`、`sortCorrected`
- 教师聚合：`misclassified_cards`

### AI 边界
- 页面目标：固化 `P -> N -> Z` 的读图顺序。
- 允许范围：包围关系、右半平面极点数。
- 禁止范围：把包含右半平面零点自动判成不稳。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-07`
- 对齐要求：四图和判稳表必须先于归类区出现。

## 步骤 08｜Bode 判稳：截止频率、相角裕度、增益裕度不是另一套规则

### 页面骨架
- 模板：`dual_graph_indicator_locator`
- 区域：`media` / `table` / `interaction`

### 模块清单
- `bode-graph`：Bode 主图
- `indicator-table`：四类线与四类量对应表
- `locator-zone`：热点标注区

### 静态承载内容
- 主图固定使用 `3-8-bode-example.png`。
- 指标表固定写明：
  - 截止频率 $\omega_c$
  - 相位穿越频率 $\omega_\pi$
  - 相角裕度 $\gamma$
  - 增益裕度 $G_m$
- 结论卡固定写明：Bode 判稳是在对数坐标上读同一临界边界。

### 互动升级点
- 组件类型：`hotspot_labeling`
- 任务：把四类线与指标名称对应起来
- 反馈规则：即时反馈，可重试

### 埋点与教师数据
- 埋点摘要：`labelAttempted`、`labelCorrected`
- 教师聚合：`common_mislabels`

### AI 边界
- 页面目标：纠正“Bode 判稳是另一套规则”的误判。
- 允许范围：截止频率、相位穿越、裕度线。
- 禁止范围：把截止频率和带宽频率混成一项。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-08`
- 对齐要求：Bode 图和指标表必须先于标注区出现。

## 步骤 09｜三频段分工：精度、速度和代价该分开看

### 页面骨架
- 模板：`compare_then_ai`
- 区域：`media` / `prompt` / `ai`

### 模块清单
- `three-band-figure`：三频段总图
- `goal-switch-card`：目标切换卡
- `ai-compare-workspace`：AI 对照区

### 静态承载内容
- 主图固定使用 `3-8-three-band-overview.png`。
- 目标切换卡固定给出两组任务：
  - 任务 A：尽快跟踪；
  - 任务 B：优先减小超调并减轻执行器波动。
- 结论句固定写明：不同目标，优先改写的频带不一样。

### 互动升级点
- 组件类型：`ai_compare_workspace`
- 任务：
  - 先独立写下“任务 A / B 优先改哪一段频率”；
  - 再查看 AI 对照解释；
  - 最后标记自己改变或坚持了什么判断。
- 反馈规则：先人后 AI；AI 只做对照，不代做。

### 埋点与教师数据
- 埋点摘要：`draftSubmitted`、`aiViewed`、`revisionState`
- 教师聚合：`initial_band_choice`、`revision_rate`

### AI 边界
- 页面目标：把“先判断频段，再看 AI”固定下来。
- 允许范围：低频 / 中频 / 高频任务分工、目标切换。
- 禁止范围：直接给出完整校正器设计参数。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-09`
- 对齐要求：总图、目标卡和 AI 边界说明必须同屏。

## 步骤 10｜航向控制案例：中频超前为什么能同时更快且更稳

### 页面骨架
- 模板：`design_compare_workspace`
- 区域：`left-example` / `right-example` / `comparison`

### 模块清单
- `heading-baseline-panel`：基线 2×2 图
- `heading-case-panel`：校正后 2×2 图
- `heading-metric-card`：指标卡
- `heading-compare-workspace`：结构化比较区

### 静态承载内容
- 左侧固定使用 `3-8-heading-baseline.png`。
- 右侧固定使用 `3-8-heading-case.png`。
- 指标卡固定列：
  - 相角裕度
  - 截止频率
  - 带宽
  - 谐振峰值
  - 超调量
  - 调节时间
- 结论卡固定写明：本案例主要改写的是中频，不是低频。

### 互动升级点
- 组件类型：`structured_compare`
- 任务：填写“被优先改写的频段 / 主要收益 / 主要代价是否被压住”
- 反馈规则：按字段回显，不代做结论

### 埋点与教师数据
- 埋点摘要：`fieldsCompleted`、`compareBucket`
- 教师聚合：`common_compare_gaps`

### AI 边界
- 页面目标：把航向控制案例读成“中频定向改写”的范例。
- 允许范围：裕度、带宽、超调与调节时间联动。
- 禁止范围：进入模块 4 的完整参数整定叙事。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-10`
- 对齐要求：基线 / 校正后 2×2 图与指标卡必须同页。

## 步骤 11｜稳定平台案例：只降增益为什么不如中频定向校正

### 页面骨架
- 模板：`design_compare_workspace`
- 区域：`left-example` / `right-example` / `comparison`

### 模块清单
- `platform-block-diagram`：控制框图
- `platform-baseline-panel`：激进基线 2×2 图
- `platform-case-panel`：三方案综合对照图
- `platform-compare-workspace`：结构化比较区

### 静态承载内容
- 控制框图固定使用 `3-8-platform-block-diagram.png`。
- 基线图固定使用 `3-8-platform-baseline.png`。
- 综合图固定使用 `3-8-platform-case.png`。
- 对照表固定写明三方案：
  - 激进基线
  - 仅降增益
  - 超前校正
- 结论卡固定写明：本案例说明“更稳”和“更慢”可能同时出现，真正有效的是中频定向补角。

### 互动升级点
- 组件类型：`structured_compare`
- 任务：比较三方案在速度、超调、余量和高频代价上的取舍
- 反馈规则：按字段回显，不直接公布最优方案

### 埋点与教师数据
- 埋点摘要：`fieldsCompleted`、`compareBucket`
- 教师聚合：`common_compare_gaps`

### AI 边界
- 页面目标：把“只降增益”和“中频超前”明确区分开。
- 允许范围：三方案频域与时域指标联动。
- 禁止范围：把课堂推成模块 4 方案排序或完整设计课。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-11`
- 对齐要求：控制框图和三方案对照必须同页落下。

## 步骤 12｜后测与收束：频域不是新章，而是模块 3 的统一判断地图

### 页面骨架
- 模板：`summary_quiz_board`
- 区域：`quiz` / `summary` / `next`

### 模块清单
- `post-quiz`：后测题组
- `summary-card`：四条结论卡
- `summary-infographic`：`3-8-info.png` 信息图
- `next-step-card`：去向卡

### 静态承载内容
- 后测题固定围绕：
  - `P/N/Z` 判稳顺序；
  - 截止频率 vs 带宽；
  - 三频段目标切换；
  - 非最小相带宽边界。
- 四条结论卡固定写明：
  - 频域是统一翻译器；
  - Nyquist 与 Bode 是同一临界边界的两种表达；
  - 三频段分工帮助拆开收益与代价；
  - 工程判断应先定频带，再看校正。
- 信息图固定使用 `3-8-info.png`，并与四条结论卡同屏，作为本课统一判断地图的静态收束图。
- 去向卡固定写明：
  - `3-9`：稳定—动态—稳态综合映射实验；
  - `4-1`：设计起点，任务表达与约束语言。

### 互动升级点
- 组件类型：`quiz_group`
- 作答模型：允许重提一次；教师端区分首答与重提
- 揭示规则：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`attemptCount`、`resultState`、`errorBucket`
- 教师聚合：`question_distribution`、`top_misconceptions`

### AI 边界
- 页面目标：检查学生是否把统一判断链真正带走。
- 允许范围：顺序、边界、目标切换。
- 禁止范围：代替学生作答或提前给模块 4 方案。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-12`
- 对齐要求：后测题、信息图、小结卡与去向卡必须同页可见。
