## 文档职责
- 本文件是 `3-8` 的作者态互动课程蓝图，负责固定页面骨架、证据顺序、互动升级方式、教师聚合口径、AI 边界与学生演示页预览路径。
- 同目录 [interactive-contract.yaml](./interactive-contract.yaml) 负责机读契约；两者必须按 `step-01` 到 `step-12` 一一对应。
- 本文件不是讲义摘要，不把公式、图表、案例和结论压缩成“实现时补”；凡讲义中的核心证据链，都必须在这里写成可落页、可验收的页面顺序。
- 本课首先是 `3-8（理论） 频域判别与跨域综合语言` 的页面化课件，然后才是局部互动增强；静态证据不完整时，禁止用小测或工作区占位代替。

## 表述规则
- 页面描述只写客观结构：区域、模块、证据、阅读顺序、互动组件、反馈、教师聚合、AI 边界与验收条件。
- 禁止把“展示、引导、讲解、让学生先想一想”写成设计内容；这些属于课堂执行层，不属于作者态前台真源。
- 本课主线固定为：`结构变化的频域指纹 -> Nyquist / Bode 判稳统一 -> 三频段分工 -> 双工程案例读回 -> 3-9 / 模块4 入口`。
- 本课不得回退到模块 2 的作图基础重讲，也不得偷渡模块 4 的完整选型、整定和优化排序。
- 讲义中的曲线图默认优先升级为参数联动或结构切换面板；若暂不升级，也必须先把图、公式、表和结论链静态落完整。

## 节点与步骤分组
- `group-01｜导入与翻译框架`：`step-01` 到 `step-05`
- `group-02｜判稳统一链`：`step-06` 到 `step-08`
- `group-03｜频段分工与工程读回`：`step-09` 到 `step-11`
- `group-04｜后测与出口收束`：`step-12`

## 全课总览
| 步骤 | 标题 | 页面模板 | 证据重心 | 互动组件 | 预估学生实践 |
|------|------|----------|----------|----------|--------------|
| `step-01` | 回到地图：为什么频域不是新章而是统一翻译器 | `map_hero_slide` | 路径图、主问题卡、边界卡 | `none` | 0 分钟 |
| `step-02` | 先看指纹：四类结构变化为什么在频域里长得不一样 | `comparison_gallery_with_prompt` | 四图并排、两问清单、误判底线 | `binary_choice` | 3 分钟 |
| `step-03` | 统一翻译链：结构变化、稳定边界和闭环后果如何接起来 | `translation_chain_board` | 翻译链、三种稳定语言、边界表 | `none` | 0 分钟 |
| `step-04` | 前测：四类典型误判先暴露出来 | `question_stack` | 四题前测、错因标签、AI 锁定提示 | `quiz_group` | 6 分钟 |
| `step-05` | 频域翻译总表：先判哪一段频率，再谈收益与代价 | `formula_table_match` | 总表、例题 1、频带说明卡 | `triple_match` | 6 分钟 |
| `step-06` | 从 $F(s)=1+L(s)$ 到 $(-1,0)$：Nyquist 判稳的来路 | `formula_media_compare` | 三张公式卡、几何示意、顺序链 | `reason_check` | 5 分钟 |
| `step-07` | 快速判稳：先数 $P$，再数 $N$，最后算 $Z$ | `comparison_panel_with_sort` | 四图快判、边界例题、判稳表 | `card_sort` | 8 分钟 |
| `step-08` | Bode 判稳：截止频率、裕度与三种稳定语言的对照 | `dual_graph_indicator_locator` | Bode 图、指标表、三语言对照表 | `hotspot_labeling` | 7 分钟 |
| `step-09` | 三频段分工：精度、速度和代价必须分开读 | `compare_then_ai` | 三频段总图、目标切换卡、例题 5 | `ai_compare_workspace` | 7 分钟 |
| `step-10` | 航向控制案例：为什么中频超前能同时更快且更稳 | `design_compare_workspace` | 基线 2×2、目标翻译链、校正后 2×2、指标表 | `structured_compare` | 9 分钟 |
| `step-11` | 稳定平台案例：为什么只降增益不如中频定向校正 | `design_compare_workspace` | 控制框图、三方案 2×2、结论表 | `structured_compare` | 9 分钟 |
| `step-12` | 后测与收束：频域判断地图如何接到 `3-9` 与模块 4 | `summary_quiz_board` | 后测题组、四条结论、去向卡、信息图 | `quiz_group` | 5 分钟 |

