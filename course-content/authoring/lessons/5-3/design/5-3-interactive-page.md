━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
互动页面设计 | 单元 5-3：从单回路控制到复杂自主系统链路
技术栈：Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 文档职责

- 本文件是 `5-3` 作者态互动页面蓝图，负责把讲义中的 MASS 协同链路、控制位置、上游信息质量、规划参考可实现性、执行约束、链路诊断、避碰转弯半径案例和自动化等级责任边界转化为学生脱离讲稿也能独立阅读的页面内容。
- 本轮只写人读版页面设计。按照当前 `interactive-design` 技能门槛，`interactive-contract.yaml` 需在本文件经用户确认后再生成。
- `sequence.json` 现阶段仍视为 lesson 阶段候选知识卡片池；最终卡片顺序、步骤归属和 `groups[].step_ids` 应在机读契约阶段同步校准。

## 表述规则

- 每页必须回答四件事：对象是什么、正在判断什么、关键证据在哪里、结论怎样回到“复杂自主系统中的控制位置与责任诊断”。
- 页面顺序服从讲义顺序。文字定义、公式、表格和案例题面先出现，链路图、曲线图和场景图放在对应证据之后。
- 逐步显影只隐藏分析步骤，不隐藏对象、题面、已知条件、公式和图形说明。
- 本课不展开感知算法、规划算法或完整 MASS 监管专题；所有互动都回到链路证据、控制接口和责任边界判断。

## 全课总览

| 步骤 | 标题 | 页面模板 | 互动类型 | 本页职责 |
|---|---|---|---|---|
| step-01 | 复杂自主系统链路中的控制位置 | `intro_comic_chain_board` | `none` | 用封面漫画和链路问题提出“偏差责任是否只在控制器” |
| step-02 | 本次课程目标 | `goal_statement_board` | `none` | 呈现布鲁姆式能力目标 |
| step-03 | 前置基础快测 | `quiz_group_board` | `quiz_group` | 检查闭环误差、反馈量和执行器限幅等预备概念 |
| step-04 | MASS 协同链路与责任流 | `chain_role_match_board` | `match` | 建立感知、估计、规划、控制、执行和监督的基本信息流 |
| step-05 | 单回路控制在自主系统链路中的位置 | `formula_chain_position_board` | `activity_card_set` | 固定闭环公式、控制层输入输出和边界 |
| step-06 | 上游信息质量与反馈可信度 | `evidence_compare_board` | `activity_card_set` | 用表格、噪声传播图和延迟航迹图判断反馈状态是否可信 |
| step-07 | 规划参考可实现性 | `planning_reference_compare_board` | `single_choice` | 读三类规划路径如何转化为航向参考和舵角负担 |
| step-08 | 执行约束与可实现反馈 | `actuator_constraint_evidence_board` | `activity_card_set` | 说明幅值饱和与速率限制怎样改变真实运动 |
| step-09 | 链路责任诊断顺序 | `diagnostic_sequence_board` | `drag_sort` | 按信息、意图、控制、执行和监督建立诊断顺序 |
| step-10 | 自主避碰中的偏差传播场景 | `avoidance_scene_evidence_board` | `activity_card_set` | 把感知遮挡、估计滞后、规划急转和执行触边放在一张场景图中阅读 |
| step-11 | 避碰转弯半径与舵角可行域分析 | `turning_radius_rust_panel_board` | `rust_turning_radius_panel` | 常显题面和公式，用 Rust 面板动态判断规划半径、舵角上限和安全约束 |
| step-12 | MASS 自动化等级与责任边界 | `automation_responsibility_board` | `single_choice` | 区分自动化等级、责任主体和技术链路证据 |
| step-13 | 链路阅读的最小方法 | `five_question_diagnostic_board` | `match` | 用五个问题形成复杂自主系统的最小阅读路径 |
| step-14 | 后测：链路诊断与可行性判断 | `posttest_board` | `quiz_group` | 检查目标达成，不并入总结 |
| step-15 | 总结：MASS 链路责任边界 | `summary_infograph_board` | `none` | 顶部信息图收束主要内容、局限、重点难点和课堂表现统计 |

## 讲义章节覆盖表

