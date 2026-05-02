━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
互动页面设计 | 单元 3-6：零点作用与动态改善实验——从性能目标到校正设计
技术栈：Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 文档职责
- 本文件是供人审阅的页面蓝图，只描述页面模板、阅读顺序、固定证据、互动升级位、教师聚合、AI 边界与学生页预览口径。
- 同目录 [interactive-contract.yaml](./interactive-contract.yaml) 是机读契约；两者必须逐步骤一一对应。
- 本次重构保留“五任务设计链”，但页面节奏改为“证据页 -> 推导显影页 -> 关键工作区”的混合结构，不再将整课写成连续工作区串联。
- 本课直接引用 `manifest.json` 与 `course-content/authoring/knowledge/cards/lessons/3-6/sequence.json` 中的节点分组，不再另行发明步骤主线。

## 表述规则
- 页面描述只保留客观结构：区域、模块、文本、公式、图组、表格、互动组件、反馈规则、教师聚合与验收条件。
- 动作化表述禁用：`展示`、`引导`、`让学生`、`教师讲`、`先做一次`、`跟随推导` 等。
- 讲义中的对象、公式、图后结论、比较表与边界判断必须显式落页，不得以“见讲义”“课堂口述”“实现时补充”替代。
- 曲线图默认升级为参数联动仿真板；结构图、任务链图、比较图和判断矩阵默认升级为前端原生组件或点击显影板。
- 预览入口固定为学生演示页；教师端模板弹窗只用于看课堂骨架，不代替真实页面预览。

## 全课总览
| 步骤 | 标题 | 页面模板 | 证据重心 | 互动组件 | 预估学生实践 |
|------|------|----------|----------|----------|--------------|
| step-01 | 封面导入：目标必须先于工具 | `binary_choice_illustration` | 封面媒体、核心追问、入口误判 | `single_choice` | 2 分钟 |
| step-02 | 回到地图：从 `3-5` 的机理走向 `3-6` 的设计 | `map_hero_slide` | 路径图、主线卡、边界卡 | `none` | 0 分钟 |
| step-03 | 五任务设计链与提交物总览 | `goal_chain_slide` | 五任务链、交付物、实践规则 | `none` | 0 分钟 |
| step-04 | 前测：三类目标分别从哪里进入 | `question_stack` | 三题前测、理由栏 | `quiz_group` | 6 分钟 |
| step-05 | 任务书：统一对象、三类装置与五任务入口 | `evidence_board` | 对象公式、三类校正表达式、任务书表格 | `categorize_and_confirm` | 4 分钟 |
| step-06 | 时域指标如何变成设计可行域 | `derivation_reveal_board` | 翻译公式、可行域结论、纯增益失败证据 | `workspace_builder` | 8 分钟 |
| step-07 | 任务 A：`PD` 时域设计 | `parametric_sim_board` | 设计点、相角条件、模值条件、三面板验收 | `parameter_workspace` | 12 分钟 |
| step-08 | 任务 B 的证据板：测速反馈为何不是“换位置的 `PD`” | `structure_evidence_board` | 原生结构图、等效特征方程、对照表 | `none` | 4 分钟 |
| step-09 | 任务 B：测速反馈时域设计 | `parametric_sim_board` | 等效极点位置、模值条件、三面板验收 | `parameter_workspace` | 10 分钟 |
| step-10 | 推导显影 B：频域目标如何进入超前设计 | `derivation_reveal_board` | 共同频域目标、只调增益失败、超前四步链 | `structured_response` | 4 分钟 |
| step-11 | 任务 C：超前频域设计 | `frequency_design_workspace` | 超前参数链、Bode 双图、阶跃回查 | `parameter_workspace` | 10 分钟 |
| step-12 | 推导显影 C：为何同一频域指标下还要再做一次 `PD` | `compare_reveal_board` | 共同目标卡、`PD` 频域相角条件、比较维度表 | `structured_response` | 4 分钟 |
| step-13 | 任务 D：同指标下的 `PD` 频域设计与并排比较 | `comparison_lab_board` | `PD` 频域设计、超前对照板、差异记录 | `structured_compare` | 8 分钟 |
| step-14 | 任务 E：右半平面零点下的边界与结构选择 | `boundary_decision_workspace` | 边界对象、风险图、保守示例抽屉、选择矩阵 | `decision_submit` | 8 分钟 |
| step-15 | 后测与收束：从指标走到结构选择 | `summary_assessment_board` | 三题后测、三句结论、信息图、去向卡 | `quiz_group + exit_reflection` | 4 分钟 |

> 核心实践承接位于 `step-04`、`step-05`、`step-06`、`step-07`、`step-08`、`step-09`、`step-10`、`step-11`、`step-12`、`step-13`、`step-14`，其中可计入课堂实践训练的操作、记录、对比、判断与提交累计约 `54` 分钟；与 `design/3-6-boppps.md` 中的实践时长口径保持一致。

