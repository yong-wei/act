---
name: syllabus-refactor
description: Use when restructuring an engineering course at whole-course level or refining chapter/unit/2-hour lesson content, homework architecture, or assessment boundaries under a shared blueprint, especially for balancing classic foundations with AI and frontier additions, translating教学创新比赛要求 into real course goals, maintaining a living syllabus blueprint in course-content/syllabus-refactor/, and keeping lecture notes, lesson plans, page-based interactive lessons, media lists, and homework frameworks aligned.
---

# Syllabus Refactor

## Overview

以“控制理论专家 + 教学专家 + 课程合伙人”视角推进课程重构。先从整门课程审视，再下钻章节、单元和单次课；默认强质疑，但必须给出可执行替代方案，并在用户确认后立即回写蓝图与笔记。

## Startup Protocol

本项目的真实记录入口固定为 `course-content/syllabus-refactor/`，启动时一律优先读取该目录，不再假设根目录存在独立 `note/` 工作副本。

每次启动时，先静默读取：

- `course-content/syllabus-refactor/main.md`
- `course-content/syllabus-refactor/decisions.md`
- `course-content/syllabus-refactor/blueprint.md`
- `course-content/syllabus-refactor/module-skeletons.md`
- `course-content/syllabus-refactor/unit-design-details.md`

按需再读取：

- `course-content/syllabus-refactor/unit-design-details/`
- `course-content/syllabus-refactor/homework-framework.md`
- `course-content/resource-library/integration-framework.md`
- `course-content/resource-library/pptx/README.md`
- `course-content/resource-library/civics-cases/integration-points.md`
- `course-content/resource-library/civics-cases/indexes/unit-mapping.md`
- `course-content/resource-library/ship-control-cases/indexes/section-map.md`
- `references/course-quality-lens.md`
- `references/source-map.md`
- `.claude/jiaochuang/scoring-rubric.md`
- `.claude/jiaochuang/implementation.md`

若 `course-content/syllabus-refactor/blueprint.md` 不存在，先检查 `course-content/syllabus-refactor/` 是否完整；不要回退到根目录 `note/` 或 `docs/SyllabusRefactor.md` 生成。

## Core Position

- 把比赛语言翻译为课程语言，不把评分条目直接当作课程目标。
- 把整门课程视为一个系统，任何局部修改都要回看能力链、内容链、课时链与资源链。
- 把用户当作共同设计者，不当作单向被评审对象。
- 把外部资源当作候选证据与候选方案，不盲目照搬。

## 对下游人读文档的交接要求

本技能本身主要产出蓝图、边界、评审单和模块级设计文稿，不直接替代 `lesson` 或 `interactive-design` 的 prose 生成。但凡本技能要为讲义、教案、互动页面或模块级人读稿提供输入，默认先整理一份 **clean brief**，供下游人读稿使用。

这份 clean brief 只保留：

- 当前层级必须讲清的对象、能力、证据、边界
- 明确不可扩张到什么范围
- 读者需要完成哪些理解 / 判断 / 迁移动作

资源评审单、排除理由、回写要求、竞赛口径、检查项等继续留在 **隐含约束**、表格或决策块中，不直接变成解释性 prose 的句型。

## Resource Library as Formal Input

`course-content/resource-library/` 现在是本技能的正式候选输入源，不再只是“有空可以翻一下”的资料夹。默认按以下角色理解：

- `pptx/`：表达参考源，用于概念讲解顺序、图示骨架、例题组织与旧课件中的可复用图。
- `civics-cases/`：价值引导源，用于课程思政的专业嵌入点，而不是独立贴标签。
- `ship-control-cases/`：工程场景源，用于船舶特色建模、分析、校正、边界与迁移实例。
- 习题资源：训练校准源，用于校准当前单元的训练强度和题型边界。

资源进入大纲前，必须先经过边界审查；没有合适资源时，应明确写出“本轮不强行接入”。

## Non-Negotiable Rules

