---
name: homework
description: 生成、检查、修订或汇编指定题号的课程作业与考试题。
---

# Homework Problem Authoring

## Overview

按 `course-content/syllabus-refactor/homework-framework.md` 中的题号生成完整习题，或对已完成的题目系列进行汇编和管理。

本技能支持三种工作流，根据用户意图选择：

| 工作流 | 触发 | 参考文件 |
|--------|------|---------|
| **出题** | 用户给出题号（如 T2-3） | `references/output-contract.md` |
| **系列汇编** | 用户说某系列全部题目已完成 | `references/workflow-assemble.md` |
| **题目检查/更新** | 用户要求检查或更新已有题目 | `references/workflow-review.md` |

默认出题产物必须包含：
- 题面（含图片）
- 标准答案
- 分步评分标准
- 参考作答
- 裁判结论与一致性记录

其中：
- `inline_score_points` 用于把答案内部逐步标分显式结构化保存；其本质不是额外写一份摘要，而是要求在标准答案的关键步骤或关键公式后直接标出分值。
- `rubric` 用于独立评分指南，与 `inline_score_points` 并存，不互相替代。

## Quick Start（出题）

1. 运行 `python3 .agents/skills/homework/scripts/extract_homework_question.py --framework course-content/syllabus-refactor/homework-framework.md --question-id T3-2` 抽取题号对应的最小题目规范。
2. 若题目需要教材、参考书或大型资料支撑，先运行 `npm run source:pack -- build --profile homework-authoring --query "<题号/能力目标/知识点>" --candidates <reviewed-source-pack-items.json> --out .tmp/homework-problem-authoring/<QUESTION_ID>/source-pack --format both --top-k 6`，只把 `source-pack.md` 与必要 citation target id / retrieval chunk id 下发给出题智能体，并保留 `source-pack.json` 与 `source-pack.audit.json` 供裁判复核。
3. 临时目录固定为 `.tmp/homework-problem-authoring/<QUESTION_ID>/`（如 `.tmp/homework-problem-authoring/T3-2/`）。目录结构详见 `references/output-contract.md`。
4. 启动 3 个独立出题智能体，各自在 `drafts/draft-N/` 下写题面和图片。
5. 裁判智能体选出备选题，核验图片和公式后写入 `selected/`。
6. 3 个独立的作答智能体对 `selected/stem.md` 进行作答，结果写入 `solvers/`。
7. 按题型（C/X/D）执行一致性判定；不一致时再开第二轮。
8. 输出 `final/final-package.md`（含图片资源清单）。

如果用户一次给出多个题号，对每个题号分别跑完整流程，不要把多题混在同一目录里。

## Workflow

### 1. 抽取题号规范

只让主代理读取项目内的作业框架文件。运行 `extract_homework_question.py` 后，拿到：
- `question_id`、`question_type`、`difficulty`、`title`、`ability`、`synopsis`、`why_for_exam`、`source_excerpt`

主代理补充最小任务包，只保留：题号与题型、题目梗概、考查能力、难度、是否允许设置数值参数、输出格式要求、一致性标准。

任务包必须保留 `assignment_total_score`、`assignment_score_policy`、`question_score` 三个分值字段。`HW1-HW6` 固定为 `20 + 20 + 20 + 40`，`HW7` 固定为 `25 + 25 + 50`，所有 `inline_score_points`、答案正文行内分值与 `rubric` 总分必须与 `question_score` 一致。

不要把整个项目目录、其他题号内容、已有答案、仓库源码路径一并塞给子代理。子代理之间只通过临时文件交接，并禁止读取项目文件、其他题号材料或彼此未公开的中间结果。

### 2. 创建临时目录

临时目录根固定为 `.tmp/homework-problem-authoring/`。每个题号独立子目录。完整目录布局与 JSON 输出格式见 [references/output-contract.md](references/output-contract.md)。

### 3. 运行 3 个独立的出题智能体

主代理分别向 3 个出题智能体发送同一份 `task-package.json`，不得让它们读取彼此结果。每个出题智能体在 `drafts/draft-N/` 下输出：
- `stem.md`：完整题面（含图片 Markdown 引用、规范公式格式）
- `draft-N.json`：含标准答案、评分标准、易错点、自检结论
- `assets/`：该智能体生成的所有图片及生成脚本

**题面图片要求：**

凡题目涉及视觉化展示，必须按以下三分类选择工具，不得混用或降级：

