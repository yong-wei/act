━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
互动页面设计 | 单元 3-3：根轨迹机制与完整法则——为什么参数变化会推动闭环极点迁移
技术栈：Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 文档职责
- 本文件是供人审阅的页面蓝图，只描述页面模板、固定内容、互动组件、反馈规则、教师聚合、AI 边界与学生页预览口径。
- 同目录 [interactive-contract.yaml](./interactive-contract.yaml) 是机读契约；两者必须逐步骤一一对应。
- 本文件不回退为讲课脚本，不写口播叙事，不给实现阶段留下“到时候再补”的结构空白。
- 页面默认预览入口固定为学生演示页，不以教师端模板弹窗替代真实页面。

## 表述规则
- 先写清页面上直接可见的标题、公式、图像、表格、结论，再决定哪些位置值得互动升级。
- 互动组件只负责预测、判断、配对、改写、对照与反馈，不能替代核心概念、核心公式、关键图表和关键例题。
- 所有关键图示都来自真实媒体文件，不使用 ASCII 图或实现时临时占位。
- 页面顺序与知识分组对齐 `sequence.json` 的五组主线：引入与研究对象、判别入口、完整法则体系、广义视角与参数扩展、动态解释与收束。

## 全课总览
| 步骤 | 标题 | 页面模板 | 主体布局 | 互动组件 | 学生页预览 |
|------|------|----------|----------|----------|------------|
| `step-01` | 回到地图：从稳定边界走向迁移机制 | `map_hero_slide` | 路径图 + 任务卡 | `none` | `/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-01` |
| `step-02` | 问题引入：知道 $K=6$ 还不够 | `figure_question_vote` | 主图 + 三问 + 二选一判断 | `binary_choice` | `/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-02` |
| `step-03` | 本课目标与边界 | `goal_boundary_slide` | 目标卡 + 主线链 + 边界表 | `none` | `/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-03` |
| `step-04` | 根轨迹定义：参数变化下的闭环根集合 | `definition_formula_figure` | 定义卡 + 二阶对象 + 反思框 | `short_response` | `/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-04` |
| `step-05` | 从闭环特征方程到 $GH=-1$ | `equation_to_condition_chain` | 方程链 + 条件入口卡 | `none` | `/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-05` |
| `step-06` | 相角条件与幅值条件 | `geometry_check_workspace` | 几何图 + 条件卡 + 判断区 | `reason_check` | `/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-06` |
| `step-07` | 骨架法则：起点终点、实轴区段、渐近线 | `rules_overview_board` | 主图 + 法则卡 + 高亮区 | `region_highlight` | `/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-07` |
| `step-08` | 关键节点：分离点、虚轴交点、起始角终止角 | `keypoint_compare_board` | 主图 + 三节点卡 + 配对区 | `triple_match` | `/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-08` |
| `step-09` | 完整例题：三阶对象的根轨迹骨架与稳定范围 | `worked_example_workspace` | 题面 + 三步法 + 结果区 | `worked_example_workspace` | `/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-09` |
| `step-10` | 广义根轨迹：一般参数怎样转回普通根轨迹 | `equivalent_open_loop_chain` | 改写链 + 等效开环卡 + 排序区 | `formula_ordering` | `/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-10` |
| `step-11` | 时间常数例子与 $0^\circ/180^\circ$ 根轨迹 | `compare_dual_root_locus` | 例图 + 对照表 + 切换区 | `tab_switch` | `/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-11` |
| `step-12` | 动态翻译：从极点迁移到快慢和振荡 | `dynamic_translation_panel` | 翻译表 + 动态图 + 映射区 | `mapping_highlight` | `/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-12` |
| `step-13` | 后测与收束：从法则走向读图窗口 | `postcheck_quiz` | 三题后测 + 五点总结 + 下节预告 | `quiz_group` | `/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-13` |