## 证据单元升级决策表
| 证据类型 | 来源锚点 | 目标步骤 | 升级方式 | 保留元素 | 不得删减内容 | 验收点 |
|---|---|---|---|---|---|---|
| 路径定位 + 主问题 | `## 一、引入`、`### 2.1 频域是统一翻译器` | `step-01` | 静态保留 | `3-5 -> 3-7 -> 3-8 -> 3-9` 路径、主问题、边界卡 | “频域不是新章，而是统一翻译器”这句主判断不得消失 | 首屏看到路径图、主问题卡和边界卡 |
| 四类频域指纹总览 | `## 一、引入`、`### 2.2 四类结构变化的频域指纹` | `step-02` | 静态保留 + 二选一判断 | `3-8-gain-effect.png`、`3-8-zero-effect.png`、`3-8-pole-effect.png`、`3-8-rhp-zero-effect.png`、两问清单 | 不得只保留图片或只保留判断题；“同时看频带与相位”不得删 | 四图与两问清单先于判断区完整出现 |
| 统一翻译链 + 三语言对照 | `### 2.1 频域是统一翻译器`、`### 2.4.2 为什么不能只看截止频率` | `step-03` | 原生重绘 | 翻译链、三种稳定语言对照表、本课边界表 | 不得只剩一条箭头链；三语言对照和边界必须同页 | 翻译链、对照表、边界表同屏 |
| 四类误判前测 | `## 一、引入`、`### 2.4.2`、`### 2.5` | `step-04` | 题组前测 | “只看幅值”“Nyquist 先数圈”“截止频率等于一切”“非最小相可盲目追带宽”四类误区 | AI 对照必须后置；错因标签必须可聚合 | 教师端可直接看到四类错因比例 |
| 频域翻译总表 + 例题 1 | `### 2.2 四类结构变化的频域指纹`、`#### 例题 1` | `step-05` | 静态保留 + 三向配对 | 结构变化、主要频带、收益/代价、例题 1 结论 | 不得把“先判哪一段频率”压缩成只看答案 | 总表、例题卡、频带说明先于配对区出现 |
| Nyquist 推导显影链 | `### 2.3 从幅角原理到 Nyquist 判据` | `step-06` | 点击显影 | $F(s)=1+L(s)$、$\Delta \arg F(s)=2\pi(Z-P)$、`Z=P-N`、临界点 $(-1,0)$ | 不得只保留最终判据，不得删掉“为什么看 $(-1,0)$” | 公式卡、几何示意和顺序链同屏 |
| Nyquist 快判例题组 | `#### 例题 2`、`#### 例题 3` | `step-07` | 静态保留 + 分类判断 | `3-8-nyquist-quickcheck.png`、`3-8-nyquist-example.png`、`P/N/Z` 表 | 不得把“靠近边界”和“已越界”混成一个结论 | 四图、判稳表、边界句先于排序区出现 |
| Bode 判稳与三语言对应 | `### 2.4 Bode 判稳与稳定裕度`、`#### 例题 4` | `step-08` | 静态保留 + 热点标注 | `3-8-bode-example.png`、截止频率、相位穿越频率、PM、GM、三语言对照表 | 不得只保留 Bode 图；三语言对照和“开环读余量，闭环看带宽”必须保留 | Bode 图、指标表、对照表同屏 |
| 三频段总图 + 例题 5 | `### 2.5 三频段分工`、`#### 例题 5` | `step-09` | 静态保留 + AI 对照工作区 | `3-8-three-band-overview.png`、低/中/高频职责、目标切换卡 | AI 只能用于对照，不得替代先判频带 | 三频段图、目标卡、AI 边界提示同屏 |
| 航向控制完整证据链 | `#### 2.6.1 船舶航向控制` | `step-10` | 静态保留 + 参数联动预埋 + 结构化比较 | 基线 2×2、目标翻译链、超前网络、校正后 2×2、指标表 | 不得只保留结果表；`M_p -> \zeta -> \gamma` 与 `t_s -> \omega_n -> \omega_c` 链不得删 | 两张 2×2 图、目标翻译卡和指标表同页 |
| 稳定平台三方案证据链 | `#### 2.6.2 稳定平台` | `step-11` | 原生重绘 + 参数联动预埋 + 结构化比较 | 控制框图、激进基线、仅降增益、超前校正三方案、结论表 | 不得删掉“只靠降增益为什么不够”；三方案必须同页可比 | 结构图、三方案对照和结论表同屏 |
| 收束与去向 | `## 三、本节小结` | `step-12` | 静态保留 + 后测 | 四条小结、`3-8-info.png`、`3-9 / 4-1` 去向卡 | 后测不能替代小结卡；去向必须明确写出 | 小结卡、信息图、去向卡、后测题同页 |

