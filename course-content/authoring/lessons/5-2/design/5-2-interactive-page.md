━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
互动页面设计 | 单元 5-2：非线性系统的最小分析入口
技术栈：Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 文档职责

- 本文件是 `5-2` 作者态互动页面蓝图，先把讲义中的非线性边界工具、局部线性化、相平面、描述函数、负倒描述函数、自振例题和舵机案例转换成学生脱离讲稿也能阅读的页面内容。
- 本轮只写人读版页面设计。按照当前 `interactive-design` 技能门槛，`interactive-contract.yaml` 需在本文件经用户确认后再生成。
- `sequence.json` 现阶段仍视为候选知识卡片池；最终卡片顺序与步骤归属应在机读契约阶段同步校准。

## 表述规则

- 每页必须回答四件事：对象是什么、正在判断什么、关键证据在哪里、结论如何回到“非线性边界下选择合适分析工具”。
- 页面顺序服从讲义顺序。公式、题面和判断规则先出现，曲线图和仿真图放在对应证据之后。
- 逐步显影只隐藏推理步骤，不隐藏题面、对象、已知条件和图形说明。

## 全课总览

| 步骤 | 标题 | 页面模板 | 互动类型 | 本页职责 |
|---|---|---|---|---|
| step-01 | 非线性边界现象与三种观察工具 | `intro_comic_problem_board` | `none` | 用封面漫画和三工具图提出工具选择问题 |
| step-02 | 本次课程目标 | `goal_statement_board` | `none` | 呈现布鲁姆式能力目标 |
| step-03 | 前置基础快测 | `quiz_group_board` | `quiz_group` | 检查状态变量、正弦信号和低通滤波等基础概念 |
| step-04 | 工作点附近的局部线性化 | `formula_example_board` | `activity_card_set` | 固定工作点、增量变量和 `tanh x` 对比 |
| step-05 | 动态系统线性化与局部结论 | `formula_table_board` | `single_choice` | 固定雅可比矩阵、特征值和适用边界 |
| step-06 | 相平面中的状态轨迹与周期行为 | `phase_plane_rust_tabs_board` | `rust_phase_plane_panel` | 用三标签 Rust 面板从初始点生成状态轨迹 |
| step-07 | 描述函数的基波近似 | `describing_function_harmonic_panel_board` | `rust_harmonic_panel_with_question` | 观察继电输出谐波、低通滤波和描述函数近似 |
| step-08 | 饱和、死区与死区饱和的描述函数 | `nonlinear_characteristic_rust_tabs_board` | `rust_nonlinearity_parameter_panel` | 用参数控件改变无记忆非线性的输入输出形态 |
| step-09 | 继电、滞环继电与间隙的描述函数 | `nonlinear_characteristic_rust_tabs_board` | `rust_nonlinearity_parameter_panel` | 用参数控件改变继电、滞环和间隙类形态 |
| step-10 | 负倒描述函数与候选自振条件 | `block_formula_board` | `single_choice` | 固定闭环结构、适用条件和交点含义 |
| step-11 | 微小扰动法判断稳定自振点 | `interactive_perturbation_curve_board` | `interactive_perturbation_panel` | 拖动交点后观察稳定交点回归和非稳定交点远离 |
| step-12 | 常见负倒曲线与参数影响 | `negative_inverse_rust_family_board` | `rust_negative_inverse_family_panel` | 用强制 Rust 曲线族面板观察参数改变方向 |
| step-13 | 理想继电闭环的自振计算 | `worked_example_reveal_board` | `teacher_reveal_only` | 完整显影例题一并读仿真验证 |
| step-14 | 饱和环节中线性增益改变自振条件 | `worked_example_compare_board` | `teacher_reveal_only` | 完整显影例题二并比较 `K=4` 与 `K=9` |
| step-15 | 舵机执行器结构中的死区与饱和 | `engineering_case_structure_board` | `single_choice` | 说明执行器结构和非线性来源 |
| step-16 | 舵机自振风险与整改方向 | `engineering_case_simulation_board` | `activity_card_set` | 结合计算、仿真和工程后果形成整改判断 |
| step-17 | 后测：非线性边界判断链 | `quiz_group_board` | `quiz_group` | 检查工具选择、公式范围和自振判断 |
| step-18 | 总结：三种入口与工程验证边界 | `summary_infograph_board` | `none` | 用信息图收束主要内容、局限和拓展思考 |

## 讲义章节覆盖表

