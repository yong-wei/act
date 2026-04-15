━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
互动页面设计 | 单元 3-7：型别、积分环节与稳态改善——PI 与滞后校正的低频补偿机理
技术栈：Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 文档职责
- 本文件是供人审阅的页面蓝图，只描述页面模板、固定内容、互动组件、反馈规则、教师聚合、AI 边界与学生页预览口径。
- 同目录 [interactive-contract.yaml](./interactive-contract.yaml) 是机读契约；两者必须逐步骤一一对应。
- 本文件不是讲义摘要，不写教师台词，不把关键公式、图表或判断语言留给实现阶段脑补。
- 默认预览口径固定为学生演示页；教师端模板弹窗只用于查看课堂骨架，不代替真实页面预览。

## 表述规则
- 页面描述只保留客观结构：区域、模块、文本、公式、图片、表格、互动组件、反馈规则、教师聚合与验收条件。
- 动作化表述禁用：`展示`、`引导`、`让学生`、`先做一次`、`跟着算`、`教师讲` 等。
- 静态内容优先。互动组件只负责通道识别、路径选择、代价比较、误判纠正，不替代核心公式、图表、例题与结论。
- 本课主线固定为：`动态改善为什么还没回答“更准” -> 给定/扰动双通道 -> 终值定理与型别快判 -> 增益变大 vs 型别提高 -> PI / 滞后低频补偿 -> 为什么这会自然过渡到 3-8`。

## 证据单元升级决策表
| 证据类型 | 来源锚点 | 目标步骤 | 升级方式 | 保留元素 | 不得删减内容 | 验收点 |
|---|---|---|---|---|---|---|
| 路径定位 + 主问题 | `## 一、引入：系统已经稳定了，为什么还可能不够准` | step-01 | 静态保留 | `3-6 -> 3-7 -> 3-8` 路径、主问题、边界卡 | “动态改善没有自动回答更准”这句主问题不得消失 | 首屏直接看到路径图、主问题卡、边界卡 |
| 双通道结构图 + 四类传函 | `### 2.1`、`### 2.2` | step-04 | 原生重绘 + 热点标注 | 给定入口、扰动入口、总输出、总误差、四类传函、分母相同/分子分通道 | 不得只保留结构图或只保留公式；`总输出` 与 `总误差` 结论不得省略 | 结构图、四式卡、通道判断句在互动前完整可读 |
| 终值定理三步法 + 例题 1 | `### 2.3`、`#### 例题 1` | step-05 | 静态保留 + 工作区补链 | 判稳定、写误差、做终值极限、题面、结果 | 不得把“三步法”压缩成只剩终值公式；结果来源链不得省略 | 三步法卡、终值定理公式、题面、结果同屏 |
| 型别定义 + 双表快判 | `### 2.4` | step-06 | 静态保留 + 配对 | 型别定义、`K_p/K_v/K_a`、两张表、适用边界 | 不得只保留一张表；“扰动题不能直接套表”不得删 | 两张表先于配对区出现，边界句同屏 |
| 复合例题 2 双输入链 | `### 2.5`、`#### 例题 2` | step-07 | 静态保留 + 工作区补链 | 双输入结构、总误差列式、代入式、结果 `0.4` | 不得把“不能只套表”的理由删成仅留答案 | 结构图、两条公式、结果栏同页 |
| 增益 vs 型别对照 | `### 2.6` | step-08 | 静态保留 + 二选一判断 | 压小误差 vs 改变误差阶次 | 不得把“压小”和“归零”混成同一结论 | 对照卡先出现，判断区后出现 |
| `PI / lag` 低频补偿对照 | `### 3.1` | step-09 | 原生重绘 + 排序 | 三类补偿图、比较表、共同点与差异 | 不得把滞后写成“弱积分”；`PI / lag` 各自抓手不得缺项 | 图与表先于排序区，同页完成 |
| 时域设计双案比较 | `### 3.2`、`### 3.3` | step-10 | 静态保留 + 结构化比较 | `PI` 提高型别、`lag` 抬高低频、两张设计图、关键指标 | 不得只剩指标结论而丢失“结构抓手” | 两图与指标卡同屏，可直接比较 |
| 频域过渡链 | `### 3.4`、`### 3.5` | step-11 | 静态保留 + 配对 | 纯增益限制、`PI` 频域设计顺序、`PI / PD` 比较图表 | 不得只保留最终控制器表达式；纯增益为何不够必须写明 | 限制条件、设计顺序、图表同屏 |
| 收束与去向 | `### 3.6`、`## 五`、`## 附录 A` | step-12 | 静态保留 + 后测 | 规则表、六条小结、信息图、`3-8` 去向 | 不得删掉“直接求 / 快速判”规则表 | 小结卡、规则表、后测题、去向卡同页 |

