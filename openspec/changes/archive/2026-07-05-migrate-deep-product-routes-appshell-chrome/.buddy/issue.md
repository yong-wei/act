---
change_id: migrate-deep-product-routes-appshell-chrome
claim_branch: migrate-deep-product-routes-appshell-chrome
series: sitewide-navigation-unification
coupling_group: ui-shell-nav-2026-07
execution_mode: stacked
base_branch: integration
required_branch:
depends_on:
  - define-universal-appshell-frame-contract
  - migrate-primary-product-appshell-chrome
blocked_by:
  - define-universal-appshell-frame-contract
  - migrate-primary-product-appshell-chrome
blocking:
  - enforce-appshell-route-coverage-governance
openspec_path: openspec/changes/migrate-deep-product-routes-appshell-chrome
risk: high
area: ui-shell
---

## Goal

Make all second-level and deeper product routes use the same AppShell navigation, top bar, breadcrumbs, and account/theme action behavior.

## Scope

- Course and lesson runtime routes.
- Classroom routes.
- Teacher, administrator, data-center, graph-center, AI, playlist, dashboard, missions, assessment, Arena child, simulation child, legacy interactive, and virtual-lab routes.
- Route exceptions for auth, print, visual review, and embed-only surfaces.

## Out of Scope

- Changing lesson content or classroom business logic.
- Reworking primary module entry pages, except where needed for deep-route active-state mapping.

## Acceptance Checklist

- [ ] AC-1: Every deep product route is wrapped by AppShell/AppShell-compatible shell or listed in the exception inventory. Owner: independent reviewer.
  Evidence: static route shell coverage report.
- [ ] AC-2: Course, lesson, and classroom routes retain canonical navigation and shared top bar without losing immersive controls. Owner: independent reviewer.
  Evidence: representative Playwright screenshots and DOM assertions.
- [ ] AC-3: Teacher, administrator, data-center, graph-center, AI, playlist, dashboard, missions, virtual-lab, assessment, Arena child, simulation child, and legacy interactive pages have breadcrumbs and correct active top-level navigation. Owner: independent reviewer.
  Evidence: route matrix test output and source review.
- [ ] AC-4: Deep route local controls do not replace or reorder shell-level theme switch and Personal Center actions. Owner: independent reviewer.
  Evidence: DOM tests and source review.
- [ ] AC-5: Every AppShell-compatible wrapper used by deep routes is registered and passes the shared DOM contract. Owner: independent reviewer.
  Evidence: wrapper registry tests for `InteractiveLearningShell`, `CourseEntryShell`, `LessonRuntimeShell`, classroom shell, teacher shell, admin shell, Arena shell, and simulation shell.

## Tasks

- [ ] Task 1: Classify and wrap deep product routes.
  Covers: AC-1, AC-5
  Acceptance: Static coverage report contains no unclassified deep product routes.
  Evidence: route coverage test output.
  Reviewer Check: Confirm ordinary learning/classroom/AI routes are not hidden as exceptions.
- [ ] Task 2: Migrate course, lesson, and classroom routes.
  Covers: AC-2, AC-4
  Acceptance: Representative runtime routes keep shell orientation and local controls.
  Evidence: Playwright screenshots and DOM assertions.
  Reviewer Check: Confirm immersive teaching controls remain available without replacing top-level shell.
- [ ] Task 3: Migrate role, AI, playlist, legacy, graph/data, and virtual-lab routes.
  Covers: AC-3, AC-4, AC-5
  Acceptance: Routes have breadcrumbs, correct active nav, and consistent header actions.
  Evidence: route matrix test output and screenshots.
  Reviewer Check: Confirm no local topbar competes with AppShell and teacher/admin Personal Center targets remain role-safe.

## Issue Readiness

- Labels to apply: `status:ready`, `type:change`, `area:ui-shell`, `series:sitewide-navigation-unification`, `risk:high`, `mode:stacked`, `coupling:ui-shell-nav-2026-07`.
- Project item: add to the configured OpenSpec Buddy project in Todo.
- Relationship readiness: blocked by `define-universal-appshell-frame-contract` and `migrate-primary-product-appshell-chrome`; blocks `enforce-appshell-route-coverage-governance`.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