| 讲义章节 | 覆盖步骤 | 页面元素出现顺序 | 主要公式与符号说明 | 互动方式 |
|---|---|---|---|---|
| 一、复杂自主系统把单回路放进更长的责任链 | step-01, step-04 | 封面漫画 -> MASS 链路定义 -> 协同链路图 -> 责任边界句 | `MASS链路=感知+估计+规划+控制+执行+监督` | 无题 / 角色匹配 |
| 二、学习目标 | step-02 | 引导句 -> 五项目标 | 无 | 无题 |
| 三、单回路控制仍然承担运动落地任务 | step-05 | 闭环公式 -> 符号说明 -> 控制位置图 -> 职责三分 -> 双题 | $e(t)=r(t)-y(t)$，$u(t)=C(e(t))$，$y(t)=P(u(t),d(t))$ | 双题 |
| 四、感知和估计决定控制器看到的对象状态 | step-06 | 信息质量说明 -> 表 1 -> 噪声传播图 -> 延迟航迹图 -> 双题 | $y_m(t)=y(t-\tau)+n(t)$ | 双题 |
| 五、规划把任务约束翻译为控制参考 | step-07 | 规划空间说明 -> 控制可行域反馈 -> 三路径对比图 -> 单题 | $\delta_{\max}$，$\dot{\delta}_{\max}$，最小转弯半径 | 单题 |
| 六、执行约束让控制指令必须经过可实现性检查 | step-08 | 执行约束说明 -> 约束公式 -> 饱和/速率图 -> 双题 | $|u(t)|\le u_{\max}$，$|\dot{u}(t)|\le \dot{u}_{\max}$ | 双题 |
| 七、链路责任边界决定故障诊断顺序 | step-09 | 诊断分层表 -> 诊断顺序图 -> 混合日志排序 | 诊断顺序公式 | 排序题 |
| 八、避碰机动中的链路偏差传播场景 | step-10 | 场景任务书 -> 五层问题链 -> 避碰场景图 -> 双题 | 无新增公式 | 双题 |
| 九、避碰转向过急的链路定位分析 | step-11 | 完整题面 -> 启动距离公式 -> 舵角公式 -> 最小半径公式 -> Rust 面板 -> 参数提交 | $d_{\mathrm{start}}$，$\delta_d$，$R_{\min}$ | Rust 参数调节提交 |
| 十、MASS 自动化等级与责任边界案例 | step-12 | 四类自动化程度说明 -> 场景图 -> MASS Code 路线图 -> 单题 | 无 | 单题 |
| 十一、链路阅读的最小方法 | step-13 | 五问路径 -> 角色证据匹配 -> 责任边界句 | 无 | 匹配题 |
| 十二至十三、分层练习与小结 | step-14, step-15 | 后测题组 -> 信息图 -> 主要内容、局限、重点难点、拓展思考 | 复用核心公式 | 后测题组 / 总结 |

## 证据单元升级决策表

| evidence_unit_id | evidence_kind | handout_anchor | target_steps | upgrade_mode | keep_elements | non_reducible | acceptance_checks |
|---|---|---|---|---|---|---|---|
| mass_chain_entry | concept_route | 一 | step-01, step-04 | comic_to_chain_role_map | 封面漫画、MASS 链路图、责任边界句 | 不能把链路压成名词列表 | 学生能说出感知到监督的基本流向 |
| control_position | formula_chain | 三 | step-05 | formula_with_chain_position | 闭环公式、控制位置图、三类职责 | 控制层输入、输出和约束必须同页出现 | 学生能区分控制层能承担与依赖的内容 |
| upstream_quality | evidence_table_curve | 四 | step-06 | table_plus_static_curve_reading | 表 1、噪声传播图、延迟航迹图 | 噪声与延迟必须分开判断 | 学生能把“控制太忙”和“修正慢”分别归因 |
| planning_feasibility | curve_evidence | 五 | step-07 | planning_path_compare | 三类路径、航向参考、控制器输出、实际舵角 | 规划参考必须和舵角负担连读 | 学生能指出最短路径不等于控制可实现 |
| actuator_constraint | curve_evidence | 六 | step-08 | constraint_formula_and_log | 幅值约束、速率约束、控制量/响应/航迹图 | 执行约束不能写成末端修饰 | 学生能把饱和证据反馈给规划与控制 |
| diagnosis_sequence | diagnostic_table | 七 | step-09 | drag_sort_diagnostic_chain | 诊断分层表、诊断顺序图、混合日志 | 不能先默认调控制器参数 | 学生能按链路写出优先检查对象 |
| avoidance_propagation | scenario_evidence | 八 | step-10 | scenario_to_evidence_cards | 避碰场景图、五层问题链、轨迹偏差 | 场景图必须绑定诊断证据 | 学生能解释蓝线和橙线间隔的多环节来源 |
| turning_radius_case | worked_example_with_curve | 九 | step-11 | mandatory_rust_turning_radius_panel | 完整题面、启动距离、舵角、最小半径、单情形动态曲线、动态启动圈 | 题面和公式常显，Rust 面板不可降级为静态图 | 学生能调节规划半径并提交满足安全约束的半径与最大舵角 |
| automation_boundary | responsibility_case | 十 | step-12 | responsibility_compare | 四类自动化程度、场景图、监管路线图 | 自动化等级不能替代技术链路诊断 | 学生能区分运行形态与工程证据 |
| minimal_reading_method | method_summary | 十一至十三 | step-13, step-14, step-15 | five_question_practice_summary | 五问路径、后测、信息图 | 后测与总结分离 | 学生能把链路判断迁移到新日志 |

## 知识卡片互动归宿表