## 混合证据顺序表
| 步骤 | 先出现什么 | 再出现什么 | 最后出现什么 | 必须同屏内容 | 不得折叠内容 |
|---|---|---|---|---|---|
| `step-02` | 四图并排 | 两问清单 | 二选一判断区 | 四图、两问、底线句 | 任一对照图 |
| `step-03` | 翻译链 | 三语言对照表 | 本课边界表 | 翻译链、对照表、边界表 | 三语言对照表 |
| `step-05` | 频域翻译总表 | 例题 1 题面与答案链 | 配对区 | 总表、例题卡、频带说明 | 总表 |
| `step-06` | 三张公式卡 | 临界点几何示意 | 顺序检查区 | 三张公式卡、几何示意 | 任一公式卡 |
| `step-07` | 快判四图 | `P/N/Z` 表与边界提醒 | 分类排序区 | 四图、判稳表、边界提醒 | 判稳表 |
| `step-08` | Bode 图 | 指标表与三语言对照表 | 热点标注区 | Bode 图、指标表、对照表 | 指标表 |
| `step-09` | 三频段总图 | 目标切换卡与例题 5 结论 | AI 对照区 | 三频段图、目标卡、AI 边界提示 | 三频段总图 |
| `step-10` | 基线 2×2 图与原始指标 | 目标翻译链与超前网络 | 校正后 2×2 图、指标表、比较区 | 两张 2×2 图、翻译卡、指标表 | 目标翻译链 |
| `step-11` | 控制框图与三方案说明 | 三方案 2×2 图 | 结论表与比较区 | 控制框图、三方案图、结论表 | 三方案对照 |
| `step-12` | 后测题组 | 四条小结与信息图 | `3-9 / 4-1` 去向卡 | 小结卡、信息图、去向卡 | 去向卡 |

## 曲线镜像与运行时合同
| 步骤 | 图组 / 证据 | 基线态 | 图组镜像 | 控件 | 运行时合同 |
|------|-------------|--------|----------|------|------------|
| `step-10` | 航向控制 2×2 对照 | 基线态固定为讲义中的 $K=2.25$ 直接负反馈；校正态固定为讲义中的超前网络基线参数 | 固定 `2×2`：左上时域、左下根轨迹与闭环极点、右上开环幅频、右下开环相频与裕度；窄屏只允许响应式换行，不改变语义顺序 | `case_toggle`（基线 / 超前）、`parameter_drawer`（仅教师示范开放） | `caseId=unit-3-8-heading-lead-compare`；`outputs=[step_response, root_locus, bode_mag, bode_phase, metrics]`；`overlay_policy=[current_poles, pm_gm, wc_wb]`；`axis_policy=fixed_extent` |
| `step-11` | 稳定平台三方案对照 | 基线态固定为激进增益 $K=5$；对照态固定包含 `K=0.2` 与超前校正方案 | 固定 `2×2`：左上时域、左下根轨迹与闭环极点、右上开环幅频、右下开环相频与裕度；三方案通过勾选切换叠加 | `scheme_toggle`（激进基线 / 仅降增益 / 超前校正）、`parameter_drawer`（教师示范开放） | `caseId=unit-3-8-platform-three-scheme`；`outputs=[step_response, root_locus, bode_mag, bode_phase, metrics, compare_summary]`；`overlay_policy=[scheme_colors, pm_gm, wc_wr_mr]`；`axis_policy=fixed_extent` |

