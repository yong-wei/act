# Question Bank Finalization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 `course-content/questions/` 题库剩余的公式混排与缺图问题收口到可稳定复建、可快速检索、可区分人工精修与源缺失的最终状态。

**Architecture:** 先把剩余异常分成“抽取/清洗逻辑缺陷”和“源文档信息不足”两类。对可自动修复的部分先补测试、再改抽取与清洗脚本；对无法自动恢复的图统一落到明确状态与报告，避免继续误报或被后续重建覆盖。

**Tech Stack:** `python3`、`python-docx`、现有题库抽取脚本、`pytest`

### Task 1: 分类剩余异常

**Files:**
- Modify: `course-content/questions/scripts/extract_docx_question_bank.py`
- Test: `course-content/tests/test_question_bank_extract.py`
- Output: `course-content/questions/reports/*.json`

**Step 1: 统计剩余 `mixed_formula_questions` 与 `title_only_figures` 的分布**

Run: `python3 - <<'PY' ... PY`
Expected: 输出按题号、章节、异常类型聚合后的清单。

**Step 2: 人工确认异常类别**

将异常分成：
- 规范化规则可自动修复
- 抽取边界仍有漏洞
- 源 DOCX 缺图或非图片对象

**Step 3: 记录到脚本/报告字段设计**

确认需要新增或调整的状态字段与报告输出。

### Task 2: 公式清洗规则补强

**Files:**
- Modify: `course-content/questions/scripts/extract_docx_question_bank.py`
- Test: `course-content/tests/test_question_bank_extract.py`

**Step 1: 先写失败测试**

覆盖至少这些模式：
- `2-16` 中的 `(\Omega(s)/U_i(s))`
- `1-10` 中的多条行内公式与积分项
- 常见的 `[ ... ]`、`( ... )`、`$...$` 混排

**Step 2: 跑测试确认失败**

Run: `python3 -m pytest course-content/tests/test_question_bank_extract.py`
Expected: 新增用例失败，失败原因是公式仍未规范化。

**Step 3: 实现最小清洗逻辑**

只修真实出现的混排模式，不扩展到未知格式。

**Step 4: 跑测试确认通过**

Run: `python3 -m pytest course-content/tests/test_question_bank_extract.py`
Expected: 新增公式规范化测试转绿。

### Task 3: 缺图状态收口

**Files:**
- Modify: `course-content/questions/scripts/extract_docx_question_bank.py`
- Test: `course-content/tests/test_question_bank_extract.py`
- Output: `course-content/questions/reports/missing-images.json`

**Step 1: 检查剩余 `title_only` 题是否仍存在可抽取对象**

若仍有可恢复对象，先补测试。

**Step 2: 对确无可抽取图的题统一状态**

必要时把“抽取漏图”和“源文档无可导出图”分开。

**Step 3: 更新报告逻辑**

确保后续批次不会再把已核实的源缺失图误写成“待抽取”。

### Task 4: 保护人工精修题

**Files:**
- Modify: `course-content/questions/scripts/extract_docx_question_bank.py`
- Test: `course-content/tests/test_question_bank_extract.py`

**Step 1: 确认 `usage_status != raw` 的题在重建后保持内容不回退**

Run: `python3 -m pytest course-content/tests/test_question_bank_extract.py`

**Step 2: 如需新增保留字段，最小化实现并补测试**

避免后续 rebuild 覆盖 `cleaned` 题。

### Task 5: 全量重建与抽查

**Files:**
- Modify: `course-content/questions/questions/*.json`
- Modify: `course-content/questions/questions/*.md`
- Output: `course-content/questions/indexes/*`
- Output: `course-content/questions/reports/*`

**Step 1: 全量重建**

Run:
- `python3 course-content/questions/scripts/extract_docx_question_bank.py`
- `python3 course-content/questions/scripts/build_question_indexes.py`

**Step 2: 抽查关键题**

至少检查：
- `AC-Q-0006`
- `AC-Q-0010`
- `AC-Q-0012/0013/0014`
- `AC-Q-0025/0026`

**Step 3: 确认报告数字变化符合预期**

验证 `mixed_formula_questions`、`title_only_figures`、`duplicate_candidates`。

### Task 6: 文档与记忆同步

**Files:**
- Modify: `docs/ProjectDescription.md`
- Modify: `.codex/memory/02-recent-summary.md`
- Modify: `course-content/questions/reports/remediation-batch-01.md`

**Step 1: 更新稳定结论**

写清：
- 题库总量
- 已修复的抽取器缺陷
- 仍需人工介入的边界

**Step 2: 最终验证**

Run:
- `python3 -m pytest course-content/tests/test_question_bank_layout.py course-content/tests/test_question_bank_extract.py`
- `python3 scripts/tests/test_homework_authoring_score_points.py`

**Step 3: 记录最终状态**

将本轮结论同步到项目说明和长期记忆。
