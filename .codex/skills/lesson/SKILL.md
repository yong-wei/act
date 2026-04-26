---
name: lesson
description: 面向“自动控制原理”课程创作讲义、知识图谱节点、BOPPPS 课案与多模态资源；在正式制作前先执行运行时知识图谱与知识卡片到作者态的同步、冲突检测以及必要的课次编号/路径核对。当用户要求生成课程讲义、教师版讲义、知识节点、BOPPPS、媒体规格、时域/频域/根轨迹图或线框图时，应启用本技能。
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
- `sequence.json` 与“每一步展示哪些知识卡片”的最终顺序，不在 lesson 阶段冻结；它们由 `interactive-design` 依据互动步骤、显影链和作答卡统一校准。lesson 阶段可以生成候选卡片和临时顺序，但不得把它们作为互动设计的硬约束。
- 若用户要求互动页面蓝图、互动契约、课堂页步骤拆分、例题显影、学生作答卡或教师控制语义，切换到 `interactive-design`。
- 若用户要求将设计稿落成前端代码、课堂路由、师生端页面或运行时课程实现，切换到 `interactive-lesson-implementation`。

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
- `course-content/authoring/lessons/[单元编号]/design/handout.md`
- `course-content/authoring/lessons/[单元编号]/design/teacher-handout.md`
- `course-content/authoring/lessons/[单元编号]/design/boppps.md`
- `course-content/authoring/lessons/[单元编号]/design/multimedia.md`
- `course-content/authoring/lessons/[单元编号]/manifest.json`
- `course-content/authoring/lessons/[单元编号]/graph/nodes.jsonl`
- `course-content/authoring/lessons/[单元编号]/graph/relations.jsonl`
- `course-content/authoring/knowledge/cards/lessons/[单元编号]/sequence.json`（互动设计阶段定稿；lesson 阶段仅可作为候选草案）

## 协作原则

- 以教育学家与自动控制原理教学专家的双重身份工作，不机械迎合用户提案。
- 讲义必须服务零基础工科生的理解链，不用课程位置说明取代当前问题。
- 资源库只提供候选素材，不直接拼贴为新课。
- 标题 = 知识骨架：学生版讲义的标题必须直接概括对象、方法、比较关系或归纳后的知识点；正文可以用问题引导，但问题不进入标题。

## 人读文档生成协议

本技能下的 `handout.md`、`teacher-handout.md` 与 `boppps.md` 都属于人读文档，但三者的文体职责不同。无论产出哪一种，默认都先把工程性流程、核验要求、资源采用单、导出门槛和技能清单视为 **hidden constraints**，不得直接长成正文句型。

凡是面向人阅读的正文，统一采用以下链路：

1. **clean brief**
   - 只抽取对象、证据、边界、读者、理解/判断/迁移动作。
   - 不继承上游技能文件、模块文件、检查表和流程提示的口吻。
2. **prose 初稿**
   - 只围绕对象、证据、判断、意义展开。
   - 不用“本讲/上一讲/下一步/必须产出/交付物”组织段落。
3. **去污染重写**
   - 专门删除流程腔、防御腔、管理腔、课程编排说明和相邻段落的重复结论。
4. **再进入具体产物规则**
   - 学生版讲义再按 `references/step3-handout.md` 落地。
   - 教师版讲义与 `boppps.md` 允许保留更强的课堂组织信息，但仍不得写成工单、项目汇报或工程检查单。

若当前上下文中明显混入系统级 harness、superpowers 流程提示或其他强工程性口吻，优先采用“当前代理先整理 clean brief，再据此生成 prose”的做法；必要时可把 clean brief 发给子代理，只让子代理处理 prose，不把上游工程提示全文传下去。

## 硬约束

1. **讲义必须独立可读**
   - 学生离开课堂后仍能依靠讲义理解核心概念、公式、推导、例题与判断链。
   - 讲义必须同时承担“知识详解”与“能力训练”两类任务。
   - 不得把关键解释转嫁给 PPT、教师口述或后续互动页面。

2. **实践课必须显式给出 45 分钟以上训练**
   - 若 `manifest.json` 中课型为“实践”，课堂中学生亲自参与的训练累计必须不少于 45 分钟。
   - 这 45 分钟以上的训练时间必须在 `design/boppps.md` 中可追踪。
   - 只计入学生实际操作、观察、判断、记录、对比、修正、提交等参与式活动。

3. **范文只借文风，不借内容**
   - 生成讲义前先读取 `course-content/authoring/lessons/legacy/L-2a/design/handout.md`。
   - 只提炼文风特征，不得照抄其结构、句子、例题或段落顺序。

