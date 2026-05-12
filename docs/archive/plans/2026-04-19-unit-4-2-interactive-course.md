# Unit 4-2 Interactive Course Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the full `unit-4-2-controller-selection-first-start` premium interactive lesson from the reviewed authoring/runtime sources and wire it into the premium classroom flow.

**Architecture:** Reuse the runtime-first entry-page pattern from `4-1`, the teacher-control/session-sync model from `3-2`, and the card-based interaction widgets from `3-7/4-1`. Keep the lesson-specific behavior concentrated in `unit-4-2-course.ts`, `unit-4-2-ai-contexts.ts`, `workspace.ts`, and `step-panels.tsx`, then wire route, preset, catalog, and session routing around that core.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, existing premium classroom session framework, runtime lesson loader, Vitest.

### Task 1: Freeze the lesson-to-implementation contract

**Files:**
- Create: `notes/4-2.md`
- Create: `docs/plans/2026-04-19-unit-4-2-interactive-course.md`

**Step 1: Write the design-to-implementation mapping**

Record all 14 steps, templates, interaction kinds, teacher controls, required media, and missing implementation files in `notes/4-2.md`.

**Step 2: Save the execution plan**

Write this plan document to `docs/plans/2026-04-19-unit-4-2-interactive-course.md`.

**Step 3: Verify the files exist**

Run: `rtk sed -n '1,220p' notes/4-2.md`
Expected: the mapping table and implementation scope are visible.

### Task 2: Add failing regression coverage for the 4-2 lesson contract

**Files:**
- Create: `src/features/interactive/__tests__/unit-4-2-course.test.ts`

**Step 1: Write failing tests for the course contract**

Cover:
- AI context registry entry
- 14-step flow and page types
- local page contract alignment with `course-content/authoring/lessons/4-2/design/interactive-contract.yaml`
- runtime media mapping
- entry page runtime media hub integration
- learning catalog + classroom route resolver registration
- step panel content requirements for `step-07/09/10/12/14`

**Step 2: Run the focused test and confirm it fails**

Run: `rtk npm run test -- src/features/interactive/__tests__/unit-4-2-course.test.ts`
Expected: FAIL because the 4-2 modules and routes do not exist yet.

### Task 3: Build the 4-2 course metadata, AI contexts, and shared lesson wiring

**Files:**
- Create: `src/lib/unit-4-2-course.ts`
- Create: `src/lib/unit-4-2-ai-contexts.ts`
- Modify: `src/lib/course-ai-contexts.ts`
- Modify: `src/lib/classroom-session-route.ts`
- Modify: `src/features/interactive/learning-catalog.ts`
- Create: `src/features/teacher/preset-lessons/presets/unit-4-2-controller-selection-first-start.ts`
- Modify: `src/features/teacher/preset-lessons/presets/index.ts`

**Step 1: Write minimal metadata/constants to satisfy tests**

Add route segment, preset key, lesson steps, page contracts, media mapping, teacher sync adapter, premium lesson card, and AI context registry hooks.

**Step 2: Run the focused test**

Run: `rtk npm run test -- src/features/interactive/__tests__/unit-4-2-course.test.ts`
Expected: FAIL on missing UI/route files, but metadata assertions begin to pass.

**Step 3: Refine metadata and teacher-control coverage**

Add `browseEnabled` and `teacherRevealProgress` support because `worked_example_reveal` pages need separate browse/reveal semantics.

### Task 4: Implement the lesson UI and classroom routes

**Files:**
- Create: `src/features/interactive/unit-4-2-controller-selection-first-start/course-header.tsx`
- Create: `src/features/interactive/unit-4-2-controller-selection-first-start/workspace.ts`
- Create: `src/features/interactive/unit-4-2-controller-selection-first-start/step-panels.tsx`
- Create: `src/features/interactive/unit-4-2-controller-selection-first-start/entry-page.tsx`
- Create: `src/features/interactive/unit-4-2-controller-selection-first-start/student-page.tsx`
- Create: `src/features/interactive/unit-4-2-controller-selection-first-start/teacher-page.tsx`
- Create: `src/app/interactive-learning/courses/unit-4-2-controller-selection-first-start/page.tsx`
- Create: `src/app/interactive-learning/courses/unit-4-2-controller-selection-first-start/student/[sessionId]/page.tsx`
- Create: `src/app/interactive-learning/courses/unit-4-2-controller-selection-first-start/teacher/[sessionId]/page.tsx`

**Step 1: Implement the entry page**

Reuse `LessonEntryMediaHub` and `LessonEntryRuntimeSections`, wire teacher creation/student join/demo navigation, and load runtime `4-2`.

**Step 2: Implement student/teacher pages**

Reuse the session framework and teacher control pattern from `3-2`, including release/browse/reveal/answer toggles.

**Step 3: Implement lesson-specific panels and forms**

Build the static panels, worked-example reveal chains, activity-card forms, workspace form, assessment-card grid, and teacher summaries to match the 14-step design.

**Step 4: Run the focused test**

Run: `rtk npm run test -- src/features/interactive/__tests__/unit-4-2-course.test.ts`
Expected: PASS.

### Task 5: Verify the full lesson integration

**Files:**
- Modify: `docs/ProjectDescription.md` if the premium-course inventory or module 4 status changed materially

**Step 1: Run static verification**

Run:
- `rtk npm run lint`
- `rtk npm run test`
- `rtk npm run build`

Expected: all commands succeed.

**Step 2: Run browser verification**

Open the entry page and student demo, then verify:
- `step-07` and `step-09` reveal chains advance correctly
- `step-10` shows structure, formulas, four-panel media, and worked-example cards in order
- `step-12` keeps the seven-field template visible above the workspace

**Step 3: Update notes with verification evidence**

Append the exact commands and the browser checks to `notes/4-2.md`.