## 节点与步骤分组
- `group-01｜从 3-5 机理切到目标翻译`：`step-01` 到 `step-06`
- `group-02｜任务 A / B：时域目标驱动设计`：`step-07` 到 `step-09`
- `group-03｜任务 C / D：频域目标驱动设计`：`step-10` 到 `step-13`
- `group-04｜任务 E 与课末收束`：`step-14` 到 `step-15`

## 证据单元升级决策表
| 证据单元 | 证据类型 | 来源锚点 | 目标步骤 | 升级方式 | 保留元素 | 不得删减内容 | 验收点 |
|---|---|---|---|---|---|---|---|
| `eu-01` | `concept + bridge` | `### 1.1 上一课的成果与本课的挑战` | `step-02` | `静态保留` | `3-5 -> 3-6 -> 3-7` 路径图、主线切换句 | `3-5 讲机理，3-6 讲目标驱动设计，3-7 讲稳态改善` | 首屏必须看出本课在模块 3 中的位置 |
| `eu-02` | `task_card` | `### 1.2 本课主线` | `step-03` | `原生重绘` | 五任务链、交付物、实践规则 | 五个任务名称与顺序、固定提交物 | 不得缩成“若干设计任务” |
| `eu-03` | `task_card + quiz` | `### 1.3 先做一次“目标翻译”预测` | `step-04` | `原生表单` | 三题前测、理由栏 | “先独立判断，再进入 AI 对照”的顺序 | 页面内不出现显式 AI gate，顺序约束转入控灵助手上下文 |
| `eu-04` | `object + formula + table` | `### 2.1`、`### 2.2`、`### 2.3` | `step-05` | `原生重绘` | $$G_p(s)=\frac{4}{s(s+0.8)}$$、`PD`/测速反馈/超前表达式、五任务表 | 对象公式、三类装置的标准表达、任务 A-E 与推荐工具 | 对象卡、表达式卡和任务表必须同屏 |
| `eu-05` | `derivation` | `### 2.4 将时域指标翻译为目标区域` | `step-06` | `点击显影` | $$M_p$$ 与 $$t_s$$ 翻译公式、$\zeta \ge 0.456$、$\operatorname{Re}(s)\le -1$ | 从指标到区域的推导链，以及纯增益无法进入区域的结论 | 必须看出“公式 -> 代入 -> 区域 -> 失败原因”四层 |
| `eu-06` | `curve_figure + conclusion` | `### 2.4 将时域指标翻译为目标区域` | `step-06` | `统一仿真引擎` | 复平面可行域、纯增益根轨迹、纯增益失败记录 | 原对象复根实部固定在 `-0.4`，无法达到 $\operatorname{Re}(s)\le -1$ | 根轨迹面板在左，记录区在右，基线态必须复现讲义中的纯增益失败图景 |
| `eu-07` | `derivation` | `### 3.1`、`### 3.2`、`### 3.3` | `step-07` | `点击显影 + 参数联动` | 设计点 $$s_d=-1.1\pm j1.67$$、相角条件、模值条件 | 设计点选择理由、$$T_d \approx 0.35$$、$$K \approx 1.00$$、验收逻辑 | 不得只保留最终参数结果式 |
| `eu-08` | `curve_figure` | `![3-6-pd-design.png]` | `step-07` | `参数联动` | 根轨迹、阶跃响应、指标卡三面板 | 目标区域叠加、基线参数、通过态与失败态 | 三面板默认态必须与讲义图一致 |
| `eu-09` | `structure_figure + derivation + table` | `### 4.1`、`### 4.2`、`### 4.4` | `step-08`、`step-09` | `原生重绘 + 点击显影 + 参数联动` | 测速反馈结构图、等效特征方程、`PD` 对照表 | “先定等效极点，再求 $K_t$，最后由模值条件求 $K$” 的顺序 | `step-08` 必须先显式落出结构差异，且不设置独立学生作答区 |
| `eu-10` | `curve_figure` | `![3-6-rate-feedback-design.png]` | `step-09` | `参数联动` | 等效根轨迹、阶跃响应、指标卡三面板 | 基线参数 $$K_t=0.35$$、$$K=1.00$$ 与 `PD` 区别 | 工作区必须支持顺序检查而非只收最终参数 |
| `eu-11` | `derivation` | `### 5.1` 到 `### 5.5` | `step-10`、`step-11` | `点击显影 + 参数联动` | 共同频域目标、只调增益失败、超前四步链 | $$PM \ge 50^\circ$$、$\omega_c \approx 3$、补角、布置频带、由幅值条件求 $K_c$ | 不得只留下“超前形式 + 调参面板” |
| `eu-12` | `curve_figure` | `![3-6-lead-design.png]` | `step-11` | `参数联动` | 幅频图、相频图、阶跃回查、指标卡 | 基线超前参数、双裕度标注、时域回查 | 频域双图与时域回查必须同屏 |
| `eu-13` | `derivation + compare` | `### 6.1` 到 `### 6.5` | `step-12`、`step-13` | `点击显影 + 参数联动 + 原生表格` | 同一频域目标卡、`PD` 频域相角条件、比较维度表 | “同指标比较副作用”这一课程意图 | 比较板不得只写“二者都达标” |
| `eu-14` | `curve_figure` | `![3-6-pd-frequency-design.png]` | `step-13` | `参数联动` | `PD` 频域工作区、与超前并排比较板 | 共同频域目标、`PD` 参数链、时域副作用比较 | 必须支持同屏比较超调、调节时间和高频放大风险 |
| `eu-15` | `curve_figure + boundary + task_card` | `### 7.1` 到 `### 7.4`、`附录 B` | `step-14` | `参数联动 + 点击显影` | $$G_{nmp}(s)=\frac{4(1-0.3s)}{s(s+0.8)}$$、风险图、保守示例抽屉、选择矩阵 | “先改目标，再选结构”的边界结论，以及三个保守示例入口 | 不得只保留风险图，不得省略保守示例 |
| `eu-16` | `summary + infographic` | `## 八、本课小结与前后衔接` | `step-15` | `静态保留` | 三句结论、`3-6-info.png`、去向卡 | 时域入口、频域入口、非最小相边界三句结论 | 信息图与三句结论必须同屏 |

