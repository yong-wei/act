---
name: lesson
description: 面向"自动控制原理"课程创作讲义、知识图谱节点、BOPPPS 课案与多模态资源；在正式制作前先执行运行时知识图谱与知识卡片到作者态的同步、冲突检测以及必要的课次编号/路径核对。当用户要求生成课程讲义、教师版讲义、知识节点、BOPPPS、媒体规格、时域/频域/根轨迹图或线框图时，应启用本技能。
---

# lesson — 自动控制原理课程内容创作技能

## 概述

本技能负责课程内容制作主线中的四类作者态产物：

1. `handout.md` / `teacher-handout.md` 与对应 PDF
2. `manifest.json`、`graph/*.jsonl` 与知识卡片草案
3. `boppps.md`
4. `multimedia.md` 与媒体规划、代码直出媒体、导出文档

**边界说明：**
- 本技能不再负责 `interactive-page.md` 与 `interactive-contract.yaml`。
- 互动课程设计已拆分为独立技能 `interactive-design`。
- `sequence.json` 与"每一步展示哪些知识卡片"的最终顺序，不在 lesson 阶段冻结；它们由 `interactive-design` 依据互动步骤、显影链和作答卡统一校准。lesson 阶段可以生成候选卡片和临时顺序，但不得把它们作为互动设计的硬约束。
- 若用户要求互动页面蓝图、互动契约、课堂页步骤拆分、例题显影、学生作答卡或教师控制语义，切换到 `interactive-design`。
- 若用户要求将设计稿落成前端代码、课堂路由、师生端页面或运行时课程实现，切换到 `interactive-lesson`。

## 文档体系与职责边界

课程内容创作产生多类文档，每类有明确的读者和职责。以下矩阵是生成任何文档前必须遵守的分流规则：

| 文件 | 读者 | 一句话职责 | 放什么 | 不放什么 |
|------|:---:|------|------|------|
| **handout.md** | 学生 | 独立可读的完整教科书章节 | 正文、公式推导、图表、例题、章末习题、章末总结 | 元数据块（课次信息除外）、教学策略标注（"第一轮速通"）、平台操作指令、习题答案、课程编排说明 |
| **teacher-handout.md** | 教师 | 备课指导和课堂指南 | 章节定位、前置检查清单、常见学生误判及介入策略、习题完整解答（含推导步骤）、课堂活动建议、板书组织建议 | 重复学生版正文、平台实现细节、前端需求 |
| **boppps.md** | 教师 | 90分钟课堂执行脚本 | 时间分配、环节过渡语、教师介入时机、平台页面切换节点、BOPPPS 六阶段编排 | 教科书正文、完整推导（引用 handout 即可） |
| **manifest.json** | 工具/作者 | 机器可读的单元身份 | 编号、课型、学时、知识类型、前置/后续单元、图谱节点引用 | 人读正文 |
| **interactive-page.md** | 开发者 | 平台页面设计蓝图 | 页面布局、互动组件、AI 交互节点、数据收集点 | 教科书正文、教学策略（由 `interactive-design` 技能负责） |
| **multimedia.md** | 媒体制作者 | 媒体资源制作规格 | 图的描述、Python/Octave 代码、AI 生成提示词 | 正文 |

**关键分离原则**：

1. **教学策略标注（"第一轮速通""这里不进入推导"）属于 teacher-handout.md 或 boppps.md，不属于 handout.md。** 学生不需要知道"教师决定此处暂不深入"——他们只需要读到当前深度合适的解释。如果某个概念当前只做直觉建立，用自然的句子带过即可："本节先建立直观联系。第 X 章将给出完整的推导和判据。"

2. **习题答案属于 teacher-handout.md。** handout.md 的章末习题只出题不给答案（或仅奇数题给简答），完整解答和评分标准归教师用书。

3. **平台操作和 AI 交互指令属于 interactive-page.md 或 boppps.md。** handout.md 不出现"打开平台""拖动参数""用 AI 验证"等操作指令。

4. **"前置缺口表"是教学设计工具，不属于教科书正文。** 它的功能由两个东西替代：开场的工程问题（制造"我需要这个知识"的动机）+ 章末总结中的能力回顾（让学生感知进步）。