| 讲义章节 | 覆盖步骤 | 页面元素出现顺序 | 主要公式与符号说明 | 互动方式 |
|---|---|---|---|---|
| 一、非线性边界需要先选观察工具 | step-01 | 封面漫画 -> 三工具图 -> 工具选择问题 | 无 | 无题 |
| 二、学习目标 | step-02 | 引导句 -> 六项目标 | 无 | 无题 |
| 三、局部线性化描述工作点附近的小扰动 | step-04, step-05 | 静态关系公式 -> 增量变量 -> `tanh x` 对比 -> 雅可比矩阵 -> 适用条件表 | $y\approx f(x_0)+f'(x_0)(x-x_0)$；$\Delta y\approx f'(x_0)\Delta x$；$\Delta\dot{x}=A\Delta x$ | 双题/单题 |
| 四、相平面显示状态怎样运动 | step-06 | 状态方程 -> 方向场公式 -> 三标签 Rust 相平面面板 -> 阅读对象表 | $dx_2/dx_1=f(x_1,x_2)/x_2$ | Rust 初始点轨迹提交 |
| 五、典型非线性环节的描述函数 | step-07, step-08, step-09 | 基波定义 -> 继电谐波与低通面板 -> 各类完整公式 -> 非线性参数面板 | $N(A)$ 及各非线性表达式 | Rust 面板 + 单题 |
| 六、负倒描述函数与自振判断 | step-10, step-11, step-12 | 闭环框图 -> 特征方程 -> 微小扰动交互面板 -> Rust 负倒曲线族 | $1+G(j\omega)N(A)=0$；$G(j\omega)=-1/N(A)$ | 单题/交点拖动/Rust 参数提交 |
| 七、描述函数法判断自振例题 | step-13, step-14 | 完整题面 -> 公式显影 -> 交点图 -> 时域仿真 | 继电 $N(A)=4M/(\pi A)$；饱和 $N(A)$ 分段式 | 教师显影 |
| 八、船舶航向舵机饱和与死区案例 | step-15, step-16 | 执行器结构 -> 非线性来源 -> 参数计算 -> 仿真图 -> 整改方向 | 死区饱和 $N(A)$；$G(s)=K/[s(s+1)(0.2s+1)]$ | 单题/双题 |
| 九至十一、近似风险、练习、小结 | step-17, step-18 | 后测题组 -> 信息图 -> 局限和拓展 | 复用核心公式 | 后测题组/总结 |

## 证据单元升级决策表

| evidence_unit_id | evidence_kind | handout_anchor | target_steps | upgrade_mode | keep_elements | non_reducible | acceptance_checks |
|---|---|---|---|---|---|---|---|
| nonlinear_tool_choice | concept_route | 一、非线性边界需要先选观察工具 | step-01 | comic_to_problem_map | 封面漫画、三工具图、工具选择句 | 三种工具不可压成一张结论卡 | 学生能区分工作点、轨迹、频域边界 |
| local_linearization | formula_example | 三、局部线性化 | step-04, step-05 | formula_with_activity | 泰勒展开、增量变量、`tanh x` 两工作点、雅可比矩阵 | 工作点和扰动范围必须同页出现 | 能指出局部模型不是全局比例系数 |
| phase_plane | curve_evidence | 四、相平面 | step-06 | mandatory_rust_phase_tabs | 状态方程、方向场、Van der Pol、重积分系统、积分惯性系统、阅读对象表 | Rust 面板不可降级为静态图 | 能点击方向场任意初始点并形成轨迹 |
| describing_function_family | formula_family | 五、描述函数 | step-07, step-08, step-09 | mandatory_rust_nonlinearity_panels | 各描述函数完整公式、适用范围、参数含义、谐波/低通面板、非线性特性面板 | 公式与参数范围不能分离，Rust 面板不可降级 | 能按类型选择公式区间并观察参数改变形态 |
| negative_inverse | curve_method | 六、负倒描述函数 | step-10, step-11, step-12 | mandatory_interactive_curve_panels | 闭环框图、交点条件、微小扰动交互图、Rust 负倒曲线族 | 交点不能直接等同稳定自振，曲线族面板不可降级 | 能判断 $A_1$ 非稳定、$A_2$ 稳定并观察参数移动方向 |
| worked_examples | worked_example | 七、例题 | step-13, step-14 | reveal_chain_with_simulation | 题面、列式、求解、交点图、短脉冲仿真 | 题面常显，显影保留公式 | 能解释仿真为何验证自振 |
| rudder_case | engineering_case | 八、船舶舵机案例 | step-15, step-16 | structure_plus_simulation_case | 执行器结构、参数计算、工程后果、整改方向 | 工程后果和整改不能只停留在公式 | 能同时给控制器和执行器整改方向 |
| limitations_summary | summary | 九至十一 | step-17, step-18 | quiz_and_summary | 近似风险、分层练习、信息图 | 总结页和后测页分离 | 能说出三种方法的适用边界 |

## 知识卡片互动归宿表

| node_id | 卡片标题 | 目标步骤 | 呈现方式 | 是否需要补写或拆分 |
|---|---|---|---|---|
| 非线性边界工具选择_5_52001 | 非线性边界工具选择 | step-01, step-18 | 常显卡片 / 总结回看 | 否 |
| 非线性微分方程的线性化_2_caa86ba6 | 非线性微分方程的线性化 | step-05 | 常显卡片 | 否 |
| 局部线性化工作点_5_52002 | 局部线性化工作点 | step-04 | 作答前置 | 否 |
| 相平面图_8_bd606f51 | 相平面图 | step-06 | 常显卡片 | 否 |
| 描述函数法_8_849fa8a1 | 描述函数法 | step-07, step-13 | 常显卡片 / 显影回看 | 否 |
| 描述函数适用条件_5_52003 | 描述函数适用条件 | step-10, step-18 | 常显卡片 / 总结回看 | 否 |
| 负倒描述函数_8_159ff256 | 负倒描述函数 | step-10, step-12 | 常显卡片 | 否 |
| 自振微小扰动判断_5_52004 | 自振微小扰动判断 | step-11, step-17 | 显影卡片 / 后测回看 | 否 |
| 舵机死区饱和自振风险_5_52005 | 舵机死区饱和自振风险 | step-15, step-16 | 案例常显卡片 | 否 |