## 混合证据顺序表
| 步骤 | 先出现什么 | 再出现什么 | 最后出现什么 | 同屏要求 |
|------|------------|------------|--------------|----------|
| `step-01` | 封面媒体 | 核心追问 | 首反应选择 | 媒体、问题、按钮同屏 |
| `step-02` | 路径图 | 主线切换卡 | 边界卡 | 三块必须同屏，不折叠 |
| `step-03` | 五任务链 | 交付物卡 | 实践规则卡 | 五任务链与交付物并排两列，实践规则整行收束 |
| `step-04` | 三题前测 | 理由栏 | 顺序约束转入控灵助手 | 页面内不出现显式 AI gate |
| `step-05` | 对象公式卡 | 三类校正表达式卡 | 五任务表与入口分类区 | 对象卡、表达式卡、任务表同屏 |
| `step-06` | 时域翻译公式 | 代入与区域结论显影 | 统一引擎根轨迹面板与记录区 | 公式先点击显影，再在下方以左图右记录方式完成工作区 |
| `step-07` | 设计点卡与顺序卡 | 相角条件与模值条件显影 | 三面板工作区与记录卡 | 设计点、公式链、工作区同屏 |
| `step-08` | 原生结构图 | 等效特征方程显影 | `PD`/测速反馈对照表 | 结构图与方程同屏，不设置独立学生作答区 |
| `step-09` | 等效极点目标卡 | 模值条件与参数顺序提示 | 三面板工作区与一句解释提交 | 顺序提示必须位于工作区上方 |
| `step-10` | 共同频域目标卡 | 只调增益失败证据 | 超前四步显影链与简答框 | 目标卡与失败证据同屏 |
| `step-11` | 超前形式卡 | 参数求解顺序卡 | Bode 双图、阶跃回查与记录卡 | 双图与时域回查同屏 |
| `step-12` | 共同目标卡 | `PD` 频域相角条件显影 | 比较维度表与进入工作区提示 | 目标卡与比较维度表同屏 |
| `step-13` | `PD` 频域工作区 | 并排比较板 | 差异提交区 | 工作区和比较板同屏 |
| `step-14` | 边界对象卡 | 风险图与保守示例抽屉 | 结构选择矩阵与理由提交区 | 对象、风险图、选择矩阵同屏 |
| `step-15` | 三题后测 | 三句结论 | 信息图与退出反思 | 后测完成后才出现退出反思 |