## 混合证据顺序表
| 步骤 | 先出现什么 | 再出现什么 | 最后出现什么 | 必须同屏内容 | 不得折叠内容 |
|---|---|---|---|---|---|
| step-04 | 双通道结构图与信号位置 | 四类传函 + 总输出/总误差结论 | 热点标注区 | 结构图、四式卡、通道判断句 | 任一公式卡 |
| step-05 | 三步法卡 + 终值定理 | 例题 1 题面与列式链 | 工作区 | 三步法、题面、结果 | 三步法卡 |
| step-06 | 型别定义与误差系数公式 | 两张快判表 + 适用边界 | 配对区 | 两张表、边界句 | 任一表格 |
| step-07 | 双输入结构图 | 总误差式 + 代入式 + 结果 `0.4` | 工作区 | 结构图、两条公式、结果栏 | 总误差式 |
| step-09 | `PI / lag / lead` 对照图 | 比较表 + 共同点句 | 排序区 | 图、表、共同点句 | 比较表 |
| step-10 | `PI` 设计图 | `lag` 设计图 + 指标卡 | 结构化比较区 | 两张设计图、指标卡 | 任一设计图 |
| step-11 | 纯增益限制句 + 设计顺序卡 | `PI` 频域图 + `PI / PD` 比较表 | 配对区 | 限制句、顺序卡、图表 | 设计顺序卡 |
| step-12 | 后测题组 | 六条小结 + 规则表 + 信息图 | `3-8` 去向卡 | 规则表、小结卡、去向卡 | 规则表 |

## 全课总览
| 步骤 | 标题 | 页面模板 | 主体布局 | 互动组件 | 学生页预览 |
|------|------|----------|----------|----------|------------|
| step-01 | 回到地图：为什么动态改善之后还可能不够准 | `map_hero_slide` | 路径图 + 主问题卡 + 边界卡 | `none` | `/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-01` |
| step-02 | 学习目标与边界：本课先回答“为什么更准” | `goal_boundary_slide` | 目标卡 + 边界表 | `none` | `/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-02` |
| step-03 | 前测：给定、扰动、型别三类混淆 | `question_stack` | 三题前测 + 提交反馈条 | `quiz_group` | `/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-03` |
| step-04 | 双通道骨架：先分给定与扰动，再写总输出与总误差 | `formula_media_compare` | 结构图 + 四式卡 + 标注区 | `hotspot_labeling` | `/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-04` |
| step-05 | 终值定理直接求：稳态误差的通用路径 | `worked_example_workspace` | 路径卡 + 例题卡 + 填写区 | `worked_example_workspace` | `/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-05` |
| step-06 | 型别与静态误差系数：什么时候能快速判断 | `formula_table_match` | 型别表 + 误差系数表 + 对应区 | `triple_match` | `/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-06` |
| step-07 | 复合例题：给定与扰动共同作用时为什么不能只套表 | `worked_example_workspace` | 结构图 + 列式卡 + 结果栏 | `worked_example_workspace` | `/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-07` |
| step-08 | 增益变大 vs 型别提高：哪一种才会改变误差阶次 | `contrast_summary_board` | 对照卡 + 判断区 + 错因提示 | `binary_choice` | `/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-08` |
| step-09 | 稳态改善路径比较：PI 与滞后都站在低频补偿线上 | `comparison_panel_with_sort` | 结构对照图 + 比较表 + 排序区 | `card_sort` | `/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-09` |
| step-10 | 时域设计工作区：PI 改型别，滞后抬低频 | `design_compare_workspace` | 两张设计图 + 指标卡 + 对照区 | `structured_compare` | `/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-10` |
| step-11 | 频域过渡：为什么 PI 更准、PD 更快 | `formula_media_compare` | 频域图 + 对比表 + 归因区 | `triple_match` | `/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-11` |
| step-12 | 后测与收束：先选路径，再认代价，最后接到 3-8 | `summary_quiz_board` | 后测题组 + 小结卡 + 去向卡 | `quiz_group` | `/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-12` |

