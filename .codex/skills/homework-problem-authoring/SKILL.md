---
name: homework-problem-authoring
description: Use when the user asks to create homework or exam problems by question ID such as `T1-1` from `course-content/syllabus-refactor/homework-framework.md`, especially when another Codex instance must run a multi-agent draft-judge-solve workflow with anti-cheating file-access limits and produce the final stem, answer, scoring rubric, and reference solution.
---

# Homework Problem Authoring

## Overview

按 `course-content/syllabus-refactor/homework-framework.md` 中的题号生成完整习题。主代理负责读取框架、构造最小任务包、组织多智能体流程；出题智能体和作答智能体只允许读取主代理写入的临时文件，不允许读取项目文件，避免直接抄用仓库内容。

把这个技能当作“出题编排器”，不是单次直接写题。默认产物必须包含：
- 题面
- 标准答案
- 行内得分点
- 分步评分标准
- 参考作答
- 裁判结论与一致性记录

其中：
- `inline_score_points` 用于把答案内部逐步标分显式结构化保存，保留“行内得分点”命题方式；
- `rubric` 用于独立评分指南，与 `inline_score_points` 并存，不互相替代。

## Quick Start

1. 用 `python3 .codex/skills/homework-problem-authoring/scripts/extract_homework_question.py --framework course-content/syllabus-refactor/homework-framework.md --question-id T3-2` 抽取题号对应的最小题目规范。
2. 为每个题号创建独立临时目录。
3. 启动 3 个独立的出题智能体，分别写 `draft-1.json`、`draft-2.json`、`draft-3.json`。
4. 让裁判智能体只读取任务包和 3 份候选稿，选出一个备选题面。
5. 把备选题面发给 3 个独立的作答智能体，分别写 `solver-1.json`、`solver-2.json`、`solver-3.json`。
6. 按题型执行一致性判定；不一致时，再次启动三个智能体独立作答。
7. 在答案大体一致且比例占优的答案中，选择步骤最清晰的一份，连同题面一起输出最终产物。

如果用户一次给出多个题号，对每个题号分别跑完整流程，不要把多题混在同一个临时目录里。

## Workflow

### 1. 抽取题号规范

只让主代理读取项目内的作业框架文件。运行 `extract_homework_question.py` 后，拿到：
- `question_id`
- `question_type`
- `difficulty`
- `title`
- `assignment`
- `module_units`
- `question_positioning`
- `ability`
- `prerequisites`
- `forbidden_knowledge`
- `boundary`
- `stem_contract`
- `parameterization_policy`
- `allowed_methods`
- `scoring_anchors`
- `common_pitfalls`
- `synopsis`
- `why_for_exam`
- `source_excerpt`

然后由主代理补充一个最小任务包，只保留出题需要的内容：
- 题号与题型
- 所属作业与对应模块边界
- 题目梗概
- 考查能力
- 先备知识
- 禁止使用知识
- 题目边界
- 题面构成要求
- 难度
- 是否允许设置数值参数
- 允许解法范围
- 评分锚点
- 输出格式要求
- 本技能规定的一致性标准

不要把整个项目目录、其他题号内容、已有答案、仓库源码路径一并塞给子代理。

### 2. 创建临时目录并固定交接物

为每个题号创建单独的临时目录。推荐形如：

```text
<temp-root>/T3-2/
```

目录布局与文件格式使用 [references/output-contract.md](references/output-contract.md)。

硬约束：
- 出题智能体和作答智能体只允许读取该题号对应的临时目录。
- 子代理提示词里明确写“禁止读取项目文件、仓库源码、已有题库、讲义、设计文档、其他题号的临时目录”。
- 允许编写和运行脚本，但脚本输入只能来自当前临时目录。
- 如果子代理答案引用了项目内文件、仓库路径或未授权来源，直接判无效并重跑该角色。

### 3. 运行 3 个独立的出题智能体

主代理分别向 3 个出题智能体发送同一份 `task-package.json`，但不得让它们读取彼此结果。每个出题智能体必须输出：
- 完整题面
- 标准答案
- 行内得分点
- 分步评分标准
- 关键易错点
- 自检结论：题面是否自包含、是否可判分、是否满足题型