## 曲线镜像与运行时合同
| 步骤 | 图组 / 证据 | 基线态 | 图组镜像 | 控件 | 运行时合同 |
|------|-------------|--------|----------|------|------------|
| `step-06` | 纯增益失败复平面板 | 原对象、仅调比例增益、复根实部固定在 `-0.4` | 上方公式显影 + 下方左根轨迹右记录 | `K` 滑块 | `caseId=unit-3-6-pure-gain-failure`；`engine=useControlEngine + RootLocusPanel`；`axis_policy=fixed_extent`；`sampling_policy=critical_point_dense` |
| `step-07` | `PD` 三面板 | $$T_d=0.35$$、$$K=1.00$$、目标区域开启 | 左根轨迹 / 右上阶跃 / 右下指标卡 | `T_d`、`K` 滑块 | `caseId=unit-3-6-pd-time-domain`；`outputs=[root_locus, step_response, metrics]`；`overlay_policy=[feasible_region,current_poles,mp_ts]` |
| `step-09` | 测速反馈三面板 | $$K_t=0.35$$、$$K=1.00$$、等效极点为 `-2.2` | 左等效根轨迹 / 右上阶跃 / 右下指标卡 | `K_t`、`K` 滑块 | `caseId=unit-3-6-rate-feedback`；`outputs=[root_locus, step_response, metrics]`；`overlay_policy=[equivalent_pole,current_poles,mp_ts]` |
| `step-11` | 超前频域工作区 | 讲义基线超前参数 | `2×2`：幅频 / 相频 / 阶跃回查 / 指标卡 | `a`、`T`、`K_c` 滑块 | `caseId=unit-3-6-lead-design`；`outputs=[bode_mag, bode_phase, step_response, metrics]`；`overlay_policy=[pm_gm,wc,mp_ts]` |
| `step-13` | 频域 `PD` + 超前比较板 | 与 `step-11` 共用频域目标；`PD` 基线参数为讲义结果 | 左 `PD` 频域工作区，右并排比较表 | `T_d`、`K` 滑块 + 结构化比较表 | `caseId=unit-3-6-pd-frequency`；`outputs=[bode_mag, bode_phase, step_response, metrics, compare_summary]`；`overlay_policy=[pm_gm,wc,mp_ts]` |
| `step-14` | 非最小相边界板 | 右半平面零点位于 `+3.33`，默认沿用原频域目标并标记“不可直接照搬” | 左风险图，右选择矩阵，下方保守示例抽屉 | `target_profile` 切换、结构勾选、理由提交 | `caseId=unit-3-6-nmp-boundary`；`outputs=[bode_mag, bode_phase, step_response, risk_flags]`；`overlay_policy=[inverse_response,rhp_zero_marker,pm_gm]` |

## 步骤 01｜封面导入：目标必须先于工具

### 页面骨架
- 模板：`binary_choice_illustration`
- 区域：
  - `media`：封面漫画或导入视频
  - `question`：核心追问
  - `interaction`：首反应选择

### 模块清单
- `cover-media`：`3-6-cover-comic.png` 或 `3-6-intro-video.mp4`
- `core-question-card`：导入追问卡
- `first-reaction-choice`：首反应单选组件

### 固定证据
- 核心追问固定写明：为什么同样都在引入零点相关装置，有时入口是目标极点区域，有时入口却是相角裕度与截止频率。
- 副标题固定写明：本课不再停留在“零点会不会改善”，而进入“目标如何驱动结构与参数选择”。

### 互动升级点
- 组件类型：`single_choice`
- 选项固定为：
  - A：先看根轨迹
  - B：先看 `Bode` 图
  - C：先看目标是什么
- 正确项：`C`
- 反馈规则：只提示“入口必须先按目标分类”，不提前公布后续设计结果。

### 埋点与教师数据
- 埋点摘要：`selectedOption`、`resultState`、`teacherRevealSeen`
- 教师聚合：`option_distribution`、`goal_entry_confusion_rate`

### AI 边界
- 允许范围：目标、入口、工具分类
- 禁止范围：后续参数结果

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-01`
- 对齐要求：封面媒体、核心追问和选择按钮首屏同时可见。

## 步骤 02｜回到地图：从 `3-5` 的机理走向 `3-6` 的设计

### 页面骨架
- 模板：`map_hero_slide`
- 区域：
  - `header`：模块 3 路径图
  - `lead`：主线切换卡
  - `summary`：本课边界卡

### 模块清单
- `stage-map`：高亮 `3-5 -> 3-6 -> 3-7`
- `bridge-card`：主线切换卡
- `boundary-card`：边界说明卡

### 固定证据
- 切换卡固定写明：`3-5` 回答“零点为什么改变动态”，`3-6` 回答“目标如何驱动结构与参数”，`3-7` 再进入稳态改善线。
- 边界卡固定写明：本课只做目标驱动设计与边界判断，不进入模块 4 的完整方案整定。

### 互动升级点
- 组件类型：`none`

### 埋点与教师数据
- 埋点摘要：`viewed`、`timeOnStep`、`teacherFollowSync`
- 教师聚合：`view_count`、`sync_status`

### AI 边界
- 允许范围：前后课关系、主线切换、本课边界
- 禁止范围：具体参数计算

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-02`
- 对齐要求：路径图、主线卡和边界卡必须同屏。

## 步骤 03｜五任务设计链与提交物总览

### 页面骨架
- 模板：`goal_chain_slide`
- 区域：
  - `chain`：五任务链（左列）
  - `outputs`：提交物卡（右列）
  - `rules`：实践规则卡

### 模块清单
- `task-chain`：五任务流程卡
- `deliverable-card-row`：固定交付物卡
- `practice-rule-card`：课堂实践与提交规则