## 步骤 01｜非线性边界现象与三种观察工具
### 页面骨架
- 顶部放页面标题和一句问题引入：“同一控制回路为什么在小幅输入下像线性模型，大幅输入下却可能触碰饱和并产生周期摆动。”
- 中部先显示封面漫画 `5-2-cover-comic.png`，随后显示 `5-2-nonlinear-tool-comparison.png`。
- 底部放三种观察工具对照条：局部线性化看工作点附近的小扰动；相平面看二阶状态轨迹；描述函数看正弦基波近似下的自振边界。
### 静态承载内容
- 元素出现顺序：标题问题 -> 封面漫画 -> 三工具对照图 -> 三工具对照条 -> 收束句。
- 收束句写：“这三种工具不是谁替代谁，而是在非线性边界下回答不同证据问题。”
### 互动升级点
- `none`；导入页不设置作答壳层。
### 教师控制
- `release_activity=not_applicable`；`open_browse=not_applicable`；`teacher_step_reveal=not_applicable`；`reveal_reference_answer=not_applicable`。
### 学生默认状态
- `default_visibility=visible`。
### 预览口径
- `/interactive-learning/courses/unit-5-2-nonlinear-analysis-entry/student/demo?step=step-01`。
### 脱离讲稿自包含检查
- 学生仅看本页应能说出三种工具分别观察工作点、状态轨迹和频域边界。

## 步骤 02｜本次课程目标
### 页面骨架
- 页面只呈现课程目标，不提前出现公式表、例题或案例图。
### 静态承载内容
- 引导句：“完成本次课程后，学习者能够：”
- 目标列表：解释局部线性化的工作点、增量变量和适用范围；计算一元非线性关系在给定工作点附近的一阶线性化模型；识别相平面中平衡点、轨迹方向、吸引行为和周期运动；写出主要非线性环节的描述函数及参数范围；使用负倒描述函数和微小扰动法判断候选自振点；结合执行器结构、仿真响应和工程后果提出整改方向。
### 互动升级点
- `none`。
### 教师控制
- 四类教师控制均为 `not_applicable`。
### 学生默认状态
- `default_visibility=visible`。
### 预览口径
- `/interactive-learning/courses/unit-5-2-nonlinear-analysis-entry/student/demo?step=step-02`。
### 脱离讲稿自包含检查
- 目标页只保留本次课程能力项，不出现课次接口或课程管理语言。

## 步骤 03｜前置基础快测
### 页面骨架
- 顶部说明：“这些题只检查学习本页所需的基础概念，不提前考察本课将要讲授的局部线性化、描述函数和自振判据。”
- 下方三题客观题组，单题独立提交。
### 静态承载内容
- 题 1 单选：二阶运动对象常用状态变量 $x_1=x$、$x_2=\dot{x}$ 表示。若给出一个初始点 $(x_1(0),x_2(0))$，它描述的是哪一类信息？正确项：系统从某个位置和速度出发的状态。
- 题 2 单选：正弦信号 $e(t)=A\sin\omega t$ 中，$A$ 与 $\omega$ 分别表示什么？正确项：幅值和角频率。
- 题 3 判断：低通滤波环节通常更容易保留低频成分，并衰减较高频率成分。正确项：正确。
### 互动升级点
- `quiz_group`；每题单独提交，教师可显示全班选项分布。
### 教师控制
- `release_activity=separate_toggle`；`open_browse=not_applicable`；`teacher_step_reveal=not_applicable`；`reveal_reference_answer=separate_toggle`。
### 学生默认状态
- `default_visibility=hidden`；题面常显，提交区需教师发放。
### 预览口径
- `/interactive-learning/courses/unit-5-2-nonlinear-analysis-entry/student/demo?step=step-03`。
### 脱离讲稿自包含检查
- 每题只调用状态变量、正弦信号和低通滤波基础概念，不要求学生预先掌握本讲的新公式。

## 步骤 04｜工作点附近的局部线性化
### 页面骨架
- 上半区放静态关系与一阶泰勒展开；中部放增量变量定义；下半区放 `y=\tanh x` 在 $x_0=0$ 和 $x_0=1$ 的对比表；末尾放两张作答卡。
### 静态承载内容
- 主要公式：$y\approx f(x_0)+f'(x_0)(x-x_0)$；$\Delta x=x-x_0$；$\Delta y=y-f(x_0)$；$\Delta y\approx f'(x_0)\Delta x$。
- 对比表列：工作点、$f(x_0)$、$f'(x_0)$、线性化模型、适用读法。
- 固定行：$x_0=0$，$f'(0)=1$，$\Delta y\approx\Delta x$；$x_0=1$，$f(1)\approx0.762$，$f'(1)\approx0.420$，$y\approx0.762+0.420(x-1)$。
### 互动升级点
- 双题半宽作答卡。题 1：选择“哪个量表示工作点附近的小信号增益”。题 2：判断“$f'(0)=1$ 是否可直接用于 $x=3$ 附近的大幅输入”。两题单独提交。
### 教师控制
- `release_activity=separate_toggle`；`open_browse=not_applicable`；`teacher_step_reveal=not_applicable`；`reveal_reference_answer=separate_toggle`。
### 学生默认状态
- `default_visibility=hidden`；正文和题面常显。
### 预览口径
- `/interactive-learning/courses/unit-5-2-nonlinear-analysis-entry/student/demo?step=step-04`。
### 脱离讲稿自包含检查
- 学生可从同页公式和表格理解工作点、小扰动和局部模型的边界。

