# 2-3 大纲级修订与课程设计修订执行计划

> **For Codex:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to execute scoped review/fix tasks where practical.

**Goal:** 在不推进知识图谱同步的前提下，完成 `2-2` 媒体补充落稿复核，以及 `2-3` 的大纲级修订与课程设计文稿修订，并做最小验证。

**Architecture:** 先以 `syllabus-refactor` 约束 `2-3` 的课程边界与资源融入，再以 `lesson` 约束讲义、教案、互动页和媒体清单的内部一致性；知识同步链因关系冲突暂时冻结，仅处理文稿层内容。

**Tech Stack:** Markdown、`apply_patch`、`git diff --check`、Codex 子代理、Serena 检索、仓库内 `course-content/syllabus-refactor/` 与 `course-content/authoring/lessons/`

### Task 1: 复核现有补丁

**Files:**
- Check: `course-content/syllabus-refactor/main.md`
- Check: `course-content/syllabus-refactor/decisions.md`
- Check: `course-content/syllabus-refactor/unit-design-details/module2.md`
- Check: `course-content/authoring/lessons/2-2/design/multimedia.md`
- Check: `course-content/authoring/lessons/2-3/design/handout.md`
- Check: `course-content/authoring/lessons/2-3/design/teacher-handout.md`
- Check: `course-content/authoring/lessons/2-3/design/boppps.md`
- Check: `course-content/authoring/lessons/2-3/design/interactive-page.md`
- Check: `course-content/authoring/lessons/2-3/design/multimedia.md`

**Step 1:** 搜索 `2-3` 中仍把 `Bode` 正式进入延后到 `2-4` 的残留语句。

**Step 2:** 搜索 `syllabus-refactor` 与 `2-3` 设计稿之间是否存在边界不一致。

**Step 3:** 列出需要修正的句段与文件。

### Task 2: 回写文稿

**Files:**
- Modify: `course-content/syllabus-refactor/main.md`
- Modify: `course-content/syllabus-refactor/decisions.md`
- Modify: `course-content/syllabus-refactor/unit-design-details/module2.md`
- Modify: `course-content/authoring/lessons/2-3/design/handout.md`
- Modify: `course-content/authoring/lessons/2-3/design/teacher-handout.md`
- Modify: `course-content/authoring/lessons/2-3/design/boppps.md`
- Modify: `course-content/authoring/lessons/2-3/design/interactive-page.md`
- Modify: `course-content/authoring/lessons/2-3/design/multimedia.md`
- Modify if needed: `course-content/authoring/lessons/2-2/design/multimedia.md`

**Step 1:** 删除或改写与新边界冲突的旧表述。

**Step 2:** 统一 `2-3` 的主线为“频域对象建立 + Bode 首轮进入 + 典型环节骨架读图/手绘”。

**Step 3:** 保证 `2-2` 媒体补充与 `2-3` 课程设计衔接自然。

### Task 3: 最小验证

**Files:**
- Verify: 上述全部改动文件

**Step 1:** 运行 `git diff --check -- <files...>`。

**Step 2:** 运行定向 `git diff -- <files...>` 复核关键表述。

**Step 3:** 记录未执行项与阻断项，特别是知识同步 `12` 个关系冲突。
