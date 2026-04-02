━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
互动页面设计 | 单元 3-1：纯极点视角下的稳定、模态与双域近似——为什么高阶系统仍能用低阶模型理解
技术栈：Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 文档职责
- 本文件是供人审阅的页面蓝图，只描述页面模板、固定内容、互动组件、数据采集与 AI 边界。
- 同目录 [interactive-contract.yaml](./interactive-contract.yaml) 是机读契约；两者必须逐步骤一一对应。
- 本文件不是讲义摘要，不写课堂口播，不给实现方留下“到时候再发挥”的结构空白。
- 页面默认预览口径固定为学生演示页，不以教师端模板弹窗替代真实页面。

## 表述规则
- 页面描述只保留客观结构：区域、模块、文本、公式、图片、表格、互动组件、反馈规则。
- 动作化表述禁用：`展示`、`引导`、`让学生`、`先做一次`、`教师讲`、`提醒学生` 等。
- 静态内容优先。互动组件只负责预测、验证、配对、判断、对照与反思，不能替代核心公式、图表、例题与结论。
- 本课只讲纯极点语言，不提前滑入劳斯、根轨迹、Nyquist/Bode 判稳、裕度设计与控制器整定。

## 全课总览
| 步骤 | 标题 | 页面模板 | 主体布局 | 互动组件 | 学生页预览 |
|------|------|----------|----------|----------|------------|
| step-01 | 回到地图——从模块2的对象语言走向模块3的机理语言 | `map_hero_slide` | 路径图 + 今日任务卡 | `none` | `/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-01` |
| step-02 | 情境引入——同主导极点，为什么响应还会不同 | `triple_model_vote` | 三模型公式卡 + 对照图 + 投票区 | `binary_choice` | `/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-02` |
| step-03 | 学习目标与课堂边界——本课负责什么，不负责什么 | `goal_chain_slide` | 目标卡 + 主线链 + 边界卡 | `none` | `/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-03` |
| step-04 | 前测——稳定、主导极点与“可忽略”直觉判断 | `question_stack` | 三题纵向堆叠 + 提交反馈条 | `quiz_group` | `/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-04` |
| step-05 | 稳定底线——先回答“能不能谈近似” | `formula_plus_plane_check` | 特征方程卡 + 半平面图 + 判断区 | `reason_check` | `/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-05` |
| step-06 | 从极点到模态——极点为什么会直接进入响应 | `formula_explain_match` | 一般展开式 + 模态解释条 + 配对区 | `triple_match` | `/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-06` |
| step-07 | 三类极点与重根——形态为什么会完全不同 | `family_compare_switcher` | 极点类型图 + 误区卡 + 切换区 | `tab_switch` | `/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-07` |
| step-08 | 三模型时域对照——主导极点近似为什么有时可靠 | `triple_model_compare` | 三模型公式区 + 时域对照图 + 记录栏 | `comparison_workspace` | `/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-08` |
| step-09 | 时域近似边界——“更靠左”不是万能判断句 | `decision_table_with_reason` | 指标表 + 判断准则表 + 解释区 | `reason_check` | `/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-09` |
| step-10 | 仅看时域还不够——为什么还要回到频域 | `bridge_table_plus_prompt` | 时域结论卡 + 追问清单 + 短答栏 | `short_response` | `/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-10` |
| step-11 | Bode 对照——附加极点何时侵入主要带宽 | `bode_compare_workspace` | 幅频公式区 + Bode 图 + 三频率对照表 | `parameter_workspace` | `/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-11` |
| step-12 | 双域近似判断 + AI 对照——先自判，再问 AI，再回到图上核验 | `compare_then_ai` | 双域判断表 + AI 对照区 + 证据清单 | `ai_compare_workspace` | `/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-12` |
| step-13 | 卷积与模态叠加——输入激发模态，但不会改写极点结构 | `dual_media_reason_check` | 卷积公式卡 + 双图对照 + 误区判断区 | `formula_pair_check` | `/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-13` |
| step-14 | 后测——会不会发散、能不能近似、为什么能解释 | `post_quiz_stack` | 两题客观题 + 一题解释题 | `quiz_group` | `/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-14` |
| step-15 | 总结与后续预告——先守底线，再谈机制，再谈后续方法 | `summary_infographic` | 四句出口判断 + 信息图 + 去向卡 | `none` | `/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-15` |