## 讲义核心内容映射
| handout_anchor | core_item_type | must_appear_content | target_step | page_mode | interaction_upgrade | media_or_table_ref | acceptance_note |
|---|---|---|---|---|---|---|---|
| ## 一、引入：系统已经稳定了，为什么还可能不够准 | concept+question | “稳定不等于够准”“误差有结构来源与通道来源”两条开场判断。 | step-01 | static | 无。 | 主问题卡 | 主问题与动态改善线对照必须首屏可见。 |
| ### 2.1 误差先从两类来源理解 / ### 2.2 给定与扰动为何必须分通道 | concept+formula+figure | 给定/扰动双通道、总输出、总误差、四类传函分母相同分子不同。 | step-04 | static+interactive | 热点标注只负责指出各信号进入位置与公式对应关系。 | 3-7-error-dual-channel.png | 结构图与四式卡必须先于互动区完整出现。 |
| ### 2.3 终值定理：稳态误差的直接求法 / #### 例题 1：多项式输入作用下的稳态误差 | formula+example | 通用三步法、终值定理公式、例题 1 列式与结果。 | step-05 | static+interactive | 工作区只辅助填写极限链，不替代通用路径卡。 | 例题 1 公式链 | 三步法、终值定理和例题结果必须同屏。 |
| ### 2.4 型别与静态误差系数：稳态误差的快速判断 | formula+table | 型别定义、$K_p/K_v/K_a$ 定义、典型输入误差表、适用边界。 | step-06 | static+interactive | 对应区只负责把输入类型、型别和误差形式配对。 | 表 2 / 表 3 | 两张表和适用边界必须完整静态出现。 |
| ### 2.5 给定与扰动共同作用下如何求稳态误差 / #### 例题 2：给定与扰动共同作用 | example+figure | 例题 2 的双输入结构、总误差列式、结果 `0.4` 与“不能只套表”的理由。 | step-07 | static+interactive | 工作区只辅助学生选择列式顺序与结果检查。 | 3-7-example2-structure.png | 结构图、总误差式和结果栏必须同屏。 |
| ### 2.6 为什么结构性误差不能靠纯调增益消除 | concept+comparison | “增益变大 vs 型别提高”的本质差异。 | step-08 | static+interactive | 二选一判断只负责暴露误判，不替代对照卡。 | 对照卡 | 对照卡必须先静态出现。 |
| ### 3.1 两种低频补偿的结构差别 | concept+figure+table | `PI`、滞后、超前三种零极点与频带直觉；表 4 的四列比较。 | step-09 | static+interactive | 排序区只强化“是否改型别 / 主要收益 / 主要代价”。 | 3-7-low-frequency-compensators.png | 图与比较表必须先于排序区出现。 |
| ### 3.2 基于时域指标的 `PI` 设计：先证明纯增益不够，再改结构 / ### 3.3 基于时域指标的滞后校正：同样要先画可行域 | example+comparison | `PI` 提高型别、滞后抬低频；两张时域设计图与关键指标。 | step-10 | static+interactive | 结构化比较只负责归纳抓手与结果。 | 3-7-pi-time-domain-design.png / 3-7-lag-time-domain-design.png | 两张设计图与指标卡必须同屏可比。 |
| ### 3.4 基于频域指标的 `PI` 设计：先说明纯增益为什么不可能两头兼顾 / ### 3.5 频域设计下 `PI` 与 `PD` 的性能差异 | formula+figure+table | 纯增益为什么两头兼顾不了、`PI` 频域设计顺序、`PI / PD` 比较表。 | step-11 | static+interactive | 对应区只负责把“更准 / 更快 / 代价落点”与方法对应。 | 3-7-pi-frequency-design.png / 3-7-pi-pd-comparison.png | 频域图和比较表必须完整出现。 |
| ### 3.6 收束：为什么这会自然过渡到 3-8 / ## 五、本节小结与前后衔接 / ## 附录 A：稳态误差求解路径判断表 | summary+quiz | 低频决定精度、中频暴露代价、直接求/快速判选用规则、`3-8` 去向。 | step-12 | static+quiz | 后测题只检查路径与代价判断，不替代小结本体。 | 3-7-info.png / 表 6 | 小结卡、去向卡、后测题必须同页。 |