## 步骤 05｜动态系统线性化与局部结论
### 页面骨架
- 顶部放二阶状态方程和“平衡点先找哪里”的提示；中部放雅可比矩阵公式；下方放局部线性化适用条件表；页尾放单选题。
### 静态承载内容
- 主要公式：$\dot{x}_1=x_2$，$\dot{x}_2=f(x_1,x_2)$；平衡条件 $x_2=0, f(x_1,0)=0$；$\Delta\dot{x}=A\Delta x$。
- 符号说明：$x^\ast$ 表示平衡点，$A$ 表示在该点计算的雅可比矩阵，特征值只说明工作点附近的小扰动趋势。
- 表格保留讲义表 1 的五行：可导、小扰动、工作点改变、轨迹远离工作点、继电/滞回/间隙主导。
### 互动升级点
- 单选题：“若雅可比矩阵特征值均在左半平面，最稳妥的结论是什么？”正确项：平衡点附近足够小的扰动会衰减，但不能保证远处轨迹也衰减。
### 教师控制
- `release_activity=separate_toggle`；`reveal_reference_answer=separate_toggle`；其余为 `not_applicable`。
### 学生默认状态
- `default_visibility=hidden`。
### 预览口径
- `/interactive-learning/courses/unit-5-2-nonlinear-analysis-entry/student/demo?step=step-05`。
### 脱离讲稿自包含检查
- 本页同时给出动态对象、平衡点条件、矩阵公式和局部结论边界。

## 步骤 06｜相平面中的状态轨迹与周期行为
### 页面骨架
- 先放状态方程和方向场公式，再放三标签 Rust 相平面面板，随后放相平面阅读对象表和观察提交区。
- Rust 面板标签固定为 `Van der Pol 振子`、`重积分系统`、`积分惯性系统`。三个标签都采用相同交互逻辑：用户点击方向场上任意一点作为初始点，面板按当前标签的状态方程数值积分并生成轨迹；下一次点击必须清空上一条轨迹并从新初始点重新计算。
### 静态承载内容
- 主要公式：$\dot{x}_1=x_2$，$\dot{x}_2=f(x_1,x_2)$，$dx_2/dx_1=f(x_1,x_2)/x_2$。
- 三标签模型：
  - `Van der Pol 振子`：$\dot{x}_1=x_2$，$\dot{x}_2=(1-x_1^2)x_2-x_1$，用于观察不同初始条件趋向共同闭合轨道。
  - `重积分系统`：$\dot{x}_1=x_2$，$\dot{x}_2=0$，用于观察无回复力、无阻尼时速度保持造成的相轨迹。
  - `积分惯性系统`：$\dot{x}_1=x_2$，$\dot{x}_2=-x_2/T$，默认 $T=1$，用于观察惯性环节使速度衰减后状态逐渐停留。
- 图后解释：“图中的每个点表示系统状态，不是时间轴上的采样点；从不同初始点生成的轨迹揭示系统在相平面中的运动方向、吸引行为和周期行为。”
- 阅读表列：平衡点、方向场、闭合轨道、开关线或分段边界、多条初始轨迹。
### 互动升级点
- 强制实现 Rust 相平面面板，不允许降级为静态图。面板默认显示方向场，支持显示/隐藏方向场；用户点击任意点后按固定步长积分生成轨迹；下一次点击清空旧轨迹。学生提交当前标签、初始点坐标、轨迹最终形态和一句观察记录。
### 教师控制
- `release_activity=separate_toggle`；`open_browse=not_applicable`；`teacher_step_reveal=not_applicable`；`reveal_reference_answer=separate_toggle`。
### 学生默认状态
- `default_visibility=hidden`；图和公式常显。
### 预览口径
- `/interactive-learning/courses/unit-5-2-nonlinear-analysis-entry/student/demo?step=step-06`。
### 脱离讲稿自包含检查
- 学生能基于本页知道相平面图看的是状态轨迹、吸引行为和周期运动。