## 讲义核心内容映射
| handout_anchor | core_item_type | must_appear_content | target_step | page_mode | interaction_upgrade | media_or_table_ref | acceptance_note |
|---|---|---|---|---|---|---|---|
| `### 2.1 闭环特征方程奠定稳定底线` | concept+formula | `$$\Delta(s)=a_ns^n+\cdots+a_1s+a_0=0$$`，`$$\Re(p_i)<0,\ \forall i$$`，并明确左半平面 / 虚轴 / 右半平面对应稳定、临界稳定、不稳定。 | `step-05` | `static+form` | 判断区只强化“先能不能谈近似”，不进入劳斯判据。 | `3-1-pp-01-stability-half-plane.svg` | 静态区必须先完整落地特征方程与半平面判据。 |
| `### 2.2 一般模态展开：极点直接进入时域响应表达式` | concept+formula | `$$G(s)=\sum_{i=1}^{m}\sum_{r=1}^{q_i}\frac{A_{i,r}}{(s-p_i)^r}$$`，`$$g(t)=\sum_{i=1}^{m}\sum_{r=1}^{q_i}\frac{A_{i,r}}{(r-1)!}t^{r-1}e^{p_i t}$$`。 | `step-06` | `static+workspace` | 配对区只强化“极点位置 / 留数 / 响应现象”的对应。 | `公式卡 / 模态解释条` | 不能只写口头结论，必须把两条展开式完整出现。 |
| `### 2.3 三类典型极点对应的时域响应形态` | concept+formula | `$$e^{pt}$$`，`$$e^{\sigma t}\sin(\omega t+\phi)$$`，并明确负实极点、左半平面共轭复极点、右半平面极点三类形态。 | `step-07` | `static+workspace` | 切换器只做类型对照，不代替静态说明。 | `3-1-pp-02-poles-and-modes.svg` | 静态区必须先给出三类极点与响应形态的对应语句。 |
| `### 2.4 重根为何需要特别关注` | concept+formula | `$$A_1e^{pt}+A_2te^{pt}$$`，并明确重根会引入额外拖尾项。 | `step-07` | `static+workspace` | 误区判断区只检查“重根多出的不是新极点，而是额外时间因子”。 | `3-1-pp-02-poles-and-modes.svg / 重根提醒卡` | 静态区必须显式出现 `te^{pt}` 项。 |
| `### 3.2 通过三个同直流增益模型比较"近似何时可靠"` | concept+formula | `$$G_{\mathrm{ref}}(s)=\frac{3.2}{s^2+1.6s+3.2}$$`，`$$G_{\mathrm{A}}(s)=\frac{16}{(s+5)(s^2+1.6s+3.2)}$$`，`$$G_{\mathrm{B}}(s)=\frac{4.48}{(s+1.4)(s^2+1.6s+3.2)}$$`，以及 `$$p_{1,2}=-0.8\pm j1.6$$`。 | `step-08` | `static+workspace` | 工作区只负责对照三模型，不替代公式区。 | `3-1-pp-03-dominant-pole-response-families.svg / 时域指标表` | 三组模型和主导极点对必须同屏可见。 |
| `### 3.3 时域忽略可接受的条件` | concept+table | `3~5` 倍更靠左只是经验起点，还要同时看附加模态权重、重根/聚集极点和时域指标表。 | `step-09` | `static+form` | 解释区只要求写明“为什么不能只说更靠左”。 | `时域指标表 / 判断准则表` | 页面必须显式写出“经验不是定理”的边界句。 |
| `### 4.2 通过 Bode 图考察"被忽略极点在关注频段内的影响范围"` | concept+formula | `$$\left|G_{\mathrm{ref}}(j\omega)\right|=\frac{3.2}{\sqrt{(3.2-\omega^2)^2+(1.6\omega)^2}}$$`，`$$\omega_n=\sqrt{3.2}\approx 1.79\ \text{rad/s}$$`，并明确附加极点对应转折频率 `5` 与 `1.4`，参考带宽约 `2.39`。 | `step-11` | `static+workspace` | 工作区只负责对照三频率关系，不扩展成 Bode 手工绘图课。 | `3-1-pp-05-bode-model-reduction.svg / 三频率对照表` | 静态区必须同时出现幅频表达式、固有频率、转折频率和带宽。 |
| `### 4.3 频域忽略可接受的条件` | concept+formula | `$$\frac{1}{1+s/p}$$`，`$$\left|\frac{1}{1+j\omega/p}\right|\approx 1,\qquad \angle\frac{1}{1+j\omega/p}\approx 0^\circ,\quad \omega\ll p$$`，以及“先自判，再问 AI，再回到图上核验”的证据链。 | `step-12` | `static+ai` | AI 只核对证据链完整性，不直接替学生下最终结论。 | `3-1-pp-05-bode-model-reduction.svg / AI 对照区` | 静态区必须先给频域近似式和双域证据链。 |
| `### 5.2 数值实验：用延时脉冲响应叠加逼近阶跃响应` | concept+formula | `$$y(t)=\int_0^t g(t-\tau)u(\tau)\,\mathrm{d}\tau$$`，`$$y_{\text{step}}(t)=\int_0^t g(t-\tau)\,\mathrm{d}\tau$$`。 | `step-13` | `static+workspace` | 判断区只核对“卷积改变什么 / 不改变什么”。 | `3-1-pp-06-convolution-step-from-impulse.svg` | 卷积两式必须和数值图同时出现。 |
| `### 5.3 一个明确的高阶示例：模态叠加并不要求各分量均从正值开始` | concept+formula | `$$G(s)=\frac{12}{(s+1)(s+2)(s+6)}$$`，`$$g(t)=2.4e^{-t}-3e^{-2t}+0.6e^{-6t}$$`，并明确负模态来自留数符号，不等于失稳。 | `step-13` | `static+workspace` | 误区判断区只检查“负模态”和“右半平面极点”是否被混淆。 | `3-1-pp-04-modal-superposition-high-order.svg` | 静态区必须把三阶示例公式与“负模态不等于失稳”一起写清。 |
| `## 六、本节小结与后续铺垫` | summary | 稳定是底线；时域看附加模态退场快慢；频域看转折频率是否侵入主要带宽；卷积只激发模态、不改写极点结构；下一课进入 `3-2` 的稳定边界可视化。 | `step-15` | `static` | 仅做结构化收束，不新增负担型互动。 | `3-1-info.png` | 结尾必须压成可复习的四句出口判断。 |