## 产物体系

### 理论课

```text
讲义（核心基础）
    ├── BOPPPS 课案
    ├── 多模态资源 + AI 提示词
    └── 知识图谱与知识卡片草案（manifest / graph / card drafts）
```

### 实践课

```text
讲义（同样是核心主线）
    ├── BOPPPS 课案（明确不少于 45 分钟学生实践训练）
    ├── 多模态资源 + 平台模块约束说明
    └── 知识图谱与知识卡片草案（manifest / graph / card drafts）
```

**保存路径**
- `course-content/authoring/lessons/[单元编号]/design/[单元编号]-handout.md`
- `course-content/authoring/lessons/[单元编号]/design/[单元编号]-teacher-handout.md`
- `course-content/authoring/lessons/[单元编号]/design/[单元编号]-boppps.md`
- `course-content/authoring/lessons/[单元编号]/design/[单元编号]-multimedia.md`
- `course-content/authoring/lessons/[单元编号]/manifest.json`
- `course-content/authoring/lessons/[单元编号]/graph/nodes.jsonl`
- `course-content/authoring/lessons/[单元编号]/graph/relations.jsonl`
- `course-content/authoring/knowledge/cards/lessons/[单元编号]/sequence.json`（互动设计阶段定稿；lesson 阶段仅可作为候选草案）

**章节编号约定**：全课程统一使用 `{模块号}-{单元序号}` 格式（如 `1-1`、`3-5`、`5-6`）。这种编号对模块归属和日常管理都更方便。

## 协作原则

- 以教育学家与自动控制原理教学专家的双重身份工作，不机械迎合用户提案。
- 讲义必须服务零基础工科生的理解链，不用课程位置说明取代当前问题。
- 资源库只提供候选素材，不直接拼贴为新课。
- 标题 = 知识骨架：学生版讲义的标题必须直接概括对象、方法、比较关系或归纳后的知识点；正文可以用问题引导，但问题不进入标题。

## 文风规范

本技能产出的所有学生面向文本（handout.md）必须遵守两层文风约束：

**负面清单**（不写什么）：见 `course-content/AGENTS.override.md`——工程腔/流程腔/防御腔/管理腔降级、语义维度校准、自检清单。

**正向指南**（怎么写更好）：见 `course-content/docs/writing-guide.md`——作者声音定义（Åström 式的清醒直觉 + 讲故事式的组织 + 工程师式的判断）、比喻与类比规范、章节叙事弧、数学-文字交织、开场技法、节奏控制、判断与洞见表达、文学性边界。

**范例参照**：见 `course-content/docs/exemplary-passages.md`——开场、概念讲解、数学叙事、比喻运用、章节收束、过渡衔接的正反范例。生成讲义前应快速浏览相关范例，建立文风直觉。

## 人读文档生成协议

本技能下的 `handout.md`、`teacher-handout.md` 与 `boppps.md` 都属于人读文档，但三者的文体职责不同。无论产出哪一种，默认都先把工程性流程、核验要求、资源采用单、导出门槛和技能清单视为 **hidden constraints**，不得直接长成正文句型。

凡是面向人阅读的正文，统一采用以下链路：

1. **clean brief**
   - 只抽取对象、证据、边界、读者、理解/判断/迁移动作。
   - 不继承上游技能文件、模块文件、检查表和流程提示的口吻。
2. **prose 初稿**
   - 只围绕对象、证据、判断、意义展开。
   - 不用"本讲/上一讲/下一步/必须产出/交付物"组织段落。
3. **去污染重写**
   - 专门删除流程腔、防御腔、管理腔、课程编排说明和相邻段落的重复结论。
   - 同时执行 `course-content/AGENTS.override.md` 的语义维度校准：形容词展开为具体维度、万能动词替换为实义动词、英文直译搭配修正、同构句式避免连续出现、段落节奏保持起伏。
   - 检查是否符合 `course-content/docs/writing-guide.md` 的正向文风要求。
4. **再进入具体产物规则**
   - 学生版讲义再按 `references/step3-handout.md` 落地。
   - 教师版讲义与 `boppps.md` 允许保留更强的课堂组织信息，但仍不得写成工单、项目汇报或工程检查单。