### 固定证据
- 五任务链固定为：时域 `PD`、时域测速反馈、频域超前、同指标下的频域 `PD`、右半平面零点边界选择。
- 固定提交物完整列出：`指标翻译表`、`时域设计记录`、`频域设计记录`、`边界判断卡`、`一页设计报告`。
- 实践规则固定写明：记录重点是设计链、判断句与比较结果，而不是死记单一参数数值。

### 互动升级点
- 组件类型：`none`

### 埋点与教师数据
- 埋点摘要：`viewed`、`timeOnStep`
- 教师聚合：`view_count`

### AI 边界
- 允许范围：目标、任务链、交付物、实践规则
- 禁止范围：参数答案

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-03`
- 对齐要求：任务链与交付物并排两列呈现，不得拆成两步，也不设置独立学生作答区。

## 步骤 04｜前测：三类目标分别从哪里进入

### 页面骨架
- 模板：`question_stack`
- 区域：
  - `question-stack`：三题前测
  - `record`：一句理由栏

### 模块清单
- `pretest-q1`：时域目标入口题
- `pretest-q2`：频域目标入口题
- `pretest-q3`：右半平面零点边界题
- `reason-record`：理由填写栏

### 固定证据
- 三道题干全部明文落页，分别对应：$M_p/t_s$、$PM/\omega_c$、右半平面零点。
- 顺序约束固定写明：先独立完成三题与理由，再进入控灵助手中的错因对照；控灵助手不代替学生作答。

### 互动升级点
- 组件类型：`quiz_group`
- 作答模型：三题前测 + 一句理由
- 反馈规则：只显示正确率与误区标签，不直接给出完整标准答案

### 埋点与教师数据
- 埋点摘要：`attemptCount`、`resultState`、`errorBucket`、`reasonTextSubmitted`
- 教师聚合：`question_distribution`、`top_misconceptions`

### AI 边界
- 允许范围：错因归类、术语纠偏、入口对照
- 禁止范围：生成完整答案

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-04`
- 对齐要求：三题与理由栏在未作答状态下同时可见；页面内不出现显式 AI gate。

## 步骤 05｜任务书：统一对象、三类装置与五任务入口

### 页面骨架
- 模板：`evidence_board`
- 区域：
  - `object`：对象公式卡
  - `expressions`：三类校正表达式卡
  - `tasks`：五任务表与入口分类区

### 模块清单
- `plant-card`：示例对象卡
- `controller-expression-tabs`：`PD`、测速反馈、超前表达式卡
- `task-table`：五任务与推荐工具表
- `entry-classifier`：入口分类组件

### 固定证据
- 对象卡固定给出

$$
G_p(s)=\frac{4}{s(s+0.8)}
$$

- 三类装置卡必须完整给出

$$
G_{PD}(s)=K(1+T_d s)
$$

$$
U(s)=K E(s)-K_t sY(s)
$$

$$
G_{lead}(s)=K_c\frac{aTs+1}{Ts+1},\qquad a>1
$$

- 任务表固定写出五个任务、目标类型和推荐工具。

### 互动升级点
- 组件类型：`categorize_and_confirm`
- 学生任务：把五个任务分别拖入“先上根轨迹 / 先上 Bode 图 / 先重审目标”三栏
- 反馈规则：允许二次调整；第一次只提示入口类型，不给后续参数

### 埋点与教师数据
- 埋点摘要：`bucketAssignment`、`attemptCount`、`timeOnStep`
- 教师聚合：`goal_bucket_distribution`、`misbucket_rate`

### AI 边界
- 允许范围：对象、任务、目标分类
- 禁止范围：替学生完成分类

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-05`
- 对齐要求：对象卡、表达式卡、任务表与分类组件必须同屏。

## 步骤 06｜时域指标如何变成设计可行域

### 页面骨架
- 模板：`derivation_reveal_board`
- 区域：
  - `derivation`：公式显影区
  - `figure`：统一引擎根轨迹面板（左列）
  - `record`：翻译记录表（右列）

### 模块清单
- `translation-formula-panel`：时域指标翻译公式
- `feasible-region-reveal`：显影链
- `pure-gain-failure-plot`：统一引擎纯增益失败根轨迹面板
- `translation-record-table`：记录表

### 固定证据
- 公式卡必须完整给出

$$
M_p=e^{-\frac{\zeta\pi}{\sqrt{1-\zeta^2}}}\times100\%
$$

$$
t_s \approx \frac{4}{\zeta\omega_n}
$$

- 结论卡固定写明：$\zeta \ge 0.456$，$\operatorname{Re}(s)\le -1$。
- 失败证据卡固定写明：纯增益根轨迹的复根实部始终停在 `-0.4`，因此纯增益不能进入本课可行域。

### 互动升级点
- 组件类型：`workspace_builder`
- 学生任务：点击核心翻译公式依次显影约束结论，再拖动增益观察纯增益闭环根轨迹，并填写一句纯增益失败原因
- 反馈规则：只提示边界叠加是否正确，不替代学生写出结论句

### 埋点与教师数据
- 埋点摘要：`constraintOverlayState`、`recordSubmitted`、`attemptCount`
- 教师聚合：`overlay_accuracy`、`pure_gain_failure_tags`

### AI 边界
- 允许范围：指标翻译、阻尼线、实部边界、纯增益失败原因
- 禁止范围：替学生直接写翻译结论

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-06`
- 对齐要求：公式显影位于上方；下方使用统一仿真引擎，根轨迹面板在左，记录区在右。

