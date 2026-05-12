# HW3 O3 And Export Plan

> **For Codex:** 当前沙箱禁止写入 `.codex/plans` 与 `.codex/tmp/homework/O3`，本次改将执行计划与 O3 产物落在可写的仓库路径中，保持内容与验收标准不变。

**Goal:** 生成 `HW3` 的开放题 `O3`，并将既有 `T3-1`、`T3-2`、`T3-3` 与新 `O3` 合并导出为学生版作业 3 文档。

**Architecture:** 先依据 `course-content/syllabus-refactor/homework-framework.md` 的 `O3` 边界手工构造题包与评分契约，再把四道题的题面汇总成 [T3.md](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/shared/homework-problems/T3.md)。最后用 `python3 + python-docx` 导出 [T3.docx](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/shared/homework-problems/T3.docx) 并做可读性检查。

**Tech Stack:** Markdown、JSON、`python3`、`python-docx`

### Task 1: 固化 O3 题面与评分契约

**Files:**
- Create: `course-content/authoring/shared/homework-problems/O3-final-package.json`
- Create: `course-content/authoring/shared/homework-problems/O3-final-package.md`

**Step 1:** 读取 `HW3` / `O3` 边界，固定“沿用 O2 对象与模型、只做机理诊断、不做控制结构定夺”的题面。
**Step 2:** 产出带行内得分点的标准答案模板与 `40` 分 rubric。
**Step 3:** 记录为何当前题面符合 `HW3` 能力边界。

### Task 2: 合并学生版作业 3 Markdown

**Files:**
- Create: `course-content/authoring/shared/homework-problems/T3.md`

**Step 1:** 从既有 `T3-1/T3-2/T3-3` 最终题包提取正式题面。
**Step 2:** 将新 `O3` 题面按现有作业文档风格并入学生版文档。
**Step 3:** 复查文字边界，确保未把答案内容混入学生版文档。

### Task 3: 导出 DOCX 并验证

**Files:**
- Create: `course-content/authoring/shared/homework-problems/T3.docx`

**Step 1:** 用 `python3` 读取 Markdown 结构并导出 DOCX。
**Step 2:** 校验 DOCX 可打开、段落层级完整、题号顺序正确。
**Step 3:** 若本机具备渲染工具，再补做一次渲染检查；否则至少做结构性检查并标注剩余风险。
