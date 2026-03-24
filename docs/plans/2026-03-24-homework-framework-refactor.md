# Homework Framework Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the syllabus homework framework so that 7 assignments, 20 closed-form exam-bank questions, and a 7-step open design thread all align with the new module/ability architecture.

**Architecture:** Treat homework as the bridge between module progression and final review. The refactor will replace the old layer-based homework structure with a module-aligned sequence, split questions into a stable closed-question exam bank plus a continuous open design dossier, and explicitly define how the closed bank feeds the final review architecture.

**Tech Stack:** Markdown, `course-content/syllabus-refactor/*.md`, repository planning docs

### Task 1: Confirm scope and target files

**Files:**
- Modify: `course-content/syllabus-refactor/homework-framework.md`
- Modify: `course-content/syllabus-refactor/main.md`
- Modify: `course-content/syllabus-refactor/decisions.md`

**Step 1: Re-read current homework framework and current syllabus truth sources**

Run: `sed -n '1,520p' course-content/syllabus-refactor/homework-framework.md && sed -n '1,260p' course-content/syllabus-refactor/module-skeletons.md && sed -n '1,260p' course-content/syllabus-refactor/blueprint.md`
Expected: Old homework structure still reflects outdated layer-based organization and is inconsistent with current module 1-5 structure.

**Step 2: Extract the required redesign constraints**

Run: `rg -n "结构可见|结构可用|结构可评|模块4|模块5|期末复习" course-content/syllabus-refactor/{blueprint,module-skeletons,main,decisions}.md`
Expected: Enough evidence to map homework to the current course ability chain and review entry.

### Task 2: Rewrite the homework framework

**Files:**
- Modify: `course-content/syllabus-refactor/homework-framework.md`

**Step 1: Replace the old assignment architecture**

Implementation:
- Remove old layer-based assignment timing and outdated 26-question bank.
- Introduce a new framework with:
  - 7 assignments
  - 20 closed questions total
  - 7 open-ended progressive tasks that form one evolving control-design dossier
  - explicit workload rules and scoring boundaries

**Step 2: Define assignment-by-assignment structure**

Implementation:
- For each homework, specify:
  - release timing
  - closed-question focus
  - open-thread deliverable
  - expected outputs
  - relation to prior and next homework

**Step 3: Define the 20-question bank structure**

Implementation:
- Provide question IDs and concise specs grouped by homework.
- Ensure closed questions cover:
  - modeling/computation
  - structural mechanism
  - cross-domain translation
  - constrained design judgment
  - boundary/method comparison

**Step 4: Add final-review interface**

Implementation:
- Explicitly state how the closed-question bank determines the final review structure.
- State that the final review cannot be finalized independently of the homework bank.

### Task 3: Sync confirmed decisions

**Files:**
- Modify: `course-content/syllabus-refactor/main.md`
- Modify: `course-content/syllabus-refactor/decisions.md`

**Step 1: Add one new confirmed-summary block**

Implementation:
- Record that homework is now organized as:
  - 7 assignments
  - 20 closed exam-bank questions
  - 1 continuous open design thread from problem definition to final control solution

**Step 2: Add one new decision log entry**

Implementation:
- Record the rationale, impact range, and review implications of the homework redesign.

### Task 4: Verify document integrity

**Files:**
- Modify: `course-content/syllabus-refactor/homework-framework.md`
- Modify: `course-content/syllabus-refactor/main.md`
- Modify: `course-content/syllabus-refactor/decisions.md`
- Create: `docs/plans/2026-03-24-homework-framework-refactor.md`

**Step 1: Check formatting**

Run: `git diff --check -- course-content/syllabus-refactor/homework-framework.md course-content/syllabus-refactor/main.md course-content/syllabus-refactor/decisions.md docs/plans/2026-03-24-homework-framework-refactor.md`
Expected: No whitespace or conflict-marker errors.

**Step 2: Check critical keywords**

Run: `rg -n "7次作业|20道闭题|开放主线|期末复习接口|结构可见|结构可用|结构可评" course-content/syllabus-refactor/homework-framework.md course-content/syllabus-refactor/main.md course-content/syllabus-refactor/decisions.md`
Expected: New homework architecture and review interface are visible in all three files.