## 步骤 01｜回到地图：为什么动态改善之后还可能不够准

### 页面骨架
- 模板：`map_hero_slide`
- 区域：`header` / `lead` / `summary`

### 模块清单
- `stage-map`：模块 3 路径图
- `core-question-card`：主问题卡
- `boundary-card`：本课边界卡

### 静态承载内容
- 路径图固定高亮 `3-6 -> 3-7 -> 3-8`。
- 主问题卡固定写明：
  - 系统稳定了，为什么误差还可能留在比较点上？
  - 为什么“更快更稳”并没有自动回答“为什么更准”？
- 边界卡固定写明：本课不进入 Nyquist 判据和模块 4 的完整校正整定流程。

### 互动升级点
- 组件类型：`none`
- 提交态：无
- 揭示规则：无

### 埋点与教师数据
- 埋点摘要：`viewed`、`timeOnStep`、`teacherFollowSync`
- 教师聚合：`view_count`、`sync_status`

### AI 边界
- 页面目标：标定本课位于模块 3 “稳态改善线”的入口位置。
- 允许范围：课程路径、动态改善线与稳态改善线的区别。
- 禁止范围：提前展开例题数值或补偿器参数。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-01`
- 对齐要求：首屏直接出现路径图、主问题卡和边界卡，不出现作答区占位。

## 步骤 02｜学习目标与边界：本课先回答“为什么更准”

### 页面骨架
- 模板：`goal_boundary_slide`
- 区域：`goals` / `boundary`

### 模块清单
- `goal-cards`：四项目标卡
- `boundary-table`：负责 / 不负责边界表

### 静态承载内容
- 四项目标卡固定对应：会分通道、会选路径、会分辨增益与型别、会比较 `PI / lag`。
- 边界表固定写明：
  - 本课负责：通道分析、稳态误差求解、低频补偿路径、频域过渡。
  - 本课不负责：频域判据、完整整定、模块 4 控制器选型。

### 互动升级点
- 组件类型：`none`

### 埋点与教师数据
- 埋点摘要：`viewed`、`timeOnStep`
- 教师聚合：`view_count`

### AI 边界
- 页面目标：建立明确的课堂边界。
- 允许范围：目标卡、边界表、模块 3 位置。
- 禁止范围：偷渡后续模块内容。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-02`
- 对齐要求：目标卡与边界表必须同屏。

## 步骤 03｜前测：给定、扰动、型别三类混淆

### 页面骨架
- 模板：`question_stack`
- 区域：`question-stack` / `submit-bar`

### 模块清单
- `pretest-q1`：扰动能否直接套型别表
- `pretest-q2`：I 型系统只调增益能否消除斜坡误差
- `pretest-q3`：滞后是不是更弱积分

