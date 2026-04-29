━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
互动页面设计 | 单元 3-9：稳定—动态—稳态综合映射实验
技术栈：Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 文档职责
- 本文件是作者态人读蓝图，固定 3-9 互动课的页面顺序、静态证据、互动模块、教师控制与学生页预览口径。
- 同目录 `interactive-contract.yaml` 是机读契约，运行态 `course-content/runtime/lessons/3-9/interactive-manifest.json` 是共享组件化渲染的页面编排真源；三者必须保持同名、同序、同语义。
- 本轮实现采用 manifest-first 共享渲染：通用正文、题组、显影、表格和 Rust/WASM 控制分析面板优先走共享组件；课程目录只保留 3-9 专属参数面板和提交评价的窄适配。
- 学生页面不出现页内 AI 助手，不为展示页渲染“无需提交”之类占位。

## 全课总览
| 步骤 | 标题 | 页面模板 | 主体模块 | 互动类型 | 学生页预览 |
|---|---|---|---|---|---|
| step-01 | 导入：同一艘船的三种改进诉求 | `intro_comic_scene` | 导入漫画 + 场景回顾 | `none` | `/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-01` |
| step-02 | 前测：先贴任务标签，不先报控制器名称 | `question_stack` | 本次课程目标 + 前测题组 | `quiz_group` | `/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-02` |
| step-03 | 控制对象：本次课比较的同一艘船 | `object_task_slide` | 控制对象 + 本次课主要任务 | `none` | `/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-03` |
| step-04 | 基准版本：从四联图读出性能指标 | `rust_metric_reading_board` | Rust 四联图 + 指标填空 + 教师显影结论 | `structured_compare` | `/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-04` |
| step-05 | 超前校正：调节增益、零点与极点 | `rust_tuning_workspace` | Rust 参数面板 + 设计提交评价 | `parameter_slider` | `/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-05` |
| step-06 | 积分校正：调节增益与积分零点 | `rust_tuning_workspace` | Rust 参数面板 + 设计提交评价 | `parameter_slider` | `/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-06` |
| step-07 | 积分校正例子：调节校正零点与极点 | `rust_tuning_workspace` | 设计任务 + Rust 参数面板 + 提交评价 | `parameter_slider` | `/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-07` |
| step-08 | 滞后对照：调节增益、零点与极点 | `rust_tuning_workspace` | Rust 参数面板 + 设计提交评价 | `parameter_slider` | `/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-08` |
| step-09 | 后测：填写四个版本的综合映射表 | `mapping_workspace` | 四版本映射填空表 + 暂存 + 提交 | `table_builder` | `/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-09` |
| step-10 | 总结：从读图比较走向设计任务表达 | `summary_only` | 总结卡 + 课程信息图 | `summary` | `/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-10` |

## 共享组件化要求
| 能力 | 运行态实现口径 | 验收点 |
|---|---|---|
| 页面编排 | `interactive-manifest.json` 驱动 `renderInteractiveManifestStep` | 学生端与教师端都通过 manifest 构造 10 步 |
| 静态内容 | `createManifestContentModuleRegistry` 消费 `summary-card`、`formula-card`、`figure`、`step-reveal` | 通用内容模块不写 3-9 专属页面常量 |
| 活动内容 | `createManifestStudentActivityRegistry` 与教师活动汇总消费题组、显影、表格提交 | 前测、指标填空、后测不进入正文重复渲染 |
| Rust 四联图 | `useControlEngine` + `ControlFigureWorkspace` + `ControlChartPanel` + `RootLocusPanel` | 时域、根轨迹、幅频、相频同面板联动 |
| 参数面板 | 3-9 专属窄适配只负责参数、公式显示、评价与提交 | 不恢复旧私有步骤常量或整页大 switch |