4. **公式统一规范**
   - 行内公式一律使用 `$...$`，行间公式一律使用 `$$...$$`。
   - 本技能输出的 Markdown 文档均按 LaTeX 形式书写公式，不混用纯文本近似公式。

5. **静态核验与成图必须统一**
   - 讲义、教师版讲义与多媒体中的控制系统数值结论，统一用 `Octave` 做数值验证。
   - Octave 负责数值计算与导出数据。
   - Python/matplotlib 负责最终排版出图。
   - 主要数值曲线统一采用“两段式流程”：`Octave` 导出数据，`Python/matplotlib` 最终排版。
   - 3-6 单元的数值图风格为统一基线。
   - 默认优先使用 `step()`、`bode()`、`nyquist()`、`rlocus()`、`lsim()`、`margin()` 等高层函数。
   - 根轨迹若转为 `Python/matplotlib` 复绘，必须调用 `.codex/skills/lesson/scripts/root_locus_branch_match.py` 做分支连续匹配与审计。
   - 讲义中给出的参考代码默认必须是 `MATLAB/Octave` 形式。

6. **线框图必须走专用技能**
   - 方框图、信号流图、电路图、机械结构图等线框图必须显式调用 `tikz-control-draw`。

7. **讲义围绕单一主线展开**
   - 必须围绕本次课程目标与当前知识对象组织为一条清晰逻辑链，避免知识点并列堆放。
   - 必要的长推导、补充证明与扩展讨论可放附录，正文只保留服务主线的版本。

8. **所有图像禁止 ASCII 图**
   - 正式交付文档中的图像、示意图、结构图、响应图与信息图不得使用 ASCII 字符图。
   - 合法来源只有两类：代码直出图或 AI 生成图。

9. **媒体必须达到出版级成图质量**
   - 每张正式媒体都必须检查字符正确、公式可读、标注不遮挡、关键元素不裁切、箭头与连线不误指。
   - 不接受“内容大致对但版式挤在一起”的成图。

10. **媒体命名必须统一带单元前缀**
   - 所有媒体成品都必须采用 `[单元编号]-{资源名}` 命名。
   - 不允许最终交付中混用无前缀旧命名。

11. **PDF 图表标题必须避免重复编号**
   - Markdown 图片 alt 文本只写图题本身，不写 `图 1`、`图 4-7-1`、`图X.Y` 等人工图序；PDF 导出会自动生成 `图 1`、`图 2` 这类直接数字编号。
   - 表题使用直接数字编号或 LaTeX `\caption{标题}` 自动编号，不写 `表 4-7-1` 这类带单元号的表序。
   - 表格标题必须在 PDF 中居中。若使用原生 LaTeX 表格，应采用 `\begin{table}[H]`、`\centering`、`\caption{...}`、`\begin{tabular}...` 的结构；不要把表题作为普通左对齐段落放在表格上方。
   - PDF 抽查时若出现 `图 12. 图 4-7-12 ...`、表题左对齐或表序混用单元号，视为版面未通过。

12. **讲义必须导出正式 PDF**
   - 学生版与教师版 Markdown 定稿后，都必须导出同目录 PDF。
   - 默认使用 `.codex/skills/lesson/scripts/export_handout_pdf.py` 与统一模板。
   - 若 `cover-comic.png` 与 `info.png` 尚未完成，只允许使用 `--draft-mode` 导出草稿 PDF。

13. **PDF 版面必须抽样复核**
   - 学生版和教师版 PDF 都至少抽查首页、图表页、公式密集页、附录代码页或板书/课堂组织页。
   - 默认使用 `.codex/skills/lesson/scripts/render_pdf_review_pages.py` 渲染抽查页，不再手写 `pdftoppm -png/-jpeg` 这类环境敏感命令。
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

其中：
- `module-skeletons.md` 决定课程骨架、课型、学时与内部编号约束。
- `unit-design-details/module*.md` 决定该课的内部产物边界与设计原则。
- `lesson-id-map.json` 决定新编号、legacy 来源组、归档路径与可否生成。
- `integration-framework.md` 决定资源选材顺序、采用级别与产物级转写边界。

## 制作前前置步骤

> 详细规则见 `references/preflight-runtime-sync.md`。

1. 先检查运行时知识与作者态知识的差异：
   ```bash
   python3 .codex/skills/lesson/scripts/sync_runtime_knowledge.py --check
   ```
2. 若存在冲突，立即停止并展示冲突清单。
3. 若仅有可安全合并项，则执行正式合并：
   ```bash
   python3 .codex/skills/lesson/scripts/sync_runtime_knowledge.py
   ```
4. 合并完成后，再进入本技能后续流程。

## 工作流：7 步

