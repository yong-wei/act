# Civics DOCX Resource Library Conversion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 `course-content/resource-library/自动控制原理课程思政案例库及融入点.docx` 转化为 `course-content/resource-library/` 下可检索、可复用的资源包，完整保留文本结构、案例条目、融入点和嵌入图片。

**Architecture:** 不把原始 `docx` 机械转成单一长文，而是建立一个独立目录，包含总索引、结构化提取正文、按案例拆分的子资源，以及导出的原始图片。先通过 `python-docx` 和 OOXML 包结构抽取段落、标题层级、表格与媒体映射，再进行人工语义整理，确保“案例主题、教学目标、教学方法、课堂实施、案例内容、相关资源、可融入课次/知识点”这些字段可直接供后续课程制作引用。

**Tech Stack:** `python3`、`python-docx`、DOCX OOXML 解包、Markdown、仓库内资源目录规范

---

### Task 1: 建立资源包目录与原始抽取清单

**Files:**
- Create: `course-content/resource-library/civics-cases/README.md`
- Create: `course-content/resource-library/civics-cases/extracted.md`
- Create: `course-content/resource-library/civics-cases/assets/`
- Create: `course-content/resource-library/civics-cases/indexes/`
- Read: `course-content/resource-library/自动控制原理课程思政案例库及融入点.docx`

**Steps:**
1. 创建 `civics-cases/` 目录和基础文件，明确这是从课程思政案例库转换出的正式资源包。
2. 用 `python-docx` 抽取全部段落、标题、表格、超链接线索，生成原始文本顺序清单。
3. 解包 `docx` 并导出 `word/media/*` 到 `assets/raw/`，保留原始文件扩展名和顺序映射。
4. 建立 `indexes/media-map.md`，记录“文中位置 -> 图片文件”的对应关系。

### Task 2: 按案例语义重组正文

**Files:**
- Modify: `course-content/resource-library/civics-cases/extracted.md`
- Create: `course-content/resource-library/civics-cases/cases/*.md`

**Steps:**
1. 识别文档中的一级案例边界，例如“华夏自控启明星”“梅森的温度尺度”“数理交响启示录”等。
2. 每个案例单独拆成一个 `cases/<slug>.md` 文件。
3. 在每个案例文件中统一整理以下字段：
   - 案例标题
   - 核心思政主题
   - 教学目标
   - 教学方法
   - 课前准备
   - 课堂实施
   - 课后补充
   - 案例内容
   - 相关资源
4. 在 `extracted.md` 中保留总览，并链接到各案例文件。

### Task 3: 抽取“融入点”并建立课程映射

**Files:**
- Create: `course-content/resource-library/civics-cases/integration-points.md`
- Create: `course-content/resource-library/civics-cases/indexes/unit-mapping.md`

**Steps:**
1. 从原文中识别每个案例对应的知识点、章节、课次或教学环节。
2. 按“案例 -> 可融入课程主题 -> 融入方式 -> 建议使用时机”建立映射。
3. 若原文未显式给出标准课次编号，则先保留为“知识主题级映射”，避免臆造课次。
4. 在 `unit-mapping.md` 中预留与当前 `2-1`、`2-2` 等正式课程编号的后续对接栏位。

### Task 4: 处理嵌入图片并回链到正文

**Files:**
- Modify: `course-content/resource-library/civics-cases/cases/*.md`
- Modify: `course-content/resource-library/civics-cases/extracted.md`
- Create: `course-content/resource-library/civics-cases/assets/processed/*`

**Steps:**
1. 检查 `docx` 中 `16` 个嵌入媒体是否都为正文有效图片，而不是装饰元素。
2. 对有效图片按案例归类重命名，例如 `case-01-figure-01.jpg`。
3. 在对应案例 Markdown 中直接插入图片，而不是只写文件名。
4. 若图片内容包含文字或版式信息，再补一行中文说明其用途和上下文。

### Task 5: 做成可引用的资源库入口

**Files:**
- Modify: `course-content/resource-library/index.md`
- Modify: `course-content/resource-library/civics-cases/README.md`

**Steps:**
1. 在资源库总索引中加入“课程思政案例库”入口。
2. 在 `README.md` 中说明资源包结构、来源文档、适用场景和引用方式。
3. 强调该资源包面向后续讲义、BOPPPS、互动课和课前导入设计，不作为正式授课文案直接复用。

### Task 6: 验证与交付

**Files:**
- Verify: `course-content/resource-library/civics-cases/**`

**Steps:**
1. 抽查每个案例是否都能独立阅读，且标题层级、段落顺序合理。
2. 抽查图片链接是否可打开，是否挂在正确案例下。
3. 抽查相关资源链接、人物名、书名等是否在转写中丢失。
4. 汇总“已完整保留 / 需人工补充判断”的边界项，例如无法从 `docx` 自动判断的融入课次编号。