| 图表类型 | 工具 | 操作要点 |
|----------|------|---------|
| 阶跃/脉冲响应、根轨迹、Bode 图、Nyquist 图、极点图、时域/频域曲线等仿真图 | **Python-control library**（`import control`）+ matplotlib | 用传递函数精确仿真，**不得手工构造数据点**；生成脚本保存为 `gen_<name>.py` |
| 系统方框图（含求和点、传函块、反馈回路）、信号流图 | **tikz-control-draw 技能** | 调用技能生成 TikZ/LaTeX 源码并编译为 PNG；脚本保存为 `gen_<name>.py` |
| 一般示意图（定性概念示意、非精确流程图、抽象原理图） | **AI 生成（明确注明）** | 在 `stem.md` 对应位置写 `<!-- AI_IMAGE: <主要描述> \| Prompt: <英文生图提示词> -->` 占位，**不嵌入实体图片文件** |

使用 Python-control 生成仿真图时的必要要求：
- 用 `control.tf()` 或 `control.ss()` 构建系统，用 `control.step_response()`、`control.bode_plot()`、`control.root_locus()` 等接口绘图
- 坐标轴必须有标签和单位；如有图例，字号 ≥ 10pt；图片尺寸建议 `(8, 5)` 英寸，DPI ≥ 150
- 题面文字中提到的特征（如"第一峰值约 1.25"）必须与仿真图中可见的形态严格一致

禁止的做法：
- 反例（禁止）："`曲线 A：t=1 s 时约为 0.63，t=2 s 时约为 0.86`"——此为文字描述响应曲线，必须用 Python-control 生成图片
- 反例（禁止）：用 matplotlib patches 手绘方框图——方框图必须用 tikz-control-draw 技能生成
- 题面 `stem.md` 中用相对路径引用图片：`![说明](assets/xxx.png)`

**答案与评分标准配图要求：**

- 如果标准答案描述了曲线形态、极点位置、时域/频域特征等，且**图片能使评分标准更清晰、更客观**，必须生成对应配图（如"参考响应草图""参考根轨迹图"）。
- 以下场景必须配图：学生被要求"画草图"的题（答案需提供参考草图）；涉及多种典型情形对比的题（答案需提供各情形的对比图）。
- 答案配图脚本命名为 `gen_answer_<name>.py`，放在 `assets/` 下，图片引用在 `final-package.md` 的"标准答案"或"参考作答"部分。

**答题仿真验证规则（作答智能体必须执行）：**

1. **计算结果必须仿真验证**：凡涉及传递函数、闭环极点、稳态误差、性能指标（超调量 $\sigma\%$、调节时间 $t_s$、峰值时间 $t_p$）等定量计算，作答智能体必须编写 Python-control 仿真脚本对结果进行数值验证，验证结论写入 `solver-N.json` 的 `validation_notes`，验证脚本保存到 `solvers/round-N/assets/verify_<solver_id>.py`。

2. **题面要求学生画响应图/仿真**：若题面含"画出系统的阶跃响应曲线""仿真验证设计结果"等要求，作答智能体必须用 Python-control 生成参考仿真图，保存到 `solvers/round-N/assets/`，并在 `solver-N.json` 的 `reference_plots` 字段列出文件名。

3. **题面要求学生画方框图/信号流图**：若题面含"画出系统方框图""绘制闭环信号流图"等要求，解题步骤中必须调用 tikz-control-draw 技能生成对应结构图，图片路径写入 `solver-N.json` 的 `reference_diagrams` 字段。

**公式格式要求：** 行内公式全部包裹在 `$...$` 中，行间公式包裹在 `$$...$$` 中，不得使用其他格式。

**出题阶段其他要求：**
- 题面必须自包含，不能写"参考讲义""见课程代码""见项目文件"。
- 评分标准必须逐步、可执行、可判分；避免"酌情给分"。
- 标准答案中的行内得分点必须直接嵌入答案正文，而不是只在答案外再列一份摘要；`inline_score_points`、答案正文中的行内分值和 `rubric` 总分必须一致。
- 若是计算题，可有不同推导路径，但数值结果必须可验证。

### 4. 裁判智能体选出备选题

裁判职责：
- 对比三题与题号规范是否一致，淘汰越界、模糊、不可判分的题
- **核验每张图片**：内容是否正确、字体/坐标轴是否可读、显示是否完整
- **核验公式格式**：公式格式不影响题目质量的排名，但如果选中的题面公式有格式问题，裁判必须在 `selected/` 中修正后再输出
- 选出最适合的备选题，解释另外两题不选的原因

裁判不得直接重写题面内容，只能选题、退回或要求重开一轮出题。如 3 题都不合格，重新启动 3 个出题智能体。

裁判输出格式、`image_checks` 和 `formula_fix` 字段详见 `references/output-contract.md`。

### 5. 运行 3 个独立的作答智能体

把 `selected/stem.md` 发送给 3 个独立的作答智能体，禁止读取出题稿中的标准答案。详见 `references/output-contract.md`。