## 讲义核心内容映射
| handout_anchor | core_item_type | must_appear_content | target_step | page_mode | interaction_upgrade | media_or_table_ref | acceptance_note |
|---|---|---|---|---|---|---|---|
| `## 一、引入：为什么同样是结构变了，频域图上的反应却完全不同` | `concept + question` | 主问题、四类结构变化并排对照、两问清单。 | `step-02` | `static + choice` | 二选一只负责暴露“只看幅值”的误判。 | `3-8-gain-effect.png / 3-8-zero-effect.png / 3-8-pole-effect.png / 3-8-rhp-zero-effect.png` | 四图与两问不得后置到互动之后。 |
| `### 2.1 频域是统一翻译器` | `concept + chain` | `结构变化 -> 开环频率特性改写 -> 稳定边界变化 -> 闭环后果`，以及本课边界。 | `step-03` | `static` | 保持静态总览，不做低价值交互。 | 翻译链 + 边界表 | 翻译链与边界表必须同页。 |
| `### 2.2 四类结构变化的频域指纹` | `table + figure` | 四类变化各改哪一段频率、收益与代价落点。 | `step-05` | `static + interactive` | 三向配对只负责强化“变化类型 / 频带 / 代价”对应。 | 频域翻译总表 | 总表必须先于配对区出现。 |
| `#### 例题 1：先从哪一段频带开始判断结构变化` | `worked_example` | 例题 1 的频带判断链与答案。 | `step-05` | `static + interactive` | 配对区不替代例题卡。 | 例题 1 卡 | 例题卡必须先于配对区出现。 |
| `### 2.3 从幅角原理到 Nyquist 判据` | `derivation + concept` | $F(s)=1+L(s)$、幅角原理、临界点 $(-1,0)$、`Z=P-N` 的推导链。 | `step-06` | `static + interactive` | 顺序检查只负责固定判稳逻辑顺序。 | 公式卡 + 临界点示意 | 三张公式卡与临界点示意必须同屏。 |
| `#### 例题 2：第一组快速判稳题` | `worked_example + table` | 快判四图与 `P/N/Z` 固定顺序。 | `step-07` | `static + interactive` | 分类区只负责稳定/不稳归类。 | `3-8-nyquist-quickcheck.png` | 图和表必须在未作答状态下可见。 |
| `#### 例题 3：第二组设计型例题` | `worked_example + boundary` | “靠近边界”和“已越界”的图区分。 | `step-07` | `static + interactive` | 分类区不能替代边界说明。 | `3-8-nyquist-example.png` | 边界图与提醒句必须可见。 |
| `### 2.4 Bode 判稳与稳定裕度` | `graph + formula + table` | 截止频率、相角裕度、增益裕度和三种稳定语言对应。 | `step-08` | `static + interactive` | 热点标注只负责把线和量一一对应。 | `3-8-bode-example.png` | Bode 图、指标表、三语言对照表必须同页。 |
| `#### 例题 4：由 Bode 图直接判稳` | `worked_example + formula` | 例题 4 的判稳结论与 Bode 读图链。 | `step-08` | `static + interactive` | 热点标注不替代例题说明。 | 例题 4 卡 | 例题卡必须含公式与结论。 |
| `### 2.5 三频段分工：谁负责精度，谁负责速度，谁负责代价` | `concept + ai` | 低频/中频/高频任务分工与目标切换。 | `step-09` | `static + ai` | AI 区只允许做“先自判、再对照”。 | `3-8-three-band-overview.png` | 三频段总图和目标卡必须先于 AI 区出现。 |
| `#### 例题 5：按频段安排校正目标` | `worked_example + ai` | 例题 5 的频带优先级判断。 | `step-09` | `static + ai` | AI 区不能替代先独立判断。 | 例题 5 卡 | 例题卡必须先于 AI 区出现。 |
| `#### 2.6.1 船舶航向控制：超前校正把“较慢且超调偏大”改成“更快且更稳”` | `case + derivation + comparison` | 基线指标、目标翻译链、超前网络、基线/校正后 2×2 对照、指标表。 | `step-10` | `static + interactive` | 结构化比较只负责归纳“主改中频、换来什么、代价是什么”。 | `3-8-heading-baseline.png / 3-8-heading-case.png` | 两张 2×2 图、翻译卡、指标表必须同页。 |
| `#### 2.6.2 稳定平台：单纯降增益不够，超前校正更能兼顾速度与平稳` | `case + structure + comparison` | 控制框图、激进基线、仅降增益、超前校正三方案、结论表。 | `step-11` | `static + interactive` | 结构化比较只负责回答“为什么只降增益不够”。 | `3-8-platform-block-diagram.png / 3-8-platform-baseline.png / 3-8-platform-case.png` | 控制框图和三方案对照必须同页。 |
| `## 三、本节小结` | `summary + quiz` | 四条结论、`3-8-info.png`、`3-9 / 4-1` 去向。 | `step-12` | `static + quiz` | 后测只检查判断顺序与边界，不替代小结卡。 | `3-8-info.png` | 小结卡、信息图、去向卡和后测题必须同页。 |

## 步骤 01｜回到地图：为什么频域不是新章而是统一翻译器

### 页面骨架
- 模板：`map_hero_slide`
- 区域：`header` / `lead` / `summary`

### 模块清单
- `stage-map`：高亮 `3-5 -> 3-7 -> 3-8 -> 3-9`
- `core-question-card`：主问题卡
- `boundary-card`：本课边界卡

### 静态承载内容
- 路径图固定写明：`3-5` 已建立零点与中频动态改善，`3-7` 已建立低频补偿与稳态改善，`3-8` 负责把这些结构变化统一翻译到频域判断语言。
- 主问题卡固定写明：
  - 为什么同样是结构变了，频域里看起来完全不同？
  - 为什么频域不只是判稳，还能读出收益与代价？