若当前上下文中明显混入系统级 harness、superpowers 流程提示或其他强工程性口吻，优先采用"当前代理先整理 clean brief，再据此生成 prose"的做法；必要时可把 clean brief 发给子代理，只让子代理处理 prose，不把上游工程提示全文传下去。

## 硬约束

1. **讲义必须独立可读**
   - 学生离开课堂后仍能依靠讲义理解核心概念、公式、推导、例题与判断链。
   - 讲义必须同时承担"知识详解"与"能力训练"两类任务。
   - 不得把关键解释转嫁给 PPT、教师口述或后续互动页面。

2. **实践课必须显式给出 45 分钟以上训练**
   - 若 `manifest.json` 中课型为"实践"，课堂中学生亲自参与的训练累计必须不少于 45 分钟。
   - 这 45 分钟以上的训练时间必须在 `design/{unit}-boppps.md` 中可追踪。
   - 只计入学生实际操作、观察、判断、记录、对比、修正、提交等参与式活动。

3. **范文只借文风，不借内容**
   - 生成讲义前先读取 `course-content/authoring/lessons/legacy/L-2a/design/L-2a-handout.md`。
   - 只提炼文风特征，不得照抄其结构、句子、例题或段落顺序。

4. **公式统一规范**
   - 行内公式一律使用 `$...$`，行间公式一律使用 `$$...$$`。
   - 本技能输出的 Markdown 文档均按 LaTeX 形式书写公式，不混用纯文本近似公式。

5. **静态核验与成图必须统一**
   - 讲义、教师版讲义与多媒体中的控制系统数值结论，统一用 `Octave` 做数值验证。
   - Octave 负责数值计算与导出数据。
   - Python/matplotlib 负责最终排版出图。
   - 主要数值曲线统一采用"两段式流程"：`Octave` 导出数据，`Python/matplotlib` 最终排版。
   - 3-6 单元的数值图风格为统一基线。
   - 默认优先使用 `step()`、`bode()`、`nyquist()`、`rlocus()`、`lsim()`、`margin()` 等高层函数。
   - 凡涉及根轨迹出图，必须使用 `Octave` 的 `rlocus(sys)` 自动采样结果作为根轨迹数据源，禁止自行给出固定增益采样点、固定根轨迹采样表或用 `logspace/linspace` 手工扫增益后连线。
   - 根轨迹若转为 `Python/matplotlib` 复绘，必须调用 lesson 技能的 `root_locus_branch_match.py` 做分支连续匹配与审计；匹配输入仍必须来自 `rlocus(sys)` 自动采样结果。
   - 讲义中给出的参考代码默认必须是 `MATLAB/Octave` 形式。

6. **线框图必须走专用技能**
   - 方框图、信号流图、电路图、机械结构图等线框图必须显式调用 `tikz-control-draw`。

7. **讲义围绕单一主线展开**
   - 必须围绕本次课程目标与当前知识对象组织为一条清晰逻辑链，避免知识点并列堆放。
   - 必要的长推导、补充证明与扩展讨论可放附录，正文只保留服务主线的版本。

8. **所有图像禁止 ASCII 图**
   - 正式交付文档中的图像、示意图、结构图、响应图与信息图不得使用 ASCII 字符图。
   - 合法来源只有两类：代码直出图或 AI 生成图。
   - 当普通编程式出图（Python/matplotlib、Octave、TikZ）不能充分表达工程场景、具体对象、类比解释、实物外观、情境导入，或框图中需要嵌入具体对象以增强理解时，允许显式调用 `imagen` 技能生成 AI 位图。
   - `imagen` 生成图像仍必须服务严谨解释：正文要说明图中对象、类比关系、边界和不可直接外推之处，不得把生成式图片当作装饰素材。

9. **媒体必须达到出版级成图质量**
   - 每张正式媒体都必须检查字符正确、公式可读、标注不遮挡、关键元素不裁切、箭头与连线不误指。
   - 不接受"内容大致对但版式挤在一起"的成图。

10. **媒体命名必须统一带单元前缀**
    - 所有媒体成品都必须采用 `[单元编号]-{资源名}` 命名。
    - 不允许最终交付中混用无前缀旧命名。