| node_id | 卡片标题 | 来源证据 | 目标步骤 | 呈现方式 | 是否需要补写或拆分 |
|---|---|---|---|---|---|
| MASS协同链路_5_53001 | MASS 协同链路 | 讲义一 | step-04, step-15 | 常显卡片 / 总结回看 | 否 |
| 控制在自主系统链路中的位置_5_53002 | 控制在自主系统链路中的位置 | 讲义三 | step-05 | 常显卡片 | 否 |
| 上游信息质量_5_53003 | 上游信息质量 | 讲义四 | step-06 | 作答前置 | 否 |
| 规划参考可实现性_5_53004 | 规划参考可实现性 | 讲义五、九 | step-07, step-11 | 常显卡片 / 显影回看 | 否 |
| 执行约束反馈_5_53005 | 执行约束反馈 | 讲义六、九 | step-08, step-11 | 常显卡片 / 显影回看 | 否 |
| 链路责任诊断_5_53006 | 链路责任诊断 | 讲义七、十一 | step-09, step-13, step-14 | 常显卡片 / 后测回看 | 否 |
| 避碰转弯半径可行域_5_53007 | 避碰转弯半径可行域 | 讲义九 | step-11 | 案例显影卡片 | 否 |
| MASS自动化等级责任边界_5_53008 | MASS 自动化等级责任边界 | 讲义十 | step-12, step-15 | 常显卡片 / 总结回看 | 否 |

## 混合证据顺序表

| step | evidence_sequence | media_policy | curve_panel_policy |
|---|---|---|---|
| step-01 | 问题句 -> 封面漫画 -> MASS 链路入口句 | 使用 `5-3-cover-comic.png` | 无曲线 |
| step-04 | 链路定义 -> 角色说明 -> 协同链路图 -> 角色匹配 | 使用 `5-3-mass-coordination-chain.png` | 无曲线 |
| step-05 | 闭环公式 -> 符号说明 -> 控制位置图 -> 职责判断 | 使用 `5-3-control-position-in-chain.png` | 无曲线 |
| step-06 | 信息质量表 -> 噪声传播图 -> 延迟航迹图 -> 诊断判断 | 使用两张静态日志图 | 不采用 Rust 面板；图承载固定日志证据，不是参数探索对象 |
| step-07 | 规划可行性说明 -> 三路径对比图 -> 舵角负担判断 | 使用 `5-3-planning-path-control-comparison.png` | 不采用 Rust 面板；本页训练读图，不训练重规划算法 |
| step-08 | 执行约束公式 -> 饱和/速率图 -> 日志字段判断 | 使用 `5-3-actuator-limits-response-track.png` | 不采用 Rust 面板；本页训练约束证据识别 |
| step-10 | 避碰任务书 -> 五层问题链 -> 场景图 -> 证据定位 | 使用 `5-3-autonomous-avoidance-scene.png` | 无参数面板 |
| step-11 | 题面 -> 公式 -> Rust 面板 -> 控件调参 -> 参数提交 -> 结论 | 默认视觉样式镜像 `5-3-turning-radius-saturation-comparison.png`，但只显示当前一种半径情形 | 强制 Rust 面板；下方控件调节规划半径，左侧航向曲线和右侧启动圈动态更新 |

## step-01｜复杂自主系统链路中的控制位置

### 页面骨架
- 顶部放页面标题和问题句：“一艘自主船避碰失败，末端航迹偏离规划路径，责任是否一定在控制器参数。”
- 中部显示封面漫画 `5-3-cover-comic.png`，漫画下方放一句解释：“单回路仍在工作，但它已经嵌入更长的感知、估计、规划、控制、执行和监督链路。”
- 底部放本页收束句：“本课从单回路语言出发，训练沿链路寻找证据，而不是把所有偏差直接归因给控制器。”
### 静态承载内容
- 元素出现顺序：标题问题 -> 封面漫画 -> 链路入口解释 -> 收束句。
- 不放知识点目录，不提前展示全课图谱。
### 互动升级点
- `none`；导入页不设置作答壳层。
### 教师控制
- `release_activity=not_applicable`；`open_browse=not_applicable`；`teacher_step_reveal=not_applicable`；`reveal_reference_answer=not_applicable`。
### 学生默认状态
- `default_visibility=visible`。
### 预览口径
- `/interactive-learning/courses/unit-5-3-mass-coordination-chain/student/demo?step=step-01`。
### 脱离讲稿自包含检查
- 学生仅看本页应能知道本课不是讨论一个更大的控制器，而是讨论复杂自主系统中的控制位置和责任链。

## step-02｜本次课程目标

