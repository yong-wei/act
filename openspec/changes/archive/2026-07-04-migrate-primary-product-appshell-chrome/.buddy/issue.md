---
change_id: migrate-primary-product-appshell-chrome
claim_branch: migrate-primary-product-appshell-chrome
series: sitewide-navigation-unification
coupling_group: ui-shell-nav-2026-07
execution_mode: stacked
base_branch: integration
required_branch:
depends_on:
  - define-universal-appshell-frame-contract
parent_issue:
blocked_by:
  - define-universal-appshell-frame-contract
blocking:
  - enforce-appshell-route-coverage-governance
openspec_path: openspec/changes/migrate-primary-product-appshell-chrome
risk: medium
area: ui-shell
---

## Goal

Make all primary product modules use the same AppShell left navigation, breadcrumbs, and top-right action order.

## Scope

- Knowledge Graph, Interactive Learning, Learning Path, Arena, Virtual Simulation, Control Workbench, and Personal Center entry surfaces.
- Header action order and relocation of route-local commands.
- Representative visual/DOM checks for primary routes.

## Out of Scope

- Deep lesson/classroom/runtime route migration.
- Redesigning the internal content of any module.

## Acceptance Checklist

- [ ] AC-1: Representative primary routes use the canonical collapsible left navigation and navigation order. Owner: independent reviewer.
  Evidence: route inventory tests and visual/DOM checks for the primary route matrix.
- [ ] AC-2: Top-right actions render theme switch first and Personal Center second on all primary routes. Owner: independent reviewer.
  Evidence: DOM tests or Playwright assertions for representative routes.
- [ ] AC-3: Knowledge Graph and other primary routes expose breadcrumbs through the shared top bar. Owner: independent reviewer.
  Evidence: DOM tests and screenshots for `/knowledge` and the route matrix.
- [ ] AC-4: Path management, return-to-exploration, and other local commands are no longer placed in the shell account/theme action area. Owner: independent reviewer.
  Evidence: source review and DOM tests for Learning Path and Control Workbench.
- [ ] AC-5: Primary route responsive states pass at 1440, 1280, 1024, 768, 390, and 320 widths. Owner: independent reviewer.
  Evidence: Playwright screenshots or DOM metrics for the primary route matrix.

## Tasks

- [ ] Task 1: Normalize primary route metadata and sidebar mode.
  Covers: AC-1
  Acceptance: Primary routes resolve to the canonical collapsible navigation rail and active item.
  Evidence: route inventory test output.
  Reviewer Check: Confirm `/profile` and nested primary surfaces are not left in fixed sidebar mode.
- [ ] Task 2: Centralize primary header actions.
  Covers: AC-2, AC-4
  Acceptance: Header action order is controlled by the shared shell and route-local commands move to documented local zones.
  Evidence: source review and DOM assertions.
  Reviewer Check: Confirm no primary route passes Personal Center, path management, or return links through the shell account/theme slot.
- [ ] Task 3: Add breadcrumbs and representative visual checks.
  Covers: AC-3, AC-5
  Acceptance: Each primary route has breadcrumb orientation and screenshots show consistent top bars across required viewports.
  Evidence: Playwright screenshots or DOM assertions for the primary route matrix.
  Reviewer Check: Confirm Knowledge Graph has breadcrumbs and no page-specific substitute.

## Issue Readiness

- Labels to apply: `status:ready`, `type:change`, `area:ui-shell`, `series:sitewide-navigation-unification`, `risk:medium`, `mode:stacked`, `coupling:ui-shell-nav-2026-07`.
- Project item: add to the configured OpenSpec Buddy project in Todo.
- Relationship readiness: blocked by `define-universal-appshell-frame-contract`; blocks `enforce-appshell-route-coverage-governance`.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
