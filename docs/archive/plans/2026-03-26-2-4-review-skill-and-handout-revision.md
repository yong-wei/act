# 2-4 Review Skill And Handout Revision Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 更新 `lesson-content-review` 技能中的数值核查规范，并据此修订 `2-4` 讲义，使其更符合当前模块2边界与课程规划。

**Architecture:** 先修改技能文档中的“确定性结论验证”与相关检查项，统一为“Octave 原生能力 + control 包内置函数优先”的审查口径；再回写 `2-4` 讲义中的反向识别、例题组织与章节负载分配，保持不越界且更贴合 `module2.md` 的设计边界。

**Tech Stack:** Markdown, apply_patch, ripgrep, shell inspection

### Task 1: Update Review Skill Rules

**Files:**
- Modify: `./.codex/skills/lesson-content-review/SKILL.md`

**Step 1: Tighten the deterministic verification section**

- Replace “必须使用 `python3` + `control` 验证” with a rule that numerical checks default to Octave + control package built-ins.
- Explicitly ban hand-written basic numerical helper functions for step response, frequency response, and performance metrics when Octave built-ins already cover them.

**Step 2: Propagate the rule to quick checks and common mistakes**

- Update checklist, common mistakes, and red flags so they no longer direct reviewers toward `python3` + `control` as the default path.
- Keep the wording focused on review workflow, not on lesson authoring.

### Task 2: Revise 2-4 Handout

**Files:**
- Modify: `./course-content/authoring/lessons/2-4/design/handout.md`

**Step 1: Reduce front-loaded conceptual weight**

- Compress overly extended explanatory setup where it crowds out the 2-hour teaching payload.
- Keep the logical chain intact: why draw, what Bode/Nyquist show, why log axis/dB matter.

**Step 2: Add the missing “simple combination object” bridge**

- Insert a short but concrete section and/or example showing how a gain + first-order inertia object is read/drawn via simple Bode stacking.
- Keep it at “simple open-loop object” level, not a high-intensity manual plotting drill.

**Step 3: Upgrade reverse identification to coarse parameter judgment**

- Extend the reverse-identification section so it covers low-frequency gain level, break frequency, time constant scale, and simple second-order coarse judgments.
- Keep the boundary explicit: no full identification, no stability judgment, no compensation design.

**Step 4: Rebalance examples**

- Make the example set better match `module2.md`: one basic Bode skeleton example, one simple combination-object stacking example, one reverse-identification example, one pure-pole Nyquist recognition example if needed.

### Task 3: Verify Alignment

**Files:**
- Inspect: `./course-content/syllabus-refactor/unit-design-details/module2.md`
- Inspect: `./course-content/syllabus-refactor/blueprint.md`
- Inspect: `./course-content/syllabus-refactor/homework-framework.md`

**Step 1: Re-read changed sections**

- Confirm the handout still avoids Nyquist criterion, Bode stability judgment, margins, compensation design, and full-system identification.

**Step 2: Summarize residual risks**

- Note any remaining gaps such as absent `boppps.md`, unresolved figure embedding, or workload still likely to be heavy in a 2-hour lecture.