### 页面骨架
- 页面只呈现课程目标，不提前出现链路诊断表、转弯半径公式或自动化等级图。
### 静态承载内容
- 引导句：“完成本次课程后，学习者能够：”
- 目标列表：解释 MASS 中感知、估计、规划、控制、执行和监督的基本信息流；指出经典闭环控制在复杂自主系统链路中的位置；根据图像、表格和日志证据判断偏差可能来自哪个链路环节；计算避碰转弯半径案例中的舵角需求和最小可实现半径；评价自动化等级描述与技术链路诊断之间的关系。
### 互动升级点
- `none`。
### 教师控制
- 四类教师控制均为 `not_applicable`。
### 学生默认状态
- `default_visibility=visible`。
### 预览口径
- `/interactive-learning/courses/unit-5-3-mass-coordination-chain/student/demo?step=step-02`。
### 脱离讲稿自包含检查
- 目标页只保留本次课程能力项，不写课次接口或课程管理语言。

## step-03｜前置基础快测

### 页面骨架
- 顶部说明：“这些题只检查理解本课所需的闭环控制和物理约束基础，不提前考察 MASS 链路诊断、规划可行域或自动化等级。”
- 下方三题客观题组，单题独立提交。
### 静态承载内容
- 题 1 单选：闭环控制中 $e(t)=r(t)-y(t)$ 的含义是什么？正确项：参考输入与输出反馈之间的误差。
- 题 2 判断：反馈量若带有噪声或延迟，控制器接收到的误差就可能偏离真实状态。正确项：正确。
- 题 3 单选：执行器幅值上限的直接含义是什么？正确项：控制指令超过边界时，实际执行量会被截断。
### 互动升级点
- `quiz_group`；每题单独提交，教师可显示全班选项分布。
### 教师控制
- `release_activity=separate_toggle`；`open_browse=not_applicable`；`teacher_step_reveal=not_applicable`；`reveal_reference_answer=separate_toggle`。
### 学生默认状态
- `default_visibility=hidden`；题面常显，提交区需教师发放。
### 预览口径
- `/interactive-learning/courses/unit-5-3-mass-coordination-chain/student/demo?step=step-03`。
### 脱离讲稿自包含检查
- 前测只调用闭环误差、反馈质量和执行器限幅基础概念，不要求学生预先掌握本课新链路。

## step-04｜MASS 协同链路与责任流

### 页面骨架
- 顶部放 MASS 定义卡：MASS 是海上自主水面船舶，它需要把环境感知、状态估计、行动规划、运动控制、执行机构和安全监督连成责任链。
- 中部显示 `5-3-mass-coordination-chain.png`，图后放六个环节的职责条。
- 底部放角色匹配题。
### 静态承载内容
- 元素出现顺序：MASS 定义 -> 链路公式 -> 协同链路图 -> 六环节职责条 -> 角色匹配题。
- 主要公式：$\text{MASS链路}=\text{感知}+\text{估计}+\text{规划}+\text{控制}+\text{执行}+\text{监督}$。
- 职责条：感知回答系统看到了什么；估计把不完整观测整理为状态；规划形成行动意图；控制把行动意图转为运动指令；执行器和船体产生真实运动；监督处理风险、降级和接管。
### 互动升级点
- 匹配题：将“目标船轮廓识别、目标船速度估计、避碰路径生成、期望航向转舵角、舵机动作、风险超限接管”匹配到六个环节。
### 教师控制
- `release_activity=separate_toggle`；`reveal_reference_answer=separate_toggle`；其余为 `not_applicable`。
### 学生默认状态
- `default_visibility=hidden`；链路图和职责条常显。
### 预览口径
- `/interactive-learning/courses/unit-5-3-mass-coordination-chain/student/demo?step=step-04`。
### 脱离讲稿自包含检查
- 学生仅看本页应能按信息流说出 MASS 链路的六个环节，而不是只记住一个系统名。

## step-05｜单回路控制在自主系统链路中的位置

### 页面骨架
- 顶部放闭环公式和符号说明。
- 中部显示 `5-3-control-position-in-chain.png`，图后说明控制层的输入来自规划参考和估计状态，输出进入舵、推进或姿态执行器。
- 底部放两张半宽作答卡。
### 静态承载内容
- 元素出现顺序：闭环公式 -> 符号说明 -> 控制位置图 -> 三类职责 -> 两张作答卡。
- 主要公式：$e(t)=r(t)-y(t)$，$u(t)=C(e(t))$，$y(t)=P(u(t),d(t))$。
- 符号说明：$r(t)$ 是上游给出的参考，$y(t)$ 是反馈输出，$u(t)$ 是控制输入，$P$ 表示对象与执行机构，$d(t)$ 表示扰动。
- 三类职责：跟踪参考；处理局部扰动和模型误差；尊重执行器和船体约束。
### 互动升级点
- 题 1 单选：规划层给出期望航迹后，控制层最直接承担什么任务？正确项：把参考转化为可反馈、可约束的运动指令。
- 题 2 判断：控制层能独自保证感知信息完整和规划目标合理。正确项：错误。
### 教师控制
- `release_activity=separate_toggle`；`reveal_reference_answer=separate_toggle`；其余为 `not_applicable`。
### 学生默认状态
- `default_visibility=hidden`；公式、图和题面常显。
### 预览口径
- `/interactive-learning/courses/unit-5-3-mass-coordination-chain/student/demo?step=step-05`。
### 脱离讲稿自包含检查
- 本页同时给出闭环公式、符号来源和控制层职责，学生能区分“控制层负责运动落地”和“控制层依赖上游输入”。

