# 单元 4-2 多模态资源设计与采用清单

> **当前阶段目标**：围绕新版讲义的“控制器选型与单结构整定”主线组织媒体，覆盖频域特性、选型决策树、分结构整定例题、前馈补偿和客船候选结构比较。
> **命名前缀**：全部统一使用 `4-2-...`

## 1. 资源融入评审单

| 候选资源路径 | 资源类型 | 计划落点 | 采用方式 | 采用级别 | 边界说明 |
| --- | --- | --- | --- | --- | --- |
| `course-content/resource-library/pptx/10.1校正_实现控制的手段/README.md` | `pptx` | 结构工具箱、典型控制结构表 | 改写吸收 | 必融入 | 吸收结构族、适用任务和代价语言，重写为频域特性对照 |
| `course-content/resource-library/pptx/20宽备窄用_稳定裕度/README.md` | `pptx` | 相角裕度、幅值裕度、客船候选结果解释 | 改写吸收 | 必融入 | 只保留“离风险边界还有多远”的储备语言，不重开裕度专题 |
| `course-content/resource-library/pptx/21三频段_各司其职/README.md` | `pptx` | 低频/中频/高频职责与选型决策树 | 改写吸收 | 必融入 | 服务结构选择，不回到模块 3 的频域分析教学顺序 |
| `course-content/resource-library/pptx/22串联校正/README.md` | `pptx` | 超前-滞后整定边界 | 仅作灵感 | 可选融入 | 不展开完整复合方案，只服务“先动态、后低频”的步骤说明 |
| `course-content/resource-library/pptx/23滞后超前/README.md` | `pptx` | 频域 PI/滞后、超前整定步骤 | 改写吸收 | 必融入 | 用讲义中的公式和例题重写，不沿旧页序搬运 |
| `course-content/resource-library/ship-control-cases/sections/6.1-船舶航向控制频域校正.md` | `ship-case` | 客船航向控制候选结构整定 | 改写吸收 | 必融入 | 作为工程对象和指标解释来源，参数以本讲义数值图为准 |
| `course-content/resource-library/ship-control-cases/sections/6.3-船载稳定平台控制系统校正设计.md` | `ship-case` | 中频动态品质对照 | 仅作灵感 | 可选融入 | 不在本课重开第二工程案例，只作为教师讲解的对照语料 |
| `course-content/resource-library/civics-cases/cases/06-频段强国策应器.md` | `civics` | 课堂收束一句话 | 改写吸收 | 可选融入 | 只服务系统职责分工，不设置独立思政板块 |

---

## 2. 本课正式媒体总表

| 编号 | 文件名 | 类型 | 状态 | 引用于 | 用途 |
| :---: | --- | --- | --- | --- | --- |
| 1 | `4-2-cover-comic.png` | AI 位图 | 已有 | handout 首页 | 单元导入 |
| 2 | `4-2-controller-frequency-characteristics.png` | 代码直出图 | 已有 | handout §2 | 六类控制结构的 Bode 特性矩阵 |
| 3 | `4-2-controller-selection-decision-tree.png` | 信息图 | 已有 | handout §3 | 任务证据到候选结构的选型路径 |
| 4 | `4-2-example-5-1-correction-quadrants.png` | 代码直出图 | 已有 | handout §5.1 | 频域 PI 校正前后对比 |
| 5 | `4-2-example-5-2-correction-quadrants.png` | 代码直出图 | 已有 | handout §5.2 | 超前校正前后对比 |
| 6 | `4-2-example-5-3-correction-quadrants.png` | 代码直出图 | 已有 | handout §5.3 | 滞后校正前后对比 |
| 7 | `4-2-example-5-4-zn-steps.png` | 代码直出图 | 已有 | handout §5.4 | 临界比例实验过程 |
| 8 | `4-2-example-5-4-correction-quadrants.png` | 代码直出图 | 已有 | handout §5.4 | Ziegler-Nichols PID 校正前后对比 |
| 9 | `4-2-example-5-5-feedforward-comparison.png` | 代码直出图 | 已有 | handout §5.5 | 扰动前馈补偿前后对比 |
| 10 | `4-2-ship-controller-candidates-bode.png` | 代码直出图 | 已有 | handout §6.3 | 客船候选结构开环 Bode 对比 |
| 11 | `4-2-ship-controller-candidates-step-disturbance.png` | 代码直出图 | 已有 | handout §6.3 | 客船候选结构时域与扰动响应 |
| 12 | `4-2-ship-controller-candidates-summary.png` | 代码直出图 | 已有 | handout §6.3 | 客船候选结构指标比较 |
| 13 | `4-2-feedforward-block-diagram.png` | TikZ 线框图 | 已有 | 知识卡/课堂说明 | 前馈与反馈职责边界 |
| 14 | `4-2-input-feedforward-quad.png` | 代码直出图 | 已有 | 前馈扩展说明 | 按输入补偿前馈 |
| 15 | `4-2-disturbance-feedforward-quad.png` | 代码直出图 | 已有 | 前馈扩展说明 | 按扰动补偿前馈 |
| 16 | `4-2-info.png` | 信息图 | 已有 | handout 尾页 | 结构选择与复核收束 |
| 17 | `4-2-media.md` | 媒体索引 | 已有 | runtime / 课程入口 | 课程级资源链接 |