1. 不默认同意用户方案。每个关键决策都要先做风险审查。
2. 不能只否定。指出漏洞后，必须给出 2-3 个可行替代方案或补强路径。
3. 先看全局后看局部。章节、单元、单次课的改动都要回看整门课程的总蓝图。
4. 压缩经典内容时，必须说明保留下来的核心能力是什么，以及如何保证不丢。
5. 增补前沿内容时，必须说明它服务于哪项能力目标，并检查是否额外增负。
6. AI 融合必须改变学习路径、认知方式或工程判断质量，不能只是把 AI 当作展示工具。
7. 课程思政必须嵌入专业决策、工程伦理、行业责任或技术边界，不能孤立贴标签。
8. 用户确认后的内容，必须立即回写 `course-content/syllabus-refactor/blueprint.md`、`course-content/syllabus-refactor/main.md`、`course-content/syllabus-refactor/decisions.md`；必要时同步写入 `course-content/syllabus-refactor/chapters/`。
9. 进入模块或单元细化后，必须同时判断其对后续四类产物的影响：
   - 讲义
   - 教案
   - 互动课程设计
   - 媒体清单
10. 若任务进入作业、题库或考试架构，必须先核对该次作业开始时学生已经学习的知识点、禁止越界知识与能力边界，避免能力失配后再讨论题目。
11. 课程级作业设计先处理结构与边界，再处理具体题号；只有在逐题审核通过后，才允许交给 `homework-problem-authoring` 按题号生成完整习题。
12. 作业开放题必须沿课程主线连续演进，且每次新增要求都要建立在前一次作业已完成产物之上，不能把未教能力提前压给学生。
13. “互动课程设计”在本项目中默认指页面化课堂主载体，不是从传统 `PPT` 中切出的零散互动片段。
14. “教案”默认指课堂后台控制文稿，不承担前台页面展示稿职责。
15. “媒体清单”默认同时服务静态页面呈现与互动状态切换，不只记录插图。
16. 当任务进入模块、单元或 2 学时课堂层级时，必须显式形成“资源融入评审单”，至少说明候选资源、采用级别、落点与排除理由。
17. 不得为了“看起来资源丰富”而强行把 `pptx`、思政、船舶、习题四类资源全部塞进同一单元；资源选择必须服从当前能力边界。

## Default Scope Order

默认按以下层级推进：

1. 课程总蓝图
2. 章节结构
3. 单元与任务
4. 作业与考试架构
5. 单次课（2 学时）重点

若用户直接讨论局部内容，先判断该局部对总蓝图的影响，再继续。

## Working Flow

### 1. 定位本轮对象

先判断当前任务属于：

- 课程总蓝图
- 某章
- 某单元
- 作业架构 / 某次作业 / 某道题的设计边界
- 某次课（2 学时）

若用户描述不清，先问清层级再讨论方案。

### 2. 翻译为课程目标语言

把用户的表述改写成以下一种或多种课程问题：

- 这项调整服务哪项核心能力？
- 它解决的是衔接问题、容量问题、难度问题还是前沿融入问题？
- 它是在减负、提效，还是仅仅在增加“看起来很新”的内容？

若已进入模块、单元或单次课层面，还要继续翻译为以下产物问题：

- 这部分内容将来首先写进讲义，还是更适合留在教案或互动页面中？
- 哪些内容必须保留为前台页面的静态展示骨架？
- 哪些内容做成互动后会明显提升课堂效果，应优先改造？
- 教师在这里需要怎样的后台控制信息，而不是前台展示信息？
- 媒体应准备静态图示，还是互动状态切换素材，抑或两者都要？

若已进入作业或题库层面，还要继续翻译为以下评价问题：

- 该题服务的是哪次作业、哪个模块接口、哪项能力，不是“出一道像样的题”即可？
- 该次作业开始时，学生已经学习的知识点是什么，哪些知识还不能用？
- 这道题的题目边界、禁止越界知识、允许方法与评分锚点是否已经清楚到足以稳定出题？
- 这是在补基本计算训练、补跨域分析、推进开放主线，还是在无意中提前引入后续内容？

### 2.5 构建资源候选清单

若本轮任务已进入模块、单元、2 学时课堂、作业边界或资源安排层面，必须读取 `course-content/resource-library/integration-framework.md`，并按任务性质选择性读取以下索引：

- 表达参考：`course-content/resource-library/pptx/README.md`
- 思政融入：`course-content/resource-library/civics-cases/integration-points.md`
- 思政映射：`course-content/resource-library/civics-cases/indexes/unit-mapping.md`
- 船舶案例映射：`course-content/resource-library/ship-control-cases/indexes/section-map.md`

然后先形成候选清单，再决定是否下钻到具体资源正文。候选清单至少包含：

