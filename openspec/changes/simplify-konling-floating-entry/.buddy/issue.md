---
change_id: simplify-konling-floating-entry
claim_branch: simplify-konling-floating-entry
series: sitewide-navigation-unification
coupling_group: ui-shell-nav-2026-07
execution_mode: isolated
base_branch: integration
required_branch:
depends_on:
  - standardize-primary-navigation-order
  - refresh-home-brand-and-account-entry
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/simplify-konling-floating-entry
risk: medium
area: ui-shell
---

## Goal

Make the bottom-right floating entry open Konling directly and move theme switching out of the bottom tools menu.

## Scope

- Remove implicit theme switching from bottom floating controls.
- Make Konling the direct primary floating action where available.
- Preserve Konling route context and unread behavior.
- Validate non-overlap and keyboard reachability.

## Out of Scope

- Konling chat message layout.
- Konling citation presentation.
- Tool-call disclosure UI.
- Per-page Konling prompt/tool registry semantics.

## Acceptance Checklist

- [ ] AC-1: Routes with Konling available show a direct Konling launcher instead of a generic bottom-right “工具” menu. Owner: independent reviewer.
  Evidence: screenshots or interaction test on representative routes.
- [ ] AC-2: Theme switching is removed from bottom floating controls and remains available in top-right shell actions. Owner: independent reviewer.
  Evidence: source check and visual evidence.
- [ ] AC-3: Direct launcher and opened Konling panel do not overlap primary controls on dense routes or mobile. Owner: independent reviewer.
  Evidence: visual QA for knowledge, adaptive, Arena, simulation, and interactive routes.
- [ ] AC-4: Konling route context registration continues to work. Owner: independent reviewer.
  Evidence: targeted test or manual check that selected page context reaches Konling.

## Tasks

- [ ] Task 1: Separate theme control from bottom dock.
  Covers: AC-2
  Acceptance: Bottom floating controls no longer prepend theme switching after top-right theme switching is available on homepage and AppShell routes.
  Evidence: changed `PageFloatingControls` code and header screenshots.
  Reviewer Check: Confirm supported routes still have top-right theme switching.
- [ ] Task 2: Implement direct Konling launcher behavior.
  Covers: AC-1, AC-4
  Acceptance: Clicking the bottom-right Konling button opens Konling directly and preserves route context registration.
  Evidence: interaction test or manual browser evidence.
  Reviewer Check: Confirm no new chat UI implementation is introduced.
- [ ] Task 3: Validate safe-area behavior.
  Covers: AC-3
  Acceptance: Launcher and panel avoid primary controls at desktop and mobile widths.
  Evidence: OpenWolf/product-design screenshot evidence.
  Reviewer Check: Confirm dense workspace controls remain reachable.

## Agent Guardrails

- Do not modify Konling citation or message rendering in this change.
- Do not hide missing context diagnostics as a substitute for fixing runtime behavior.
- Do not reintroduce theme switching into the bottom-right dock.
- Coordinate with active or archived unified Konling chat changes rather than duplicating chat components.