## step-06｜上游信息质量与反馈可信度

### 页面骨架
- 顶部说明控制器使用的反馈量不等于真实世界本身。
- 中部先放表 1：上游信息质量对控制判断的影响；随后显示 `5-3-sensor-noise-filter-chain.png` 和 `5-3-sensor-delay-heading-track.png`。
- 底部放两张半宽诊断卡。
### 静态承载内容
- 元素出现顺序：反馈可信度说明 -> 信息质量表 -> 噪声传播图 -> 延迟航迹图 -> 两张诊断卡。
- 主要公式：$y_m(t)=y(t-\tau)+n(t)$。
- 表格保留四行：传感器噪声增大、目标状态估计滞后、环境遮挡或丢帧、坐标系或时间戳不一致；列为上游问题、控制层接收到的表现、可能后果、优先检查对象。
- 噪声图读图口令：先看测量反馈，再看误差信号和控制器输出，最后看执行器动作是否出现高频负担。
- 延迟图读图口令：先看无延迟与有延迟的航向跟随差异，再看航迹偏差是否由反馈时间滞后放大。
### 互动升级点
- 题 1 单选：日志显示控制输出频繁小幅抖动，同时反馈测量含高频噪声，优先检查对象是什么？正确项：传感器健康、量测滤波和采样同步。
- 题 2 单选：同一控制器在测量延迟存在时避障后留下更大横向偏差，首要证据指向什么？正确项：反馈状态的时间滞后。
### 教师控制
- `release_activity=separate_toggle`；`reveal_reference_answer=separate_toggle`；其余为 `not_applicable`。
### 学生默认状态
- `default_visibility=hidden`；表格、图和题面常显。
### 预览口径
- `/interactive-learning/courses/unit-5-3-mass-coordination-chain/student/demo?step=step-06`。
### 脱离讲稿自包含检查
- 学生能从表格和两张图分别判断噪声、延迟对控制判断的影响，不需要教师口头补足诊断链。

## step-07｜规划参考可实现性

### 页面骨架
- 顶部说明规划层面对的是任务空间，控制层拿到的是参考航迹、航向或速度剖面。
- 中部显示 `5-3-planning-path-control-comparison.png`，图后分三行解释最短折线路径、频繁重规划路径和平滑可行路径。
- 底部放单选题。
### 静态承载内容
- 元素出现顺序：规划参考说明 -> 控制可行域反馈句 -> 三路径对比图 -> 三行图后解释 -> 单选题。
- 关键约束项：最大舵角 $\delta_{\max}$、最大舵角速率 $\dot{\delta}_{\max}$、允许横向加速度、最小转弯半径和跟踪误差上界。
- 图后解释：最短折线路径把折点翻译成航向阶跃；频繁重规划路径造成航向参考反复摆动；平滑可行路径让舵角输出留有余量。
### 互动升级点
- 单选题：三类路径中哪一类最容易造成舵角在正负最大值之间频繁切换？正确项：频繁重规划路径。
### 教师控制
- `release_activity=separate_toggle`；`reveal_reference_answer=separate_toggle`；其余为 `not_applicable`。
### 学生默认状态
- `default_visibility=hidden`；图和题面常显。
### 预览口径
- `/interactive-learning/courses/unit-5-3-mass-coordination-chain/student/demo?step=step-07`。
### 脱离讲稿自包含检查
- 学生能把几何路径、航向参考、控制器输出和实际舵角连成同一证据链。

## step-08｜执行约束与可实现反馈

### 页面骨架
- 顶部放执行器约束说明和两条不等式。
- 中部显示 `5-3-actuator-limits-response-track.png`，图后按“理想控制量、幅值饱和、速率限制、真实航迹”读图。
- 底部放两张半宽作答卡。
### 静态承载内容
- 元素出现顺序：执行约束说明 -> 幅值/速率公式 -> 控制量与航迹图 -> 图后解释 -> 两张作答卡。
- 主要公式：$|u(t)|\le u_{\max}$，$|\dot{u}(t)|\le \dot{u}_{\max}$。
- 图后解释：幅值限制截断峰值，速率限制减慢上升和回落；这会改变阶跃响应和船体航迹。
### 互动升级点
- 题 1 单选：若日志中实际舵角长时间贴着上限，最直接的证据类型是什么？正确项：执行器幅值约束触边。
- 题 2 判断：执行约束只是控制信号显示前的后处理，不会影响真实运动路径。正确项：错误。
### 教师控制
- `release_activity=separate_toggle`；`reveal_reference_answer=separate_toggle`；其余为 `not_applicable`。
### 学生默认状态
- `default_visibility=hidden`；公式、图和题面常显。
### 预览口径
- `/interactive-learning/courses/unit-5-3-mass-coordination-chain/student/demo?step=step-08`。
### 脱离讲稿自包含检查
- 学生能从公式和图看出执行约束会反向影响规划参考和控制判断。