出题阶段要求：
- 题面必须自包含，不能写“参考讲义”“见课程代码”“见项目文件”。
- 评分标准必须逐步、可执行、可判分；避免“酌情给分”。
- 若是计算题，可以有不同推导路径，但数值结果必须可验证。
- 若是跨域题，题干中列出的分析项目必须都能落到答案里。
- 若是设计题，必须明确设计目标、允许的自由度和验收口径。

### 4. 让裁判智能体选出备选题

裁判智能体只读取：
- `task-package.json`
- `draft-1.json`
- `draft-2.json`
- `draft-3.json`

裁判职责：
- 比较三题与题号规范是否一致
- 淘汰越界、模糊、不可判分、答案不稳定的题
- 选择一个最适合要求的备选题
- 解释为什么另外两题不选

裁判不得直接重写题面；只能选择、退回或要求重开一轮出题。如果 3 题都不合格，重新启动 3 个出题智能体，而不是自己“缝合”一题。

### 5. 运行 3 个独立的作答智能体

把裁判选出的备选题面单独写入临时文件，再发送给 3 个独立的作答智能体。作答智能体禁止读取：
- 项目文件
- 原始框架文件
- 任意出题稿中的标准答案
- 其他作答智能体的结果

作答智能体允许：
- 阅读 `selected-draft.json` 中的题面
- 编写脚本进行数值、符号或逻辑验证
- 把分析过程与最终答案写回当前临时目录

### 6. 执行题型一致性判定

使用以下标准，不要自行改写：

- 计算题（C）：
  规范化过程可有不同，但最终数值结果必须一致；允许等价表达形式。
- 跨域题（X）：
  必须回答题面中所有分析项目，且总体方向基本一致，例如都判断“变大/变差/更快/更慢”；具体表述可不同。
- 设计题（D）：
  必须采用同样的设计路线，例如选择同样的控制器结构；设计结果的性能指标可以不同，只要满足题目要求即可。

裁判在判定一致性时，不看“写法像不像”，只看是否满足以上标准。

### 7. 处理首轮不一致

如果 3 份作答不满足“大体一致”，再次启动三个智能体独立作答。第二轮仍然禁止读项目文件，也不能看第一轮标准答案。

第二轮后：
- 只在答案大体一致的候选中做选择
- 选择比例占优的一组答案
- 在该组中挑选步骤最清晰的一份作为参考作答

如果两轮作答后仍无法形成占优且大体一致的答案，判该题为“不稳定题”，不要输出为正式题目。

## 子代理提示词硬约束

给出题智能体或作答智能体的提示词时，始终包含这些句子：

```text
你只能读取当前任务提供的临时目录文件，禁止读取任何项目文件、仓库源码、已有题库、讲义、设计文档或其他临时目录。
你可以编写和运行脚本，但脚本输入只能来自当前临时目录。
如果你发现题面信息不足，只能在当前任务包范围内做最小合理假设，并在输出中显式写出假设。
```

如果子代理违反以上限制，丢弃输出并重试，不要“带着污染结果继续往下走”。

## 最终输出要求

最终交付必须包含：
- 题号与题型
- 最终题面
- 标准答案
- 行内得分点
- 分步评分标准
- 参考作答
- 裁判为何选择该题
- 一致性判定记录
- 是否经历第二轮作答

推荐把最终交付写成 `final-package.md`，同时保留机器可读的 JSON 产物。

## Common Mistakes

| 错误 | 处理 |
| --- | --- |
| 让出题智能体直接读取框架或项目文件 | 只允许主代理读取框架，然后下发最小任务包 |
| 裁判自己改题 | 裁判只能选题或判废，不能代写 |
| 第一轮作答不一致就直接挑一个喜欢的答案 | 必须再开第二轮 |
| 用“措辞相近”判断一致 | 按 `C/X/D` 的规则判，不按文风判 |
| 参考作答直接复用标准答案文本 | 参考作答要来自独立作答智能体 |

## Resources

### scripts/

- `extract_homework_question.py`
  - 从 `course-content/syllabus-refactor/homework-framework.md` 按题号提取最小规范
  - 使用 `python3` 运行

### references/

- `references/output-contract.md`
  - 定义临时目录布局、JSON 输出契约和最终产物格式