## 步骤 07｜任务 A：`PD` 时域设计

### 页面骨架
- 模板：`parametric_sim_board`
- 区域：
  - `evidence`：设计点与顺序卡
  - `derivation`：相角条件与模值条件显影区
  - `workspace`：三面板工作区与记录卡

### 模块清单
- `pd-design-point-card`：设计点卡
- `pd-derivation-reveal`：相角条件与模值条件显影区
- `pd-tri-panel-workspace`：根轨迹 / 阶跃 / 指标卡三面板
- `pd-record-card`：参数与验收记录卡

### 固定证据
- 设计点卡固定给出

$$
s_d=-1.1\pm j1.67
$$

- 控制器形式卡固定给出

$$
G_{PD}(s)=K(1+T_d s)
$$

- 顺序卡固定写明：先定设计点，再用相角条件求 $T_d$，再用模值条件求 $K$，最后用阶跃响应验收。
- 基线提示卡固定写明：本课参考结果为 $T_d \approx 0.35$、$K \approx 1.00$，但提交重点是设计链与验收逻辑。

### 互动升级点
- 组件类型：`parameter_workspace`
- 开放参数：`T_d`、`K`
- 学生任务：调参直到目标区域与时域指标同时通过，并提交一句“为什么零点位置能把轨迹拉入可行域”
- 反馈规则：保留调参轨迹；只给出通过 / 未通过状态

### 埋点与教师数据
- 埋点摘要：`parameterTrail`、`validationState`、`recordSubmitted`
- 教师聚合：`final_parameter_distribution`、`validation_pass_rate`

### AI 边界
- 允许范围：设计点、相角条件、模值条件、验收逻辑
- 禁止范围：跳过设计点直接背答案

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-07`
- 对齐要求：设计点、公式显影区、三面板工作区与记录卡必须同屏。

## 步骤 08｜任务 B 的证据板：测速反馈为何不是“换位置的 `PD`”

### 页面骨架
- 模板：`structure_evidence_board`
- 区域：
  - `structure`：原生结构图
  - `derivation`：等效特征方程显影区
  - `compare`：`PD` / 测速反馈对照表

### 模块清单
- `rate-structure-diagram`：原生结构图
- `rate-derivation-reveal`：等效特征方程显影区
- `pd-rate-contrast-table`：对照表

### 固定证据
- 结构图旁必须完整给出

$$
U(s)=K E(s)-K_t sY(s)
$$

$$
1+\frac{4K}{s(s+0.8+4K_t)}=0
$$

- 顺序卡固定写明：先决定等效极点位置，再求 $K_t$，最后由模值条件求 $K$。
- 对照表固定写明：测速反馈的抓手是等效极点，不是“把 `PD` 换个位置”。

### 互动升级点
- 组件类型：`none`
- 学生任务：本页不设置独立学生作答区，只负责完成结构差异阅读与证据对照
- 反馈规则：不单独提交，作为进入 `step-09` 前的证据板

### 埋点与教师数据
- 埋点摘要：`revealOrder`、`completedState`
- 教师聚合：`reveal_order_accuracy`、`pd_rate_confusion_rate`

### AI 边界
- 允许范围：结构图、等效方程、设计抓手差异
- 禁止范围：把测速反馈误写成前向显式增零点

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-08`
- 对齐要求：结构图、等效方程和对照表必须同屏；结构图必须采用原生方式绘制，且不设置独立学生作答区。

## 步骤 09｜任务 B：测速反馈时域设计

### 页面骨架
- 模板：`parametric_sim_board`
- 区域：
  - `evidence`：等效极点目标卡
  - `derivation`：模值条件与顺序提示
  - `workspace`：三面板工作区与解释提交

### 模块清单
- `rate-target-card`：等效极点目标卡
- `rate-modulus-reveal`：模值条件显影区
- `rate-tri-panel-workspace`：等效根轨迹 / 阶跃 / 指标卡三面板
- `rate-record-card`：解释提交卡

### 固定证据
- 等效极点目标卡固定写明：将原极点 `-0.8` 左移到 `-2.2`，使复根实部稳定落在 `-1.1`。
- 参数提示卡固定写明：本课基线结果为 $K_t=0.35$、$K=1.00$。

