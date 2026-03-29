# T2-3 Homework Regeneration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 删除旧的 `.tmp/homework-problem-authoring/T2-3` 临时产物，并按当前 `homework-framework.md` 中的 `T2-3 [X]` 规范重新生成完整题目包。

**Architecture:** 主代理读取框架与输出契约，生成最小 `task-package.json` 并重建目录；随后通过独立子代理生成 3 份草稿、1 份裁判选择、3 份 solver 结果，最后由主代理汇总出 `final-package.md/json` 并做契约核查。频域部分固定选择“基础 Bode 手工绘图”路线，避免再次偏成纯时域计算题。

**Tech Stack:** Markdown、JSON、`python3`、Codex 子代理、仓库内 `extract_homework_question.py`

### Task 1: 清理旧目录并重建契约骨架

**Files:**
- Modify: `.tmp/homework-problem-authoring/T2-3/`

**Step 1: 删除旧目录**

Run: `rm -rf .tmp/homework-problem-authoring/T2-3`
Expected: 目录删除成功

**Step 2: 重建目录骨架**

Run: `mkdir -p .tmp/homework-problem-authoring/T2-3/{drafts,judge,selected,solvers/round-1,solvers/round-2,final}`
Expected: 目录结构符合 `output-contract.md`

### Task 2: 生成最小任务包

**Files:**
- Create: `.tmp/homework-problem-authoring/T2-3/task-package.json`

**Step 1: 抽取最新题号规范**

Run: `python3 .codex/skills/homework-problem-authoring/scripts/extract_homework_question.py --framework course-content/syllabus-refactor/homework-framework.md --question-id T2-3`
Expected: 输出 `T2-3 [X]` 的正式规范 JSON

**Step 2: 写入最小任务包**

要求：
- 保留题号、题型、模块边界、能力、禁止知识、题面构成要求、允许方法、评分锚点
- 写入 `output_requirements` 和 `consensus_rule`
- 明确频域路线固定为“基础 Bode 手工绘图”

### Task 3: 生成三份独立草稿

**Files:**
- Create: `.tmp/homework-problem-authoring/T2-3/drafts/draft-1.json`
- Create: `.tmp/homework-problem-authoring/T2-3/drafts/draft-2.json`
- Create: `.tmp/homework-problem-authoring/T2-3/drafts/draft-3.json`

**Step 1: 分派 3 个独立出题子代理**

要求：
- 只允许读取 `T2-3` 临时目录
- 输出 `stem`、`answer`、`inline_score_points`、`rubric`、`pitfalls`、`self_check`
- 标准答案正文必须内嵌分值

**Step 2: 主代理检查草稿结构**

Expected:
- 三份草稿均为合法 JSON
- 题型为 `[X]`
- 题面同时覆盖时域与频域

### Task 4: 裁判选择备选题

**Files:**
- Create: `.tmp/homework-problem-authoring/T2-3/judge/draft-selection.json`
- Create: `.tmp/homework-problem-authoring/T2-3/selected/selected-draft.json`

**Step 1: 分派裁判子代理**

要求：
- 只读取 `task-package.json` 和 3 份草稿
- 只能选择或判废，不能改题

**Step 2: 主代理写入 selected-draft**

Expected:
- 选中草稿与 T2-3 规范一致
- 被淘汰草稿有明确理由

### Task 5: 生成 solver 结果并做一致性判定

**Files:**
- Create: `.tmp/homework-problem-authoring/T2-3/solvers/round-1/solver-1.json`
- Create: `.tmp/homework-problem-authoring/T2-3/solvers/round-1/solver-2.json`
- Create: `.tmp/homework-problem-authoring/T2-3/solvers/round-1/solver-3.json`

**Step 1: 分派 3 个独立 solver 子代理**

要求：
- 只读取 `selected/selected-draft.json`
- 禁止读取标准答案与其他 solver 输出

**Step 2: 主代理按 `X` 题一致性规则判定**

Expected:
- 所有分析项都被回答
- 方向性结论大体一致
- 若不一致，再开第 2 轮

### Task 6: 汇总最终产物并核查契约

**Files:**
- Create: `.tmp/homework-problem-authoring/T2-3/final/final-package.md`
- Create: `.tmp/homework-problem-authoring/T2-3/final/final-package.json`

**Step 1: 生成最终 Markdown 与 JSON**

要求：
- `final-package.md` 顺序固定为：基本信息、题面、标准答案、分步评分标准、裁判结论、一致性记录、是否第二轮
- 不得重复输出“参考作答”
- `final-package.json` 保留结构化 `inline_score_points`

**Step 2: 执行契约核查**

Run: `python3 - <<'PY' ... PY`
Expected:
- 必要文件全部存在
- 标准答案正文含有 `（x分）` 或 `\\tag{x分}`
- 最终包无“参考作答”章节