## 讲义核心内容映射
| handout_anchor | core_item_type | must_appear_content | target_step | page_mode | interaction_upgrade | media_or_table_ref | acceptance_note |
|---|---|---|---|---|---|---|---|
| ## 一、引入：为什么知道稳定区间还不够 | concept | “知道边界在哪里”与“看清极点怎样走到边界”这两件事的区分。 | `step-02` | `static+interactive` | 二选一判断只负责暴露“边界已足够”的误判。 | `3-3-pp-04-complete-rules-example.svg` | 主图和三问同页出现。 |
| ### 2.1 从闭环特征方程出发：轨迹研究的是“参数变化下的闭环根集合” | concept+formula | `$$1+G(s)H(s)=0$$` 与“参数变化下的闭环根集合”的定义。 | `step-04` | `static+interactive` | 短答区只补一句“为什么单点求根不够”。 | `无` | 定义卡必须先于互动区出现。 |
| ### 2.3 从闭环特征方程到 GH=-1 | formula | `$$G(s)H(s)=-1$$` 的方程链与“后续条件从这里分出”的说明。 | `step-05` | `static` | 无，保持静态展示。 | `无` | 方程链完整落页。 |
| ### 2.4 相角条件：先判断“这个点能不能在轨迹上” / ### 2.5 幅值条件：再判断“若在轨迹上，它对应多大参数” | formula+figure | `$$\angle G(s)H(s)=(2k+1)\pi$$`、`$$|G(s)H(s)|=1$$`，以及“先资格、后参数”的顺序。 | `step-06` | `static+interactive` | 判断区只检查顺序和理由。 | `3-3-pp-03-angle-and-magnitude-geometry.svg` | 几何图和两条条件同时可见。 |
| ### 3.1 起点与终点：轨迹从哪里来，到哪里去 / ### 3.2 分支数、对称性与连续性：先把整张图的骨架搭起来 / ### 3.3 实轴区段法则：哪些实轴段真正属于根轨迹 / ### 3.4 渐近线：当分支走向无穷远时，整体朝哪几个方向展开 | concept+figure | 起点终点、实轴区段、渐近线中心与夹角。 | `step-07` | `static+interactive` | 高亮区只负责法则落点，不省略法则卡。 | `3-3-pp-04-complete-rules-example.svg` / `3-3-pp-05-real-axis-parity.svg` | 骨架法则至少三条同页出现。 |
| ### 3.5 分离点与汇合点：分支什么时候离开实轴，什么时候重新并回 / ### 3.6 虚轴交点：根轨迹何时真正触碰稳定边界 / ### 3.7 起始角与终止角：复极点和复零点附近的切线方向 | concept+figure | 分离点、虚轴交点、起始角终止角的角色区分。 | `step-08` | `static+interactive` | 配对区只负责“哪个节点回答什么问题”。 | `3-3-pp-06-departure-arrival-angle.svg` | 三类关键节点都要明确写出用途。 |
| ### 3.9 完整例题：为 $G(s)=K/[s(s+1)(s+2)]$ 绘制根轨迹骨架并判断稳定范围 | example | 对 `G(s)H(s)=K/[s(s+1)(s+2)]` 依次完成骨架和稳定范围 `0<K<6`。 | `step-09` | `static+interactive` | 工作区只承接三步法和中间量。 | `3-3-pp-04-complete-rules-example.svg` | 题面、三步法、最终稳定范围显式出现。 |
| ### 4.1 为什么要把视角从“增益根轨迹”扩大到“广义根轨迹” / ### 4.2 一般参数怎样转回普通根轨迹问题 | concept+formula | `$$B(s)+aA(s)=0$$` 改写到 `$$1+aA(s)/B(s)=0$$` 的总逻辑。 | `step-10` | `static+interactive` | 排序区只检查改写顺序。 | `3-3-pp-01-root-locus-roadmap.svg` | 改写链完整出现。 |
| ### 4.3 一个非增益参数的例子：以时间常数 $T_a$ 为参数 | example+figure | 时间常数 `T_a` 例子及等效开环 `$$s(s+1)/(s+2)$$`。 | `step-11` | `static+interactive` | 切换区只对照“原方程 / 等效开环 / 轨迹结果”。 | `3-3-pp-07-generalized-time-constant-example.svg` | 等效开环与轨迹图同页。 |
| ### 4.4 $0^\circ$ 根轨迹与 $180^\circ$ 根轨迹：参数方向变化时图形怎样改变 | concept+figure | 两类根轨迹的相角条件差异与同属广义视角的关系。 | `step-11` | `static+interactive` | 标签切换只负责比较，不新增算例。 | `3-3-pp-02-generalized-root-locus-map.svg` | 对照表必须明确“相同研究对象、不同相角条件”。 |
| ## 五、根轨迹如何翻译稳定性与动态变化 / ### 5.1 先看左半平面、虚轴与右半平面 / ### 5.2 再看极点离虚轴有多远 / ### 5.3 还要看极点是沿实轴移动，还是进入复平面 / ### 5.4 两类对象的读图方式 / ### 5.5 从“解释轨迹”走向“读图判断窗口” | conclusion+figure | 看左右半平面、离虚轴距离、实轴/复平面主导三条翻译线。 | `step-12` | `static+interactive` | 高亮区只负责把图上位置映射到结论。 | `3-3-pp-08-dynamics-translation.svg` | 三条翻译线必须成表落页。 |
| ## 六、本讲小结与前后衔接 | summary | 五条收束结论与“下一课进入读图窗口”的铺垫语。 | `step-13` | `static+interactive` | 后测只检查核心判断，不替代总结卡。 | `3-3-info.png` | 后测题与总结卡同时出现。 |