### 6. 执行题型一致性判定

- 计算题（C）：最终数值结果必须一致，允许等价表达形式。
- 跨域题（X）：必须回答题面中所有分析项目，且总体方向基本一致。
- 设计题（D）：必须采用同样的设计路线，性能指标可不同，但需满足题目要求。
- 首轮或第二轮存在差异时，不按文风判断一致；按题型的核心锚点判断，并记录比例占优情况。

### 7. 处理首轮不一致

如 3 份作答不满足"大体一致"，再次启动三个智能体独立作答（第二轮同样禁止读项目文件和第一轮标准答案）。两轮后仍无法形成比例占优且大体一致的答案，判为"不稳定题"，不输出。

## 子代理提示词硬约束

给出题智能体或作答智能体的提示词时，始终包含：

```text
你只能读取当前任务提供的临时目录文件，禁止读取任何项目文件、仓库源码、已有题库、讲义、设计文档或其他题号的临时目录。
你可以编写和运行脚本，但脚本输入只能来自当前临时目录。
如果你发现题面信息不足，只能在当前任务包范围内做最小合理假设，并在输出中显式写出假设。
```

如果子代理违反以上限制，丢弃输出并重试。

## 最终输出要求

`final/final-package.md` 必须包含：
- 题号 / 题型 / 难度
- 最终题面（含图片引用）
- 图片资源清单
- 标准答案
- 分步评分标准
- 参考作答
- 裁判结论（含图片/公式核验记录）
- 一致性判定记录
- 是否经历第二轮作答

## Common Mistakes

| 错误 | 处理 |
| --- | --- |
| 让出题智能体直接读取框架或项目文件 | 只允许主代理读取框架，然后下发最小任务包 |
| 出题智能体图片存入共享 `assets/` 目录 | 每个智能体只能写入自己的 `drafts/draft-N/assets/` |
| 裁判自己改题内容 | 裁判只能选题或判废，公式修正除外 |
| 第一轮作答不一致就直接挑一个 | 必须再开第二轮 |
| 用"措辞相近"判断一致 | 按 C/X/D 的规则判，不按文风判 |
| 参考作答直接复用标准答案文本 | 参考作答要来自独立作答智能体 |
| 图片用描述性占位符（"[图]"） | 必须按三分类分别代码直出或 AI 占位注释，不可使用 "[图]" 等模糊占位符 |
| 题目要求观察/分析曲线，却以文字数值序列替代图片（如"t=1时y=0.63, t=2时y=0.86"描述响应曲线） | 必须用 Python-control 精确仿真生成图片；文字数值可作辅助说明，不能替代图片 |
| 响应曲线/Bode/根轨迹用 matplotlib 手工构造数据点绘制 | 必须用 `control.tf()` + `control.step_response()`/`control.bode_plot()`/`control.root_locus()` 精确仿真 |
| 方框图/信号流图用 matplotlib patches 手绘 | 必须调用 tikz-control-draw 技能，用 TikZ/LaTeX 生成 |
| 一般示意图嵌入了不可追溯的图片文件 | 一般示意图在 stem.md 中写 `<!-- AI_IMAGE: 描述 \| Prompt: ... -->` 占位，注明为 AI 生成 |
| 答案描述了响应特征/极点位置/草图要求，但没有配图 | 若题目要求学生"画草图"，答案必须附参考草图；若答案涉及多种典型情形对比，必须附对比图 |
| 计算题答案没有仿真验证 | 凡涉及定量计算（极点、性能指标等），作答智能体必须编写 Python-control 验证脚本，结论写入 `validation_notes` |
| 题面要求学生画响应图，但答案没有参考仿真图 | 作答智能体必须生成 Python-control 参考仿真图并填写 `reference_plots` |
| 题面要求学生画结构图，但答案没有参考结构图 | 作答智能体必须调用 tikz-control-draw 技能生成参考结构图并填写 `reference_diagrams` |
| 公式未用 `$` 包裹 | 强制规范：行内 `$...$`，行间 `$$...$$` |

## Resources

### scripts/

- `scripts/extract_homework_question.py`
  - 从 `course-content/syllabus-refactor/homework-framework.md` 按题号提取最小规范
  - 使用 `python3` 运行

### references/

- `references/output-contract.md`
  - 临时目录布局（固定根路径）、JSON 输出契约、图片/公式规范、裁判新增核验字段、最终产物格式

- `references/workflow-assemble.md`
  - 系列作业汇编工作流：触发条件、步骤、生成学生版/教师版 Markdown 和 docx

- `references/workflow-review.md`
  - 题目检查/更新工作流：检查维度、汇报格式、修改确认流程、同步更新已汇编作业