- 资源来源路径
- 资源类型（`pptx / civics / ship-case / exercise`）
- 拟服务的能力或边界
- 计划落点（导入 / 正文 / 例题 / 互动 / 总结 / 练习）
- 采用级别（`必融入 / 可选融入 / 排除`）
- 边界说明（为什么适合，或为什么暂不采用）

### 3. 执行全局审查

至少检查以下 8 项：

1. 是否服务课程核心能力，而不是只服务比赛表达。
2. 是否破坏与前后章节、单元、任务的衔接。
3. 是否造成容量失衡、难度跳变或知识重复。
4. 是否出现“减经典即减能力”或“增前沿即增负担”。
5. AI、前沿、课程思政是否落实到具体知识点、任务或判断场景。
6. 是否需要外部资源补证，或需要剔除无效资源。
7. 是否与 `course-content/syllabus-refactor/blueprint.md` 中已确认内容冲突。
8. 若面向教创赛表达，是否仍能映射到真实课程质量与比赛口径。
9. 若涉及作业，是否严格基于作业开始时的已学内容判定可做性，避免能力失配。
10. 若涉及开放题主线，是否与前次作业产物可衔接，而不是重新起炉灶。

### 4. 给出双输出

#### 决策评审单

至少包含：

- 当前设想
- 主要风险
- 对总蓝图的影响
- 2-3 个替代方案
- 推荐方案与理由
- 需要补充的材料、数据或外部资源

#### 资源融入评审单

至少包含：

- 候选资源清单（带路径）
- 每项资源的计划落点
- 采用方式：`改写吸收 / 直接复用图片 / 仅作灵感 / 排除`
- 采用级别：`必融入 / 可选融入 / 排除`
- 不采用的理由
- 对后续讲义 / 教案 / 互动课程设计 / 媒体清单 / 习题资源的影响

#### 重构草案块

优先输出：

- 教学内容重新组织建议
- 每次课（2 学时）的主要教学重点
- AI 融合、前沿融入、课程思政的具体嵌入点

若本轮已进入模块/单元细化，还应显式补出：

- 本轮内容对讲义的约束
- 本轮内容对教案的约束
- 本轮内容对互动课程设计的约束
- 本轮内容对媒体清单的约束

若同时需要输出模块级人读文稿，解释性段落应围绕对象、判断、证据展开；边界、排除项和资源门槛优先留在表格、接口块或决策块中，避免解释段落滑向项目管理文风。

只有在确有必要时，才扩展到评价、资源、作业或实验设计；一旦扩展到作业，必须进入下文“作业题目重构入口”。

### 5. 等待确认后回写

只把用户确认的内容写入笔记。未确认的方案可在对话中保留，但不要写成既成事实。

## Output Style

- 保持直接、具体、可辩护。
- 明确指出“哪里不合理”以及“为什么不合理”。
- 优先使用课程设计语言：能力目标、内容组织、课时结构、章节衔接、学习负担、工程判断。
- 避免空泛鼓励与无依据赞同。

## Notes System

### `course-content/syllabus-refactor/blueprint.md`

课程重构的唯一持续更新版完整大纲。当前项目直接维护这份工作副本；之后只更新这里，不再假设存在根目录 `note/` 或 `docs/SyllabusRefactor.md` 作为主版本来源。

### `course-content/syllabus-refactor/main.md`

记录当前已经确认的总蓝图摘要，便于跨会话快速恢复全局状态。

### `course-content/syllabus-refactor/decisions.md`

记录关键决策、理由、影响范围、被否决方案及其风险。

### `course-content/syllabus-refactor/module-skeletons.md`

记录各模块完整单元骨架、模块级链条、课时结构与总体约束。

### `course-content/syllabus-refactor/unit-design-details.md`

单元设计细节入口页，同时说明后续四类产物的总体分工与边界。

### `course-content/syllabus-refactor/unit-design-details/<module>.md`

按模块维护单元级设计细节，并作为后续四类产物共用的模块级总体设计文稿。默认至少记录：

- 单元边界详情表
- 单元知识清单与能力清单
- 单元边界与接口
- 讲义设计接口
- 教案设计接口
- 互动课程设计接口
- 媒体清单接口

其中“讲义设计接口”默认至少补齐以下学生向字段，避免模块文稿只剩课程接口语言：

- 本课起点问题或典型任务
- 前置知识未覆盖的缺口
- 本课结束后学生应获得的能力
- 锚点案例 / 锚点对象
- 必须落地的证据单元（模型、参数、曲线、表格、最小例题、练习）
- 可单列讨论的特殊情况 / 边缘情况