### 静态承载内容
- 三道题干全部明文落页。
- 误区提示固定列出：
  - 扰动不是另一种输入型别；
  - 增益变大不等于型别提高；
  - `PI` 与滞后不是强弱关系。

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
- 学生页预览：`/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-03`
- 对齐要求：三题在未作答状态下全部可见。

## 步骤 04｜双通道骨架：先分给定与扰动，再写总输出与总误差

### 页面骨架
- 模板：`formula_media_compare`
- 区域：`media` / `formula` / `interaction`

### 模块清单
- `dual-channel-figure`：双通道结构图
- `formula-card-row`：四式卡
- `channel-hotspots`：热点标注区

### 静态承载内容
- 主图固定使用 `3-7-error-dual-channel.png`。
- 四式卡必须完整落页：
  - $\Phi_r(s)=\dfrac{C(s)}{R(s)}=\dfrac{G_c(s)G_p(s)}{1+G_c(s)G_p(s)H(s)}$
  - $\Phi_d(s)=\dfrac{C(s)}{D(s)}=\dfrac{G_p(s)}{1+G_c(s)G_p(s)H(s)}$
  - $\dfrac{E_r(s)}{R(s)}=\dfrac{1}{1+G_c(s)G_p(s)H(s)}$
  - $\dfrac{E_d(s)}{D(s)}=-\dfrac{G_p(s)H(s)}{1+G_c(s)G_p(s)H(s)}$
- 总输出与总误差结论必须与四式卡同页写明：
  - $C(s)=\Phi_r(s)R(s)+\Phi_d(s)D(s)$
  - $E(s)=E_r(s)+E_d(s)$
- 结论卡固定写明：分母相同反映结构，分子不同反映通道。
- 混合证据顺序固定为：先结构图与信号位置 -> 再四类传函和总输出/总误差结论 -> 最后开放热点标注区。

### 互动升级点
- 组件类型：`hotspot_labeling`
- 任务：把“给定入口 / 扰动入口 / 总输出 / 总误差”与图中位置对应起来
- 反馈规则：即时标对错，可重试

### 埋点与教师数据
- 埋点摘要：`labelAttempted`、`labelCorrected`、`timeOnStep`
- 教师聚合：`common_mislabels`、`completion_rate`

### AI 边界
- 页面目标：把“先分通道”立成固定动作。
- 允许范围：通道位置、结构与分子分母含义。
- 禁止范围：提前跳到数值结果。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-04`
- 对齐要求：结构图、四式卡、总输出/总误差结论必须先于热点区出现，且不得折叠到二级抽屉。

## 步骤 05｜终值定理直接求：稳态误差的通用路径

### 页面骨架
- 模板：`worked_example_workspace`
- 区域：`workflow` / `problem` / `workspace`

### 模块清单
- `three-step-card`：三步法卡
- `example-one-card`：例题 1 题面
- `limit-workspace`：极限链填写区

### 静态承载内容
- 三步法固定写明：判稳定 -> 写误差 -> 做终值极限。
- 终值定理公式与例题 1 的输入表达必须完整显示：
  - $e_{ss}=\lim_{s\to 0}sE(s)$
  - $R(s)=\dfrac{3}{s}+\dfrac{2}{s^2}+\dfrac{1}{s^3}$
- 结果摘要固定写明：本题最终稳态误差为 `1/K`。
- 混合证据顺序固定为：先三步法卡与终值定理 -> 再题面与列式链 -> 最后开放工作区。

### 互动升级点
- 组件类型：`worked_example_workspace`
- 任务：按步骤补全 `E(s)` 与 `e_{ss}` 计算链
- 反馈规则：分段反馈，只提示“漏了哪一步”

### 埋点与教师数据
- 埋点摘要：`stepCompletion`, `errorBucket`, `timeOnStep`
- 教师聚合：`stuck_step_distribution`

### AI 边界
- 页面目标：把直接求法压成固定流程。
- 允许范围：终值定理、列式顺序、例题 1。
- 禁止范围：跳过误差表达直接报结果。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-05`
- 对齐要求：三步法卡、终值定理公式、题面与结果摘要必须同屏，工作区不得把三步法顶出首屏。