- 边界卡固定写明：本课不重讲模块 2 的作图基础，也不进入模块 4 的完整整定。

### 互动升级点
- 组件类型：`none`

### 埋点与教师数据
- 埋点摘要：`viewed`、`timeOnStep`、`teacherFollowSync`
- 教师聚合：`view_count`、`sync_status`

### AI 边界
- 允许范围：课程路径、本课任务、与 `3-5 / 3-7 / 3-9` 的关系
- 禁止范围：提前展开 Nyquist 与 Bode 公式细节

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-01`
- 对齐要求：路径图、主问题卡和边界卡首屏同见。

## 步骤 02｜先看指纹：四类结构变化为什么在频域里长得不一样

### 页面骨架
- 模板：`comparison_gallery_with_prompt`
- 区域：`gallery` / `questions` / `interaction`

### 模块清单
- `fingerprint-gallery`：四图并排
- `question-list`：两问清单
- `binary-vote`：误判判断区

### 静态承载内容
- 四图固定按以下顺序出现：
  1. `3-8-gain-effect.png`
  2. `3-8-zero-effect.png`
  3. `3-8-pole-effect.png`
  4. `3-8-rhp-zero-effect.png`
- 两问清单固定写明：
  1. 这类变化首先改写哪一段频率？
  2. 它换来的主要收益与代价分别落在哪个闭环后果上？
- 底线句固定写明：频域判断必须同时看幅值、相位与被改写的频段。

### 互动升级点
- 组件类型：`binary_choice`
- 题干固定为：频域分析是否只需要看幅值变化？
- 选项固定为：
  - A：只要曲线抬高，系统一定更快更好
  - B：还要同时看相位代价和被改写的频段
- 正确项：`B`
- 反馈规则：只允许暴露“只看幅值”的误判，不提前泄露后续例题答案。

### 埋点与教师数据
- 埋点摘要：`selectedOption`、`resultState`
- 教师聚合：`option_distribution`、`only_watch_magnitude_rate`

### AI 边界
- 允许范围：四类结构变化、频带、相位代价
- 禁止范围：提前进入 Nyquist 判稳与工程案例结论

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-02`
- 对齐要求：四图与两问清单必须先于判断区完整落页。

## 步骤 03｜统一翻译链：结构变化、稳定边界和闭环后果如何接起来

### 页面骨架
- 模板：`translation_chain_board`
- 区域：`chain` / `table` / `boundary`

### 模块清单
- `translation-chain-card`：统一翻译链
- `language-correspondence-table`：三种稳定语言对照表
- `boundary-table`：本课边界表

### 静态承载内容
- 翻译链固定写成：
  $$
  \text{结构变化} \rightarrow \text{开环频率特性改写} \rightarrow \text{稳定边界变化} \rightarrow \text{闭环后果}
  $$
- 三种稳定语言对照表必须同时给出：
  - 极点 / 根轨迹语言
  - Nyquist 语言
  - Bode 语言
- 边界表固定写明：
  - 本课负责统一翻译、判稳与工程读回；
  - 不负责作图基础重练；
  - 不负责完整补偿器参数整定与模块 4 的排序。

### 互动升级点
- 组件类型：`none`

### 埋点与教师数据
- 埋点摘要：`viewed`、`timeOnStep`
- 教师聚合：`view_count`

### AI 边界
- 允许范围：翻译链、三种稳定语言、本课边界
- 禁止范围：生成任何控制器参数建议

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-03`
- 对齐要求：翻译链、三语言对照表和边界表必须同屏。

## 步骤 04｜前测：四类典型误判先暴露出来

### 页面骨架
- 模板：`question_stack`
- 区域：`question-stack` / `record` / `ai-gate`

### 模块清单
- `pretest-q1`：频带误判
- `pretest-q2`：Nyquist 顺序误判
- `pretest-q3`：截止频率误判
- `pretest-q4`：非最小相误判
- `reason-record`：一句理由栏
- `ai-gate-note`：AI 锁定提示

### 静态承载内容
- 四题固定对应四类误区：
  1. 增益与积分是否改写同一段频率；
  2. Nyquist 是否可以不先数 `P`；
  3. 截止频率更大是否自动更好；
  4. 右半平面零点是否可以靠更大带宽直接“压过去”。
- AI 锁定提示固定写明：必须先完成首答，才能进入 AI 对照区。

### 互动升级点
- 组件类型：`quiz_group`
- 允许一次重提，但教师端必须区分首答与重提。
- 错因标签固定为：
  - `band_before_conclusion`
  - `nyquist_skip_p`
  - `wc_equals_everything`
  - `nmp_unlimited_bandwidth`

### 埋点与教师数据
- 埋点摘要：`attemptCount`、`resultState`、`errorBucket`
- 教师聚合：`question_distribution`、`top_misconceptions`

### AI 边界
- 允许范围：术语纠偏、错因命名
- 禁止范围：直接代做后续例题与案例判断

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-04`
- 对齐要求：四题、理由栏和 AI 锁定提示同页可见。