## 步骤 07｜描述函数的基波近似
### 页面骨架
- 顶部放正弦输入和描述函数定义；中部先放 Rust 谐波与低通滤波面板；面板下方放低通条件说明和单选题。
### 静态承载内容
- 主要公式：$e(t)=A\sin\omega t$；$N(A)=\text{输出基波复幅值}/\text{输入正弦幅值}$。
- Rust 面板区域从左到右或按响应式网格呈现五类证据：输入正弦波、固定继电器输入输出特性图、继电器输出的频率分解、线性低通环节、线性环节实际输出与描述函数近似输出对比。
- 控件区放在面板下方或右侧固定区域，至少包含正弦输入幅值 $A$、角频率 $\omega$ 和低通滤波截止频率 $\omega_c$。继电器输出幅值默认 $M=1$，特性图固定显示 $u=M\operatorname{sgn}(e)$。
- 面板读图说明：“输入正弦经过继电后会产生高次谐波；低通截止频率越低，高次谐波越难通过，实际输出越接近只保留基波的描述函数近似。”
- 近似条件：非线性基波代表主要输出成分，线性部分能明显衰减高次谐波。
### 互动升级点
- 强制实现 Rust 谐波与低通滤波面板，不允许用静态图替代。单选题放在面板下方：“描述函数法为什么要求线性部分具有较好的低通滤波特性？”正确项：非线性输出的高次谐波需要被线性部分衰减，基波近似才有意义。
### 教师控制
- `release_activity=separate_toggle`；`reveal_reference_answer=separate_toggle`；其余为 `not_applicable`。
### 学生默认状态
- `default_visibility=hidden`。
### 预览口径
- `/interactive-learning/courses/unit-5-2-nonlinear-analysis-entry/student/demo?step=step-07`。
### 脱离讲稿自包含检查
- 本页给出输入、输出近似、图形对象和适用条件，不依赖教师补充。

## 步骤 08｜饱和、死区与死区饱和的描述函数
### 页面骨架
- 左侧放强制 Rust 非线性特性面板，通过标签切换 `饱和`、`死区`、`死区饱和` 三类环节；右侧放控件区，调节当前非线性环节参数并实时改变输入输出关系图形。下方放三类环节完整公式与参数范围。
### 静态承载内容
- 饱和环节完整公式：
  $$
  N(A)=
  \begin{cases}
  k, & 0<A\le a,\\[4pt]
  \dfrac{2k}{\pi}\left[
  \sin^{-1}\dfrac{a}{A}
  +\dfrac{a}{A}\sqrt{1-\left(\dfrac{a}{A}\right)^2}
  \right], & A>a.
  \end{cases}
  $$
  参数范围：$k>0,a>0,A>0$。
- 死区环节完整公式：
  $$
  N(A)=
  \begin{cases}
  0, & 0<A\le \Delta,\\[4pt]
  \dfrac{2k}{\pi}\left[
  \dfrac{\pi}{2}-\sin^{-1}\dfrac{\Delta}{A}
  -\dfrac{\Delta}{A}\sqrt{1-\left(\dfrac{\Delta}{A}\right)^2}
  \right], & A>\Delta.
  \end{cases}
  $$
  参数范围：$k>0,\Delta>0,A>0$。
- 死区饱和环节完整公式：
  $$
  N(A)=
  \begin{cases}
  0, & 0<A\le \Delta,\\[4pt]
  \dfrac{2k}{\pi}\left[
  \dfrac{\pi}{2}-\sin^{-1}\dfrac{\Delta}{A}
  -\dfrac{\Delta}{A}\sqrt{1-\left(\dfrac{\Delta}{A}\right)^2}
  \right], & \Delta<A\le a,\\[8pt]
  \dfrac{2k}{\pi}\left[
  \sin^{-1}\dfrac{a}{A}-\sin^{-1}\dfrac{\Delta}{A}
  +\dfrac{a}{A}\sqrt{1-\left(\dfrac{a}{A}\right)^2}
  -\dfrac{\Delta}{A}\sqrt{1-\left(\dfrac{\Delta}{A}\right)^2}
  \right], & A>a.
  \end{cases}
  $$
  参数范围：$k>0,0<\Delta<a,A>0$。
### 互动升级点
- 强制实现 Rust 非线性特性面板，不允许用静态图片替代。左侧图形显示当前标签下的输入输出曲线、正弦输入幅值边界和关键参数标注；右侧控件随标签变化：饱和调节 $k,a,A$，死区调节 $k,\Delta,A$，死区饱和调节 $k,\Delta,a,A$。学生提交当前标签、参数组和“参数改变后图形哪一段发生变化”的观察记录，不再设置普通双题作答卡。
### 教师控制
- `release_activity=separate_toggle`；`reveal_reference_answer=separate_toggle`；其余为 `not_applicable`。
### 学生默认状态
- `default_visibility=hidden`。
### 预览口径
- `/interactive-learning/courses/unit-5-2-nonlinear-analysis-entry/student/demo?step=step-08`。
### 脱离讲稿自包含检查
- 学生能同时看到输入输出形态、可调参数、完整描述函数公式和适用幅值区间。

## 步骤 09｜继电、滞环继电与间隙的描述函数
### 页面骨架
- 左侧放强制 Rust 非线性特性面板，通过标签切换 `理想继电`、`死区继电`、`滞环继电`、`间隙` 四类环节；右侧放控件区，调节当前非线性环节参数并实时改变输入输出关系或路径回线。下方放四类环节完整公式与参数范围。
### 静态承载内容
- 理想继电：$N(A)=4M/(\pi A)$，$M>0,A>0$。
- 死区继电完整公式：
  $$
  N(A)=
  \begin{cases}
  0, & 0<A\le d,\\[4pt]
  \dfrac{4M}{\pi A}\sqrt{1-\left(\dfrac{d}{A}\right)^2}, & A>d.
  \end{cases}
  $$
  参数范围：$M>0,d>0,A>0$。