## 步骤 06｜型别与静态误差系数：什么时候能快速判断

### 页面骨架
- 模板：`formula_table_match`
- 区域：`formula` / `tables` / `interaction`

### 模块清单
- `type-definition-card`：型别定义卡
- `static-coefficient-card`：误差系数定义卡
- `type-coefficient-table`：型别与误差系数关系表
- `type-error-table`：典型输入误差表
- `match-zone`：配对区

### 静态承载内容
- 型别定义和 `K_p/K_v/K_a` 公式必须完整落页。
- 两张表固定出现：
  - 型别与误差系数关系
  - 型别与典型输入误差关系
- 边界提示固定写明：显式扰动问题不得直接用表代替列式。
- 混合证据顺序固定为：先型别定义与误差系数公式 -> 再两张快判表与边界提示 -> 最后开放配对区。

### 互动升级点
- 组件类型：`triple_match`
- 任务：把输入类型、可用误差系数、误差形式对应起来

### 埋点与教师数据
- 埋点摘要：`matchAttempted`、`matchCorrected`
- 教师聚合：`common_mismatch_pairs`

### AI 边界
- 页面目标：把快判的适用边界说清。
- 允许范围：型别、误差系数、标准给定输入。
- 禁止范围：把所有扰动问题都折成快判题。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-06`
- 对齐要求：两张表和边界提示必须先于配对区出现，且两张表都不得折叠。

## 步骤 07｜复合例题：给定与扰动共同作用时为什么不能只套表

### 页面骨架
- 模板：`worked_example_workspace`
- 区域：`problem` / `figure` / `workspace`

### 模块清单
- `example-two-card`：例题 2 题面
- `example-two-figure`：双输入结构图
- `total-error-workspace`：总误差列式区

### 静态承载内容
- 主图固定使用 `3-7-example2-structure.png`。
- 题面卡必须完整写出 `G_1(s)`、`G_2(s)`、`R(s)`、`D(s)`。
- 总误差式必须静态落页：
  - $E(s)=\dfrac{1}{1+G_1(s)G_2(s)}R(s)-\dfrac{G_2(s)}{1+G_1(s)G_2(s)}D(s)$
  - $E(s)=\dfrac{s^2+7s+10}{s^2+7s+20}\cdot \dfrac{1}{s}-\dfrac{2(s+5)}{s^2+7s+20}\cdot \dfrac{0.2}{s}$
- 结果卡固定写明：`e_{ss}=0.4`，且原因不是套表，而是先分通道再求极限。
- 混合证据顺序固定为：先双输入结构图 -> 再总误差式、代入式与结果栏 -> 最后开放工作区。

### 互动升级点
- 组件类型：`worked_example_workspace`
- 任务：选择总误差列式顺序并补全关键分子分母
- 反馈规则：指出“漏了给定项/扰动项/比较点定义”中的哪一类

### 埋点与教师数据
- 埋点摘要：`stepCompletion`、`errorBucket`
- 教师聚合：`missing_term_distribution`

### AI 边界
- 页面目标：纠正“给定 + 扰动题也能只套表”的误判。
- 允许范围：总输出、总误差、双通道列式。
- 禁止范围：把两个信号直接合并成单一路径输入。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-07`
- 对齐要求：结构图、题面、两条公式和结果栏必须同页可见，不得把公式后移到点击展开区。

## 步骤 08｜增益变大 vs 型别提高：哪一种才会改变误差阶次

### 页面骨架
- 模板：`contrast_summary_board`
- 区域：`compare` / `interaction` / `summary`

### 模块清单
- `gain-vs-type-card`：对照卡
- `binary-judge`：二选一判断区
- `error-note`：错因提示