## 步骤 01｜回到地图——从模块2的对象语言走向模块3的机理语言

### 页面骨架
- 模板：`map_hero_slide`
- 区域：`header` / `lead` / `summary`

### 模块清单
- `stage-map`：课程路径图
- `today-task`：本课任务卡
- `boundary-note`：模块3入口定位卡

### 静态承载内容
- 路径图固定高亮 `2-2 -> 2-4 -> 3-1 -> 3-2 -> 3-3`
- 任务卡固定写明：模块2建立对象语言，`3-1` 开始回答“极点为什么能统领双域行为”
- 边界卡固定写明：本课只讲纯极点语言，不进入劳斯、根轨迹和频域判稳

### 互动升级点
- 组件类型：`none`
- 提交态：无
- 答案揭示：无

### 埋点与教师数据
- 埋点摘要：`viewed`、`timeOnStep`、`teacherFollowSync`
- 教师聚合：`view_count`、`sync_status`

### AI 边界
- 页面目标：标定本课是模块3入口课
- 允许范围：课程路径、对象语言到机理语言的切换
- 禁止范围：提前展开公式、近似准则和卷积证明

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-01`
- 对齐要求：首屏直接出现路径图、任务卡和边界卡，无作答区占位

## 步骤 02｜情境引入——同主导极点，为什么响应还会不同

### 页面骨架
- 模板：`triple_model_vote`
- 区域：`formula-strip` / `chart` / `interaction`

### 模块清单
- `model-formulas`：三模型公式卡
- `response-compare`：三曲线时域对照图
- `binary-vote`：二选一判断区

### 静态承载内容
- 三模型必须完整出现：

$$
G_{\mathrm{ref}}(s)=\frac{3.2}{s^2+1.6s+3.2}
$$

$$
G_{\mathrm{A}}(s)=\frac{16}{(s+5)(s^2+1.6s+3.2)}
$$

$$
G_{\mathrm{B}}(s)=\frac{4.48}{(s+1.4)(s^2+1.6s+3.2)}
$$

- 结论卡固定写明：三者拥有同一对主导共轭极点，但附加极点位置不同
- 时域对照图固定使用 `3-1-pp-03-dominant-pole-response-families.svg`

### 互动升级点
- 组件类型：`binary_choice`
- 选项结构：
  - A：只要主导极点相同，主要响应就一定几乎一样
  - B：还要看附加模态退场快慢
- 正确项：`B`
- 错误反馈：只提示“主导极点很重要，但不是唯一证据”
- 答案揭示：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`selectedOption`、`resultState`、`teacherRevealSeen`
- 教师聚合：`option_distribution`、`reveal_correction_rate`

### AI 边界
- 页面目标：把主问题压实为“同主导极点为何仍有差异”
- 允许范围：主导极点、附加极点、响应差异
- 禁止范围：直接给出完整时域和频域近似准则

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-02`
- 对齐要求：公式卡、对照图和判断区在未作答状态下同时可见

