# Module4 Front-Half Reframe Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reframe module 4 so `4-1 / 4-2 / 4-3` become more concrete, example-driven, and action-oriented, then align `4-4` onward around the same pragmatic design workflow.

**Architecture:** Keep the eight-unit module-4 structure stable, but rewrite the front-half boundary definitions from “task language -> selection explanation -> initial scheme” into “task sorting from concrete evidence -> single-structure first-pass start -> composite-structure first verifiable scheme.” Then explicitly connect `4-4 / 4-5 / 4-6 / 4-7 / 4-8` through a shared “diagnose first, optimize second, migrate last” design chain across outline, decisions, and summary docs.

**Tech Stack:** Markdown documentation in `course-content/syllabus-refactor/` and `docs/ProjectDescription.md`

### Task 1: Write the reframe plan and sync target files

**Files:**
- Create: `docs/plans/2026-04-11-module4-front-half-reframe.md`
- Modify: `course-content/syllabus-refactor/unit-design-details/module4.md`
- Modify: `course-content/syllabus-refactor/module-skeletons.md`
- Modify: `course-content/syllabus-refactor/blueprint.md`
- Modify: `course-content/syllabus-refactor/main.md`
- Modify: `course-content/syllabus-refactor/decisions.md`
- Modify: `docs/ProjectDescription.md`

**Step 1: Freeze the reframe scope**

Run: `rg -n "4-1|4-2|4-3|4-4|4-5|4-6|4-7|4-8" course-content/syllabus-refactor/{main.md,decisions.md,blueprint.md,module-skeletons.md} docs/ProjectDescription.md`
Expected: Find every module-4 summary and decision location that must stay consistent.

**Step 2: Rewrite module-4 front-half boundaries**

Edit `course-content/syllabus-refactor/unit-design-details/module4.md` so that:
- `4-1` is anchored on concrete cross-domain evidence reading and task priority sorting.
- `4-2` becomes a single-structure first-pass start lesson rather than a mostly abstract “reason card” lesson.
- `4-3` becomes the first verifiable composite-structure / parameter-direction lesson.

**Step 3: Rewrite module-4 back-half continuity**

Edit `course-content/syllabus-refactor/unit-design-details/module4.md` so that:
- `4-4` starts from verification and diagnosis.
- `4-5` explicitly consumes the diagnosis sheet instead of restarting abstract optimization talk.
- `4-6` stays problem-list-driven.
- `4-7 / 4-8` preserve the same evidence-first comparison workflow under migration.

**Step 4: Sync summary docs**

Edit `course-content/syllabus-refactor/module-skeletons.md`, `course-content/syllabus-refactor/blueprint.md`, and `course-content/syllabus-refactor/main.md` to reflect the new module-4 logic chain and brief task descriptions.

**Step 5: Append a superseding decision record**

Edit `course-content/syllabus-refactor/decisions.md` with a new dated decision that explicitly supersedes the overly abstract split of `4-1 / 4-2 / 4-3` and records the pragmatic continuity rule from `4-4` onward.

**Step 6: Update project-level change log**

Edit `docs/ProjectDescription.md` with one concise update item capturing the module-4 reframe outcome.

**Step 7: Run consistency checks**

Run: `rg -n "4-1|4-2|4-3|4-4|4-5|4-6|4-7|4-8" course-content/syllabus-refactor/{main.md,decisions.md,blueprint.md,module-skeletons.md} docs/ProjectDescription.md`
Expected: Updated wording is consistent across all affected docs.

Run: `git diff -- course-content/syllabus-refactor/unit-design-details/module4.md course-content/syllabus-refactor/module-skeletons.md course-content/syllabus-refactor/blueprint.md course-content/syllabus-refactor/main.md course-content/syllabus-refactor/decisions.md docs/ProjectDescription.md docs/plans/2026-04-11-module4-front-half-reframe.md`
Expected: Diff shows only the intended module-4 outline and summary documentation changes.