## 步骤 01｜回到地图：从稳定边界走向迁移机制
### 页面骨架
- 模板：`map_hero_slide`
- 区域：`header` / `lead` / `summary`

### 模块清单
- `stage-map`
- `today-task`

### 静态承载内容
- 路径图固定高亮 `3-2 -> 3-3 -> 3-4`
- 任务卡固定写明：边界、迁移、读图窗口三层关系

### 互动升级点
- 组件类型：`none`

### 埋点与教师数据
- 埋点摘要：`viewed`、`timeOnStep`
- 教师聚合：`view_count`

### AI 边界
- 页面目标：标定本课在模块3中的位置
- 允许范围：稳定边界、迁移机制、读图窗口
- 禁止范围：提前展开具体法则和例题计算

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-01`
- 对齐要求：路径图与任务卡同屏可见

## 步骤 02｜问题引入：知道 $K=6$ 还不够
### 页面骨架
- 模板：`figure_question_vote`
- 区域：`figure` / `questions` / `interaction`

### 模块清单
- `main-figure`
- `three-questions`
- `binary-vote`

### 静态承载内容
- 三问固定为：极点先往哪走、何时开始更振荡、边界点之前发生了什么
- 结论卡固定写明：边界判断不能替代迁移机制

### 互动升级点
- 组件类型：`binary_choice`
- 选项：`A. 知道边界点已经足够` / `B. 还需要整条迁移路径`
- 正确项：`B`
- 揭示规则：教师统一揭示

### 埋点与教师数据
- 埋点摘要：`selectedOption`、`resultState`、`teacherRevealSeen`
- 教师聚合：`option_distribution`

### AI 边界
- 页面目标：暴露“边界已足够”的误判
- 允许范围：趋势、边界、振荡
- 禁止范围：提前给出完整法则答案

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-02`
- 对齐要求：主图、三问和判断区同页

## 步骤 03｜本课目标与边界
### 页面骨架
- 模板：`goal_boundary_slide`
- 区域：`goals` / `chain` / `boundary`

### 模块清单
- `goal-cards`
- `main-chain`
- `scope-table`

### 静态承载内容
- 主链固定为：`参数变化 -> 闭环极点迁移 -> 轨迹条件 -> 完整法则 -> 动态翻译`
- 边界表明确“不进入完整手工绘图训练、不进入控制器设计”

### 互动升级点
- 组件类型：`none`

### 埋点与教师数据
- 埋点摘要：`viewed`、`timeOnStep`
- 教师聚合：`view_count`

### AI 边界
- 页面目标：建立本课能力边界
- 允许范围：目标说明与课程边界
- 禁止范围：替代后续步骤讲解

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-03`
- 对齐要求：目标卡、主链、边界表同时落页

## 步骤 04｜根轨迹定义：参数变化下的闭环根集合
### 页面骨架
- 模板：`definition_formula_figure`
- 区域：`definition` / `example` / `reflection`

### 模块清单
- `definition-card`
- `second-order-example`
- `short-response`

### 静态承载内容
- 定义卡固定出现“参数变化下的闭环根集合”
- 起点方程必须显式出现：

$$
1 + G(s)H(s) = 0
$$

- 二阶对象固定出现：

$$
G(s)=\frac{K^\ast}{s(s+2)}
$$

以及其闭环根表达。

### 互动升级点
- 组件类型：`short_response`
- 题干：`为什么单点求根不足以替代根轨迹？`
- 反馈规则：保存文本，不即时判对错

### 埋点与教师数据
- 埋点摘要：`responseSubmitted`、`responseLength`
- 教师聚合：`common_reason_tags`

### AI 边界
- 页面目标：建立“集合”而不是“单点”的视角
- 允许范围：趋势判断、高阶系统、单点求根局限
- 禁止范围：把短答改写成标准答案

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-04`
- 对齐要求：定义卡先于短答区出现

## 步骤 05｜从闭环特征方程到 $GH=-1$
### 页面骨架
- 模板：`equation_to_condition_chain`
- 区域：`equation-chain` / `condition-intro`

### 模块清单
- `equation-chain`
- `condition-intro`

### 静态承载内容
- 方程链完整出现 `$$1+G(s)H(s)=0$$ -> $$G(s)H(s)=-1$$`
- 入口卡固定写明：后续条件都从这一步分出

