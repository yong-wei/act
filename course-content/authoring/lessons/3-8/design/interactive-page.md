# 3-8 互动课程设计：频域判别与跨域综合语言

## 文档职责

本文件是 3-8 互动课程的人读页面蓝图；同目录 `interactive-contract.yaml` 是机读契约。两者按 `step-01` 到 `step-22` 一一对应。

## 全课总览

| 步骤 | 页面标题 | 主阅读顺序 | 互动类型 |
| --- | --- | --- | --- |
| `step-01` | 导入：三类结构变化为什么需要统一频域语言 | 导入问题 -> 封面漫画 -> 本课核心问题 | `none` |
| `step-02` | 课程目标：用频域语言解释结构变化与稳定边界 | 布鲁姆能力目标单列表 | `none` |
| `step-03` | 前测：四类典型误判先暴露出来 | 前置基础说明 -> 前测题组 -> 理由记录 | `quiz_group` |
| `step-04` | 四类结构变化总表：先给开环传函与频率响应，再看频域指纹 | 开环传递函数 -> 频率响应 -> 四类结构变化总表 | `none` |
| `step-05` | 2.2.1 增益提升：整条曲线一起被抬高 | 公式 -> 对应文案 -> Rust 四联互动面板 | `none` |
| `step-06` | 2.2.2 左半平面零点：重点改写中频 | 公式 -> 对应文案 -> Rust 四联互动面板 | `none` |
| `step-07` | 2.2.3 极点增加与积分环节：先给精度，再收紧余量 | 公式 -> 对应文案 -> Rust 四联互动面板 | `none` |
| `step-08` | 2.2.4 右半平面零点：为什么“看起来更强”却可能更难控制 | 公式 -> 对应文案 -> Rust 四联互动面板 | `none` |
| `step-09` | 例题 1：先从哪一段频带开始判断结构变化 | 完整题面 -> 已知变化列表 -> 逐步显影链 -> 独立作答卡 -> 参考答案 | `activity_cards` |
| `step-10` | 从幅角原理到 Nyquist 判据：为什么要研究 F(s)=1+G(s)H(s) | 幅角原理公式 -> 闭环特征方程 -> F(s) 零点与闭环极点 -> (-1,0) 临界点 -> P/N/Z 判稳顺序 | `teacher_reveal_only` |
| `step-11` | 例题 2：第一组 Nyquist 快速判稳题 | 例题 2 题面 -> Nyquist 图形 -> P/N/Z 判稳表 -> 边界提醒 | `none` |
| `step-12` | 例题 3：靠近边界与越过边界有什么本质不同 | 完整题面 -> 边界对照图 -> 增益区间说明 -> 分类作答区 | `card_sort` |
| `step-13` | Bode 判稳：截止频率、相角裕度和增益裕度 | Bode 图 -> 指标定义 -> 三语言对照 -> 热点标注区 | `hotspot_labeling` |
| `step-14` | 例题 4：由 Bode 图直接判断系统在边界哪一侧 | 完整题面 -> 读图顺序 -> 独立作答卡 -> 参考答案 | `activity_cards` |
| `step-15` | 三频段分工：精度、速度与代价不能混读 | 三频段总图 -> 频带职责表 -> 频域量读回表 -> 频带聚焦区 | `band_focus_panel` |
| `step-16` | 例题 5：目标切换时，先改哪一段频带 | 完整题面 -> 独立作答卡 -> 频段分工回看 | `goal_cards` |
| `step-17` | 航向控制案例：先把基线方案的问题读清楚 | 案例背景 -> 基线 2×2 图 -> 基线指标 -> 证据标注卡 | `evidence_mark_cards` |
| `step-18` | 航向控制案例：把时域指标翻译成频域目标，再看超前校正 | 指标翻译链 -> 超前网络 -> 前后对照 2×2 图 -> 指标表 -> 结构化比较卡 | `structured_compare` |
| `step-19` | 稳定平台案例：为什么“只改增益”会左右为难 | 控制框图 -> 激进基线 / 仅降增益对照 -> 矛盾说明 -> 方案投票卡 | `scheme_vote_cards` |
| `step-20` | 稳定平台案例：超前校正怎样兼顾速度和平稳 | 三方案 2×2 图 -> 指标表 -> 固定结论 -> 结构化比较卡 | `structured_compare` |
| `step-21` | 后测：把完整判断链独立走一遍 | 后测题组 -> 剩余错因回看 -> 班级聚合条 | `quiz_group` |
| `step-22` | 总结与去向：`3-9` 和模块 4 从哪里接走本课 | 四条结论 -> 信息图 -> 去向卡 -> 一句反思 | `reflection_card` |