## 步骤 03｜学习目标与课堂边界——本课负责什么，不负责什么

### 页面骨架
- 模板：`goal_chain_slide`
- 区域：`goals` / `chain` / `boundary`

### 模块清单
- `goal-cards`：三目标卡组
- `method-chain`：全课主线链
- `boundary-card`：不负责内容卡

### 静态承载内容
- 三张目标卡固定对应：会判稳定底线、会把极点翻译成模态、会判断近似何时可靠
- 主线固定为：`稳定底线 -> 极点到模态 -> 时域近似 -> 频域近似 -> 卷积收束`
- 边界卡固定列出：劳斯判据、根轨迹、Nyquist/Bode 判稳、裕度设计、控制器整定不在本课展开

### 互动升级点
- 组件类型：`none`

### 埋点与教师数据
- 埋点摘要：`viewed`、`timeOnStep`
- 教师聚合：`view_count`

### AI 边界
- 页面目标：建立本课能力边界
- 允许范围：三项目标和主线顺序
- 禁止范围：替代后续步骤提前解释公式细节

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-03`
- 对齐要求：目标卡、主线链和边界卡同时落页

## 步骤 04｜前测——稳定、主导极点与“可忽略”直觉判断

### 页面骨架
- 模板：`question_stack`
- 区域：`question-stack` / `submit-bar`

### 模块清单
- `pretest-q1`：稳定与性能辨析题
- `pretest-q2`：附加极点可忽略判断题
- `pretest-q3`：主导极点含义辨析题

### 静态承载内容
- 三道题干必须全部明文落页
- 误区提示区固定列出：
  - 稳定不等于表现已经够好
  - 主导极点不是“唯一极点”
  - 更靠左不是无条件可忽略

### 互动升级点
- 组件类型：`quiz_group`
- 题目数量：3
- 作答模型：允许重提一次；教师端区分首答与重提
- 答案揭示：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`attemptCount`、`resultState`、`errorBucket`
- 教师聚合：`question_distribution`、`top_misconceptions`

### AI 边界
- 页面目标：暴露三类起点混淆
- 允许范围：术语纠偏、错因归类
- 禁止范围：代替作答或提前抛出最终结论

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-04`
- 对齐要求：三题在未作答状态下全部可见

## 步骤 05｜稳定底线——先回答“能不能谈近似”

### 页面骨架
- 模板：`formula_plus_plane_check`
- 区域：`formula-card` / `media` / `interaction`

### 模块清单
- `characteristic-equation`：特征方程卡
- `stability-plane`：半平面图
- `reason-check`：判断区

### 静态承载内容
- 公式卡必须完整出现：

$$
\Delta(s)=a_ns^n+\cdots+a_1s+a_0=0
$$

$$
\Re(p_i)<0,\ \forall i
$$