## 讲义核心内容映射
| handout_anchor | core_item_type | must_appear_content | target_step | page_mode | interaction_upgrade | media_or_table_ref | acceptance_note |
|---|---|---|---|---|---|---|---|
| `## 一、为什么模块 3 结束前要整合三种语言` | scene | 同一航向控制对象的三类改进诉求 | step-01 | static | 导入漫画 + 场景问题 | `3-9-cover-comic.png` | 首屏不出现作答占位 |
| `## 一、为什么模块 3 结束前要整合三种语言` | quiz | 布鲁姆动词驱动目标与更快、更准、兼顾稳与快三类任务标签 | step-02 | quiz | 课程目标 + 前测题组 | 前测题目 | 页面内无 AI 助手 |
| `## 二、统一对象与统一读图口径` | formula | `P(s)`、`C_0(s)` 与本次课主要任务 | step-03 | static | 无 | 控制对象公式 | 不作答 |
| `## 三、任务一：基准版本给出哪一类基线` | curve+metric | 基准四联图、性能指标、读图基本结论 | step-04 | rust+fill | Rust 四联图 + 指标填空 + 教师显影 | 基准指标表 | 教师释放答案后显示正确指标 |
| `## 四、任务二：零点线补强如何优先改善动态` | parametric_panel | 超前增益、零点、极点对四域证据的影响 | step-05 | rust+submit | 参数调节与设计提交 | Rust 控制分析面板 | 校正前后与装置曲线同屏 |
| `## 五、任务三：积分家族如何把低频收益和中频代价同时暴露出来` | parametric_panel | 增益与积分零点对稳态收益和中频代价的影响 | step-06 | rust+submit | 参数调节与设计提交 | Rust 控制分析面板 | 与 step-05 同交互逻辑 |
| `### 5.4 积分校正：保留积分任务，同时把动态和裕度拉回可用区` | worked_example | 固定积分校正设计任务与零点、极点调节 | step-07 | rust+submit | 只调校正零点和极点 | Rust 控制分析面板 | 控制器曲线采用完整控制器，时域读取单位斜坡误差 |
| `### 5.5 滞后对照：稳态改善还有另一条路径` | parametric_panel | 不改变型别，把低频增益提高一倍 | step-08 | rust+submit | 参数调节与设计提交 | Rust 控制分析面板 | 时域读取单位斜坡误差，根轨迹采用校正后完整控制器 |
| `## 六、综合映射：同一对象上的三条典型路线怎样分工` | table | 四个版本的收益、代价、观察域与任务标签 | step-09 | table | 表格填空、暂存、提交 | 综合映射表 | 允许空白提交 |
| `## 本讲小结` | summary | 从读图比较走向设计任务表达 | step-10 | static | 无 | 总结卡与 `3-9-info.png` | 不设置后测 |

## 步骤 01｜导入：同一艘船的三种改进诉求

### 页面骨架
- 模板：`intro_comic_scene`
- 区域：`comic` / `recall`
- 模块：`figure:intro-comic`、`summary-card:recall-scene`

### 静态承载内容
- 首屏给出导入漫画 `3-9-cover-comic.png`。
- 漫画后给出简要场景回顾：同一套航向控制对象已经经历根轨迹、频域和稳态误差三条观察线；当需求说“更快”“更准”或“既快又稳”时，需要从图和指标中判断哪条机制线先承担任务。
- 回顾以问题或工程场景嵌入，不写边界管理文案，不追加提交占位。

### 互动升级点
- 组件类型：`none`
- 教师控制：无
- 学生默认状态：漫画与回顾默认可见。

### 验收点
- 页面只呈现导入漫画和简要场景回顾。
- 不出现页内 AI 助手或提交占位文本。

## 步骤 02｜前测：先贴任务标签，不先报控制器名称

### 页面骨架
- 模板：`question_stack`
- 区域：`quiz`
- 模块：`objective-list:lesson-objectives`、`summary-card:pretest-anchor`、`activity-card-set:pretest-questions`

### 静态承载内容
- 先给出本次课程目标：
  - 识别同一航向控制对象下动态、稳态、稳定裕度三类证据分别来自哪张图。
  - 解释超前、积分、滞后控制器改变低频收益和中频相位的主要机制。
  - 比较基准、超前、积分、滞后四个版本在单位斜坡误差、相角裕度、超调和调节时间上的收益与代价。
  - 判断给定改进诉求应先写成哪类任务标签，并匹配相应的机制线。
- 前测只检查面对“更快”“更准”“兼顾稳与快”时，是否先写任务标签，再判断可能的机制线。
- 页面内只保留题目与必要题组说明。

### 互动升级点
- 组件类型：`quiz_group`
- 学生任务：完成前测题组。
- 反馈规则：教师可释放参考答案与错因标签。