### 互动升级点
- 组件类型：`parameter_workspace`
- 开放参数：`K_t`、`K`
- 学生任务：完成参数调整并提交一句“为什么这里先定等效极点，而不是先猜某个零点”
- 反馈规则：参数顺序正确且指标达标后才允许提交

### 埋点与教师数据
- 埋点摘要：`parameterTrail`、`adjustmentOrder`、`recordSubmitted`
- 教师聚合：`adjustment_order_distribution`、`rate_validation_pass_rate`

### AI 边界
- 允许范围：等效极点位置、模值条件、顺序检查
- 禁止范围：只报参数结果不解释设计抓手

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-09`
- 对齐要求：等效极点目标卡、模值条件提示和三面板工作区必须同屏。

## 步骤 10｜推导显影 B：频域目标如何进入超前设计

### 页面骨架
- 模板：`derivation_reveal_board`
- 区域：
  - `goal`：共同频域目标卡
  - `evidence`：只调增益失败证据
  - `derivation`：超前四步显影链

### 模块清单
- `shared-frequency-goal-card`：共同频域目标卡
- `gain-only-failure-card`：只调增益失败证据
- `lead-derivation-reveal`：超前四步显影链
- `lead-intent-response`：一句简答框

### 固定证据
- 共同目标卡必须完整给出

$$
PM \ge 50^\circ,\qquad \omega_c \approx 3\,\mathrm{rad/s}
$$

- 失败证据卡固定写明：若只调增益把交叉频率推到 `3 rad/s`，相角裕度不足，不能直接验收。
- 显影链固定写成：先读所缺补角，再确定最大超前角，再把最大超前角布置到目标截止频率，再由幅值条件求 $K_c$。

### 互动升级点
- 组件类型：`structured_response`
- 学生任务：写一句“为什么频域设计必须先看若只调增益会怎样”
- 反馈规则：只检查关键语义标签是否包含“交叉频率”和“相角裕度”

### 埋点与教师数据
- 埋点摘要：`responseSubmitted`、`keywordCoverage`
- 教师聚合：`keyword_coverage_distribution`

### AI 边界
- 允许范围：共同目标、失败证据、四步链条
- 禁止范围：提前给出超前最终参数

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-10`
- 对齐要求：共同目标、失败证据和四步显影链必须同屏。

## 步骤 11｜任务 C：超前频域设计

### 页面骨架
- 模板：`frequency_design_workspace`
- 区域：
  - `formula`：超前形式卡与顺序卡
  - `workspace`：Bode 双图与阶跃回查
  - `record`：超前设计记录卡

### 模块清单
- `lead-formula-card`：超前控制器形式卡
- `lead-sequence-card`：参数求解顺序卡
- `lead-frequency-workspace`：`2×2` 工作区
- `lead-record-card`：记录卡

### 固定证据
- 控制器形式卡必须完整给出

$$
G_{lead}(s)=K_c\frac{aTs+1}{Ts+1},\qquad a>1
$$

- 顺序卡固定写明：补角 -> 布置频带 -> 求 $K_c$ -> 回查阶跃代价。

### 互动升级点
- 组件类型：`parameter_workspace`
- 开放参数：`a`、`T`、`K_c`
- 学生任务：完成超前设计并记录“为何频域通过后仍要回查时域”
- 反馈规则：Bode 指标和时域回查都通过后才标记完成

### 埋点与教师数据
- 埋点摘要：`parameterTrail`、`marginState`、`recordSubmitted`
- 教师聚合：`lead_parameter_distribution`、`margin_recovery_rate`

### AI 边界
- 允许范围：补角、交叉频率、幅值条件、时域回查
- 禁止范围：把超前设计压成“调到看起来差不多”

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-11`
- 对齐要求：超前形式卡、顺序卡、Bode 双图、阶跃回查与记录卡必须同屏。

## 步骤 12｜推导显影 C：为何同一频域指标下还要再做一次 `PD`

### 页面骨架
- 模板：`compare_reveal_board`
- 区域：
  - `goal`：共同频域目标卡
  - `derivation`：`PD` 频域相角条件显影
  - `compare`：比较维度表

### 模块清单
- `shared-goal-card`：共同频域目标卡
- `pd-frequency-derivation`：`PD` 频域相角条件显影区
- `compare-rubric-table`：比较维度表
- `entry-note`：进入工作区提示卡

### 固定证据
- 共同目标卡必须再次完整给出

$$
PM \ge 50^\circ,\qquad \omega_c \approx 3\,\mathrm{rad/s}
$$

- 比较维度表固定要求记录：达标情况、超调、调节时间、高频放大风险。
- 提示卡固定写明：任务 D 不是重复任务 C，而是要在同一指标下比较不同结构带来的时域代价。

### 互动升级点
- 组件类型：`structured_response`
- 学生任务：勾选“为什么必须沿用相同频域指标”对应的理由标签
- 反馈规则：理由标签缺少“比较副作用”则不开放下一步

### 埋点与教师数据
- 埋点摘要：`reasonTags`、`completedState`
- 教师聚合：`reason_tag_distribution`、`empty_reason_rate`

### AI 边界
- 允许范围：共同目标、比较维度、`PD` 频域入口
- 禁止范围：只讲频域达标，不提比较意图

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-12`
- 对齐要求：共同目标卡、显影区和比较维度表必须同屏。