### 静态承载内容
- 对照卡固定写明：
  - 增益调节：压小有限误差，但不改变误差阶次
  - 型别提高：可能把原本有限误差变成 0
- 结论句固定写明：想消除结构性误差，第一步不是调 `K`，而是判断是否必须引入积分。
- 混合证据顺序固定为：先对照卡 -> 再结论句 -> 最后开放判断区。

### 互动升级点
- 组件类型：`binary_choice`
- 选项：
  - A：只要把增益调大，I 型系统的斜坡误差总能变成 0
  - B：若型别不变，斜坡误差最多被压小，不能结构性归零
- 正确项：`B`

### 埋点与教师数据
- 埋点摘要：`selectedOption`、`resultState`
- 教师聚合：`option_distribution`

### AI 边界
- 页面目标：把“压小”和“归零”分开。
- 允许范围：增益、型别、误差阶次。
- 禁止范围：跳到具体整定步骤。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-08`
- 对齐要求：对照卡必须完整出现，不能只剩判断按钮。

## 步骤 09｜稳态改善路径比较：PI 与滞后都站在低频补偿线上

### 页面骨架
- 模板：`comparison_panel_with_sort`
- 区域：`media` / `table` / `interaction`

### 模块清单
- `low-frequency-figure`：三类补偿对照图
- `path-compare-table`：路径比较表
- `sort-zone`：收益/代价排序区

### 静态承载内容
- 主图固定使用 `3-7-low-frequency-compensators.png`。
- 比较表固定列出：是否改型别、主要收益、主要代价、更像哪条设计线。
- 结论卡固定写明：`PI` 与滞后都在低频线上，但抓手不同。
- 混合证据顺序固定为：先三类补偿对照图 -> 再比较表与结论卡 -> 最后开放排序区。

### 互动升级点
- 组件类型：`card_sort`
- 任务：把“提高型别 / 抬高低频增益 / 相位滞后增加 / 截止频率下降”分别归入 `PI` 或滞后

### 埋点与教师数据
- 埋点摘要：`sortAttempted`、`sortCorrected`
- 教师聚合：`misclassified_cards`

### AI 边界
- 页面目标：把两条稳态改善线并列立住。
- 允许范围：低频补偿、型别变化、低频增益重分配。
- 禁止范围：把滞后简化成“弱一点的积分”。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-09`
- 对齐要求：图、比较表与结论卡必须先于排序区出现，不得只保留排序卡片。

## 步骤 10｜时域设计工作区：PI 改型别，滞后抬低频

### 页面骨架
- 模板：`design_compare_workspace`
- 区域：`left-example` / `right-example` / `comparison`

### 模块清单
- `pi-time-design`：PI 时域设计图
- `lag-time-design`：滞后时域设计图
- `metric-compare-card`：指标卡
- `compare-workspace`：结构化比较区

### 静态承载内容
- 左侧固定使用 `3-7-pi-time-domain-design.png`。
- 右侧固定使用 `3-7-lag-time-domain-design.png`。
- 指标卡固定写明：
  - `PI`：提高型别，斜坡误差归零
  - 滞后：型别不变，`K_v` 抬高到目标值
- 混合证据顺序固定为：先 `PI` 设计图 -> 再 `lag` 设计图与指标卡 -> 最后开放结构化比较区。

### 互动升级点
- 组件类型：`structured_compare`
- 任务：分别填写“结构抓手 / 精度收益 / 动态代价”

### 埋点与教师数据
- 埋点摘要：`fieldsCompleted`、`compareBucket`
- 教师聚合：`common_compare_gaps`