- 半平面判据卡固定写明：
  - 左半平面：渐近稳定
  - 虚轴：临界稳定
  - 右半平面：不稳定
- 媒体固定使用 `3-1-pp-01-stability-half-plane.svg`

### 互动升级点
- 组件类型：`reason_check`
- 任务：判断“若存在虚轴根或右半平面根，是否还能直接谈高阶近似”
- 反馈规则：先收集一句理由，再开放参考解释

### 埋点与教师数据
- 埋点摘要：`predictionSubmitted`、`reasonLength`、`teacherRevealSeen`
- 教师聚合：`prediction_distribution`、`reason_tag_cloud`

### AI 边界
- 页面目标：先立住稳定底线
- 允许范围：特征方程、半平面、稳定/临界稳定/不稳定
- 禁止范围：劳斯表、参数可行域和任何判据推导

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-05`
- 对齐要求：公式卡、半平面图和判断区同屏，静态内容先于互动

## 步骤 06｜从极点到模态——极点为什么会直接进入响应

### 页面骨架
- 模板：`formula_explain_match`
- 区域：`formula-card` / `explain-strip` / `match-zone`

### 模块清单
- `partial-fraction-form`：分式展开公式卡
- `modal-response-form`：响应展开公式卡
- `role-strip`：三段解释条
- `triple-match`：配对区

### 静态承载内容
- 公式卡必须完整出现：

$$
G(s)=\sum_{i=1}^{m}\sum_{r=1}^{q_i}\frac{A_{i,r}}{(s-p_i)^r}
$$

$$
g(t)=\sum_{i=1}^{m}\sum_{r=1}^{q_i}\frac{A_{i,r}}{(r-1)!}t^{r-1}e^{p_i t}
$$

- 解释条固定写明：
  - `p_i` 决定衰减/振荡节奏
  - `\Im(p_i)` 决定振荡频率
  - `A_{i,r}` 决定权重与方向

### 互动升级点
- 组件类型：`triple_match`
- 任务：把“极点位置 / 留数系数 / 响应现象”三列做对应
- 反馈规则：即时标对错，可重试

### 埋点与教师数据
- 埋点摘要：`matchAttempted`、`matchCorrected`、`timeOnStep`
- 教师聚合：`common_mismatch_pairs`、`completion_rate`

### AI 边界
- 页面目标：把极点从坐标点翻译成模态项
- 允许范围：部分分式、模态、权重、节奏
- 禁止范围：直接跳到主导极点近似经验句

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-06`
- 对齐要求：两条公式卡与解释条先落页，配对区作为升级层

## 步骤 07｜三类极点与重根——形态为什么会完全不同

### 页面骨架
- 模板：`family_compare_switcher`
- 区域：`family-summary` / `shared-chart` / `switcher`

### 模块清单
- `pole-family-card`：三类极点说明卡
- `repeat-root-note`：重根提醒卡
- `family-chart`：统一图示
- `misconception-switcher`：误区切换区

### 静态承载内容
- 公式卡必须显式出现：

$$
e^{pt}
$$

$$
e^{\sigma t}\sin(\omega t+\phi)
$$

$$
A_1e^{pt}+A_2te^{pt}
$$

- 说明卡固定写明：
  - 负实极点对应非振荡衰减
  - 左半平面共轭复极点对应振荡衰减
  - 右半平面极点对应发散
  - 重根会引入额外拖尾项
- 图示固定使用 `3-1-pp-02-poles-and-modes.svg`

### 互动升级点
- 组件类型：`tab_switch`
- 反馈规则：切换“共轭复极点 / 重根 / 负模态”三个误区时同步刷新一句纠偏解释
- 答案揭示：无

### 埋点与教师数据
- 埋点摘要：`tabVisited`、`viewDuration`
- 教师聚合：`tab_focus_distribution`