## 讲义核心内容映射

- 讲义 2.2 的开环传函、频率响应和总表进入 `step-04`。
- 讲义 2.2.1 到 2.2.4 分别进入 `step-05` 到 `step-08`，四页统一采用“公式和文案 -> Rust 四联面板”。
- 当前旧 `step-06` 例题页后移为 `step-09`，并修复显影默认层级、教师推进和学生浏览语义。
- 讲义 2.3.1 与 2.3.2 的主要推导进入 `step-10`。
- 例题 2 进入 `step-11`，题面置顶，随后给图形和判稳表，不设置互动。
- 例题 3 后移为 `step-12`，题面补入 `L(s)=K/[(s+1)(s+2)(s+4)]`。
- 讲义 2.4.1 进入 `step-13`，完整保留裕度公式。

## 步骤 01｜导入：三类结构变化为什么需要统一频域语言
### 页面骨架
- 模板与区域以 `interactive-contract.yaml` 中 `step-01` 为准。
### 模块清单
- `intro-question`：导入问题
- `cover-comic`：结构变化的频域入口
- `core-question`：本页核心问题
### 静态承载内容
- 主阅读顺序：导入问题 -> 封面漫画 -> 本课核心问题。
### 混合证据顺序
- 导入问题
- 封面漫画
- 本课核心问题
### 互动升级点
- `none`；若为 `none`，页面不渲染作答壳层。
### 教师控制
- `release_activity=not_applicable`；`open_browse=not_applicable`；`teacher_step_reveal=not_applicable`；`reveal_reference_answer=not_applicable`。
### 学生默认状态
- `default_visibility=visible`。
### 预览口径
- `/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-01`。
### 脱离讲稿自包含检查
- 当前页必须仅凭页面内容说明对象、证据和判断动作：导入：三类结构变化为什么需要统一频域语言。

## 步骤 02｜课程目标：用频域语言解释结构变化与稳定边界
### 页面骨架
- 模板与区域以 `interactive-contract.yaml` 中 `step-02` 为准。
### 模块清单
- `bloom-objectives`：完成本单元后，学习者能够
### 静态承载内容
- 主阅读顺序：布鲁姆能力目标单列表。
### 混合证据顺序
- 布鲁姆能力目标单列表
### 互动升级点
- `none`；若为 `none`，页面不渲染作答壳层。
### 教师控制
- `release_activity=not_applicable`；`open_browse=not_applicable`；`teacher_step_reveal=not_applicable`；`reveal_reference_answer=not_applicable`。
### 学生默认状态
- `default_visibility=visible`。
### 预览口径
- `/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-02`。
### 脱离讲稿自包含检查
- 当前页必须仅凭页面内容说明对象、证据和判断动作：课程目标：用频域语言解释结构变化与稳定边界。

## 步骤 03｜前测：四类典型误判先暴露出来
### 页面骨架
- 模板与区域以 `interactive-contract.yaml` 中 `step-03` 为准。
### 模块清单
- `misconception-list`：bullet-card
- `pretest-card-group`：quiz-group
- `reason-record`：reason-record
- `ai-lock-note`：notice-card
### 静态承载内容
- 主阅读顺序：前置基础说明 -> 前测题组 -> 理由记录。
### 混合证据顺序
- 前置基础说明
- 前测题组
- 理由记录
### 互动升级点
- `quiz_group`；若为 `none`，页面不渲染作答壳层。
### 教师控制
- `release_activity=separate_toggle`；`open_browse=not_applicable`；`teacher_step_reveal=not_applicable`；`reveal_reference_answer=separate_toggle`。
### 学生默认状态
- `default_visibility=hidden`。
### 预览口径
- `/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-03`。
### 脱离讲稿自包含检查
- 当前页必须仅凭页面内容说明对象、证据和判断动作：前测：四类典型误判先暴露出来。