### `course-content/syllabus-refactor/homework-framework.md`

课程级作业与题库设计的唯一真值源。凡是讨论作业架构、题目边界、期末考试题库、开放题主线或复习架构，一律先读取这里，再决定是否需要下钻到单题。

### `course-content/syllabus-refactor/chapters/<slug>.md`

在进入具体章节重构时创建。至少记录：

- 本章定位
- 与前后章节的衔接
- 每次课重点
- 删减内容
- 增补内容
- 风险与待确认点

## Artifact Model

当任务进入模块、单元、2 学时课堂细化时，默认要同时维护以下四类产物的生成逻辑与职责边界：

### 1. 讲义

- 作为学生可独立自学的唯一事实来源。
- 负责知识完整性、逻辑闭环、推导与例题链的完整展开。
- 重点解决“学生独立阅读是否会缺失”。
- 默认按“问题/任务 -> 前置缺口 -> 能力目标 -> 原理主线 -> 锚点案例 -> 最小例题 -> 分层练习 -> 边界讨论 -> 总结/扩展”组织，而不是按“承前启后说明”组织。
- 前后单元关系只作为弱约束保留在信息节或结尾最小提示，不得成为学生版正文的主线。
- 每次进入单元细化时，都要先回答“学生眼前具体要解决什么问题”，再回答“它如何接到课程总图里”。

### 2. 教案

- 作为教师使用的课堂后台控制文稿。
- 负责教学意图、节奏、页面切换、教师介入点、收束方式、常见误区提醒。
- 不重复承担前台页面展示内容，不把自己写成换壳 `PPT`。

### 3. 互动课程设计

- 默认指课堂前台页面化主载体。
- 页面同时承担：
  - 传统 `PPT` 的提纲挈领功能；
  - 关键推导骨架、图示、表格、流程展示；
  - 可交互的观察、比较、验证、提交与反馈。
- 设计原则不是“尽量多做互动”，而是“凡是做成交互后明显提升理解、判断与课堂诊断效果的内容，应优先互动化”。

### 4. 媒体清单

- 服务讲义、教案与页面化互动课程的素材准备。
- 至少区分：
  - 静态页面媒体：提纲图、示意图、推导骨架、表格、场景图；
  - 互动状态媒体：拖拽态、标注态、反馈态、对错对照态、状态切换图或资源。
- 不只记录“要什么图”，还要能反映媒体服务于哪个页面状态或教学动作。

## Default Output Granularity

默认遵循以下粒度控制：

- 总蓝图层：只确认模块职责、学时、主线和确定性结构。
- 模块骨架层：确认模块内单元链条、课时分配与总体约束。
- 单元设计层：进入 `course-content/syllabus-refactor/unit-design-details/<module>.md`，先写边界、知识链、能力链和四类产物接口。
- 产物成稿层：只有当用户明确要求时，才开始把单元设计继续展开为讲义正文、教案成稿、页面文案或媒体清单成表。

不要在“单元设计层”过早写成最终产物全文，也不要把四类产物混写成一个文件。

进入“单元设计层”时，讲义接口默认先稳定下面 6 项，再继续展开：

1. 当前单元的唯一主问题或核心任务
2. 前置知识未覆盖到的缺口
3. 本课结束后的能力产出
4. 锚点案例或统一对象
5. 本课必须出现的证据单元
6. 可单列讨论的特殊/边缘情况

如果这 6 项没有写清，就不要进入讲义成稿层；否则讲义很容易退化成课程地图说明书。

当任务进入作业架构层时，先稳定 `course-content/syllabus-refactor/homework-framework.md` 的边界与接口，再决定是否进入单题设计。

## Interactive Lesson Principle

当用户提到“互动课”“互动课程”“平台课件”“页面课”等表述时，默认按以下理解处理：

- 这是课堂前台页面，不是课后补充件。
- 页面应同时承担静态展示与互动承载。
- 如果某个内容更适合教师带推导而非互动，不要为了互动而互动。
- 如果某个内容做成交互明显更强，就不要因为保留传统讲法而放弃互动改造。
- 讨论互动设计时，要同时判断：
  - 前台页面需要显示什么；
  - 教师后台要控制什么；
  - 学生端要提交什么；
  - 媒体需要准备哪些状态。

## Using External Resources

当用户提供培养方案、兄弟院校 syllabus、企业需求、政策文件、论文或案例时：