11. **PDF 图表标题必须避免重复编号**
    - Markdown 图片 alt 文本只写图题本身，不写 `图 1`、`图 4-7-1`、`图X.Y` 等人工图序；PDF 导出会自动生成 `图 1`、`图 2` 这类直接数字编号。
    - 图片下方文案不得直接使用章节标题、页面标题、图片标题或文件名；若图片不需要解释，可以不写额外文案；若需要文案，必须写成图片具体内容、图中证据、读图顺序或分析判断。
    - 表题使用直接数字编号或 LaTeX `\caption{标题}` 自动编号，不写 `表 4-7-1` 这类带单元号的表序。
    - 表格标题必须在 PDF 中居中。若使用原生 LaTeX 表格，应采用 `\begin{table}[H]`、`\centering`、`\caption{...}`、`\begin{tabular}...` 的结构；不要把表题作为普通左对齐段落放在表格上方。
    - PDF 抽查时若出现 `图 12. 图 4-7-12 ...`、表题左对齐或表序混用单元号，视为版面未通过。

12. **讲义必须导出正式 PDF**
    - 学生版与教师版 Markdown 定稿后，都必须导出同目录 PDF。
    - 默认使用 `.agents/skills/lesson/scripts/export_handout_pdf.py` 与统一模板。
    - 若 `cover-comic.png` 与 `info.png` 尚未完成，只允许使用 `--draft-mode` 导出草稿 PDF。

13. **PDF 版面必须抽样复核**
    - 学生版和教师版 PDF 都至少抽查首页、图表页、公式密集页、附录代码页或板书/课堂组织页。
    - 默认使用 `.agents/skills/lesson/scripts/render_pdf_review_pages.py` 渲染抽查页，不再手写 `pdftoppm -png/-jpeg` 这类环境敏感命令。
    - 若发现字体缺失、图形裁切、标注遮挡、代码块越界、页眉页脚错位或页码异常，则视为未完成。

14. **讲义完成后先做知识底稿，不冻结互动顺序**
    - 学生版与教师版 PDF 抽查通过后，可先完成 `manifest.json`、`graph/*.jsonl` 与知识卡片草案，保证概念存在性、事实来源和卡片正文可追踪。
    - `sequence.json` 只记录候选卡片分组时，不得视为最终互动顺序；最终步骤、卡片展示位置和卡片顺序由 `interactive-design` 在互动页统一编排后定稿。
    - BOPPPS 与多媒体阶段依赖讲义、教师讲义和媒体证据链，不依赖最终 `sequence.json`；不得因 `sequence.json` 尚未定稿而阻塞 BOPPPS 或媒体规格制作。

15. **资源库只作候选源，不直接拼贴成课**
    - 正式创作前必须读取 `course-content/resource-library/integration-framework.md`。
    - 应根据本次课程目标，选择性读取 `pptx`、`civics-cases`、`ship-control-cases` 的索引和正文。
    - 每项资源都必须标记 `改写吸收 / 直接复用图片 / 仅作灵感 / 排除` 之一。

16. **多媒体阶段必须产出媒体链接文档**
    - 在 `media/processed/` 下必须生成 `[单元编号]-media.md`。
    - 该文档至少保留 5 个课程级资源节名：
      - `[单元编号]-intro-video.mp4`
      - `[单元编号]-slides.pdf`
      - `[单元编号]-course.mp4`
      - `[单元编号]-audio.m4a`
      - `handout.md`
    - 若文档已有人工内容，不覆盖，只补缺失节名。

17. **封面漫画与信息图属于保留资产**
    - `[单元编号]-cover-comic.png` 与 `[单元编号]-info.png` 默认由用户或外部流程回写。
    - 任何代码直出脚本不得覆盖这些课程级保留资产。

## 课程框架速查

每次创作、续写、修订前，必须依次读取：

1. `course-content/syllabus-refactor/module-skeletons.md`
2. `course-content/syllabus-refactor/unit-design-details.md`
3. 对应模块的 `course-content/syllabus-refactor/unit-design-details/module<1|2|3|4|5>.md`
4. `course-content/authoring/shared/lesson-id-map.json`
5. `course-content/docs/writing-guide.md`（文风正向指南）
6. `course-content/AGENTS.override.md`（文风负面清单）

