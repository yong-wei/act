---
change_id: migrate-role-workspaces-to-appshell-navigation
claim_branch: migrate-role-workspaces-to-appshell-navigation
series: sitewide-navigation-unification
coupling_group: ui-shell-nav-2026-07
execution_mode: isolated
base_branch: integration
required_branch:
depends_on:
  - standardize-primary-navigation-order
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/migrate-role-workspaces-to-appshell-navigation
risk: medium
area: ui-shell
---

## Goal

Move teacher and administrator primary workspaces toward the same AppShell first-level navigation frame while preserving their local operation workflows.

## Scope

- Inventory teacher/admin legacy topbars and shell divergence.
- Migrate selected primary role layouts to AppShell-compatible frames.
- Make operation tabs secondary navigation.
- Standardize role-aware top-right personal-center/account and theme actions.

## Out of Scope

- Redesigning all teacher/admin business modules.
- Changing teacher/admin authorization policy.
- Merging student Personal Center.
- Changing Konling chat UI.

## Acceptance Checklist

- [ ] AC-1: Teacher/admin primary routes either use AppShell-compatible first-level navigation or declare explicit temporary exceptions. Owner: independent reviewer.
  Evidence: route inventory or governance output.
- [ ] AC-2: Teacher/admin operation tabs remain reachable as secondary workflow navigation and do not replace global navigation. Owner: independent reviewer.
  Evidence: screenshots and source review.
- [ ] AC-3: Role workspaces expose consistent top-right role-aware 个人中心/account access and theme switching without routing teachers/admins into the student learner-record profile. Owner: independent reviewer.
  Evidence: visual evidence and AppShell/action-slot source check.
- [ ] AC-4: Existing role redirects and permissions are preserved. Owner: independent reviewer.
  Evidence: route tests or manual checks for student, teacher, and admin roles.

## Tasks

- [ ] Task 1: Inventory and classify role shell divergence.
  Covers: AC-1
  Acceptance: Affected teacher/admin routes are marked migrate-now or temporary exception.
  Evidence: route ledger or governance report.
  Reviewer Check: Confirm exceptions are narrow and have removal conditions.
- [ ] Task 2: Migrate selected role layouts to AppShell-compatible frames.
  Covers: AC-1, AC-2, AC-3
  Acceptance: Static role topbars no longer own first-level navigation on migrated routes.
  Evidence: changed layout code and screenshots for `/teacher`, one teacher secondary operation page, `/admin`, and one administrator secondary page.
  Reviewer Check: Confirm local operation tabs remain available as secondary controls.
- [ ] Task 3: Define role-aware Personal Center targets.
  Covers: AC-3
  Acceptance: Student routes target `/profile`; teacher/admin routes target registered role-appropriate account or operations-center destinations.
  Evidence: route navigation code and screenshots for top-right actions.
  Reviewer Check: Confirm teachers/admins are not sent into the student learner-record profile.
- [ ] Task 4: Validate role auth and routing.
  Covers: AC-4
  Acceptance: Student, teacher, and admin redirects remain correct.
  Evidence: route tests or manual checks.
  Reviewer Check: Confirm no role can access a workspace it should not access.

## Agent Guardrails

- Preserve teacher/admin local workflows.
- Do not mix admin domain entries into student module navigation.
- Do not remove temporary legacy routes without compatibility handling.
- Stop if the route ledger indicates another active change owns a specific role workspace migration.