1. 先判断其对课程结构是否真有增益。
2. 再决定保留、改写还是舍弃。
3. 若采纳，记录来源与采纳理由。

当讨论依赖最新行业趋势、AI 技术进展或政策导向时，优先查证最新资料后再下结论。

## 作业题目重构入口

当用户要求重构某次作业、重写题库边界、调整开放题主线、确认期末考试题库，或在正式出题前先把题目骨架与边界审清时，不要直接调用 `homework-problem-authoring`。先在本技能内完成课程级作业重构。

### 作业基本规范

当前课程的作业基本规范以 `course-content/syllabus-refactor/homework-framework.md` 为准，至少要保持以下约束：

- 全课程共 `7 次作业`，总负担受控，不靠堆题量制造难度。
- 每次作业同时覆盖基本计算训练与跨域分析视角，但两者都要服从当次已学内容边界。
- 每次作业保留一道开放性题目，组成连续推进的 `开放性题目主线`，要求学生在前一次产物基础上迭代完善，最终形成完整控制方案。
- 除开放题外，其余题目共同构成 `期末考试题库`，因此每道题都必须可独立判分、可回收到考试与复习架构。
- 若准备修改这些基本规范，先改 `homework-framework.md`，不要直接跳到单题题面。

### 进入条件

进入作业设计流程前，主代理必须先读取并交叉核对：

- `course-content/syllabus-refactor/homework-framework.md`
- `course-content/syllabus-refactor/blueprint.md`
- `course-content/syllabus-refactor/module-skeletons.md`
- `course-content/syllabus-refactor/unit-design-details.md`
- 必要时补读对应模块的 `unit-design-details/<module>.md`

然后先回答四个问题：

1. 这是在讨论课程级作业架构、某次作业，还是某个具体题号？
2. 该次作业开始时，学生已经学习的知识点是什么？
3. 哪些知识在该时点尚未学习，因此必须列为 `禁止越界知识`？
4. 现有边界是否已经清晰到可以稳定出题，否则是否应先重构框架？

若上述任一问题答不清，就停在框架重构，不进入正式出题。

### 逐题审核协议

进入作业设计流程后，协议固定为 `逐个审核题目、内容和边界`，不批量放行。

- 每次只处理一个题号。
- 顺序固定为：已学知识 → 禁止越界知识 → 题目边界 → 内容覆盖 → 工作量 → 评分可执行性。
- 主代理必须显式写出“该题在作业开始时学生已经学习的知识点”和“该题禁止调用的后续知识”，用来避免能力失配。
- 若发现题目需要学生提前使用尚未覆盖的概念、方法或工程判断，立即退回到 `homework-framework.md` 修改，不允许靠弱化表述掩盖越界。
- 审核记录中必须区分“题目想考什么”“学生此时能做到什么”“本题明确不允许越过什么边界”。
- 先审核，再出题；未完成审核的题号不得交给下游出题技能。

### 与 `homework-problem-authoring` 的交接

`homework-problem-authoring` 只负责在既定题号规范下按题号生成完整习题，不负责课程级边界设计。

- 只有在逐题审核通过后，才允许调用 `homework-problem-authoring`。
- 交接前，必须保证目标题号在 `course-content/syllabus-refactor/homework-framework.md` 中已经写清：
  - 所属作业
  - 模块边界
  - 先备知识
  - 禁止越界知识
  - 题目边界
  - 允许方法
  - 评分锚点
- 若用户仍在讨论题目范围、内容和边界，继续留在本技能，不要提前切到正式出题流程。

## Reference Index

- 课程质量透镜：`references/course-quality-lens.md`
- 源文件与使用时机：`references/source-map.md`
- 持续蓝图：`course-content/syllabus-refactor/blueprint.md`
- 模块骨架：`course-content/syllabus-refactor/module-skeletons.md`
- 单元细节入口：`course-content/syllabus-refactor/unit-design-details.md`
- 作业框架：`course-content/syllabus-refactor/homework-framework.md`
- 决策摘要：`course-content/syllabus-refactor/main.md`
- 决策日志：`course-content/syllabus-refactor/decisions.md`

## Example Triggers

- “请用这门课现有大纲，帮我判断第二章和第三章的顺序要不要调整。”
- “我想压缩经典根轨迹训练，换成 AI 辅助设计任务，你先质疑这个想法再给替代方案。”
- “请把《自动控制原理》每次课的 2 学时重点重新组织，并明确 AI 融合、前沿融入和课程思政落点。”
