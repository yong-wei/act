# 题库混排公式清理收尾计划

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 清除 `course-content/questions/` 中剩余“混排公式”误报与真实坏串，直到 `unresolved-formulas.json` 清零或只剩需明确升级处理的个案。

**Architecture:** 先通过抽取脚本测试锁定 `formula_status` 的判定边界，修正 `extract_docx_question_bank.py` 中的 `classify_formula_status()`，让正常括号注记如 `(\Delta = 2%)`、`(\text{m} \cdot \text{s}^{-1})` 不再误报。随后重新抽取并重建索引，只对新的 `unresolved-formulas.json` 中仍残留的真实坏串做逐题人工精修，沿用已有 `usage_status = cleaned` 的保留机制和批次测试。

**Tech Stack:** Python 3、`pytest`、仓库内 DOCX 抽取脚本、JSON/Markdown 题库产物

### Task 1: 用失败测试锁定混排误报边界

**Files:**
- Modify: `course-content/tests/test_question_bank_extract.py`
- Modify: `course-content/questions/scripts/extract_docx_question_bank.py`

**Step 1: 运行现有 delta 注记回归测试**

Run: `python3 -m pytest course-content/tests/test_question_bank_extract.py -k delta_annotations -q`

Expected: FAIL，证明当前 `(\Delta = 2%)` 会被误判为 `mixed`。

**Step 2: 抽样分析剩余 mixed 命中模式**

Run: `python3 - <<'PY' ... PY`

Expected: 将误报模式和真实坏串模式分开，明确分类器只拦截坏格式。

### Task 2: 以最小改动修正 formula mixed 分类器

**Files:**
- Modify: `course-content/questions/scripts/extract_docx_question_bank.py`

**Step 1: 保留失败测试不变，先实现最小判定规则**

规则只关注：
- `$$...$...` / `$...$$...`
- 方括号中的裸 LaTeX 未被正规化
- 明显断裂的 `$...(`、`(...$`、`$...$$...`

规则明确放过：
- `(\Delta = 2%)`
- `(\text{...})`
- 其他单纯括号中的正常 LaTeX 注记

**Step 2: 重新运行 targeted test**

Run: `python3 -m pytest course-content/tests/test_question_bank_extract.py -k delta_annotations -q`

Expected: PASS

### Task 3: 重建题库并重新筛出真实脏题

**Files:**
- Modify: `course-content/questions/questions/*.json`
- Modify: `course-content/questions/questions/*.md`
- Modify: `course-content/questions/reports/extraction-report.json`
- Modify: `course-content/questions/reports/unresolved-formulas.json`
- Modify: `course-content/questions/indexes/questions.jsonl`
- Modify: `course-content/questions/indexes/questions.sqlite`

**Step 1: 重跑抽取**

Run: `python3 course-content/questions/scripts/extract_docx_question_bank.py`

**Step 2: 重建索引**

Run: `python3 course-content/questions/scripts/build_question_indexes.py`

**Step 3: 检查 unresolved 清单**

Expected: 大量 `(\Delta = 2%)` 类误报消失，仅剩真实坏串题目。

### Task 4: 人工精修剩余真实混排题

**Files:**
- Modify: `course-content/questions/questions/AC-Q-*.json`
- Modify: `course-content/questions/questions/AC-Q-*.md`
- Modify: `course-content/questions/reports/remediation-batch-01.md`
- Modify: `course-content/tests/test_question_bank_extract.py`

**Step 1: 优先修明显坏串题**

优先顺序：
- `AC-Q-0058`
- `AC-Q-0059`
- `AC-Q-0087`
- `AC-Q-0113`
- `AC-Q-0116`
- `AC-Q-0118`
- `AC-Q-0123`

**Step 2: 每修一批就重建并确认从 unresolved 中消失**

Run:
- `python3 course-content/questions/scripts/extract_docx_question_bank.py`
- `python3 course-content/questions/scripts/build_question_indexes.py`

**Step 3: 扩展 curated cleanup 回归测试**

把新人工精修题加入固定断言，确保不会被后续重建覆盖。

### Task 5: 最终验证与可提交收口

**Files:**
- Modify: `docs/ProjectDescription.md`（若本轮形成应记录的稳定流程）
- Modify: `.codex/memory/02-recent-summary.md`（若形成稳定项目事实）

**Verification:**
- `python3 -m pytest course-content/tests/test_question_bank_layout.py course-content/tests/test_question_bank_extract.py -q`
- `python3 course-content/questions/scripts/extract_docx_question_bank.py`
- `python3 course-content/questions/scripts/build_question_indexes.py`
- 检查 `course-content/questions/reports/unresolved-formulas.json`
- 检查 `course-content/questions/reports/extraction-report.json`