其中：
- `module-skeletons.md` 决定课程骨架、课型、学时与内部编号约束。
- `unit-design-details/module*.md` 决定该课的内部产物边界与设计原则。
- `lesson-id-map.json` 决定新编号、legacy 来源组、归档路径与可否生成。
- `integration-framework.md` 决定资源选材顺序、采用级别与产物级转写边界。
- `writing-guide.md` 与 `AGENTS.override.md` 共同构成文风约束体系。

## 制作前前置步骤

1. 先检查作者态内容、运行态导出和知识卡片是否存在明显冲突；可使用 `course-content/scripts/review_lesson_content.py --review-only <lesson>` 与 `course-content/scripts/export-runtime.sh <lesson>` 验证当前课次。
2. 若存在冲突，立即停止并展示冲突清单。
3. 若仅有可安全合并项，应先在作者态真源中完成合并，再重新运行 review/export 链路。
4. 合并完成后，再进入本技能后续流程。

## 工作流：8 步

### Step 0｜技能初始化

1. 确认已完成前置同步。
2. 读取 `module-skeletons.md`、`lesson-id-map.json` 与对应 `unit-design-details/module*.md`。
3. 读取 `course-content/docs/writing-guide.md` 建立文风直觉。
4. 运行：
   ```bash
   python3 .agents/skills/lesson/scripts/kg_query.py stats
   ```
5. 完成当前课次编号、legacy 映射与阻断项的内部核对；这些信息默认不写入面向用户或学生的显式文本。

### Step 1｜资源采用单

1. 读取 `course-content/resource-library/integration-framework.md`。
2. 按本次课程目标选择性读取 `pptx`、思政案例、船舶案例与习题资源。
3. 输出"本课资源采用单"，至少包含：
   - 候选资源路径
   - 资源类型
   - 计划落点
   - 采用方式
   - 采用级别
   - 边界说明

### Step 2｜讲义设计与定稿

> **读取参考文件**：`references/step3-handout.md`

固定顺序：
1. 先生成学生版 `handout.md`（分两阶段撰写，见 step3-handout.md）
2. 导出并抽查 `handout.pdf`
3. 再生成教师版 `teacher-handout.md`
4. 导出并抽查 `teacher-handout.pdf`

学生版讲义默认要求：
- 从一个典型问题或任务开篇，不以"上一章我们……本章我们将……"的教务衔接开场
- 只显式列出本次课程目标，并用布鲁姆动词写成学习者完成本次课程后能够具备的能力项
- 导入和课程功能目标之后，正文按主题组织基本原理与方法，不按资源来源、课次边界或工具流程组织
- 至少包含 1 个具名例题和 3 道分层练习；例题章节标题必须根据所解决的具体问题命名
- 例题之后必须安排案例章节；案例必须在具体工程场景下重新表述问题
- 以章末总结和扩展思考收束，总结应提炼可带走的判断而非罗列"本节讲授了……"
- 仅看各级标题，应能还原本单元的知识骨架
- **正文中不出现教学策略标注**（"第一轮速通""这里不进入推导""后续才会正式展开"），这些属于 teacher-handout.md
- **正文中不出现平台操作指令**（"打开平台""拖动参数""用 AI 验证"），这些属于 interactive-page.md 或 boppps.md
- **章间衔接不使用教务腔**（"上一章我们学习了……本章将在此基础上……"），改用自然的概念桥接

执行要求：
- 学生版 `handout.md` 必须先走 `clean brief -> prose 初稿 -> 去污染重写`，再导出 PDF。
- 学生版讲义必须强制分为两个撰写阶段，不得一次性写完整篇：第一阶段只写到"导入、课程目标、主题原理讲解和案例头部"；第二阶段在第一阶段确认后，再写"例题、案例完整分析与收尾"。
- 教师版 `teacher-handout.md` 必须以学生版 clean brief 和定稿内容为基础重写，不得把导出门槛、检查表、流程提示直接露出成课堂讲义句子。

### Step 3｜知识图谱与知识卡片草案

> **读取参考文件**：`references/step4-knowledge-graph.md`

必须产出：
- `manifest.json`
- `graph/nodes.jsonl`
- `graph/relations.jsonl`
- 与本课相关的知识卡片草案或需补卡片清单

