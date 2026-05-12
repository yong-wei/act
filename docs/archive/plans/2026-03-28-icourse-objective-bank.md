# iCourse 客观题自适应题库 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 `tmp/icourse-question-bank-bankType4.json` 中的单选、多选、简单填空题全部精修为纯文本，并导出为适合自适应题库检索与导入的 `JSONL + 汇总索引 + Markdown 总览`。

**Architecture:** 保留 `tmp/icourse-question-bank-repair/` 作为中间工作包；先建立“唯一公式图 -> LaTeX 文本”的映射字典，再将该字典逐题回填到 `question-manifests`，最后输出独立于计算题库的 objective-bank 文档目录。最终产物不携带外挂图片资源，只保留纯文本公式、题干、选项、正确答案和适合检索/推荐的元数据。

**Tech Stack:** Python 3、Pillow、Tesseract、pix2tex（临时虚拟环境）、JSONL、SQLite/JSON 索引

### Task 1: 建立公式识别目录

**Files:**
- Create: `tmp/icourse-formula-catalog.json`
- Create: `tmp/icourse-formula-sheets/*.png`
- Create: `tmp/icourse-formula-sheets/*.txt`

**Step 1: 汇总唯一公式图**

- 按图像内容哈希而非 URL 去重
- 记录出现次数、样例路径、上下文片段

**Step 2: 跑 OCR 候选**

- `pix2tex`
- `tesseract --psm 7`

**Step 3: 生成人工复核接触图**

- 高频公式优先
- 每批 20~40 个

### Task 2: 精修公式字典

**Files:**
- Create: `tmp/icourse-formula-map.json`

**Step 1: 高频公式人工校对**

- 优先覆盖高频哈希
- 明确短公式、边界点、频率符号、特征方程等常见模式

**Step 2: 低频公式逐批补全**

- 结合题干上下文确认
- 必要时直接看图人工转写

**Step 3: 固化公式映射**

- 每个哈希一条最终 `latex/text`
- 记录来源路径与覆盖出现次数

### Task 3: 逐题回填并生成纯文本客观题

**Files:**
- Create: `course-content/questions/objective-bank/icourse-bank-bankType4.jsonl`
- Create: `course-content/questions/objective-bank/icourse-bank-bankType4.index.json`
- Create: `course-content/questions/objective-bank/icourse-bank-bankType4.overview.md`
- Create: `course-content/questions/objective-bank/icourse-bank-bankType4.errors.json`

**Step 1: 过滤客观题**

- `single`
- `multiple`
- `fill_blank`

**Step 2: 用公式映射替换占位符**

- 题干与选项全部转成纯文本
- 无外挂图片路径残留

**Step 3: 补齐自适应元数据**

- `question_kind`
- `choice_mode`
- `correct_answers`
- `knowledge_tags`
- `search_text`
- `source_platform_id`
- `source_bank_type`
- `formula_hashes`

**Step 4: 产出 overview**

- 人类可读
- 按题型、标签、来源分组概览

### Task 4: 验证

**Files:**
- Create: `course-content/tests/test_build_icourse_objective_bank.py`

**Step 1: 写 failing test**

- 非客观题不应进入最终 JSONL
- 占位符必须被替换
- 正确答案和题型字段完整

**Step 2: 运行测试验证失败**

Run:

```bash
python3 -m pytest course-content/tests/test_build_icourse_objective_bank.py -q
```

**Step 3: 实现并转绿**

**Step 4: 真实数据回归**

Run:

```bash
python3 -m pytest course-content/tests/test_build_icourse_objective_bank.py -q
python3 course-content/questions/scripts/build_icourse_objective_bank.py
```