### 教师控制
- `release_activity`：教师控制开放。
- `reveal_reference_answer`：教师切换整组参考答案。

### 验收点
- 删除页内 AI 助手。
- 未作答状态下题干完整可见。

## 步骤 03｜控制对象：本次课比较的同一艘船

### 页面骨架
- 模板：`object_task_slide`
- 区域：`object` / `task`
- 模块：`formula-card:plant-formula`、`summary-card:lesson-task`

### 静态承载内容
- 给出本次课统一控制对象：
$$
P(s)=\frac{0.01715}{s(s+0.1)(s+2.14375)}
$$
- 给出基准控制器：
$$
C_0(s)=2.25
$$
- 明确本次课主要任务：在同一控制对象上比较基准、超前、积分和滞后等版本，把读图证据转写成“更偏动态改善”“更偏稳态改善”或“更偏综合折中”的任务判断。

### 互动升级点
- 组件类型：`none`
- 学生任务：阅读对象与任务，不作答。

### 验收点
- 页面在 step-04 之前出现。
- 学生无需依赖讲稿即可知道本次课比较的是同一个控制对象。

## 步骤 04｜基准版本：从四联图读出性能指标

### 页面骨架
- 模板：`rust_metric_reading_board`
- 区域：`panel` / `reveal` / `metric-input`
- 模块：`rust-analysis-panel:baseline-rust-panel`、`step-reveal:baseline-conclusion-reveal`、`activity-card-set:baseline-metric-fill`

### 静态承载内容
- 将讲义 3.1 节图片转化为同样板式的 Rust 驱动四联图。
- 四联图包括时域响应、根轨迹、幅频响应、相频响应。
- 原图片下方模块全部删除，替换为指标填空。
- 指标填空字段对应 3.1 节列出的读图指标：超调量、调节时间、相角裕度、增益裕度、单位斜坡稳态误差。
- 教师释放答案后显示正确性能指标：
  - 超调量：约 18.7%
  - 调节时间：约 46 s
  - 相角裕度：约 48°
  - 增益裕度：约 17 dB
  - 单位斜坡误差：约 25.9
- 讲义 3.2 节读图基本结论作为教师控制的显影模块，教师点击后显示主要结论。

### 互动升级点
- 组件类型：`structured_compare`
- 学生任务：在当前基准控制器作用下，通过读图填写性能指标。
- 反馈规则：教师释放参考答案后显示正确指标；教师显影后显示 3.2 节主要结论。

### 教师控制
- `release_activity`：教师控制开放指标填写。
- `teacher_step_reveal`：教师控制 3.2 节结论显影。
- `reveal_reference_answer`：教师切换指标答案。

### 验收点
- 不再使用静态截图替代互动四联图。
- 指标填空和结论显影分属两个不同控制语义。

## 步骤 05｜超前校正：调节增益、零点与极点

### 页面骨架
- 模板：`rust_tuning_workspace`
- 区域：`workspace`
- 模块：`summary-card:lead-task` + 3-9 专属 Rust 参数面板

### 静态承载内容
- 控件区允许学生调节超前校正的三个参数：增益、零点、极点。
- 控件区动态显示当前控制器传递函数。
- 时域图同时显示校正前后曲线。
- 幅频和相频图同时显示校正前、校正后和超前装置曲线。
- 根轨迹只绘制校正之后的根轨迹，并随控件调整变化。

### 互动升级点
- 组件类型：`parameter_slider`
- 学生任务：调节参数后提交设计。
- 反馈规则：提交后依据校正效果给出评价，重点检查动态改善信号、相角余量与高频代价。

### 验收点
- 删除页内 AI 助手和文本作答区。
- 参数调节必须真实驱动 Rust/WASM 分析结果。

## 步骤 06｜积分校正：调节增益与积分零点

### 页面骨架
- 模板：`rust_tuning_workspace`
- 区域：`workspace`
- 模块：`summary-card:integral-task` + 3-9 专属 Rust 参数面板

### 静态承载内容
- 控件区允许学生调节增益和积分零点。
- 控件区动态显示当前控制器传递函数。
- 时域图显示校正前后的单位斜坡误差。
- 幅频和相频图显示校正前、校正后和完整积分控制器曲线。
- 根轨迹只绘制校正之后的根轨迹，并随控件调整变化。