### AI 边界
- 页面目标：把极点类型和响应形态做稳定映射
- 允许范围：三类极点、重根、误区纠偏
- 禁止范围：把负模态解释成失稳或把共轭复极点解释成两条物理输出

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-07`
- 对齐要求：图示与三条公式始终可见，切换器不替代静态说明

## 步骤 08｜三模型时域对照——主导极点近似为什么有时可靠

### 页面骨架
- 模板：`triple_model_compare`
- 区域：`formula-strip` / `media` / `workspace`

### 模块清单
- `model-set`：三模型与主导极点卡
- `time-response-figure`：时域对照图
- `metric-table`：时域指标表
- `comparison-workspace`：记录区

### 静态承载内容
- 主导极点卡必须显式出现：

$$
p_{1,2}=-0.8\pm j1.6
$$

- 三模型再次完整出现：

$$
G_{\mathrm{ref}}(s)=\frac{3.2}{s^2+1.6s+3.2}
$$

$$
G_{\mathrm{A}}(s)=\frac{16}{(s+5)(s^2+1.6s+3.2)}
$$

$$
G_{\mathrm{B}}(s)=\frac{4.48}{(s+1.4)(s^2+1.6s+3.2)}
$$

- 时域指标表固定包含 `t_r`、`t_p`、`M_p`、`t_s`
- 媒体固定使用 `3-1-pp-03-dominant-pole-response-families.svg`

### 互动升级点
- 组件类型：`comparison_workspace`
- 任务：先写出“谁最接近参考模型、谁已经明显改写主要动态”
- 反馈规则：提交后只回显自己的判断，不立即公布标准答案

### 埋点与教师数据
- 埋点摘要：`responseSubmitted`、`responseLength`、`timeOnStep`
- 教师聚合：`response_word_cloud`、`common_reason_tags`

### AI 边界
- 页面目标：把视觉差异绑定到附加模态退场快慢
- 允许范围：主导极点、附加极点、时域指标
- 禁止范围：把“同主导极点”偷换成“必然同响应”

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-08`
- 对齐要求：三模型公式、时域图和指标表同屏，记录区位于下方

## 步骤 09｜时域近似边界——“更靠左”不是万能判断句

### 页面骨架
- 模板：`decision_table_with_reason`
- 区域：`table` / `prompt` / `interaction`

### 模块清单
- `time-criteria-table`：时域判断准则表
- `boundary-note`：经验不是定理提示卡
- `reason-check`：解释区

### 静态承载内容
- 准则表固定写明：
  - `3~5` 倍更靠左通常更可靠
  - 还要看附加模态权重
  - 还要防范近主导区重根/聚集极点
  - 结论必须回到时域指标表核对
- 提示卡固定写明：经验句只能作为起点，不能代替证据链

### 互动升级点
- 组件类型：`reason_check`
- 任务：补全“系统 A 更接近二阶近似，不只是因为更靠左，还因为 ________”
- 反馈规则：先存答案，再开放参考理由

### 埋点与教师数据
- 埋点摘要：`predictionSubmitted`、`reasonLength`、`teacherRevealSeen`
- 教师聚合：`reason_tag_cloud`、`correction_rate`

### AI 边界
- 页面目标：防止把经验规则讲成定理
- 允许范围：附加模态权重、时间尺度、指标回查
- 禁止范围：引入频域判稳或模块4设计语言

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-09`
- 对齐要求：准则表和提示卡在未作答状态下完整可见

## 步骤 10｜仅看时域还不够——为什么还要回到频域

### 页面骨架
- 模板：`bridge_table_plus_prompt`
- 区域：`summary` / `question-list` / `interaction`

### 模块清单
- `time-domain-summary`：时域结论卡
- `frequency-questions`：频域追问清单
- `short-response`：短答栏

### 静态承载内容
- 时域结论卡固定写明：时域能回答“像不像”，但还不能回答“主要工作频带里是否也近似”
- 追问清单固定列出：
  - 幅频骨架是否也接近
  - 相位偏差是否进入主要带宽
  - 附加极点折点是否已经侵入关注频段

### 互动升级点
- 组件类型：`short_response`
- 短答句式：频域检查之所以必要，是因为 ________
- 反馈规则：保存文本，不即时判错

### 埋点与教师数据
- 埋点摘要：`responseSubmitted`、`responseLength`、`timeOnStep`
- 教师聚合：`response_word_cloud`、`common_reason_tags`

### AI 边界
- 页面目标：完成从时域证据到频域证据的过渡
- 允许范围：幅频骨架、相位偏差、带宽
- 禁止范围：提前代入完整幅频表达式

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-10`
- 对齐要求：结论卡、追问清单和短答栏同屏