## 步骤 04｜四类结构变化总表：先给开环传函与频率响应，再看频域指纹
### 页面骨架
- 模板与区域以 `interactive-contract.yaml` 中 `step-04` 为准。
### 模块清单
- `open-loop-transfer`：开环传递函数
- `frequency-response`：开环频率响应
- `fingerprint-table`：四类结构变化的频域指纹总表
### 静态承载内容
- 主阅读顺序：开环传递函数 -> 频率响应 -> 四类结构变化总表。
- 先显示 `L(s)=G(s)H(s)` 与 `L(jω)=G(jω)H(jω)`，再显示四类结构变化表。下方不放阅读口令、教师控制或学生作答。
### 混合证据顺序
- 开环传递函数
- 频率响应
- 四类结构变化总表
### 互动升级点
- `none`；若为 `none`，页面不渲染作答壳层。
### 教师控制
- `release_activity=not_applicable`；`open_browse=not_applicable`；`teacher_step_reveal=not_applicable`；`reveal_reference_answer=not_applicable`。
### 学生默认状态
- `default_visibility=visible`。
### 预览口径
- `/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-04`。
### 脱离讲稿自包含检查
- 当前页必须仅凭页面内容说明对象、证据和判断动作：四类结构变化总表：先给开环传函与频率响应，再看频域指纹。

## 步骤 05｜2.2.1 增益提升：整条曲线一起被抬高
### 页面骨架
- 模板与区域以 `interactive-contract.yaml` 中 `step-05` 为准。
### 模块清单
- `step-05-formula`：讲义 2.2.1 公式
- `step-05-explain`：对应文案
- `step-05-rust-panel`：Rust 驱动四联互动面板
### 静态承载内容
- 主阅读顺序：公式 -> 对应文案 -> Rust 四联互动面板。
- 讲义公式：L_{\text{new}}(j\omega)=\alpha L(j\omega); 20\log_{10}\alpha\ \text{dB}。
- 对应文案：若开环增益从 K 增大为 αK，其中 α>1，幅频曲线整体上移，相位曲线基本保持原状。截止频率通常右移，系统速度提高；穿越点更靠近相位不足区，相角裕度常减小。
- Rust 四联面板固定为左上时域曲线、右上 Bode 幅相合并、左下根轨迹、右下控件；基准与变参数曲线同时绘制。
### 混合证据顺序
- 公式
- 对应文案
- Rust 四联互动面板
### 互动升级点
- `none`；若为 `none`，页面不渲染作答壳层。
### 教师控制
- `release_activity=not_applicable`；`open_browse=not_applicable`；`teacher_step_reveal=not_applicable`；`reveal_reference_answer=not_applicable`。
### 学生默认状态
- `default_visibility=visible`。
### 预览口径
- `/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-05`。
### 脱离讲稿自包含检查
- 当前页必须仅凭页面内容说明对象、证据和判断动作：2.2.1 增益提升：整条曲线一起被抬高。

## 步骤 06｜2.2.2 左半平面零点：重点改写中频
### 页面骨架
- 模板与区域以 `interactive-contract.yaml` 中 `step-06` 为准。
### 模块清单
- `step-06-formula`：讲义 2.2.2 公式
- `step-06-explain`：对应文案
- `step-06-rust-panel`：Rust 驱动四联互动面板
### 静态承载内容
- 主阅读顺序：公式 -> 对应文案 -> Rust 四联互动面板。
- 讲义公式：G_z(s)=1+\frac{s}{z},\quad z>0。
- 对应文案：左半平面零点在零点附近频带同时改写幅值和相位：幅值在较高频率开始上升，相位在中频段出现提前，中频段更容易获得动态积极性。
- Rust 四联面板固定为左上时域曲线、右上 Bode 幅相合并、左下根轨迹、右下控件；基准与变参数曲线同时绘制。
### 混合证据顺序
- 公式
- 对应文案
- Rust 四联互动面板
### 互动升级点
- `none`；若为 `none`，页面不渲染作答壳层。
### 教师控制
- `release_activity=not_applicable`；`open_browse=not_applicable`；`teacher_step_reveal=not_applicable`；`reveal_reference_answer=not_applicable`。
### 学生默认状态
- `default_visibility=visible`。
### 预览口径
- `/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-06`。
### 脱离讲稿自包含检查
- 当前页必须仅凭页面内容说明对象、证据和判断动作：2.2.2 左半平面零点：重点改写中频。