## 步骤 05｜频域翻译总表：先判哪一段频率，再谈收益与代价

### 页面骨架
- 模板：`formula_table_match`
- 区域：`table` / `example` / `interaction`

### 模块清单
- `translation-table`：频域翻译总表
- `example-card`：例题 1 题面与答案链
- `frequency-band-note`：频带说明卡
- `triple-match-zone`：三向配对区

### 静态承载内容
- 总表列固定为：
  - 结构变化
  - 主要改写频带
  - 幅值 / 相位主变化
  - 典型收益
  - 典型代价
- 例题 1 必须明确写出：
  - `4` 倍增益
  - 左半平面零点 `1+s/0.8`
  - 原点积分极点
  三种变化分别优先改写哪一段频率。
- 频带说明卡固定写明：先判断变化落在哪一段频带，再判断是否逼近稳定边界。

### 互动升级点
- 组件类型：`triple_match`
- 学生任务：把“变化类型 / 首要频带 / 主要收益代价”对应起来。
- 即时反馈只负责纠偏频带定位，不代替例题解释。

### 埋点与教师数据
- 埋点摘要：`matchAttempted`、`matchCorrected`
- 教师聚合：`common_mismatch_pairs`

### AI 边界
- 允许范围：频带、收益、代价的对应关系
- 禁止范围：把配对结果直接上升成“推荐控制器”

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-05`
- 对齐要求：总表、例题卡和频带说明必须先于配对区出现。

## 步骤 06｜从 $F(s)=1+L(s)$ 到 $(-1,0)$：Nyquist 判稳的来路

### 页面骨架
- 模板：`formula_media_compare`
- 区域：`formula` / `media` / `interaction`

### 模块清单
- `f-of-s-card`：`F(s)=1+L(s)` 卡
- `argument-principle-card`：$\Delta \arg F(s)=2\pi(Z-P)$ 卡
- `pnz-card`：`Z=P-N` 卡
- `critical-point-graphic`：临界点几何示意
- `reason-check`：顺序检查区

### 静态承载内容
- 三张公式卡必须同时出现，不得拆成多步后补。
- 临界点几何示意必须同时说明：
  - 为什么在 `F` 平面看原点；
  - 为什么在 `L(j\omega)` 平面改看 `(-1,0)`。
- 固定顺序句必须完整出现：
  1. 先数开环右半平面极点数 `P`
  2. 再数包围数 `N`
  3. 最后算闭环右半平面极点数 `Z`

### 互动升级点
- 组件类型：`reason_check`
- 学生任务：对“辅助函数 -> 临界点 -> 先数什么 -> 再算什么”的顺序做判断。
- 反馈规则：只能纠正顺序链，不替代公式卡本体。

### 埋点与教师数据
- 埋点摘要：`selectionState`、`resultState`
- 教师聚合：`confusion_matrix`

### AI 边界
- 允许范围：辅助函数、幅角原理、判稳顺序
- 禁止范围：代替学生做后续快判题

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-06`
- 对齐要求：三张公式卡、几何示意与顺序区同屏。

## 步骤 07｜快速判稳：先数 $P$，再数 $N$，最后算 $Z$

### 页面骨架
- 模板：`comparison_panel_with_sort`
- 区域：`media` / `table` / `interaction`

### 模块清单
- `quickcheck-gallery`：例题 2 快判四图
- `boundary-case-card`：例题 3 边界对照卡
- `pnz-table`：判稳表
- `sort-zone`：分类区

### 静态承载内容
- `3-8-nyquist-quickcheck.png` 固定承担四个典型对象快判。
- `3-8-nyquist-example.png` 固定承担“靠近边界但未包围”与“已经包围”两种增益区间对照。
- 判稳表固定列为：对象 / `P` / `N` / `Z=P-N` / 结论。
- 边界提醒固定写明：右半平面零点不等于右半平面极点。

