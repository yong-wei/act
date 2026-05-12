# HW4 O4 And Export Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 生成 `HW4` 的开放题 `O4`，并将 `T4-1`、`T4-2`、现有 `T4-3` 与新 `O4` 合并导出为学生版和答案版最终文档。

**Architecture:** 先依据 `course-content/syllabus-refactor/homework-framework.md` 的 `HW4/O4` 边界固定题面、模板答案与评分契约，再补齐 `T4.md` 与 `T4S.md` 两份汇编文档。最后以最小 `python3 + python-docx` 导出脚本生成 `T4.docx` 和 `T4S.docx`，并做结构性校验。

**Tech Stack:** Markdown、JSON、`python3`、`python-docx`

### Task 1: 固化 O4 题面与评分契约

**Files:**
- Create: `course-content/authoring/shared/homework-problems/O4-final-package.json`
- Create: `course-content/authoring/shared/homework-problems/O4-final-package.md`

**Step 1:** 读取 `HW4` / `O4` 边界，固定“沿用 O3 诊断、比较 2-3 个候选结构、不做最终定参”的题面。
**Step 2:** 产出带行内得分点的模板答案与 `40` 分 rubric。
**Step 3:** 记录为何当前题面符合 `HW4` 能力边界。

### Task 2: 合并学生版与答案版作业 4 Markdown

**Files:**
- Create: `course-content/authoring/shared/homework-problems/T4.md`
- Create: `course-content/authoring/shared/homework-problems/T4S.md`

**Step 1:** 基于 `HW4` 框架补齐 `T4-1`、`T4-2` 的正式题面与标准答案。
**Step 2:** 复用现有 `T4-3-final-package` 的定稿内容。
**Step 3:** 将新 `O4` 并入学生版与答案版文档，答案版沿用 `O3` 示例对象继续写出 `O4` 参考答案。

### Task 3: 导出 DOCX 并验证

**Files:**
- Create: `course-content/authoring/shared/homework-problems/scripts/export_homework_docx.py`
- Create: `course-content/authoring/shared/homework-problems/T4.docx`
- Create: `course-content/authoring/shared/homework-problems/T4S.docx`

**Step 1:** 用 `python3` 读取 Markdown 结构并导出 DOCX。
**Step 2:** 校验 DOCX 可打开、标题层级完整、题号顺序正确。
**Step 3:** 用 OOXML 结构或 `python-docx` 复读验证段落与标题存在。