### 互动升级点
- 组件类型：`none`

### 埋点与教师数据
- 埋点摘要：`viewed`、`timeOnStep`
- 教师聚合：`view_count`

### AI 边界
- 页面目标：建立条件来源
- 允许范围：闭环特征方程与等价改写
- 禁止范围：跳过方程链直接给条件结论

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-05`
- 对齐要求：方程链必须作为页面主视觉

## 步骤 06｜相角条件与幅值条件
### 页面骨架
- 模板：`geometry_check_workspace`
- 区域：`figure` / `conditions` / `interaction`

### 模块清单
- `geometry-figure`
- `condition-cards`
- `reason-check`

### 静态承载内容
- 条件卡必须完整出现：

$$
\angle G(s)H(s)=(2k+1)\pi
$$

$$
|G(s)H(s)|=1
$$

- 顺序提示固定写明：先资格、后参数

### 互动升级点
- 组件类型：`reason_check`
- 任务：判断“某点是否应先查相角还是先算参数”
- 反馈规则：给出顺序反馈与一句理由提示

### 埋点与教师数据
- 埋点摘要：`selectedReason`、`attemptCount`
- 教师聚合：`reason_distribution`

### AI 边界
- 页面目标：稳住两大条件的使用顺序
- 允许范围：角度、距离、资格判断、参数大小
- 禁止范围：AI 直接替代学生先判断

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-06`
- 对齐要求：几何图、条件卡和互动区同屏

## 步骤 07｜骨架法则：起点终点、实轴区段、渐近线
### 页面骨架
- 模板：`rules_overview_board`
- 区域：`main-figure` / `rule-cards` / `interaction`

### 模块清单
- `main-figure`
- `skeleton-rule-cards`
- `region-highlight`

### 静态承载内容
- 规则卡至少包含起点终点、实轴区段、渐近线中心与夹角
- 主图固定使用 `3-3-pp-04`，实轴判段补 `3-3-pp-05`

### 互动升级点
- 组件类型：`region_highlight`
- 任务：点选“属于骨架法则”的图上区域
- 反馈规则：正确后高亮对应法则卡

### 埋点与教师数据
- 埋点摘要：`highlightChoice`、`resultState`
- 教师聚合：`rule_confusion_heatmap`

### AI 边界
- 页面目标：先把整体骨架搭起来
- 允许范围：起点终点、实轴区段、渐近线
- 禁止范围：先跳去算分离点或虚轴交点

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-07`
- 对齐要求：法则卡和主图必须同时可见

## 步骤 08｜关键节点：分离点、虚轴交点、起始角终止角
### 页面骨架
- 模板：`keypoint_compare_board`
- 区域：`main-figure` / `keypoint-cards` / `interaction`

### 模块清单
- `main-figure`
- `keypoint-cards`
- `triple-match`

### 静态承载内容
- 三张节点卡分别写明：回答什么问题、何时需要、与骨架法则的关系
- 起始角/终止角图固定使用 `3-3-pp-06`

### 互动升级点
- 组件类型：`triple_match`
- 任务：把“分离点 / 虚轴交点 / 起始角终止角”与“对应问题”配对
- 反馈规则：即时对错，可重试

### 埋点与教师数据
- 埋点摘要：`matchAttempted`、`matchCorrected`
- 教师聚合：`keypoint_mismatch_pairs`

### AI 边界
- 页面目标：把关键节点的职责分清
- 允许范围：分离、越轴、局部切线方向
- 禁止范围：把三者混成同一类“细节点”

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-08`
- 对齐要求：三节点卡和配对区同屏

## 步骤 09｜完整例题：三阶对象的根轨迹骨架与稳定范围
### 页面骨架
- 模板：`worked_example_workspace`
- 区域：`problem` / `method` / `workspace`

### 模块清单
- `problem-card`
- `three-step-method`
- `worked-example-workspace`

### 静态承载内容
- 题面固定给出 `$$G(s)H(s)=K/[s(s+1)(s+2)]$$`
- 三步法固定为：先骨架、再关键点、最后稳定范围
- 最终结论固定出现 `$$0<K<6$$`

### 互动升级点
- 组件类型：`worked_example_workspace`
- 任务：按步骤补全“实轴区段 / 渐近线 / 关键节点 / 稳定范围”
- 反馈规则：分步校验，不一次性放全答案

### 埋点与教师数据
- 埋点摘要：`stepCompletion`, `attemptCount`, `errorBucket`
- 教师聚合：`example_bottlenecks`