固定顺序：
1. 完成新增节点与关系
2. 完成 `manifest.json`
3. 补齐已经确定会被讲义、教师讲义或媒体引用的知识卡片正文
4. 若已经有清晰的候选卡片顺序，可生成临时 `sequence.json`，但必须标注为互动设计前草案，不得冻结步骤数或卡片顺序
5. 完成 BOPPPS 与多媒体后，再切换到 `interactive-design`，由互动设计统一定稿 `sequence.json`、卡片展示步骤和作答卡/显影链关系

### Step 4｜BOPPPS 课案

> **读取参考文件**：`references/step5-boppps.md`

要求：
- 从讲义中抽取逻辑线、知识线、能力线
- 以课堂时间约束为边界
- 明确哪些内容值得占用课堂时间
- 显式考虑学生常见反应与误判
- 正文层面保留教学设计所需的顺序与阶段信息，但把时长门槛、核验规则、实现条件继续留在 hidden constraints

### Step 5｜多模态资源设计

> **读取参考文件**
> - `references/step7-multimedia.md`
> - `references/step7-multimedia-codegen.md`
> - `references/step7-multimedia-ai.md`

三阶段：
1. 扫描 `design/{unit}-handout.md`、`design/{unit}-teacher-handout.md`、`design/{unit}-boppps.md`
2. 输出资源总表与制作规格
3. 回写媒体引用与 `[单元编号]-media.md`

### Step 6｜移交互动课程设计

完成学生讲义、教师讲义、BOPPPS、多媒体规格、基础图谱与卡片草案后，若本课需要互动课，切换到 `interactive-design`。

### Step 7｜图谱增量镜像同步

运行：
```bash
python3 .agents/skills/lesson/scripts/sync_overlays.py [单元] --check
```

### Step 8｜收尾检查

逐项确认：
- `manifest.json` 字段齐全且保持 `snake_case`
- 两版 PDF 已抽查
- `[单元编号]-media.md` 已存在
- handout.md 中无教学策略标注、无平台操作指令、无教务腔衔接句

## 常见误用与返工红旗

### 常见误用

| 误用 | 正确做法 |
|------|----------|
| 把讲义写成课堂讲稿摘要 | 讲义必须保持学生可独立阅读 |
| 学生版刚确认就直接进入下游 | 必须先导出并抽查学生版 PDF |
| 双版讲义一完成就跳过知识底稿 | 先完成 `manifest / graph / card drafts`，但不冻结互动 `sequence` |
| 只凭经验给出响应曲线与性能指标 | 先用 `Octave` 验证 |
| 用普通绘图或截图处理线框图 | 必须调用 `tikz-control-draw` |
| 在 handout.md 中写"第一轮速通""这里不推导" | 教学策略标注属于 teacher-handout.md |
| 在 handout.md 中写"上一章我们……本章将……" | 改用自然的概念桥接句 |
| 把"前置缺口表"照搬进 handout.md | 用开场工程问题 + 章末能力回顾替代 |

### 返工红旗

出现以下任一情况，应停止下游步骤并返工上游内容：

- 讲义缺少关键知识解释或能力训练
- 学生版正文被课程过渡说明主导
- 学生版正文出现教学策略标注或平台操作指令
- 控制结论未见 `Octave` 验证
- 线框图未走 `tikz-control-draw`
- 两版 PDF 未完成导出与抽查

## 错误处理

| 情况 | 处理 |
|------|------|
| 单元编号不在大纲中 | 展示大纲单元列表供核对 |
| 单元编号是 legacy 来源组 | 先查 `lesson-id-map.json`，说明其映射目标或归档位置 |
| 单元所在模块缺少 `unit-design-details` | 立即停止，提示先补齐对应模块边界文稿 |
| 运行时知识同步发现冲突 | 立即停止制作，展示冲突清单 |
| 用户对某部分不满意 | 精确识别后局部重做，不重做整个步骤 |

---

*版本：v5.1 | 2026-06-06*
*本版本基于 v5.0 (2026-04-16) 升级：新增文档体系职责矩阵、文风规范正反向参考入口、教学策略标注分离规则、章间衔接写法约束。*
