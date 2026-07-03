---
change_id: standardize-primary-navigation-order
claim_branch: standardize-primary-navigation-order
series: sitewide-navigation-unification
coupling_group: ui-shell-nav-2026-07
execution_mode: isolated
base_branch: integration
required_branch:
depends_on: []
parent_issue:
blocked_by: []
blocking:
  - refresh-home-brand-and-account-entry
  - merge-learner-profile-dashboard
  - simplify-konling-floating-entry
  - migrate-role-workspaces-to-appshell-navigation
openspec_path: openspec/changes/standardize-primary-navigation-order
risk: medium
area: ui-shell
---

## Goal

Make the platform first-level navigation order a single central contract shared by homepage entries, AppShell rails, student cockpit, and account/profile access.

## Scope

- Define canonical first-level navigation order.
- Wire homepage and AppShell consumers to the central order.
- Preserve the existing collapsed icon rail and expanded text behavior.
- Treat Personal Center as account/learner-record reachability rather than a core product module.
- Add tests or governance checks for order parity.

## Out of Scope

- Replacing the visual design of the AppShell rail.
- Merging `/profile` and `/dashboard`.
- Changing Konling floating entry behavior.
- Migrating teacher/admin operation pages into AppShell.

## Acceptance Checklist

- [ ] AC-1: Student first-level navigation uses the canonical order across homepage and AppShell consumers. Owner: independent reviewer.
  Evidence: targeted navigation tests or source-level governance checks.
- [ ] AC-2: Collapsed rail icon-only state and expanded text state preserve the same labels, focus order, and active route semantics. Owner: independent reviewer.
  Evidence: visual evidence or DOM assertions for folded and expanded states.
- [ ] AC-3: Local tools and teacher/admin secondary navigation do not override the canonical first-level order. Owner: independent reviewer.
  Evidence: route inventory or governance check covering primary versus secondary navigation.

## Tasks

- [ ] Task 1: Implement the central canonical order.
  Covers: AC-1
  Acceptance: Home, Knowledge Resources, Interactive Learning, Learning Path, Arena, Virtual Simulation, Control Workbench, and Personal Center are ordered from one source of truth, with Personal Center treated as account/learner-record reachability rather than a core learning module.
  Evidence: changed central navigation code and tests.
  Reviewer Check: Confirm no page-local first-level order remains for the affected routes.
- [ ] Task 2: Verify collapsed and expanded rail parity.
  Covers: AC-2
  Acceptance: Folded rail shows icons only, expanded rail shows text, and both share ordering and active state.
  Evidence: screenshot/DOM evidence for `/knowledge` or another AppShell route in both states.
  Reviewer Check: Confirm the existing fold/expand interaction was not regressed.
- [ ] Task 3: Add governance for primary versus secondary navigation.
  Covers: AC-3
  Acceptance: Teacher/admin local operation tabs remain subordinate and cannot replace first-level route navigation.
  Evidence: route inventory or governance test output.
  Reviewer Check: Confirm the change does not remove needed local teacher/admin workflow tabs.

## Agent Guardrails

- Do not redesign the rail visuals.
- Do not merge profile and dashboard in this change.
- Do not change Konling chat rendering or citation behavior.
- Stop if another active change already owns the same navigation-order contract.