### 互动升级点
- 组件类型：`parameter_slider`
- 学生任务：调节参数后提交设计。
- 反馈规则：提交后依据稳态改善收益和中频代价给出评价。

### 验收点
- 采用与 step-05 相同的交互逻辑。
- 不保留旧图片下的文本作答区。

## 步骤 07｜积分校正例子：调节校正零点与极点

### 页面骨架
- 模板：`rust_tuning_workspace`
- 区域：`workspace`
- 模块：`summary-card:integral-example-task` + 3-9 专属 Rust 参数面板

### 静态承载内容
- 设计任务：已固定积分控制器
$$
C_{ic}(s)=2.25\left(1+\frac{1}{40s}\right)\frac{20s+1}{2s+1}
$$
- 强积分几乎消除单位斜坡误差，但相角裕度偏紧；现在只调节中频校正零点和极点，在保留低频积分任务的同时把相位裕度和动态品质拉回可用区。
- 幅频和相频中的控制器曲线采用完整控制器曲线。
- 根轨迹采用完整控制器对应的校正后根轨迹。
- 时域图显示校正前后的单位斜坡误差。

### 互动升级点
- 组件类型：`parameter_slider`
- 学生任务：完成零点与极点调节后提交。
- 反馈规则：提交后依据积分收益、中频相位整理和稳定裕度变化给出评价。

### 验收点
- 页面插入在滞后对照之前。
- 控件不暴露增益调节。

## 步骤 08｜滞后对照：调节增益、零点与极点

### 页面骨架
- 模板：`rust_tuning_workspace`
- 区域：`workspace`
- 模块：`summary-card:lag-task` + 3-9 专属 Rust 参数面板

### 静态承载内容
- 调节任务：在不改变型别的前提下，把低频增益提高一倍。
- 控件区允许学生调节增益、滞后零点和滞后极点，使单位斜坡误差约从 5.56 降到 2.78。
- 控件区动态显示当前控制器传递函数。
- 时域图显示校正前后的单位斜坡误差。
- 幅频和相频图显示校正前、校正后和完整滞后控制器曲线。
- 根轨迹只绘制完整控制器对应的校正后根轨迹，并保持关于实轴的共轭对称。

### 互动升级点
- 组件类型：`parameter_slider`
- 学生任务：完成参数调节后提交。
- 反馈规则：提交后依据稳态误差压小程度和动态代价给出评价。

### 验收点
- 采用与 step-05 相同的 Rust 驱动面板样式。
- 参数提交可以在任意有效组合下完成。

## 步骤 09｜后测：填写四个版本的综合映射表

### 页面骨架
- 模板：`mapping_workspace`
- 区域：`table`
- 模块：`table-builder:mapping-table-builder`

### 静态承载内容
- 本页作为后测内容。
- 学生作答区用表格填空承载四个版本需要填写的内容。
- 表格字段覆盖版本、主要收益、主要代价、首先观察的域和任务标签。
- 删除旧版下方长文本输入区。

### 互动升级点
- 组件类型：`table_builder`
- 学生任务：在表格中填写四个版本的综合映射。
- 暂存规则：暂存后保存学生输入数据，允许切换到前面页面继续观察，再回到本页继续填写。
- 提交规则：任何时间允许提交，即使仍有空白单元格也可以提交。

### 教师控制
- `release_activity`：教师控制开放。
- `reveal_reference_answer`：教师可展示参考映射。

### 验收点
- 表格填空提供暂存和提交。
- 不再出现长段自由输入区。
- 页面无页内 AI 助手。

## 步骤 10｜总结：从读图比较走向设计任务表达

### 页面骨架
- 模板：`summary_only`
- 区域：`summary`
- 模块：`summary-card:summary-card`、`figure:course-info-graphic`

### 静态承载内容
- 汇总本课形成的判断：同一控制对象下，不同校正动作会在时域、频域、根轨迹和稳态误差中暴露不同收益与代价。
- 收束到后续设计任务表达：先写任务标签，再依据跨域证据选择候选机制。
- 同页给出课程信息图 `3-9-info.png`，帮助学生把三种校正路线的证据分工带走。

### 互动升级点
- 组件类型：`summary`
- 学生任务：阅读总结。

### 验收点
- 本页只作为总结页。
- 不设置后测题目或作答区。
