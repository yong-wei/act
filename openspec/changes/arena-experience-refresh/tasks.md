## 1. Arena Entry Shell And Public Navigation

- [x] 1.1 Add a shared Arena page shell for left project navigation and real-route breadcrumbs.
- [x] 1.2 Refactor `src/features/arena/arena-hall.tsx` to the new shell and reference-image layout.
- [x] 1.3 Refactor `src/features/arena/challenge-detail.tsx` to the new shell and reference-image layout.
- [x] 1.4 Remove the public `评审入口` link from `src/app/page.tsx` module links and top navigation while keeping `/review` routes intact.
- [x] 1.5 Remove the public `评审入口` link from `src/app/(auth)/layout.tsx`.
- [x] 1.6 Update Arena route/home smoke scripts to assert breadcrumbs, left navigation, no review entry, and real challenge links.

## 2. Arena Display Labels, Rules, And Leaderboard Summary

- [x] 2.1 Add Arena display helper functions for source, visibility, method, workspace, leaderboard type, hard constraint, and tie-breaker Chinese labels.
- [x] 2.2 Add LaTeX model fields to white-box transfer-function seed data and render them with KaTeX on the detail page.
- [x] 2.3 Split challenge detail evaluation rules into a basic-goal table and a separate hard-constraint module.
- [x] 2.4 Restrict student-visible leaderboard tabs and filters to `main`, `method`, and `metric` without deleting backend leaderboard types.
- [x] 2.5 Update leaderboard summaries so raw ids such as `hardConstraintPass`, `submittedAt`, and `closed_loop_stable` are not student-visible.

## 3. Knowledge Graph Integration

- [x] 3.1 Change Arena related-knowledge seed data to `{ label, nodeId }` references.
- [x] 3.2 Validate all Arena related-knowledge `nodeId` values against `course-content/runtime/knowledge/graph/nodes.json`.
- [x] 3.3 Add a challenge-detail knowledge preview that fetches `/api/knowledge/nodes/[id]`.
- [x] 3.4 Reuse existing knowledge card and infograph presentation for related knowledge preview.
- [x] 3.5 Update Arena filtering tests so search still matches related knowledge labels after the data shape change.

## 4. Workbench Correction Controls And Chinese Formula UI

- [x] 4.1 Extend `CorrectionState` with controller/correction gain and synchronize reset, challenge seed, and free-explore selection paths.
- [x] 4.2 Update `correctionToStructures`, root handles, turn-frequency handles, and request building to use the effective controller gain consistently.
- [x] 4.3 Move gain editing into the correction-device section when correction is enabled and keep the plant/object tab focused on object zero-pole data.
- [x] 4.4 Add dynamic LaTeX controller expression rendering below the correction structure selector.
- [x] 4.5 Update numeric inputs to step by 1, show two decimals outside active editing, and support full-value replacement.
- [x] 4.6 Stabilize parameter drawer tabs so labels and active state do not deform when switching correction structures.
- [x] 4.7 Replace remaining English workbench headings and status messages with Chinese text.

## 5. Three-Domain Chart Synchronization

- [x] 5.1 Add stable-response y-axis auto-range behavior for time-domain charts without breaking manual pan/zoom preservation.
- [x] 5.2 Show effective open-loop gain in the root-locus full-view status area.
- [x] 5.3 Ensure root-locus closed-loop poles use the same effective gain used by workbench artifact generation.
- [x] 5.4 Ensure dragging correction zero/pole handles updates parameter drawer values.
- [x] 5.5 Ensure editing parameter drawer zero/pole values updates root-locus handles.

## 6. Official Evaluation And Submission Consistency

- [x] 6.1 Remove challenge-detail official submission and local preview surfaces; keep official submission in workbench submit panels only.
- [x] 6.2 Fix PID-family transfer-function construction in `whitebox-evaluator.ts` so PD has no integrator pole and PI/PID retain the integrator pole.
- [x] 6.3 Add a regression test for `task-second-order-lead-pid` with `Kp=250.583`, `Ki=0`, `Kd=29.128` passing `closed_loop_stable`.
- [x] 6.4 Update `buildArenaArtifactFromMultiRepresentationState` so PID and serial-compensator artifacts preserve the same effective parameters used by workbench charts.
- [x] 6.5 Update workbench official submission result rendering so metric labels, hard constraints, errors, and explanations are Chinese.

## 7. Verification

- [x] 7.1 Run Arena route/home smoke scripts and update expected assertions.
- [x] 7.2 Run targeted Arena Vitest suites for domain, filtering, leaderboard, white-box evaluation, controller artifact, and multi-representation artifact mapper behavior.
- [x] 7.3 Run targeted multi-representation workbench tests for correction state, drawer input behavior, and chart synchronization.
- [x] 7.4 Start the local dev server and verify `/arena`, `/arena/challenges/task-second-order-lead-pid`, and the linked multi-representation workbench in a browser.
- [x] 7.5 Run `npm run test:unit`, `npm run test`, and `npm run lint`; run `npm run build` if the touched files affect build-time behavior.