- 滞环继电完整公式：
  $$
  N(A)=\frac{4M}{\pi A}
  \left[
  \sqrt{1-\left(\frac{h}{A}\right)^2}
  -j\frac{h}{A}
  \right],\qquad A>h.
  $$
  参数范围：$M>0,h>0,A>h$。
- 间隙环节完整公式：
  $$
  N(A)=\frac{k}{\pi}
  \left[
  \frac{\pi}{2}
  +\sin^{-1}\left(1-\frac{2b}{A}\right)
  +2\left(1-\frac{2b}{A}\right)\sqrt{\frac{b}{A}\left(1-\frac{b}{A}\right)}
  \right]
  +j\frac{4kb}{\pi A}\left(\frac{b}{A}-1\right),
  \qquad A>b.
  $$
  参数范围：$k>0,b>0,A>b$。
### 互动升级点
- 强制实现 Rust 非线性特性面板，不允许用静态图片替代。左侧图形显示当前标签的输入输出关系，滞环继电与间隙必须显示路径相关的回线或反向路径；右侧控件随标签变化：理想继电调节 $M,A$，死区继电调节 $M,d,A$，滞环继电调节 $M,h,A$，间隙调节 $k,b,A$。学生提交当前标签、参数组和“当前环节的描述函数是否带虚部及原因”的观察记录，不再设置普通双题作答卡。
### 教师控制
- `release_activity=separate_toggle`；`reveal_reference_answer=separate_toggle`；其余为 `not_applicable`。
### 学生默认状态
- `default_visibility=hidden`。
### 预览口径
- `/interactive-learning/courses/unit-5-2-nonlinear-analysis-entry/student/demo?step=step-09`。
### 脱离讲稿自包含检查
- 本页把继电类公式、幅值门槛、路径相关图形和相位来源同时落页。

## 步骤 10｜负倒描述函数与候选自振条件
### 页面骨架
- 先显示 `5-2-nonlinear-feedback-block.png`，再给出适用条件列表和特征方程，最后放交点含义判断题。
### 静态承载内容
- 主要公式：$1+G(j\omega)N(A)=0$；$G(j\omega)=-1/N(A)$。
- 适用条件：主要非线性集中为一个环节；输出基波代表主要成分；线性部分具有低通滤波特性；分析目标是自由系统自振边界。
- 固定解释：“交点只给出候选自振频率和候选振幅，不等于最终稳定自振结论。”
### 互动升级点
- 单选题：“负倒描述函数曲线与 Nyquist 曲线相交后，下一步应做什么？”正确项：检查微小扰动方向，并用时域仿真或实验复核。
### 教师控制
- `release_activity=separate_toggle`；`reveal_reference_answer=separate_toggle`；其余为 `not_applicable`。
### 学生默认状态
- `default_visibility=hidden`。
### 预览口径
- `/interactive-learning/courses/unit-5-2-nonlinear-analysis-entry/student/demo?step=step-10`。
### 脱离讲稿自包含检查
- 本页完整给出结构、方程、适用条件和交点边界。

## 步骤 11｜微小扰动法判断稳定自振点
### 页面骨架
- 顶部放判断任务：“比较交点两侧的振幅扰动是否把运动推回交点。”
- 中部放互动图像面板，默认图像与 `5-2-small-perturbation-method.png` 的静态布局一致：蓝色 $G(j\omega)$ 包围区域、红色负倒描述函数曲线、两个默认交点 $A_1$ 与 $A_2$、稳定/非稳定区域标注同时显示。
- 右侧放交点行为说明和重置按钮。
### 静态承载内容
- 图前说明：蓝色闭合曲线表示 $G(j\omega)$ 的包围区域，红色曲线表示某一负倒描述函数示意轨迹，箭头表示 $A$ 增大方向。
- 面板默认行为：$A_1$ 标注为非稳定自振交点，$A_2$ 标注为稳定自振交点。学生小范围拖动任一交点后，面板按照该交点类型模拟扰动恢复：稳定自振交点的扰动轨迹回到对应交点；非稳定自振交点的扰动轨迹远离该交点，若沿红色曲线方向进入下一个稳定自振区域，则停在 $A_2$，否则发散或衰减停止。
- 重置按钮恢复默认 $A_1$、$A_2$、$B_1$、$C_1$、$B_2$、$C_2$ 和区域标注。
### 互动升级点
- 强制实现互动图像面板，不允许退化为只读静态图。学生拖动交点后提交“拖动对象、扰动后运动方向、最终回到/远离/停在哪个点”的观察记录。
### 教师控制
- `release_activity=separate_toggle`；`open_browse=not_applicable`；`teacher_step_reveal=not_applicable`；`reveal_reference_answer=separate_toggle`。
### 学生默认状态
- `default_visibility=hidden`；图像面板常显，观察提交区需教师发放。
### 预览口径
- `/interactive-learning/courses/unit-5-2-nonlinear-analysis-entry/student/demo?step=step-11`。
### 脱离讲稿自包含检查
- 图、符号、两个交点、稳定/非稳定区域、拖动行为和重置逻辑均在本页显式出现。