### 互动升级点
- 组件类型：`card_sort`
- 学生任务：把给定对象归入“闭环稳定”“逼近边界”“闭环不稳”三类。
- 即时反馈只校正分类，不替代判稳表。

### 埋点与教师数据
- 埋点摘要：`sortAttempted`、`sortCorrected`
- 教师聚合：`misclassified_cards`

### AI 边界
- 允许范围：`P/N/Z` 顺序、边界类型
- 禁止范围：跳过判稳步骤直接报最终稳定性

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-07`
- 对齐要求：四图、判稳表和边界提醒必须先于分类区出现。

## 步骤 08｜Bode 判稳：截止频率、裕度与三种稳定语言的对照

### 页面骨架
- 模板：`dual_graph_indicator_locator`
- 区域：`media` / `table` / `interaction`

### 模块清单
- `bode-graph`：Bode 图
- `margin-table`：指标表
- `language-table`：三语言对照表
- `locator-zone`：热点标注区

### 静态承载内容
- `3-8-bode-example.png` 必须完整落页。
- 本页公式必须明文落出：
  $$
  |L(j\omega_c)|=1,\qquad \gamma = 180^\circ + \angle L(j\omega_c),\qquad G_m=\frac{1}{|L(j\omega_\pi)|}
  $$
- 指标表固定包括：
  - 截止频率 $\omega_c$
  - 相位穿越频率 $\omega_\pi$
  - 相角裕度 $\gamma$
  - 增益裕度 $G_m$
- 三语言对照表固定给出：
  - 极点离虚轴多近
  - Nyquist 离临界点多近
  - Bode 的穿越与裕度如何表达同一问题
- 固定口令句必须出现：开环读余量，闭环看带宽。

### 互动升级点
- 组件类型：`hotspot_labeling`
- 学生任务：把截止频率线、相位穿越频率线、PM 线、GM 线对应到图上。
- 即时反馈只负责锚点定位，不替代指标表。

### 埋点与教师数据
- 埋点摘要：`labelAttempted`、`labelCorrected`
- 教师聚合：`common_mislabels`

### AI 边界
- 允许范围：Bode 判稳指标与三语言对应
- 禁止范围：把截止频率和带宽混成同一个量

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-08`
- 对齐要求：Bode 图、指标表、三语言对照表同页。

## 步骤 09｜三频段分工：精度、速度和代价必须分开读

### 页面骨架
- 模板：`compare_then_ai`
- 区域：`media` / `prompt` / `ai`

### 模块清单
- `three-band-overview`：三频段总图
- `goal-switch-card-row`：目标切换卡
- `example-five-card`：例题 5 卡
- `ai-compare-zone`：AI 对照工作区

### 静态承载内容
- `3-8-three-band-overview.png` 必须先于互动区出现。
- 目标切换卡至少包含三种任务：
  - 优先减小稳态误差
  - 优先提高速度
  - 优先降低超调并减轻执行器波动
- 例题 5 必须保留结论：若任务从“尽快跟踪”切换为“优先平稳”，重点应落在相角裕度和谐振峰值，而不是继续右推截止频率。

### 互动升级点
- 组件类型：`ai_compare_workspace`
- 学生任务：先写出“优先改哪一段频带、主要看哪两个频域量”，再进入 AI 对照。
- AI 对照仅用于核对“先判频带、再问 AI”的顺序，不允许直接生成最终答案模板。

### 埋点与教师数据
- 埋点摘要：`draftSubmitted`、`aiViewed`、`revisionState`
- 教师聚合：`goal_choice_distribution`、`ai_revision_rate`