## 步骤 11｜Bode 对照——附加极点何时侵入主要带宽

### 页面骨架
- 模板：`bode_compare_workspace`
- 区域：`formula-strip` / `media` / `workspace`

### 模块清单
- `magnitude-formulas`：幅频表达式卡
- `bode-figure`：Bode 对照图
- `frequency-scale-table`：固有频率/转折频率/带宽对照表
- `workspace`：判断区

### 静态承载内容
- 幅频表达式卡必须显式出现：

$$
\left|G_{\mathrm{ref}}(j\omega)\right|=\frac{3.2}{\sqrt{(3.2-\omega^2)^2+(1.6\omega)^2}}
$$

$$
\omega_n=\sqrt{3.2}\approx 1.79\ \text{rad/s}
$$

- 对照表固定写明：
  - 参考带宽 `\omega_{\mathrm{bw}}\approx 2.39`
  - 系统 A 的附加极点转折频率 `5`
  - 系统 B 的附加极点转折频率 `1.4`
- 媒体固定使用 `3-1-pp-05-bode-model-reduction.svg`

### 互动升级点
- 组件类型：`parameter_workspace`
- 任务：在表格中勾选“固有频率 / 转折频率 / 带宽”分别回答什么问题
- 反馈规则：即时返回对错，但不替代静态解释

### 埋点与教师数据
- 埋点摘要：`selectionState`、`resultState`、`timeOnStep`
- 教师聚合：`confusion_matrix`、`completion_rate`

### AI 边界
- 页面目标：把“能否忽略”翻译成“转折频率是否侵入主要带宽”
- 允许范围：固有频率、转折频率、带宽、幅相骨架
- 禁止范围：手工 Bode 作图细节、Nyquist 判据、裕度语言

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-11`
- 对齐要求：公式卡、Bode 图和三频率对照表同屏，互动区位于下方

## 步骤 12｜双域近似判断 + AI 对照——先自判，再问 AI，再回到图上核验

### 页面骨架
- 模板：`compare_then_ai`
- 区域：`judge-table` / `ai-panel` / `evidence-strip`

### 模块清单
- `dual-domain-table`：双域判断表
- `frequency-approx-card`：频域近似式卡
- `ai-compare-workspace`：AI 对照区
- `evidence-chain`：证据链卡

### 静态承载内容
- 近似式卡必须显式出现：

$$
\frac{1}{1+s/p}
$$

$$
\left|\frac{1}{1+j\omega/p}\right|\approx 1,\qquad \angle\frac{1}{1+j\omega/p}\approx 0^\circ,\quad \omega\ll p
$$

- 双域判断表固定写明：
  - 时域看附加模态退场快慢
  - 频域看转折频率是否侵入主要带宽
  - 最终结论必须同时引用 `3-1-pp-03` 与 `3-1-pp-05`
- 证据链卡固定写明：先自判 -> 向 AI 追问 -> 回到 Octave 图核验

### 互动升级点
- 组件类型：`ai_compare_workspace`
- 任务：先写“哪一组低阶近似更可靠”，再把结论和理由发送给 AI 对照
- 反馈规则：AI 只指出证据链是否缺失时域或频域证据，不直接替学生下最终结论

### 埋点与教师数据
- 埋点摘要：`draftSubmitted`、`aiCompared`、`revisionCount`、`timeOnStep`
- 教师聚合：`ai_compare_rate`、`revision_summary`

### AI 边界
- 页面目标：把 handout 中的 `[AI融入点]` 落到页面级证据链
- 允许范围：双域近似判断、证据完整性、图上回查
- 禁止范围：直接输出最终标准答案、越界到 Nyquist/Bode 判稳

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-12`
- 对齐要求：双域判断表、近似式卡和 AI 对照区同时可见

## 步骤 13｜卷积与模态叠加——输入激发模态，但不会改写极点结构

### 页面骨架
- 模板：`dual_media_reason_check`
- 区域：`formula-card` / `media-left` / `media-right` / `interaction`