## step-09｜链路责任诊断顺序

### 页面骨架
- 顶部放诊断原则：“偏差诊断先看信息是否可信，再看参考是否可执行，随后判断控制、执行和监督边界。”
- 中部放表 2：MASS 链路诊断的责任分层；随后显示 `5-3-diagnostic-sequence-infographic.png`。
- 底部放排序题。
### 静态承载内容
- 元素出现顺序：诊断原则 -> 责任分层表 -> 诊断顺序信息图 -> 混合日志排序题。
- 表格保留六行：感知层、估计层、规划层、控制层、执行层、监督层；列为核心问题、典型证据、可能处理方向。
- 诊断顺序公式：$\text{感知}\rightarrow\text{估计}\rightarrow\text{规划}\rightarrow\text{控制}\rightarrow\text{执行}\rightarrow\text{监督}$。
### 互动升级点
- 排序题：给出“目标船丢帧、估计滞后、规划急转、舵角饱和、轨迹偏移、风险超限”六条证据，学生按优先检查顺序排序。
### 教师控制
- `release_activity=separate_toggle`；`reveal_reference_answer=separate_toggle`；其余为 `not_applicable`。
### 学生默认状态
- `default_visibility=hidden`；表格、图和题面常显。
### 预览口径
- `/interactive-learning/courses/unit-5-3-mass-coordination-chain/student/demo?step=step-09`。
### 脱离讲稿自包含检查
- 本页给出完整诊断表、顺序图和日志题面，学生能独立完成责任排序。

## step-10｜自主避碰中的偏差传播场景

### 页面骨架
- 顶部放场景任务书：一艘自主水面船在狭窄航道保持计划航线，并遇到横穿目标船，需要完成安全避让。
- 中部放五层问题链，再显示 `5-3-autonomous-avoidance-scene.png`。
- 底部放两张作答卡。
### 静态承载内容
- 元素出现顺序：场景任务书 -> 五层问题链 -> 避碰场景图 -> 图后解释 -> 两张作答卡。
- 五层问题链：感知是否识别目标船、岸线、浮标和禁航区域；估计是否给出速度、方位、风险和置信度；规划是否满足规则、安全距离和操纵能力；控制是否跟踪参考并抑制扰动；执行层是否有舵角、舵速和推进余量。
- 图后解释：蓝色规划路径和橙色实际航迹之间的间隔，可能由延迟、约束和控制误差共同留下。
### 互动升级点
- 题 1 单选：目标船被短时遮挡后，估计层保持上一速度值，这条证据首先进入哪个诊断层？正确项：感知层和估计层。
- 题 2 多选：橙色航迹未贴住蓝色规划路径时，需要同步检查哪些对象？正确项：规划参考是否过急、反馈状态是否滞后、执行器是否触边、控制器是否具备足够鲁棒性。
### 教师控制
- `release_activity=separate_toggle`；`reveal_reference_answer=separate_toggle`；其余为 `not_applicable`。
### 学生默认状态
- `default_visibility=hidden`；场景题面、问题链和图常显。
### 预览口径
- `/interactive-learning/courses/unit-5-3-mass-coordination-chain/student/demo?step=step-10`。
### 脱离讲稿自包含检查
- 学生能从一张场景图中把偏差分解为信息、参考、控制和执行证据。

## step-11｜避碰转弯半径与舵角可行域分析

### 页面骨架
- 顶部常显完整题面：自主船以 $v=4\ \mathrm{m/s}$ 接近障碍物，障碍物等效半径 $r_o=25\ \mathrm{m}$，安全裕量 $m=16\ \mathrm{m}$，等效船长 $L=34\ \mathrm{m}$，舵角边界 $\delta_{\max}=18^\circ$；比较 $R=35\ \mathrm{m}$、$65\ \mathrm{m}$、$140\ \mathrm{m}$ 三种规划半径。
- 中部放 Rust 驱动互动面板，视觉样式对齐静态图 `5-3-turning-radius-saturation-comparison.png`，但同一时刻只显示一种规划半径对应的曲线和航迹证据。
- 面板下方放规划半径控件和参数提交区；学生通过控件调节 $R$，提交满足安全约束的最新规划半径以及对应最大舵角。
### 静态承载内容
- 元素出现顺序：完整题面 -> 启动距离公式 -> 舵角需求公式 -> 最小可实现半径公式 -> Rust 面板 -> 规划半径控件 -> 参数提交 -> 责任结论。
- 主要公式：
  - $d_{\mathrm{start}}\approx \sqrt{(r_o+m)(2R+r_o+m)}$
  - $\delta_d\approx \arctan\dfrac{L}{R}$
  - $R_{\min}\approx \dfrac{L}{\tan\delta_{\max}}$