### AI 边界
- 页面目标：把完整机制串到同一道题里
- 允许范围：三步法、中间量、结论核对
- 禁止范围：AI 一次性给出全题答案

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-09`
- 对齐要求：题面、方法卡、工作区同时落页

## 步骤 10｜广义根轨迹：一般参数怎样转回普通根轨迹
### 页面骨架
- 模板：`equivalent_open_loop_chain`
- 区域：`rewrite-chain` / `equivalent-card` / `interaction`

### 模块清单
- `rewrite-chain`
- `equivalent-open-loop-card`
- `formula-ordering`

### 静态承载内容
- 改写链必须完整出现 `$$B(s)+aA(s)=0$$ -> $$1+aA(s)/B(s)=0$$`
- 等效开环卡固定写明：没有新法则，只有新改写

### 互动升级点
- 组件类型：`formula_ordering`
- 任务：把改写步骤按正确顺序排列
- 反馈规则：排序正确后显示等效开环总结

### 埋点与教师数据
- 埋点摘要：`orderAttempted`、`resultState`
- 教师聚合：`ordering_error_patterns`

### AI 边界
- 页面目标：建立广义视角的最小骨架
- 允许范围：等效开环、普通根轨迹复用
- 禁止范围：把广义根轨迹说成独立新算法

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-10`
- 对齐要求：改写链与排序区同屏

## 步骤 11｜时间常数例子与 $0^\circ/180^\circ$ 根轨迹
### 页面骨架
- 模板：`compare_dual_root_locus`
- 区域：`example` / `compare-table` / `interaction`

### 模块清单
- `time-constant-example`
- `zero-vs-oneeighty-table`
- `tab-switch`

### 静态承载内容
- 时间常数例图固定使用 `3-3-pp-07`
- 对照表固定写明两类根轨迹的相角条件差异
- 扩展关系图固定使用 `3-3-pp-02`

### 互动升级点
- 组件类型：`tab_switch`
- 标签：`时间常数例子` / `0° vs 180°`
- 反馈规则：切换不提交，只记录关注点

### 埋点与教师数据
- 埋点摘要：`tabVisited`、`timeOnTab`
- 教师聚合：`tab_attention_distribution`

### AI 边界
- 页面目标：把非增益参数与方向差异放回统一视角
- 允许范围：时间常数改写、相角条件对照
- 禁止范围：新增复杂算例

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-11`
- 对齐要求：例图和对照表都必须落页

## 步骤 12｜动态翻译：从极点迁移到快慢和振荡
### 页面骨架
- 模板：`dynamic_translation_panel`
- 区域：`translation-table` / `figure` / `interaction`

### 模块清单
- `translation-table`
- `dynamic-figure`
- `mapping-highlight`

### 静态承载内容
- 翻译表固定包含三行：左右半平面、离虚轴距离、实轴/复平面主导
- 动态图固定使用 `3-3-pp-08`

### 互动升级点
- 组件类型：`mapping_highlight`
- 任务：把图上的三个位置变化映射到“更快 / 更振荡 / 更靠近边界”三类结论
- 反馈规则：按项高亮，不一次性给全表

### 埋点与教师数据
- 埋点摘要：`mappingChoice`、`resultState`
- 教师聚合：`translation_error_map`

### AI 边界
- 页面目标：把轨迹重新翻译回系统行为
- 允许范围：稳定性、快慢、拖尾、振荡趋势
- 禁止范围：跳到下一课参数窗口定量设计

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-12`
- 对齐要求：翻译表和动态图同屏

## 步骤 13｜后测与收束：从法则走向读图窗口
### 页面骨架
- 模板：`postcheck_quiz`
- 区域：`quiz` / `summary` / `next-step`

### 模块清单
- `post-quiz`
- `summary-cards`
- `next-lesson-card`

### 静态承载内容
- 三道后测题全部落页
- 五条总结卡固定对应讲义小结
- 下节卡固定写明：`3-4` 进入读图判断、关键节点验证与参数窗口

### 互动升级点
- 组件类型：`quiz_group`
- 题量：3
- 反馈规则：教师统一揭示；错因标签保留到教师聚合

### 埋点与教师数据
- 埋点摘要：`attemptCount`、`resultState`、`errorBucket`、`teacherRevealSeen`
- 教师聚合：`post_quiz_distribution`、`ready_for_next_lesson_rate`

### AI 边界
- 页面目标：检查能否从条件和法则走到整体判断
- 允许范围：条件、骨架、广义改写、动态翻译
- 禁止范围：直接把答案写给学生

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-3-root-locus-rules/student/demo?step=step-13`
- 对齐要求：后测题、总结卡、下节预告卡同页可见