## 步骤 12｜常见负倒曲线与参数影响
### 页面骨架
- 先放读图规则，再放强制 Rust 负倒曲线族面板，面板默认复现 `5-2-negative-inverse-summary.png` 的多子图布局；下方放参数观察提交区。
### 静态承载内容
- 读图规则：空心圆是曲线起点，箭头是 $A$ 增大方向，实描述函数负倒曲线落在负实轴上，滞环和间隙会进入复平面。
- 参数说明：饱和中 $k$ 增大使曲线向原点靠近；死区增大使出现门槛推向更大振幅；滞环宽度增大使曲线虚部下移；间隙增大使相位滞后更明显。
### 互动升级点
- 强制实现 Rust 负倒曲线族面板，不允许降级为静态图。面板默认复现讲义多子图，支持标签或子图选择非线性类型；控件位于图下方或右侧，调节 $k,a,\Delta,M,h,b,d,A$ 等与当前类型相关的参数。每条曲线必须使用表达式数值计算 $-1/N(A)$，保留空心圆起点和箭头方向。学生提交当前类型、参数组、负倒曲线移动方向和候选交点风险判断。有互动图形时不再另设普通互动题。
### 教师控制
- `release_activity=separate_toggle`；`open_browse=not_applicable`；`teacher_step_reveal=not_applicable`；`reveal_reference_answer=separate_toggle`。
### 学生默认状态
- `default_visibility=hidden`；图和读图规则常显。
### 预览口径
- `/interactive-learning/courses/unit-5-2-nonlinear-analysis-entry/student/demo?step=step-12`。
### 脱离讲稿自包含检查
- 学生能从起点、箭头、参数控件和读图规则判断曲线变化方向。

## 步骤 13｜理想继电闭环的自振计算
### 页面骨架
- 题面常显；下方左右布局，左侧放逐步显影公式链，右侧放 `5-2-example-relay-limit-cycle.png` 和仿真读图提示。
### 静态承载内容
- 题面：$G(s)=10/[s(s+2)^2]$，理想继电 $M=1$，判断是否存在描述函数意义下的自振并求候选频率和振幅。
- 显影链：1. 写出 $N(A)=4/(\pi A)$；2. 写出 $-1/N(A)=-\pi A/4$；3. 令 $G(j\omega)$ 虚部为零；4. 得 $\omega=2\ \mathrm{rad/s}$；5. 计算 $G(j2)=-0.625$；6. 由 $-\pi A/4=-0.625$ 得 $A=2.5/\pi\approx0.796$；7. 读仿真，短脉冲消失后仍进入周期运动，周期约 $3.14\ \mathrm{s}$。
### 互动升级点
- `teacher_reveal_only`；学生不提交计算全文，教师按步骤显影，最后显示参考结论。
### 教师控制
- `release_activity=not_applicable`；`open_browse=separate_toggle`；`teacher_step_reveal=enabled`；`reveal_reference_answer=separate_toggle`。
### 学生默认状态
- 题面和图常显；显影步骤默认锁定。
### 预览口径
- `/interactive-learning/courses/unit-5-2-nonlinear-analysis-entry/student/demo?step=step-13`。
### 脱离讲稿自包含检查
- 题面、公式、数值结果和仿真验证全部在本页出现。

## 步骤 14｜饱和环节中线性增益改变自振条件
### 页面骨架
- 题面常显；左侧放饱和描述函数和交点计算显影链；右侧放 `5-2-example-saturation-gain-compare.png`。
### 静态承载内容
- 题面：$G(s)=K/[s(s+1)(0.2s+1)]$，单位饱和 $k=1,a=1$，比较 $K=4$ 与 $K=9$。
- 显影链：1. 写出单位饱和 $N(A)$ 分段式；2. 令 $G(j\omega)$ 虚部为零得 $\omega=\sqrt{5}$；3. $K=9$ 时 $G(j\sqrt5)\approx-1.5$；4. 交点要求 $N(A)=2/3$；5. 数值解 $A\approx1.807$；6. $K=4$ 时负实轴位置约 $-0.667$，不形成同类交点；7. 读仿真：$K=4$ 衰减，$K=9$ 进入周期运动。
### 互动升级点
- `teacher_reveal_only`；显影链和图形同步推进。
### 教师控制
- `release_activity=not_applicable`；`open_browse=separate_toggle`；`teacher_step_reveal=enabled`；`reveal_reference_answer=separate_toggle`。
### 学生默认状态
- 题面和图常显；显影步骤默认锁定。
### 预览口径
- `/interactive-learning/courses/unit-5-2-nonlinear-analysis-entry/student/demo?step=step-14`。
### 脱离讲稿自包含检查
- 学生能基于本页解释自振由线性部分和非线性部分共同决定。

