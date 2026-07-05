---
change_id: enforce-appshell-route-coverage-governance
claim_branch: enforce-appshell-route-coverage-governance
series: sitewide-navigation-unification
coupling_group: ui-shell-nav-2026-07
execution_mode: stacked
base_branch: integration
required_branch:
depends_on:
  - define-universal-appshell-frame-contract
  - migrate-primary-product-appshell-chrome
  - migrate-deep-product-routes-appshell-chrome
parent_issue:
blocked_by:
  - define-universal-appshell-frame-contract
  - migrate-primary-product-appshell-chrome
  - migrate-deep-product-routes-appshell-chrome
blocking: []
openspec_path: openspec/changes/enforce-appshell-route-coverage-governance
risk: medium
area: ui-shell
---

## Goal

Add durable governance so all non-home application routes must use the unified AppShell frame or an explicitly reviewed exception.

## Scope

- Static route shell and wrapper coverage tests.
- Exception inventory.
- DOM and visual checks for navigation order, breadcrumbs, and top-right action order.
- Governance wiring for future routes.

## Out of Scope

- Performing the migrations that this change verifies.
- Redesigning internal content layouts.

## Acceptance Checklist

- [ ] AC-1: Static tests fail on any non-exempt `src/app/**/page.tsx` route without AppShell-compatible coverage. Owner: independent reviewer.
  Evidence: route shell coverage test output.
- [ ] AC-2: Exception inventory records owner, reason, violated rule, and removal condition for every allowed shell-free route. Owner: independent reviewer.
  Evidence: exception inventory review and test output.
- [ ] AC-3: Browser or DOM tests verify canonical nav order, breadcrumb presence, and theme switch before Personal Center. Owner: independent reviewer.
  Evidence: Playwright/DOM test output for representative route matrix.
- [ ] AC-4: Visual audit passes for primary and representative deep routes. Owner: independent reviewer.
  Evidence: screenshot artifact paths and visual audit report.
- [ ] AC-5: Every AppShell-compatible wrapper has a registry entry and passing shell DOM contract test before its routes count as covered. Owner: independent reviewer.
  Evidence: wrapper registry test output.
- [ ] AC-6: Responsive visual audit covers 1440, 1280, 1024, 768, 390, and 320 widths for primary and fixed deep route families. Owner: independent reviewer.
  Evidence: screenshot artifact paths, DOM metrics, and no-overlap/no-overflow reports.
- [ ] AC-7: Teacher and administrator Personal Center targets are role-safe and do not point to the student `/profile` without explicit safe mode. Owner: independent reviewer.
  Evidence: DOM target assertions for teacher and administrator representative routes.

## Tasks

- [ ] Task 1: Implement static route shell coverage scanner.
  Covers: AC-1
  Acceptance: Scanner enumerates pages, resolves ancestor layouts/wrappers, and reports unclassified routes.
  Evidence: route coverage test output.
  Reviewer Check: Confirm scanner catches ordinary pages, not only first-level pages.
- [ ] Task 2: Add exception inventory and checks.
  Covers: AC-2
  Acceptance: Every shell-free route is classified with required metadata.
  Evidence: exception inventory and failing fixture test.
  Reviewer Check: Confirm no ordinary product route is exempt without a blocker.
- [ ] Task 3: Add wrapper registry plus DOM route matrix checks.
  Covers: AC-3, AC-5, AC-7
  Acceptance: Registered wrappers and representative routes pass navigation, breadcrumb, action-order, and local-command isolation checks.
  Evidence: wrapper registry and DOM test output.
  Reviewer Check: Confirm checks cover direct AppShell routes and registered wrappers rather than import-name heuristics, and confirm teacher/admin account targets are role-safe.
- [ ] Task 4: Add fixed visual route matrix checks.
  Covers: AC-4, AC-6
  Acceptance: Primary and fixed deep route families pass visual consistency checks at required viewports.
  Evidence: test output and screenshot artifacts.
  Reviewer Check: Confirm checks cover Knowledge Graph, Learning Path, Interactive Learning, Arena, Simulation, Control Workbench, Personal Center, teacher, admin, data-center, graph-center, lesson runtime, classroom, AI, playlist, Arena child, simulation child, assessment child, and virtual-lab representatives.

## Issue Readiness

- Labels to apply: `status:ready`, `type:change`, `area:ui-shell`, `series:sitewide-navigation-unification`, `risk:medium`, `mode:stacked`, `coupling:ui-shell-nav-2026-07`.
- Project item: add to the configured OpenSpec Buddy project in Todo.
- Relationship readiness: blocked by the shell contract, primary migration, and deep route migration issues.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