## 步骤 07｜2.2.3 极点增加与积分环节：先给精度，再收紧余量
### 页面骨架
- 模板与区域以 `interactive-contract.yaml` 中 `step-07` 为准。
### 模块清单
- `step-07-formula`：讲义 2.2.3 公式
- `step-07-explain`：对应文案
- `step-07-rust-panel`：Rust 驱动四联互动面板
### 静态承载内容
- 主阅读顺序：公式 -> 对应文案 -> Rust 四联互动面板。
- 讲义公式：G_i(s)=\frac{1}{s}。
- 对应文案：积分环节本质上是在原点增加一个极点。低频增益增强会改善稳态精度与抗缓变扰动能力，同时相位下降得更早，中频相位余量变紧。
- Rust 四联面板固定为左上时域曲线、右上 Bode 幅相合并、左下根轨迹、右下控件；基准与变参数曲线同时绘制。
### 混合证据顺序
- 公式
- 对应文案
- Rust 四联互动面板
### 互动升级点
- `none`；若为 `none`，页面不渲染作答壳层。
### 教师控制
- `release_activity=not_applicable`；`open_browse=not_applicable`；`teacher_step_reveal=not_applicable`；`reveal_reference_answer=not_applicable`。
### 学生默认状态
- `default_visibility=visible`。
### 预览口径
- `/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-07`。
### 脱离讲稿自包含检查
- 当前页必须仅凭页面内容说明对象、证据和判断动作：2.2.3 极点增加与积分环节：先给精度，再收紧余量。

## 步骤 08｜2.2.4 右半平面零点：为什么“看起来更强”却可能更难控制
### 页面骨架
- 模板与区域以 `interactive-contract.yaml` 中 `step-08` 为准。
### 模块清单
- `step-08-formula`：讲义 2.2.4 公式
- `step-08-explain`：对应文案
- `step-08-rust-panel`：Rust 驱动四联互动面板
### 静态承载内容
- 主阅读顺序：公式 -> 对应文案 -> Rust 四联互动面板。
- 讲义公式：G_{\text{nmp}}(s)=1-\frac{s}{z},\quad z>0。
- 对应文案：右半平面零点可能让幅值看起来更强，但相位朝不利方向变化。只看截止频率上升会造成误判，相位代价过大时会提高超调风险，甚至把系统推向临界状态。
- Rust 四联面板固定为左上时域曲线、右上 Bode 幅相合并、左下根轨迹、右下控件；基准与变参数曲线同时绘制。
### 混合证据顺序
- 公式
- 对应文案
- Rust 四联互动面板
### 互动升级点
- `none`；若为 `none`，页面不渲染作答壳层。
### 教师控制
- `release_activity=not_applicable`；`open_browse=not_applicable`；`teacher_step_reveal=not_applicable`；`reveal_reference_answer=not_applicable`。
### 学生默认状态
- `default_visibility=visible`。
### 预览口径
- `/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-08`。
### 脱离讲稿自包含检查
- 当前页必须仅凭页面内容说明对象、证据和判断动作：2.2.4 右半平面零点：为什么“看起来更强”却可能更难控制。

## 步骤 09｜例题 1：先从哪一段频带开始判断结构变化
### 页面骨架
- 模板与区域以 `interactive-contract.yaml` 中 `step-09` 为准。
### 模块清单
- `problem-statement-card`：完整题面
- `given-change-list`：三种结构变化
- `step-reveal-column`：显影链
- `activity-card-grid`：作答区
- `reference-answer-card`：参考答案
### 静态承载内容
- 主阅读顺序：完整题面 -> 已知变化列表 -> 逐步显影链 -> 独立作答卡 -> 参考答案。
### 混合证据顺序
- 完整题面
- 已知变化列表
- 逐步显影链
- 独立作答卡
- 参考答案
### 互动升级点
- `activity_cards`；若为 `none`，页面不渲染作答壳层。
### 教师控制
- `release_activity=separate_toggle`；`open_browse=separate_toggle`；`teacher_step_reveal=teacher_only`；`reveal_reference_answer=separate_toggle`。
### 学生默认状态
- `default_visibility=hidden`。
### 预览口径
- `/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-09`。
### 脱离讲稿自包含检查
- 当前页必须仅凭页面内容说明对象、证据和判断动作：例题 1：先从哪一段频带开始判断结构变化。