- 符号说明：$R$ 为规划假定转弯半径，$d_{\mathrm{start}}$ 为避障启动距离，$L$ 为等效船长，$\delta_d$ 为名义舵角，$\delta_{\max}$ 为舵角边界。
### Rust 面板设计
- 面板默认状态使用 $R=140\ \mathrm{m}$，对应安全通过的基线情形；默认视觉样式、坐标范围、障碍物位置、船舶起点、启动圈虚线、规划航迹、实际航迹和舵角边界标注应与静态图保持一致。
- 面板只显示当前一种规划半径情形，不再同时显示 $35\ \mathrm{m}$、$65\ \mathrm{m}$、$140\ \mathrm{m}$ 三组曲线，避免把学生注意力转成静态对照读图。
- 左侧子图显示航向相关曲线：规划参考航向、控制器期望航向、估计航向和实际航向。规划半径变小时，航向参考变化更急；若名义舵角超过 $18^\circ$，控制器期望航向和实际航向之间应表现出由舵角饱和造成的滞后差异，估计航向与实际航向曲线随半径同步更新。
- 右侧子图显示平面避碰场景：障碍物、安全裕量圈、当前规划半径对应的虚线启动圈、规划航迹和实际航迹。规划半径改变时，虚线启动圈半径和启动位置动态调整；若半径过小，实际航迹应显示横向位移不足或风险边界触碰。
- 面板下方控件只保留规划半径 $R$，建议范围 $35\ \mathrm{m}$ 至 $160\ \mathrm{m}$，默认 $140\ \mathrm{m}$，步长 $5\ \mathrm{m}$。控件旁实时显示 $d_{\mathrm{start}}$、$\delta_d$、$\delta_{\max}$、是否触发舵角饱和、是否满足安全约束。
- 控件设计意图：学生只改变规划半径，观察启动圈、航向变化速度、舵角饱和和真实航迹之间的联动；不要额外开放速度、障碍物半径、安全裕量或控制器参数，避免把本页扩成完整规划算法实验。
### 互动升级点
- 强制实现 Rust 驱动互动面板，不允许降级为静态图或只读计算表。
- 学生提交当前选择的规划半径 $R$、对应最大舵角 $\max|\delta|$ 或名义舵角 $\delta_d$、是否满足 $18^\circ$ 舵角边界、是否满足安全约束、以及一句链路判断。
- 参考提交口径：半径应不小于由 $R_{\min}\approx34/\tan18^\circ\approx105\ \mathrm{m}$ 给出的理论下限，并结合右侧航迹确认未触碰障碍物安全边界；若学生选择 $R=140\ \mathrm{m}$，应能说明它留出舵角余量且启动更早。
### 教师控制
- `release_activity=separate_toggle`；`open_browse=not_applicable`；`teacher_step_reveal=not_applicable`；`reveal_reference_answer=separate_toggle`。
### 学生默认状态
- `default_visibility=hidden`；题面、公式和 Rust 面板常显，参数提交区需教师发放。
### 预览口径
- `/interactive-learning/courses/unit-5-3-mass-coordination-chain/student/demo?step=step-11`。
### 脱离讲稿自包含检查
- 本页保留完整已知条件、公式、动态曲线、动态启动圈和提交口径，学生能独立判断“规划参考需要吸收控制与执行约束”，并能用自己调出的半径和最大舵角支撑结论。

## step-12｜MASS 自动化等级与责任边界

### 页面骨架
- 顶部说明自动化等级描述运行形态和责任主体差异。
- 中部显示 `5-3-automation-levels-scene.png`，图后放四类自动化程度对照条。
- 底部放 MASS Code 路线图提示和单选题。
### 静态承载内容
- 元素出现顺序：自动化等级说明 -> 四类场景图 -> 责任主体对照条 -> MASS Code 路线图提示 -> 单选题。
- 四类对照：带自动化过程和决策支持的船舶；船上有人但由远程位置控制的船舶；船上无人且由远程位置控制的船舶；能够自行决策并采取行动的全自主船舶。
- 路线图提示：截至 2026 年 5 月 2 日，IMO 公开资料显示非强制性 MASS Code 的目标是在 2026 年 5 月定稿并通过；强制性 Code 的目标是不晚于 2030 年 7 月 1 日通过，并于 2032 年 1 月 1 日生效。
### 互动升级点
- 单选题：自动化等级能否替代感知、估计、规划、控制、执行和监督链路证据诊断？正确项：不能，等级描述运行形态，技术判断仍要回到链路证据。
### 教师控制
- `release_activity=separate_toggle`；`reveal_reference_answer=separate_toggle`；其余为 `not_applicable`。
### 学生默认状态
- `default_visibility=hidden`；图、对照条和题面常显。
### 预览口径
- `/interactive-learning/courses/unit-5-3-mass-coordination-chain/student/demo?step=step-12`。
### 脱离讲稿自包含检查
- 学生能区分责任主体、运行形态和技术诊断证据，不把自动化等级当作工程判断结论。