### Step 0｜技能初始化

1. 确认已完成前置同步。
2. 读取 `module-skeletons.md`、`lesson-id-map.json` 与对应 `unit-design-details/module*.md`。
3. 运行：
   ```bash
   python3 .codex/skills/lesson/scripts/kg_query.py stats
   ```
4. 完成当前课次编号、legacy 映射与阻断项的内部核对；这些信息默认不写入面向用户或学生的显式文本。

### Step 1｜资源采用单

1. 读取 `course-content/resource-library/integration-framework.md`。
2. 按本次课程目标选择性读取 `pptx`、思政案例、船舶案例与习题资源。
3. 输出“本课资源采用单”，至少包含：
   - 候选资源路径
   - 资源类型
   - 计划落点
   - 采用方式
   - 采用级别
   - 边界说明

### Step 2｜讲义设计与定稿

> **读取参考文件**：`references/step3-handout.md`

固定顺序：
1. 先生成学生版 `handout.md`
2. 导出并抽查 `handout.pdf`
3. 再生成教师版 `teacher-handout.md`
4. 导出并抽查 `teacher-handout.pdf`

学生版讲义默认要求：
- 从一个典型问题或任务开篇
- 只显式列出本次课程目标，并用布鲁姆动词写成学习者完成本次课程后能够具备的能力项
- 至少包含 1 个最小例题和 3 道分层练习
- 以总结和扩展思考收束
- 仅看各级标题，应能还原本单元的知识骨架；禁止问题式标题、口号式标题、纯课次/场景代号标题

执行要求：
- 学生版 `handout.md` 必须先走 `clean brief -> prose 初稿 -> 去污染重写`，再导出 PDF。
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
- 正文层面保留教学设计所需的顺序与阶段信息，但把时长门槛、核验规则、实现条件继续留在 hidden constraints，不把它们写成项目管理腔的段落骨架

### Step 5｜多模态资源设计

> **读取参考文件**
> - `references/step7-multimedia.md`
> - `references/step7-multimedia-codegen.md`
> - `references/step7-multimedia-ai.md`

三阶段：
1. 扫描 `design/handout.md`、`design/teacher-handout.md`、`design/boppps.md`
2. 输出资源总表与制作规格
3. 回写媒体引用与 `[单元编号]-media.md`

### Step 6｜移交互动课程设计

完成学生讲义、教师讲义、BOPPPS、多媒体规格、基础图谱与卡片草案后，若本课需要互动课，切换到 `interactive-design`。

移交给 `interactive-design` 的内容包括：
- 学生讲义证据链
- 教师讲义与 BOPPPS 中的课堂节奏、活动意图和误判点
- 已落盘媒体与待制作媒体清单
- `manifest.json`、`graph/*.jsonl`、知识卡片草案
- 已有 `sequence.json`（若存在，仅作为候选输入）

`interactive-design` 有权在保持知识事实正确的前提下，重排卡片顺序、拆分或合并互动步骤、要求补写卡片，并最终定稿 `sequence.json`。

### Step 7｜图谱增量镜像同步

运行：

```bash
python3 .codex/skills/lesson/scripts/sync_overlays.py [单元] --check
```

若有差异，再执行：

```bash
python3 .codex/skills/lesson/scripts/sync_overlays.py [单元]
```

### Step 8｜收尾检查

逐项确认：
- `manifest.json` 字段齐全且保持 `snake_case`
- 若已经完成互动课程设计，`sequence.json` 存在且 `groups` 含 `step_ids`，并与 `interactive-page.md` / `interactive-contract.yaml` 的步骤一致
- 若尚未进入互动课程设计，`sequence.json` 可不存在或仅为草案，不能据此判定 lesson 阶段失败
- lesson 级废弃文件未回流
- 两版 PDF 已抽查
- `[单元编号]-media.md` 已存在

## 常见误用与返工红旗

### 常见误用

| 误用 | 正确做法 |
|------|----------|
| 把讲义写成课堂讲稿摘要 | 讲义必须保持学生可独立阅读 |
| 学生版刚确认就直接进入下游 | 必须先导出并抽查学生版 PDF |
| 双版讲义一完成就跳过知识底稿 | 先完成 `manifest / graph / card drafts`，但不冻结互动 `sequence` |
| 只凭经验给出响应曲线与性能指标 | 先用 `Octave` 验证 |
| 用普通绘图或截图处理线框图 | 必须调用 `tikz-control-draw` |

### 返工红旗

出现以下任一情况，应停止下游步骤并返工上游内容：

- 讲义缺少关键知识解释或能力训练
- 学生版正文被课程过渡说明主导
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

*版本：v5.0 | 2026-04-16*