## 步骤 10｜从幅角原理到 Nyquist 判据：为什么要研究 F(s)=1+G(s)H(s)
### 页面骨架
- 模板与区域以 `interactive-contract.yaml` 中 `step-10` 为准。
### 模块清单
- `argument-principle-formula`：幅角原理
- `closed-loop-formulas`：闭环与辅助函数
- `symbol-meaning-table`：P、N、Z 的含义
- `argument-reveal-chain`：推导逻辑显影
### 静态承载内容
- 主阅读顺序：幅角原理公式 -> 闭环特征方程 -> F(s) 零点与闭环极点 -> (-1,0) 临界点 -> P/N/Z 判稳顺序。
- 页面同时承载幅角原理、闭环特征方程、`F(s)=1+G(s)H(s)`、临界点 `(-1,0)` 和 `N=P-Z` 的逻辑桥接。
### 混合证据顺序
- 幅角原理公式
- 闭环特征方程
- F(s) 零点与闭环极点
- (-1,0) 临界点
- P/N/Z 判稳顺序
### 互动升级点
- `teacher_reveal_only`；若为 `none`，页面不渲染作答壳层。
### 教师控制
- `release_activity=not_applicable`；`open_browse=separate_toggle`；`teacher_step_reveal=teacher_only`；`reveal_reference_answer=not_applicable`。
### 学生默认状态
- `default_visibility=locked`。
### 预览口径
- `/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-10`。
### 脱离讲稿自包含检查
- 当前页必须仅凭页面内容说明对象、证据和判断动作：从幅角原理到 Nyquist 判据：为什么要研究 F(s)=1+G(s)H(s)。

## 步骤 11｜例题 2：第一组 Nyquist 快速判稳题
### 页面骨架
- 模板与区域以 `interactive-contract.yaml` 中 `step-11` 为准。
### 模块清单
- `example-2-problem`：例题 2 题面
- `quickcheck-image`：comparison-graphic
- `pnz-table`：Nyquist 快速判稳 P/N/Z 表
- `boundary-note`：判稳顺序
### 静态承载内容
- 主阅读顺序：例题 2 题面 -> Nyquist 图形 -> P/N/Z 判稳表 -> 边界提醒。
- 例题 2 题面在最上方，图形紧随其后；本页只展示图形和判稳表，不设置学生互动。
### 混合证据顺序
- 例题 2 题面
- Nyquist 图形
- P/N/Z 判稳表
- 边界提醒
### 互动升级点
- `none`；若为 `none`，页面不渲染作答壳层。
### 教师控制
- `release_activity=not_applicable`；`open_browse=not_applicable`；`teacher_step_reveal=not_applicable`；`reveal_reference_answer=not_applicable`。
### 学生默认状态
- `default_visibility=visible`。
### 预览口径
- `/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-11`。
### 脱离讲稿自包含检查
- 当前页必须仅凭页面内容说明对象、证据和判断动作：例题 2：第一组 Nyquist 快速判稳题。

## 步骤 12｜例题 3：靠近边界与越过边界有什么本质不同
### 页面骨架
- 模板与区域以 `interactive-contract.yaml` 中 `step-12` 为准。
### 模块清单
- `design-example-card`：完整题面
- `boundary-figure`：comparison-graphic
- `gain-interval-note`：summary-card
- `card-sort-zone`：增益区间分类作答
### 静态承载内容
- 主阅读顺序：完整题面 -> 边界对照图 -> 增益区间说明 -> 分类作答区。
- 题面必须包含公式 `L(s)=K/[(s+1)(s+2)(s+4)]`。
### 混合证据顺序
- 完整题面
- 边界对照图
- 增益区间说明
- 分类作答区
### 互动升级点
- `card_sort`；若为 `none`，页面不渲染作答壳层。
### 教师控制
- `release_activity=separate_toggle`；`open_browse=separate_toggle`；`teacher_step_reveal=teacher_only`；`reveal_reference_answer=separate_toggle`。
### 学生默认状态
- `default_visibility=hidden`。
### 预览口径
- `/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-12`。
### 脱离讲稿自包含检查
- 当前页必须仅凭页面内容说明对象、证据和判断动作：例题 3：靠近边界与越过边界有什么本质不同。

