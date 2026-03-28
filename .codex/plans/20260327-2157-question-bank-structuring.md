# 自动控制题库结构化实施计划

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 `course-content/questions/自动控制原理习题解析.docx` 转化为项目内可检索、可筛选、可逐步精修的结构化题库，并把“行内得分点 + 评分指南并存”的格式接入现有命题技能。

**Architecture:** 保留原始 DOCX 作为只读主源，在 `course-content/questions/` 下新增 `source / questions / assets / indexes / reports / schemas / scripts` 目录。通过 Python 3 抽取脚本把 DOCX 切分为“每题一份 Markdown + 一份 JSON”，其中同文件内分离 `题面` 与 `答案解析` 结构，同时把配图导出到按题号归档的资产目录，并生成 JSONL/SQLite 索引与异常报告。命题技能的 JSON 输出契约扩展 `inline_score_points` 字段，与现有 `rubric` 并存。

**Tech Stack:** Python 3、`python-docx`、ZIP/XML 解析、Markdown、JSON/JSONL、SQLite FTS5、仓库内技能文档与测试脚本

### Task 1: 用失败测试锁定题库文件格式与索引契约

**Files:**
- Create: `course-content/tests/test_question_bank_layout.py`
- Create: `course-content/tests/test_question_bank_extract.py`
- Create: `scripts/tests/test_homework_authoring_score_points.py`

**Step 1: 写目录与 schema 期望测试**

断言 `course-content/questions/` 下存在目标目录，且单题 JSON 至少支持：
- `question_id`
- `source_ref`
- `chapter`
- `stem_md`
- `solution_md`
- `inline_score_points`
- `rubric`
- `figure_status`
- `formula_status`
- `usage_status`

**Step 2: 运行测试并确认失败**

Run: `python3 -m pytest course-content/tests/test_question_bank_layout.py course-content/tests/test_question_bank_extract.py`

Expected: 因文件与脚本尚不存在而失败。

**Step 3: 写命题技能得分点契约测试**

断言 `homework-problem-authoring` 的输出契约和技能文档同时出现：
- `inline_score_points`
- 与 `rubric` 并存

**Step 4: 运行测试并确认失败**

Run: `python3 scripts/tests/test_homework_authoring_score_points.py`

Expected: 因技能文档与契约尚未扩展而失败。

### Task 2: 实现题库目录、schema 与 DOCX 抽取脚本

**Files:**
- Create: `course-content/questions/README.md`
- Create: `course-content/questions/schemas/question.schema.json`
- Create: `course-content/questions/schemas/index-entry.schema.json`
- Create: `course-content/questions/scripts/extract_docx_question_bank.py`
- Create: `course-content/questions/scripts/build_question_indexes.py`
- Create: `course-content/questions/scripts/query_question_bank.py`
- Create: `course-content/questions/source/.gitkeep`
- Create: `course-content/questions/questions/.gitkeep`
- Create: `course-content/questions/assets/.gitkeep`
- Create: `course-content/questions/indexes/.gitkeep`
- Create: `course-content/questions/reports/.gitkeep`

**Step 1: 实现最小 schema**

定义单题 JSON 与索引条目字段，明确 `stem_md` / `solution_md` / `inline_score_points` / `rubric`。

**Step 2: 实现抽取脚本**

脚本读取 `source/自动控制原理习题解析.docx`，按题号模式与标题样式切题，输出：
- `questions/<question_id>.md`
- `questions/<question_id>.json`
- `assets/<question_id>/*`
- `reports/extraction-report.json`

**Step 3: Markdown 文件结构固定**

统一使用：
- frontmatter
- `## 题面`
- `## 答案解析`
- `## 行内得分点`
- `## 评分指南`
- `## 元数据`

其中 `题面` 与 `答案解析` 可独立抽取，但共存于一个文件。

**Step 4: 重新运行失败测试至通过**

Run: `python3 -m pytest course-content/tests/test_question_bank_layout.py course-content/tests/test_question_bank_extract.py`

Expected: PASS

### Task 3: 执行首轮真实抽取并生成索引

**Files:**
- Create: `course-content/questions/questions/*.md`
- Create: `course-content/questions/questions/*.json`
- Create: `course-content/questions/assets/*`
- Create: `course-content/questions/indexes/questions.jsonl`
- Create: `course-content/questions/indexes/questions.sqlite`
- Create: `course-content/questions/indexes/tags.json`
- Create: `course-content/questions/indexes/chapter-map.json`
- Create: `course-content/questions/reports/unresolved-formulas.json`
- Create: `course-content/questions/reports/missing-images.json`
- Create: `course-content/questions/reports/duplicate-candidates.json`

**Step 1: 执行抽取**

Run: `python3 course-content/questions/scripts/extract_docx_question_bank.py`

**Step 2: 执行建索引**

Run: `python3 course-content/questions/scripts/build_question_indexes.py`

**Step 3: 抽样验证**

至少验证：
- 含图片题
- 含裸 LaTeX 题
- 含答案得分点题

### Task 4: 扩展命题技能的“行内得分点 + 评分指南并存”契约

**Files:**
- Modify: `.codex/skills/homework-problem-authoring/SKILL.md`
- Modify: `.codex/skills/homework-problem-authoring/references/output-contract.md`
- Create: `scripts/tests/test_homework_authoring_score_points.py`

**Step 1: 更新技能说明**

默认产物新增：
- `inline_score_points`
- `rubric`

并说明：
- `inline_score_points` 用于答案内部逐步标分
- `rubric` 用于独立评分指南

**Step 2: 更新 JSON 契约**

在 `draft-*.json` 与 `final-package.json` 契约中加入 `inline_score_points` 数组。

**Step 3: 运行技能契约测试**

Run: `python3 scripts/tests/test_homework_authoring_score_points.py`

Expected: PASS

### Task 5: 文档与最终验证

**Files:**
- Modify: `docs/ProjectDescription.md`
- Modify: `.codex/memory/02-recent-summary.md`（如本次形成稳定流程）

**Verification:**
- `python3 -m pytest course-content/tests/test_question_bank_layout.py course-content/tests/test_question_bank_extract.py`
- `python3 scripts/tests/test_homework_authoring_score_points.py`
- `python3 course-content/questions/scripts/extract_docx_question_bank.py`
- `python3 course-content/questions/scripts/build_question_indexes.py`
- `python3 course-content/questions/scripts/query_question_bank.py --query "液位 方框图" --limit 3`
