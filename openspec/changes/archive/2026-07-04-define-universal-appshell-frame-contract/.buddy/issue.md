---
change_id: define-universal-appshell-frame-contract
claim_branch: define-universal-appshell-frame-contract
series: sitewide-navigation-unification
coupling_group: ui-shell-nav-2026-07
execution_mode: isolated
base_branch: integration
required_branch:
depends_on: []
parent_issue:
blocked_by: []
blocking:
  - migrate-primary-product-appshell-chrome
  - migrate-deep-product-routes-appshell-chrome
  - enforce-appshell-route-coverage-governance
openspec_path: openspec/changes/define-universal-appshell-frame-contract
risk: medium
area: ui-shell
---

## Goal

Define the universal AppShell navigation and header contract that every non-home application page must follow.

## Scope

- Define mandatory left navigation, top bar, breadcrumb, and top-right action ordering rules.
- Add route exception inventory requirements.
- Add static governance expectations for shell coverage.

## Out of Scope

- Migrating every existing route implementation.
- Redesigning internal business content.

## Acceptance Checklist

- [ ] AC-1: The spec requires every non-home application route to use AppShell or a registered AppShell-compatible wrapper. Owner: independent reviewer.
  Evidence: `rtk openspec validate define-universal-appshell-frame-contract --strict`; spec delta review.
- [ ] AC-2: The canonical left navigation order is specified for all AppShell-backed routes. Owner: independent reviewer.
  Evidence: route metadata contract test or source review of `platform-role-navigation` expectations.
- [ ] AC-3: The top-right action order is specified as theme switch followed by Personal Center, with route-local commands excluded from that pair. Owner: independent reviewer.
  Evidence: AppShell header contract test or source review.
- [ ] AC-4: Breadcrumb and exception-inventory requirements are specified for non-home routes. Owner: independent reviewer.
  Evidence: static route governance test design and spec review.
- [ ] AC-5: AppShell-compatible wrappers must be registered and independently tested before their routes count as covered. Owner: independent reviewer.
  Evidence: wrapper registry and DOM contract test design.

## Tasks

- [ ] Task 1: Add universal AppShell frame spec requirements.
  Covers: AC-1, AC-4
  Acceptance: Spec clearly distinguishes normal application routes from governed exceptions.
  Evidence: `rtk openspec validate define-universal-appshell-frame-contract --strict`.
  Reviewer Check: Confirm no product route class can bypass shell coverage without exception metadata.
- [ ] Task 2: Add canonical primary navigation requirements.
  Covers: AC-2
  Acceptance: The exact navigation order is recorded and applies to nested routes.
  Evidence: Spec delta and route metadata test plan.
  Reviewer Check: Confirm profile and nested routes are included, not only first-level modules.
- [ ] Task 3: Add top-right action and breadcrumb requirements.
  Covers: AC-3, AC-4
  Acceptance: Every non-exempt non-home route must render theme switch before role-aware Personal Center; route-local controls are excluded from that pair.
  Evidence: Spec delta and AppShell header contract test plan.
  Reviewer Check: Confirm path management, return links, and local tools cannot occupy the account/theme slot.
- [ ] Task 4: Add governed wrapper registry requirements.
  Covers: AC-5
  Acceptance: A wrapper must be registered and pass shell DOM tests before any route it owns is considered covered.
  Evidence: Spec delta and wrapper registry test plan.
  Reviewer Check: Confirm `InteractiveLearningShell`, `CourseEntryShell`, `LessonRuntimeShell`, classroom shell, teacher shell, and admin shell are in scope.

## Issue Readiness

- Labels to apply: `status:ready`, `type:change`, `area:ui-shell`, `series:sitewide-navigation-unification`, `risk:medium`, `mode:isolated`, `coupling:ui-shell-nav-2026-07`.
- Project item: add to the configured OpenSpec Buddy project in Todo.
- Relationship readiness: this issue blocks the three migration/governance follow-up issues in this series.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