## 步骤 13｜Bode 判稳：截止频率、相角裕度和增益裕度
### 页面骨架
- 模板与区域以 `interactive-contract.yaml` 中 `step-13` 为准。
### 模块清单
- `bode-image`：comparison-graphic
- `indicator-formula-list`：2.4.1 指标定义
- `three-language-table`：同一稳定问题的三种语言
- `hotspot-labeling-zone`：hotspot-labeling
### 静态承载内容
- 主阅读顺序：Bode 图 -> 指标定义 -> 三语言对照 -> 热点标注区。
- 公式必须包含 `|L(jωc)|=1`、`γ=180°+∠L(jωc)`、`∠L(jωπ)=-180°`、`Gm=1/|L(jωπ)|` 与 `Gm,dB=-20log10|L(jωπ)|`。
### 混合证据顺序
- Bode 图
- 指标定义
- 三语言对照
- 热点标注区
### 互动升级点
- `hotspot_labeling`；若为 `none`，页面不渲染作答壳层。
### 教师控制
- `release_activity=separate_toggle`；`open_browse=always_on`；`teacher_step_reveal=not_applicable`；`reveal_reference_answer=separate_toggle`。
### 学生默认状态
- `default_visibility=hidden`。
### 预览口径
- `/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-13`。
### 脱离讲稿自包含检查
- 当前页必须仅凭页面内容说明对象、证据和判断动作：Bode 判稳：截止频率、相角裕度和增益裕度。

## 步骤 14｜例题 4：由 Bode 图直接判断系统在边界哪一侧
### 页面骨架
- 模板与区域以 `interactive-contract.yaml` 中 `step-14` 为准。
### 模块清单
- `problem-statement-card`：worked-example-card
- `bode-example-image`：comparison-graphic
- `reading-order-card`：process-card
- `activity-card-grid`：作答区
- `reference-answer-card`：参考答案
### 静态承载内容
- 主阅读顺序：完整题面 -> 读图顺序 -> 独立作答卡 -> 参考答案。
### 混合证据顺序
- 完整题面
- 读图顺序
- 独立作答卡
- 参考答案
### 互动升级点
- `activity_cards`；若为 `none`，页面不渲染作答壳层。
### 教师控制
- `release_activity=separate_toggle`；`open_browse=separate_toggle`；`teacher_step_reveal=teacher_only`；`reveal_reference_answer=separate_toggle`。
### 学生默认状态
- `default_visibility=hidden`。
### 预览口径
- `/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-14`。
### 脱离讲稿自包含检查
- 当前页必须仅凭页面内容说明对象、证据和判断动作：例题 4：由 Bode 图直接判断系统在边界哪一侧。

## 步骤 15｜三频段分工：精度、速度与代价不能混读
### 页面骨架
- 模板与区域以 `interactive-contract.yaml` 中 `step-15` 为准。
### 模块清单
- `three-band-image`：comparison-graphic
- `band-duty-table`：三频段职责表
- `metric-readback-table`：频域量读回闭环表现
- `band-focus-panel`：band-focus-panel
### 静态承载内容
- 主阅读顺序：三频段总图 -> 频带职责表 -> 频域量读回表 -> 频带聚焦区。
### 混合证据顺序
- 三频段总图
- 频带职责表
- 频域量读回表
- 频带聚焦区
### 互动升级点
- `band_focus_panel`；若为 `none`，页面不渲染作答壳层。
### 教师控制
- `release_activity=not_applicable`；`open_browse=always_on`；`teacher_step_reveal=not_applicable`；`reveal_reference_answer=not_applicable`。
### 学生默认状态
- `default_visibility=visible`。
### 预览口径
- `/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-15`。
### 脱离讲稿自包含检查
- 当前页必须仅凭页面内容说明对象、证据和判断动作：三频段分工：精度、速度与代价不能混读。