### AI 边界
- 允许范围：低频/中频/高频职责，目标切换下的频段优先级
- 禁止范围：代替学生完成完整案例比较

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-09`
- 对齐要求：三频段总图、目标切换卡、AI 边界提示同屏。

## 步骤 10｜航向控制案例：为什么中频超前能同时更快且更稳

### 页面骨架
- 模板：`design_compare_workspace`
- 区域：`baseline` / `derivation` / `compare`

### 模块清单
- `baseline-figure`：`3-8-heading-baseline.png`
- `target-translation-card`：目标翻译链卡
- `corrected-figure`：`3-8-heading-case.png`
- `metrics-table`：指标对照表
- `structured-compare-zone`：结构化比较区

### 静态承载内容
- 基线图必须先给出以下四个指标：
  - 相角裕度约 `37.43°`
  - 截止频率约 `0.1169 rad/s`
  - 超调量约 `31.95%`
  - 调节时间约 `83.10 s`
- 目标翻译链必须完整写出：
  - $M_p \approx 15\% \rightarrow \zeta_d \approx 0.52 \rightarrow \gamma_d \approx 50^\circ \sim 55^\circ$
  - $t_s \approx 45 s \rightarrow \omega_{n,d} \approx 0.17 rad/s \rightarrow \omega_c \approx 0.25 rad/s$
- 超前网络必须明文给出：
  $$
  C_h(s)=\frac{1+s/0.05}{1+s/0.3}
  $$
- 校正后对照图与指标表必须同页；指标表至少含 `PM / wc / wb / M_r / 超调量 / 调节时间`。

### 互动升级点
- 组件类型：`structured_compare`
- 学生任务固定为三栏：
  1. 主要改写哪一段频带；
  2. 频域里哪两个量发生了关键变化；
  3. 时域里因此读回了什么收益与代价。
- 比较区默认只允许在“基线 / 超前”之间来回对照，不允许脱离证据自由发挥。

### 埋点与教师数据
- 埋点摘要：`compareSubmitted`、`focusBand`、`selectedMetrics`
- 教师聚合：`focus_band_distribution`、`metric_focus_heatmap`

### AI 边界
- 允许范围：中频超前、裕度变化、时域读回
- 禁止范围：替学生编造未出现在页面上的新整定方案

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-10`
- 对齐要求：基线 2×2、目标翻译卡、校正后 2×2 和指标表必须同页可比。

## 步骤 11｜稳定平台案例：为什么只降增益不如中频定向校正

### 页面骨架
- 模板：`design_compare_workspace`
- 区域：`structure` / `figures` / `compare`

### 模块清单
- `platform-structure-card`：`3-8-platform-block-diagram.png`
- `scheme-figure`：`3-8-platform-baseline.png` 与 `3-8-platform-case.png`
- `conclusion-table`：三方案结论表
- `structured-compare-zone`：结构化比较区

### 静态承载内容
- 控制框图必须先落出四个模块：比例放大环节、执行机构、平台动力学、单位反馈。
- 三方案必须明确写成：
  - 激进基线：`K=5`
  - 仅降增益：`K=0.2`
  - 超前校正方案
- 结论表至少包含：
  - 速度
  - 超调 / 峰化
  - 相角裕度
  - 截止频率
  - 高频代价
- 固定结论句必须保留：只靠降增益会把速度压得过低；真正有效的是在中频定向补角，而不是单向把增益往下拧。

### 互动升级点
- 组件类型：`structured_compare`
- 学生任务固定为：
  1. 指出哪种方案只是“退回保守”，而不是“兼顾两头”；
  2. 指出超前校正主要在哪个频带完成修正；
  3. 写出一句“为什么只降增益不够”的比较结论。

### 埋点与教师数据
- 埋点摘要：`compareSubmitted`、`selectedScheme`、`reasonTag`
- 教师聚合：`scheme_preference_distribution`、`reason_tag_cloud`

### AI 边界
- 允许范围：三方案比较、中频补角、速度与平稳权衡
- 禁止范围：生成页面之外的新模型、新参数或新控制结构

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-11`
- 对齐要求：控制框图、三方案对照图和结论表必须同页。

## 步骤 12｜后测与收束：频域判断地图如何接到 `3-9` 与模块 4

### 页面骨架
- 模板：`summary_quiz_board`
- 区域：`quiz` / `summary` / `next`

### 模块清单
- `posttest-group`：后测题组
- `summary-card-row`：四条结论卡
- `info-graphic`：`3-8-info.png`
- `next-step-card`：去向卡

### 静态承载内容
- 四条结论卡固定为：
  1. 频域是统一翻译器，不是新章孤岛；
  2. Nyquist 与 Bode 说的是同一个稳定边界问题；
  3. 低频、中频、高频分别承担精度、速度与代价判断；
  4. 有效校正不是盲目改增益，而是定向改写关键频带。
- 去向卡固定写明：
  - `3-9`：把今天的频域判断链放回同一对象的多版本比较；
  - 模块 4：把“读懂频域”推进到“按约束形成设计行动”。

### 互动升级点
- 组件类型：`quiz_group`
- 后测题固定围绕：
  - `P/N/Z` 顺序
  - 截止频率与裕度的关系
  - 目标切换下的频带优先级
  - 非最小相的边界直觉

### 埋点与教师数据
- 埋点摘要：`attemptCount`、`resultState`、`exitReflection`
- 教师聚合：`posttest_distribution`、`top_remaining_confusions`

### AI 边界
- 允许范围：本课四条结论与下一课去向
- 禁止范围：把模块 4 的方案设计提前展开

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-12`
- 对齐要求：后测题、四条结论、信息图和去向卡必须同页完整出现。