## step-13｜链路阅读的最小方法

### 页面骨架
- 顶部放五问路径。
- 中部放“问题 -> 对应证据 -> 可能优先环节”匹配表。
- 底部放匹配题。
### 静态承载内容
- 元素出现顺序：五问路径 -> 证据匹配表 -> 责任边界句 -> 匹配题。
- 五问路径：任务目标是什么；状态从哪里来；参考怎样生成；控制怎样落地；责任怎样分界。
- 责任边界句：若偏差来自上游状态错误，先修正感知和估计；若来自参考不可实现，先修正规划约束；若来自闭环振荡，再回到控制结构、参数和裕度；若来自执行饱和，控制分配和执行器健康管理优先进入分析；若风险超过自动系统可信范围，监督层应触发降级或接管。
### 互动升级点
- 匹配题：将“状态跳变、频繁重规划、舵角贴边、裕度不足、远程接管”匹配到估计层、规划层、执行层、控制层、监督层。
### 教师控制
- `release_activity=separate_toggle`；`reveal_reference_answer=separate_toggle`；其余为 `not_applicable`。
### 学生默认状态
- `default_visibility=hidden`；五问路径和题面常显。
### 预览口径
- `/interactive-learning/courses/unit-5-3-mass-coordination-chain/student/demo?step=step-13`。
### 脱离讲稿自包含检查
- 学生能用五问路径阅读新的复杂自主系统日志，而不依赖讲义原案例。

## step-14｜后测：链路诊断与可行性判断

### 页面骨架
- 顶部放后测说明：“本页检查是否已经形成链路诊断、可实现性判断和责任边界意识。”
- 下方三题题组，单题独立提交。
### 静态承载内容
- 题 1 排序：日志显示目标船短时遮挡、估计层保持上一速度值、规划层给出急转参考、舵角达到 $18^\circ$ 上限。请按优先检查顺序排列：感知、估计、规划、执行。参考顺序：感知 -> 估计 -> 规划 -> 执行。
- 题 2 单选：若规划半径对应名义舵角超过执行器上限，最合理的链路结论是什么？正确项：规划参考没有吸收控制与执行约束。
- 题 3 简短填写：用一句话说明为什么不能先只调控制器增益。参考口径：因为信息质量、参考可实现性和执行触边证据尚未排除，直接增益调整不能解释完整偏差链。
### 互动升级点
- `quiz_group`；总题数 3 题，其中 1 题为短答，教师端展示关键词聚合和典型答案。
### 教师控制
- `release_activity=separate_toggle`；`reveal_reference_answer=separate_toggle`；其余为 `not_applicable`。
### 学生默认状态
- `default_visibility=hidden`；题面常显，提交区需教师发放。
### 预览口径
- `/interactive-learning/courses/unit-5-3-mass-coordination-chain/student/demo?step=step-14`。
### 脱离讲稿自包含检查
- 后测题目直接呼应目标页的解释、指出、判断、计算和评价能力，不设计大段综合推导。

## step-15｜总结：MASS 链路责任边界

### 页面骨架
- 顶部显示课程信息图 `5-3-info.png`。
- 中部放主要内容、局限性、重点难点和拓展思考四块。
- 底部学生页显示个人课堂表现统计，教师页显示班级整体表现统计。
### 静态承载内容
- 元素出现顺序：信息图 -> 主要内容 -> 局限性 -> 重点难点 -> 拓展思考 -> 课堂表现统计。
- 主要内容：MASS 把经典控制问题放进感知、估计、规划、控制、执行和监督组成的链路；控制仍承担稳定、跟踪和抗扰职责，但依赖上游信息质量，也受下游执行约束限制。
- 局限性：本课只建立链路阅读和责任诊断框架，不展开感知算法、路径规划算法或完整监管制度。
- 重点难点：偏差诊断不能只看末端轨迹；规划参考、反馈状态和执行器边界都可能改变控制层表现。
- 拓展思考：当模型对象不再只是一条稳定传递函数时，后续课程会继续讨论为什么会转向模型驱动与数据驱动的分工。
### 互动升级点
- `none`；总结页不设置作答壳层。
### 教师控制
- 四类教师控制均为 `not_applicable`。
### 学生默认状态
- `default_visibility=visible`。
### 预览口径
- `/interactive-learning/courses/unit-5-3-mass-coordination-chain/student/demo?step=step-15`。
### 脱离讲稿自包含检查
- 学生能在信息图和四块总结中回收本课主线，并看到个人浏览、提交、后测完成和关键能力达成摘要；教师能看到提交率、题目正确率、排序误判分布和目标达成概况。