### AI 边界
- 页面目标：把时域设计差异落到具体图上。
- 允许范围：型别、K_v、超调量、调节时间。
- 禁止范围：把图上结果当成单纯参数背诵题。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-10`
- 对齐要求：两张图和指标卡必须同屏可比，不得拆成前后两页。

## 步骤 11｜频域过渡：为什么 PI 更准、PD 更快

### 页面骨架
- 模板：`formula_media_compare`
- 区域：`media` / `table` / `interaction`

### 模块清单
- `pi-frequency-figure`：PI 频域设计图
- `pi-pd-compare-figure`：PI / PD 时域对照图
- `pi-pd-table`：比较表
- `cause-match`：归因对应区

### 静态承载内容
- 主图固定使用 `3-7-pi-frequency-design.png` 与 `3-7-pi-pd-comparison.png`。
- 比较表固定列出：低频精度、截止频率、相位裕度、时域形态。
- 设计顺序卡必须静态落页：
  - 纯增益若取 $K\ge 10$ 才能满足 $K_v\ge 10$，但相位裕度不足；
  - 先定 $\omega_c^\ast=2.5\ \mathrm{rad/s}$；
  - 再布置 `PI` 零点 $\omega_z=0.125\ \mathrm{rad/s}$；
  - 最后由幅值条件求 $G_{PI}(s)=3\dfrac{s+0.125}{s}$ 并回查 $PM,\ \omega_c$。
- 结论卡固定写明：
  - `PI` 更偏低频精度优先
  - `PD` 更偏动态速度优先
- 混合证据顺序固定为：先纯增益限制句与设计顺序卡 -> 再两张图和比较表 -> 最后开放配对区。

### 互动升级点
- 组件类型：`triple_match`
- 任务：把“更准 / 更快 / 裕量代价 / 低频补偿”与对应方法和频段关系配对

### 埋点与教师数据
- 埋点摘要：`matchAttempted`、`matchCorrected`
- 教师聚合：`common_mismatch_pairs`

### AI 边界
- 页面目标：把 3-7 收束到 3-8 的频域入口。
- 允许范围：低频、中频、相位裕度、带宽、PI/PD 对照。
- 禁止范围：完整频域整定流程或 Nyquist 判据。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-11`
- 对齐要求：纯增益限制句、设计顺序卡、两张图与比较表必须完整可见，不得只留配对题。

## 步骤 12｜后测与收束：先选路径，再认代价，最后接到 3-8

### 页面骨架
- 模板：`summary_quiz_board`
- 区域：`quiz` / `summary` / `next`

### 模块清单
- `post-quiz`：四题后测
- `summary-card`：六条小结卡
- `path-selection-table`：直接求 / 快速判规则表
- `info-graphic`：信息图总结
- `next-lesson-card`：3-8 去向卡

### 静态承载内容
- 后测题固定围绕：分通道、选路径、识别型别与低频补偿代价。
- 小结卡固定收束：
  - 稳态误差先分通道
  - 终值定理是通用路径
  - 型别和误差系数是标准快判
  - 增益变大不等于型别提高
  - `PI` 与滞后都不是免费午餐
  - 下一课转入频域判别语言
- 规则表固定对应附录 A：
  - 标准负反馈、只问典型给定输入稳态误差：优先快速判；
  - 输入与扰动共同存在：优先直接求；
  - 输入是多项式叠加：直接求与快速判均可；
  - 目标是判断是否必须引入积分：先看型别。
- 信息图固定使用 `3-7-info.png`。
- 去向卡固定写明：`3-8` 将把低频收益和中频代价翻译成统一频域判断。
- 混合证据顺序固定为：先后测题组 -> 再六条小结、规则表与信息图 -> 最后出现 `3-8` 去向卡。

### 互动升级点
- 组件类型：`quiz_group`
- 作答模型：四题后测，允许一次重提
- 揭示规则：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`attemptCount`、`resultState`、`errorBucket`
- 教师聚合：`question_distribution`、`summary_completion_rate`

### AI 边界
- 页面目标：检查学生会不会选路径和认代价。
- 允许范围：错因归类、关键词纠偏。
- 禁止范围：替学生写总结句。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/student/demo?step=step-12`
- 对齐要求：后测题、小结卡、规则表、信息图和去向卡必须同页可见，规则表不得折叠。