---

## 3. 原始脚本与生成入口

### 3.1 控制结构频域特性与整定例题

- **Octave 数据脚本**：`media/raw/generate_controller_tuning_data.m`
- **Python 渲染脚本**：`media/raw/render_controller_tuning_figures.py`
- **数据目录**：`media/raw/generated-data/`
- **输出范围**：
  - 控制器频率特性矩阵；
  - 5 组分结构整定例题；
  - 客船候选结构 Bode、阶跃/扰动响应与指标汇总；
  - 例题根轨迹分支数据与审计报告。

### 3.2 前馈面板与线框图

- **Octave 数据脚本**：`media/raw/generate_feedforward_panels_data.m`
- **TikZ 源文件**：
  - `media/raw/4-2-feedforward-block-diagram.tex`
  - `media/raw/4-2-input-feedforward-vs-pd-structure.tex`
  - `media/raw/4-2-disturbance-feedforward-structure-compare.tex`
- **用途**：
  - 讲清参考前馈、扰动前馈和反馈保底的职责边界；
  - 支撑知识卡片中的“前馈不能替代反馈”结论。

### 3.3 封面与导入视频

- **封面提示词**：`media/raw/4-2-cover-comic-prompt.md`
- **导入视频提示词**：`media/raw/4-2-intro-video-prompts.md`
- **用途**：
  - 统一封面漫画、导入视频和课程入口的叙事口径；
  - 保持“结构工具箱 + 参数初算 + 多指标复核”的视觉主线。

---

## 4. 媒体设计约束

1. 讲义中的响应曲线、Bode 图、根轨迹、参数比较和客船候选结果必须继续采用 `Octave` 导出数据、`Python/matplotlib` 排版的两段式流程。
2. 根轨迹数据必须来自 `Octave rlocus()`，并通过 `.agents/skills/lesson/scripts/root_locus_branch_match.py` 生成连续分支和审计报告。
3. 前馈结构图属于线框图，继续保留 TikZ 来源，不用位图截图替代。
4. 封面漫画和信息图属于保留资产，代码直出脚本不得覆盖。
5. 课程级媒体索引保持 5 个标准资源入口：`4-2-intro-video.mp4`、`4-2-slides.pdf`、`4-2-course.mp4`、`4-2-audio.m4a`、`handout.md`。
6. 新增或重绘媒体时，所有最终文件必须保留 `4-2-` 前缀，图题不得手写“图 4-2-x”。

---

## 5. 当前建议补做的媒体

现有媒体已经覆盖新版讲义的主要证据链。当前不登记新的正式媒体文件，以免 runtime 审查把增强设想误识别为待生成资产。若后续继续增强，可再单独设计“单结构整定复核表”和“整定方法地图”两类信息图。

---

## 6. 课程级资源索引对接

- 统一媒体索引文件：`media/processed/4-2-media.md`
- 统一讲义下载源：`design/4-2-handout.pdf`
- runtime 导出后继续沿用：
  - `handout.md` 在线阅读；
  - `handout.pdf` 静态下载；
  - `4-2-media.md` 提供课程级资源名称、说明与链接。
