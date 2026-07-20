## 1. Default-Class Persistence and Invariants

- [ ] 1.1 Add the nullable teacher-owned default-class Prisma relation as an expand migration and prove existing `ClassSession.classId` values remain unchanged.
- [ ] 1.2 Implement the shared serializable default-class service for create, set-default, activate, deactivate, and delete operations with bounded write-conflict retries.
- [ ] 1.3 Route every teacher class lifecycle mutation through the shared service, drain old writers, and add an advisory-locked idempotent reconciliation plus a zero-violation invariant gate for ownership, activity, uniqueness, and missing defaults when active classes exist.
- [ ] 1.4 Add migration and real-PostgreSQL concurrency tests for first class, additional class, reactivation, default replacement, deletion, competing mutations, and class changes between schema expansion and final reconciliation.

## 2. Class and Session APIs

- [ ] 2.1 Return default state from the teacher class list and add authenticated launch-options and set-default endpoints with owned-active-class validation.
- [ ] 2.2 Require an explicit owned active `classId` for teacher session creation, retain administrator temporary launch, validate class status in the same serializable boundary as session creation, and enable enforcement only after the reconciliation and producer-inventory gates pass.
- [ ] 2.3 Preserve duplicate-session identity and generated-courseware revision binding from `publish-smart-courseware-to-classroom` while applying the selected class identity.
- [ ] 2.4 Remove participant-based class inference when legacy classless teacher sessions finish while preserving explicit history repair, and add route tests for missing, foreign, inactive, default, current-context, alternate, and administrator-temporary selections, deactivation races, and classless `ACTIVE` to `FINISHED` transitions.

## 3. Class Management and Shared Launch UI

- [ ] 3.1 Update class cards with the diagonal default label, accessible hover/focus/touch set-default action, announced result state, and separate navigation/action hit areas.
- [ ] 3.2 Build the shared teacher launch controller and dialog with active launch options, current-class-over-default precedence, explicit alternate selection, one-class confirmation, empty state, stale-option recovery, and duplicate-session choices.
- [ ] 3.3 Migrate interactive-course entry shells, teacher lesson-plan cards, playlist launch, and class-detail launch to the shared controller, removing direct teacher session creation from those surfaces.
- [ ] 3.4 Add component and Playwright coverage for dialog accessible naming, initial and restored focus, keyboard selection/submission/cancellation/Escape, announced loading/error/stale-refresh states, desktop pointer behavior, touch/mobile actions, inactive class blocking, no-class recovery, class-context precedence, and non-persistent alternate selection.

## 4. Regression and Delivery Gates

- [ ] 4.1 Add a teacher-launch producer inventory gate that fails when a teacher-facing start action bypasses the shared launcher or can omit `classId`.
- [ ] 4.2 Run the focused migration, class API, session route, launch-dialog, interactive-entry, lesson-plan, playlist, and class-detail test suites, then run typecheck, lint, unit/smoke suites, affected Playwright coverage, and the final build.
- [ ] 4.3 Verify existing class-bound sessions, historical classless sessions, administrator temporary sessions, generated-courseware sessions, waiting rooms, student join authorization, finalization, and report attribution retain their intended behavior.
- [ ] 4.4 Update project/operator documentation for the teacher default-class invariant, administrator temporary exception, migration, rollback, and launch-entry extension rule.
- [ ] 4.5 Run `openspec validate add-default-teacher-class-launch-selection --type change --strict` and record final implementation and browser evidence before review.