### 模块清单
- `convolution-formulas`：卷积公式卡
- `convolution-media`：延时脉冲叠加图
- `modal-superposition-media`：模态叠加图
- `reason-check`：误区判断区

### 静态承载内容
- 卷积公式卡必须完整出现：

$$
y(t)=\int_0^t g(t-\tau)u(\tau)\,\mathrm{d}\tau
$$

$$
y_{\text{step}}(t)=\int_0^t g(t-\tau)\,\mathrm{d}\tau
$$

$$
G(s)=\frac{12}{(s+1)(s+2)(s+6)}
$$

$$
g(t)=2.4e^{-t}-3e^{-2t}+0.6e^{-6t}
$$

- 双媒体固定使用 `3-1-pp-06-convolution-step-from-impulse.svg` 与 `3-1-pp-04-modal-superposition-high-order.svg`
- 说明卡固定写明：输入会改变激发方式，不会改写系统固有极点；负模态来自留数符号，不等于失稳

### 互动升级点
- 组件类型：`formula_pair_check`
- 任务：判断两句话真假
  - 卷积会改写系统极点结构
  - 负模态意味着系统出现右半平面极点
- 反馈规则：即时反馈，并要求勾选对应证据图

### 埋点与教师数据
- 埋点摘要：`selectionState`、`resultState`、`evidenceChosen`
- 教师聚合：`misconception_rate`、`evidence_distribution`

### AI 边界
- 页面目标：用卷积把全课闭合
- 允许范围：卷积、延时脉冲响应、模态叠加、留数符号
- 禁止范围：把卷积页重新讲成拉氏变换基础课

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-13`
- 对齐要求：四条公式与两张图在未作答状态下完整可见

## 步骤 14｜后测——会不会发散、能不能近似、为什么能解释

### 页面骨架
- 模板：`post_quiz_stack`
- 区域：`quiz-stack` / `submit-bar`

### 模块清单
- `post-q1`：稳定底线判断题
- `post-q2`：双域近似判断题
- `post-q3`：卷积与模态解释题

### 静态承载内容
- 三道题干必须明文落页
- 题型固定包含：
  - 一题稳定/临界稳定/不稳定辨析
  - 一题系统 A/B 与参考模型的双域近似判断
  - 一题“输入改变什么、不改变什么”的解释题

### 互动升级点
- 组件类型：`quiz_group`
- 题目数量：3
- 作答模型：允许重提一次；教师端区分首答与重提
- 答案揭示：`teacher_toggle`

### 埋点与教师数据
- 埋点摘要：`attemptCount`、`resultState`、`errorBucket`、`teacherRevealSeen`
- 教师聚合：`question_distribution`、`top_misconceptions`

### AI 边界
- 页面目标：检查学生是否能用完整语言作结
- 允许范围：错因归类、证据链纠偏
- 禁止范围：直接代替解释题作答

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-14`
- 对齐要求：三题在未作答状态下全部可见

## 步骤 15｜总结与后续预告——先守底线，再谈机制，再谈后续方法

### 页面骨架
- 模板：`summary_infographic`
- 区域：`summary-strip` / `infographic` / `next-step`

### 模块清单
- `exit-rules`：四句出口判断
- `info-graphic`：信息图
- `next-lesson-card`：后续预告卡

### 静态承载内容
- 四句出口判断固定为：
  - 稳定是底线，先判断能不能谈近似
  - 时域看附加模态退场快慢
  - 频域看转折频率是否侵入主要带宽
  - 卷积只激发模态，不改写极点结构
- 信息图固定使用 `3-1-info.png`
- 后续预告卡固定写明：下一课 `3-2` 进入稳定边界可视化，把稳定底线变成可操作对象

### 互动升级点
- 组件类型：`none`

### 埋点与教师数据
- 埋点摘要：`viewed`、`timeOnStep`
- 教师聚合：`view_count`

### AI 边界
- 页面目标：收束为可复习的结构化提要
- 允许范围：四句出口判断与课程去向
- 禁止范围：新增新概念或补讲本课未覆盖内容

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/student/demo?step=step-15`
- 对齐要求：四句出口判断、信息图和后续预告卡同屏落地