## 步骤 15｜舵机执行器结构中的死区与饱和
### 页面骨架
- 顶部放执行器链条文字任务；中部显示 `5-2-ship-rudder-actuator-case.png`；下方放“非线性来源”双列表和单选题。
### 静态承载内容
- 执行器链条：控制器输出 -> 电压放大器 -> 电液伺服阀 -> 液压缸 -> 舵杆与舵叶 -> 航向反馈。
- 非线性来源：放大器或阀驱动电压存在 $\pm10\mathrm{V}$ 限幅；阀芯搭接、摩擦和启动压力形成死区。
- 工程含义：大幅航向修正时饱和降低有效控制能力；小幅稳态修正时死区吞掉细微动作。
### 互动升级点
- 单选题：“小幅稳态误差长期消不掉时，最先应怀疑执行器链条中的哪类非线性？”正确项：阀芯搭接、摩擦或启动压力造成的死区。
### 教师控制
- `release_activity=separate_toggle`；`reveal_reference_answer=separate_toggle`；其余为 `not_applicable`。
### 学生默认状态
- `default_visibility=hidden`。
### 预览口径
- `/interactive-learning/courses/unit-5-2-nonlinear-analysis-entry/student/demo?step=step-15`。
### 脱离讲稿自包含检查
- 学生能从结构图定位执行器是什么、非线性来自哪里。

## 步骤 16｜舵机自振风险与整改方向
### 页面骨架
- 上半区放案例参数、候选交点计算和 `5-2-ship-rudder-actuator-case-sim.png`；下半区放工程后果和两张整改作答卡。
### 静态承载内容
- 参数：死区饱和 $\Delta=0.30,a=1.00,k=1$；$G(s)=K/[s(s+1)(0.2s+1)]$。
- 计算链：$K=10$ 时 $\omega=\sqrt5\approx2.24\ \mathrm{rad/s}$，$G(j\sqrt5)=-K/6\approx-1.667$，交点要求 $N(A)=0.600$，数值解 $A\approx1.22$；$K=5$ 时 $G(j\sqrt5)\approx-0.833$，不再形成同类危险交点。
- 工程后果：液压泵能耗上升，阀芯和机械部件磨损加剧，航向角周期摆动降低靠泊和狭水道安全裕度，积分累积可能拖慢恢复。
### 互动升级点
- 双题半宽作答卡。题 1：选择“降低 $K$ 为什么能降低本组自振风险”。题 2：多选“哪些整改方向同时作用在控制器和执行器边界上”：降低中低频增益、抗积分饱和、死区补偿或机构维护、滤波或相位校正。
### 教师控制
- `release_activity=separate_toggle`；`reveal_reference_answer=separate_toggle`；其余为 `not_applicable`。
### 学生默认状态
- `default_visibility=hidden`；计算链和仿真图常显。
### 预览口径
- `/interactive-learning/courses/unit-5-2-nonlinear-analysis-entry/student/demo?step=step-16`。
### 脱离讲稿自包含检查
- 本页把计算、仿真、工程后果和整改方向放在同一场景中。

## 步骤 17｜后测：非线性边界判断链
### 页面骨架
- 独立后测页，顶部放“本页检查工具选择、公式范围和自振判断链”，下方三题。
### 静态承载内容
- 题 1 单选：某系统只在小扰动下偏离工作点，首选哪种入口判断线性主干是否仍可用？正确项：局部线性化。
- 题 2 多选：使用描述函数公式前必须检查哪些条件？正确项：输入幅值区间、非线性参数范围、线性部分对高次谐波的衰减能力。
- 题 3 判断：负倒描述函数交点出现后，还应检查微小扰动方向并用时域仿真复核。正确项：正确。
### 互动升级点
- `quiz_group`；每题独立提交，教师可显示目标达成分布。
### 教师控制
- `release_activity=separate_toggle`；`reveal_reference_answer=separate_toggle`；其余为 `not_applicable`。
### 学生默认状态
- `default_visibility=hidden`。
### 预览口径
- `/interactive-learning/courses/unit-5-2-nonlinear-analysis-entry/student/demo?step=step-17`。
### 脱离讲稿自包含检查
- 后测题目短而明确，分别对应目标中的工具选择、公式范围和自振判断。

## 步骤 18｜总结：三种入口与工程验证边界
### 页面骨架
- 顶部显示 `5-2-info.png`；中部放三种入口总结；下方放局限性、重点难点、拓展思考和课堂表现统计区域。
### 静态承载内容
- 三种入口总结：局部线性化看工作点附近的小扰动；相平面看二阶状态轨迹和周期行为；描述函数看正弦基波近似下的自振边界。
- 局限性：局部稳定不保证全局稳定；相平面难以直接推广到高维系统；描述函数依赖基波近似。
- 重点难点：公式必须与参数范围一起读；交点必须经微小扰动法判断；工程整改要同时考虑线性参数、执行器边界和实验验证。
- 拓展思考：“若海试中出现台架未暴露的周期误差，应先检查工作点、状态轨迹、执行器死区饱和和时域复核证据。”
### 互动升级点
- `none`；总结页不设置作答壳层。
### 教师控制
- 四类教师控制均为 `not_applicable`。
### 学生默认状态
- `default_visibility=visible`；学生端显示个人浏览、提交、前后测完成情况和关键误判标签；教师端显示班级提交率、正确率、常见误判和目标达成概况。
### 预览口径
- `/interactive-learning/courses/unit-5-2-nonlinear-analysis-entry/student/demo?step=step-18`。
### 脱离讲稿自包含检查
- 本页用信息图、三入口总结和局限性说明完成收束，不与后测合并。