## 步骤 16｜例题 5：目标切换时，先改哪一段频带
### 页面骨架
- 模板与区域以 `interactive-contract.yaml` 中 `step-16` 为准。
### 模块清单
- `goal-switch-card`：worked-example-card
- `activity-card-grid`：作答区
- `frequency-band-review`：三频段回看
### 静态承载内容
- 主阅读顺序：完整题面 -> 独立作答卡 -> 频段分工回看。
### 混合证据顺序
- 完整题面
- 独立作答卡
- 频段分工回看
### 互动升级点
- `goal_cards`；若为 `none`，页面不渲染作答壳层。
### 教师控制
- `release_activity=separate_toggle`；`open_browse=not_applicable`；`teacher_step_reveal=not_applicable`；`reveal_reference_answer=separate_toggle`。
### 学生默认状态
- `default_visibility=hidden`。
### 预览口径
- `/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-16`。
### 脱离讲稿自包含检查
- 当前页必须仅凭页面内容说明对象、证据和判断动作：例题 5：目标切换时，先改哪一段频带。

## 步骤 17｜航向控制案例：先把基线方案的问题读清楚
### 页面骨架
- 模板与区域以 `interactive-contract.yaml` 中 `step-17` 为准。
### 模块清单
- `case-context-card`：case-context-card
- `baseline-2x2-figure`：interactive-figure-panel
- `metric-strip`：metric-strip
- `evidence-mark-cards`：activity-card-grid
### 静态承载内容
- 主阅读顺序：案例背景 -> 基线 2×2 图 -> 基线指标 -> 证据标注卡。
### 混合证据顺序
- 案例背景
- 基线 2×2 图
- 基线指标
- 证据标注卡
### 互动升级点
- `evidence_mark_cards`；若为 `none`，页面不渲染作答壳层。
### 教师控制
- `release_activity=separate_toggle`；`open_browse=always_on`；`teacher_step_reveal=not_applicable`；`reveal_reference_answer=separate_toggle`。
### 学生默认状态
- `default_visibility=hidden`。
### 预览口径
- `/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-17`。
### 脱离讲稿自包含检查
- 当前页必须仅凭页面内容说明对象、证据和判断动作：航向控制案例：先把基线方案的问题读清楚。

## 步骤 18｜航向控制案例：把时域指标翻译成频域目标，再看超前校正
### 页面骨架
- 模板与区域以 `interactive-contract.yaml` 中 `step-18` 为准。
### 模块清单
- `translation-chain-card`：formula-card
- `lead-network-card`：formula-card
- `compare-2x2-figure`：interactive-figure-panel
- `metrics-table`：航向控制基线与超前校正指标表
- `structured-compare-zone`：structured-compare
### 静态承载内容
- 主阅读顺序：指标翻译链 -> 超前网络 -> 前后对照 2×2 图 -> 指标表 -> 结构化比较卡。
### 混合证据顺序
- 指标翻译链
- 超前网络
- 前后对照 2×2 图
- 指标表
- 结构化比较卡
### 互动升级点
- `structured_compare`；若为 `none`，页面不渲染作答壳层。
### 教师控制
- `release_activity=separate_toggle`；`open_browse=separate_toggle`；`teacher_step_reveal=teacher_only`；`reveal_reference_answer=separate_toggle`。
### 学生默认状态
- `default_visibility=hidden`。
### 预览口径
- `/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-18`。
### 脱离讲稿自包含检查
- 当前页必须仅凭页面内容说明对象、证据和判断动作：航向控制案例：把时域指标翻译成频域目标，再看超前校正。