## 步骤 13｜任务 D：同指标下的 `PD` 频域设计与并排比较

### 页面骨架
- 模板：`comparison_lab_board`
- 区域：
  - `workspace`：`PD` 频域工作区
  - `compare`：与超前的并排比较板
  - `submit`：差异提交区

### 模块清单
- `pd-frequency-workspace`：`PD` 频域工作区
- `lead-pd-compare-board`：超前 / `PD` 并排比较板
- `difference-submit-card`：结构化差异提交卡

### 固定证据
- 工作区上方固定保留共同目标条和 `PD` 频域相角条件摘要。
- 比较板固定要求同步填写：是否达标、$M_p$、$t_s$、高频放大风险、推荐结构。

### 互动升级点
- 组件类型：`structured_compare`
- 学生任务：完成 `PD` 频域设计，并填写与超前方案的结构化比较表
- 反馈规则：只接受结构化比较；“都达标”或“差不多”视为未完成

### 埋点与教师数据
- 埋点摘要：`comparisonSubmitted`、`differenceTags`、`validationState`
- 教师聚合：`difference_tag_distribution`、`empty_comparison_rate`

### AI 边界
- 允许范围：共同目标、结构化比较、时域回查
- 禁止范围：只看频域达标就结束

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-13`
- 对齐要求：工作区、并排比较板和差异提交区必须同屏。

## 步骤 14｜任务 E：右半平面零点下的边界与结构选择

### 页面骨架
- 模板：`boundary_decision_workspace`
- 区域：
  - `boundary-object`：边界对象卡
  - `risk`：风险图与保守示例抽屉
  - `decision`：结构选择矩阵与理由提交

### 模块清单
- `nmp-object-card`：边界对象卡
- `risk-figure-panel`：非最小相风险图
- `conservative-example-drawer`：附录 B 三个保守示例抽屉
- `decision-matrix`：结构选择矩阵
- `decision-submit-card`：理由提交卡

### 固定证据
- 边界对象卡必须完整给出

$$
G_{nmp}(s)=\frac{4(1-0.3s)}{s(s+0.8)}
$$

- 风险说明固定写明：右半平面零点位于 `+3.33`，原来的 $\omega_c \approx 3$ 目标已经过于激进。
- 结论卡固定写明：非最小相对象下先改目标，再选 `PD`、测速反馈或超前。
- 抽屉区必须保留附录 B 中三种保守示例的入口，不把示例完全移出互动页。

### 互动升级点
- 组件类型：`decision_submit`
- 学生任务：先判断原目标是否仍可行，再在三种结构中做出优先选择，并提交一句依据
- 反馈规则：提交前必须先勾选“已重审目标”，避免跳过边界判断直接选结构

### 埋点与教师数据
- 埋点摘要：`feasibilityChoice`、`structureChoice`、`reasonSubmitted`
- 教师聚合：`structure_choice_distribution`、`boundary_skip_rate`

### AI 边界
- 允许范围：边界对象、目标重审、结构选择依据
- 禁止范围：在不重审目标时直接推荐结构

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-14`
- 对齐要求：边界对象卡、风险图、示例抽屉和选择矩阵必须同屏。

## 步骤 15｜后测与收束：从指标走到结构选择

### 页面骨架
- 模板：`summary_assessment_board`
- 区域：
  - `quiz`：三题后测
  - `summary`：三句结论
  - `close`：信息图与退出反思

### 模块清单
- `posttest-group`：三题后测
- `three-line-summary`：三句结论卡
- `info-graphic`：`3-6-info.png`
- `exit-reflection`：一句退出反思

### 固定证据
- 三句结论固定为：
  - 时域指标先翻译成目标区域，再决定是否需要左半平面零点或等效极点左移；
  - 频域指标先翻译成相角裕度与截止频率，再比较不同结构的副作用；
  - 右半平面零点下，目标本身就是设计变量的一部分。

### 互动升级点
- 组件类型：`quiz_group + exit_reflection`
- 学生任务：完成三题后测，再写一句“我会先看目标还是先看工具”的反思
- 反馈规则：后测完成前，退出反思区保持锁定

### 埋点与教师数据
- 埋点摘要：`posttestAccuracy`、`reflectionSubmitted`
- 教师聚合：`posttest_distribution`、`reflection_keyword_cloud`

### AI 边界
- 允许范围：课末总结、概念收束、后续去向
- 禁止范围：重做整套设计题答案

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-15`
- 对齐要求：后测、三句结论、信息图与退出反思必须构成完整收束页。
