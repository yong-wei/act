# Unit 3-4 Handout Rewrite Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 按 `lesson` 技能要求重写 `3-4` 学生版讲义，使正文围绕“关键节点读图 -> 参数窗口判断 -> 对象化三域验证”的单一主线展开。

**Architecture:** 以 `module-skeletons.md`、`unit-design-details/module3.md`、`authoring-brief.md` 为边界真源，以 `pptx/13`、`pptx/15.1` 与船舶航向控制案例为资源来源，复用现有 `3-4` 媒体与已核定数值，重写 `handout.md` 的主结构、正文语气、证据链与章末自学区，并补做格式与导出校验。

**Tech Stack:** Markdown、现有 PNG 媒体、`python3` 导出脚本、Octave/MATLAB 示例代码。

### Task 1: 核对边界与资源

**Files:**
- Reference: `course-content/syllabus-refactor/module-skeletons.md`
- Reference: `course-content/syllabus-refactor/unit-design-details/module3.md`
- Reference: `course-content/authoring/lessons/3-4/design/authoring-brief.md`
- Reference: `course-content/resource-library/pptx/13根轨迹_细节修正/README.md`
- Reference: `course-content/resource-library/pptx/15.1根轨迹法_图形化思考/README.md`
- Reference: `course-content/resource-library/ship-control-cases/sections/4.1-船舶航向控制根轨迹分析.md`

**Step 1: 对齐单元定位**

- 确认 `3-4` 是主线实践课，正文不能回退成 `3-3` 法则复述。
- 确认三项固定产出：`关键节点读图记录`、`参数窗口判断表`、`对象化验证记录`。

**Step 2: 对齐资源采用方式**

- `pptx/13`：吸收关键节点与计算边界。
- `pptx/15.1`：吸收条件稳定、窗口判断与增益换算链。
- 船舶航向控制案例：承担工程对象主线与三域验证。

### Task 2: 重写学生版讲义

**Files:**
- Modify: `course-content/authoring/lessons/3-4/design/handout.md`

**Step 1: 重排正文结构**

- 从“给定同一对象，怎样判断哪个参数值得选用”切入。
- 正文按“主图关键节点 -> 参数窗口 -> 对象化三域验证 -> 只调增益的边界”展开。
- 将 AI 使用移到章末“课后自学建议”，不在正文主链中插入 `[AI融入点]`。

**Step 2: 复用并重编排既有媒体**

- 保留 `3-4-cover-comic.png`、`3-4-root-locus-summary.png`、`3-4-root-locus-keynodes.png`、`3-4-gain-conversion-card.png`、`3-4-root-locus-reference-b.png`、`3-4-step-compare.png`、`3-4-bode-compare.png`、`3-4-turning-track-k06064.png`、`3-4-turning-track-k20.png`、`3-4-info.png`。
- 图像只为正文证据链服务，不再按旧稿的“预测提示”松散分布。

### Task 3: 校验与导出

**Files:**
- Verify: `course-content/authoring/lessons/3-4/design/handout.md`

**Step 1: 文本检查**

Run: `python3 course-content/scripts/review_lesson_content.py --lesson 3-4`

Expected: 不出现新的公式或资源缺失阻塞项。

**Step 2: PDF 导出**

Run: `python3 .agents/skills/lesson/scripts/export_handout_pdf.py --lesson 3-4 --kind student`

Expected: 生成学生版 `handout.pdf`，供抽样复核。