## 步骤 19｜稳定平台案例：为什么“只改增益”会左右为难
### 页面骨架
- 模板与区域以 `interactive-contract.yaml` 中 `step-19` 为准。
### 模块清单
- `platform-structure-graphic`：comparison-graphic
- `aggressive-vs-slow-figure`：interactive-figure-panel
- `contradiction-note`：summary-card
- `scheme-vote-cards`：activity-card-grid
### 静态承载内容
- 主阅读顺序：控制框图 -> 激进基线 / 仅降增益对照 -> 矛盾说明 -> 方案投票卡。
### 混合证据顺序
- 控制框图
- 激进基线 / 仅降增益对照
- 矛盾说明
- 方案投票卡
### 互动升级点
- `scheme_vote_cards`；若为 `none`，页面不渲染作答壳层。
### 教师控制
- `release_activity=separate_toggle`；`open_browse=always_on`；`teacher_step_reveal=not_applicable`；`reveal_reference_answer=separate_toggle`。
### 学生默认状态
- `default_visibility=hidden`。
### 预览口径
- `/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-19`。
### 脱离讲稿自包含检查
- 当前页必须仅凭页面内容说明对象、证据和判断动作：稳定平台案例：为什么“只改增益”会左右为难。

## 步骤 20｜稳定平台案例：超前校正怎样兼顾速度和平稳
### 页面骨架
- 模板与区域以 `interactive-contract.yaml` 中 `step-20` 为准。
### 模块清单
- `three-scheme-2x2-figure`：interactive-figure-panel
- `metrics-table`：稳定平台三方案指标表
- `fixed-conclusion-card`：summary-card
- `structured-compare-zone`：structured-compare
### 静态承载内容
- 主阅读顺序：三方案 2×2 图 -> 指标表 -> 固定结论 -> 结构化比较卡。
### 混合证据顺序
- 三方案 2×2 图
- 指标表
- 固定结论
- 结构化比较卡
### 互动升级点
- `structured_compare`；若为 `none`，页面不渲染作答壳层。
### 教师控制
- `release_activity=separate_toggle`；`open_browse=separate_toggle`；`teacher_step_reveal=teacher_only`；`reveal_reference_answer=separate_toggle`。
### 学生默认状态
- `default_visibility=hidden`。
### 预览口径
- `/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-20`。
### 脱离讲稿自包含检查
- 当前页必须仅凭页面内容说明对象、证据和判断动作：稳定平台案例：超前校正怎样兼顾速度和平稳。

## 步骤 21｜后测：把完整判断链独立走一遍
### 页面骨架
- 模板与区域以 `interactive-contract.yaml` 中 `step-21` 为准。
### 模块清单
- `posttest-card-group`：quiz-group
- `remaining-confusion-note`：summary-card
- `teacher-aggregation-strip`：teacher-strip
### 静态承载内容
- 主阅读顺序：后测题组 -> 剩余错因回看 -> 班级聚合条。
### 混合证据顺序
- 后测题组
- 剩余错因回看
- 班级聚合条
### 互动升级点
- `quiz_group`；若为 `none`，页面不渲染作答壳层。
### 教师控制
- `release_activity=separate_toggle`；`open_browse=not_applicable`；`teacher_step_reveal=not_applicable`；`reveal_reference_answer=separate_toggle`。
### 学生默认状态
- `default_visibility=hidden`。
### 预览口径
- `/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-21`。
### 脱离讲稿自包含检查
- 当前页必须仅凭页面内容说明对象、证据和判断动作：后测：把完整判断链独立走一遍。

## 步骤 22｜总结与去向：`3-9` 和模块 4 从哪里接走本课
### 页面骨架
- 模板与区域以 `interactive-contract.yaml` 中 `step-22` 为准。
### 模块清单
- `summary-card-row`：summary-card-row
- `info-graphic`：media-card
- `next-step-card`：next-step-card
- `reflection-card`：reflection-card
### 静态承载内容
- 主阅读顺序：四条结论 -> 信息图 -> 去向卡 -> 一句反思。
### 混合证据顺序
- 四条结论
- 信息图
- 去向卡
- 一句反思
### 互动升级点
- `reflection_card`；若为 `none`，页面不渲染作答壳层。
### 教师控制
- `release_activity=not_applicable`；`open_browse=always_on`；`teacher_step_reveal=not_applicable`；`reveal_reference_answer=not_applicable`。
### 学生默认状态
- `default_visibility=visible`。
### 预览口径
- `/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/student/demo?step=step-22`。
### 脱离讲稿自包含检查
- 当前页必须仅凭页面内容说明对象、证据和判断动作：总结与去向：`3-9` 和模块 4 从哪里接走本课。
