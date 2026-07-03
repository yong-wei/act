---
change_id: merge-learner-profile-dashboard
claim_branch: merge-learner-profile-dashboard
series: sitewide-navigation-unification
coupling_group: ui-shell-nav-2026-07
execution_mode: isolated
base_branch: integration
required_branch:
depends_on:
  - standardize-primary-navigation-order
parent_issue: 796
blocked_by: []
blocking: []
openspec_path: openspec/changes/merge-learner-profile-dashboard
risk: medium
area: ui-shell
---

## Goal

Unify the student Dashboard and Profile into `/profile` as one Personal Center dispatch page so students have one account and learner-record destination.

## Scope

- Establish `/profile` as the canonical Personal Center route.
- Preserve `/dashboard` compatibility.
- Merge dashboard dispatch content with profile modules.
- Keep profile subroutes reachable as secondary views.

## Out of Scope

- Teacher/admin user-center migration.
- Konling chat UI changes.
- Resource or learner-state data completion.
- Redesigning every profile subroute.

## Acceptance Checklist

- [ ] AC-1: Students see one first-level Personal Center destination rather than separate dashboard/profile destinations. Owner: independent reviewer.
  Evidence: navigation tests or route inventory checks.
- [ ] AC-2: `/dashboard` remains compatible and resolves to the `/profile` Personal Center experience. Owner: independent reviewer.
  Evidence: route test or browser check for `/dashboard`.
- [ ] AC-3: The merged page includes dashboard dispatch plus profile modules without duplicate hero or next-action sections. Owner: independent reviewer.
  Evidence: visual evidence and source review.
- [ ] AC-4: Missing learner data renders honest empty/limited states while preserving navigation. Owner: independent reviewer.
  Evidence: test fixture or manual check with sparse learner profile.

## Tasks

- [ ] Task 1: Implement `/profile` canonical route and compatibility behavior.
  Covers: AC-1, AC-2
  Acceptance: `/profile` owns Personal Center, and `/dashboard` no longer acts as a competing first-level page.
  Evidence: route tests and navigation inventory output.
  Reviewer Check: Confirm existing authenticated redirects still work.
- [ ] Task 2: Merge dashboard and profile modules.
  Covers: AC-3
  Acceptance: Dashboard dispatcher content and profile evidence/competency/activity modules render in one coherent Personal Center.
  Evidence: changed page code and screenshots.
  Reviewer Check: Confirm duplicate hero/next-action modules were removed.
- [ ] Task 3: Validate incomplete-data states.
  Covers: AC-4
  Acceptance: Sparse or new student accounts see honest empty states and can still navigate.
  Evidence: fixture, test, or manual browser check.
  Reviewer Check: Confirm missing data is not treated as a fatal page failure.

## Agent Guardrails

- Do not remove `/profile/growth`, `/profile/portfolio`, or `/profile/evidence`.
- Preserve teacher/admin role redirects.
- Do not complete Yang Fan fixture data in this change.
- Do not change canonical navigation order outside the dependency contract.
