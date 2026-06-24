---
change_id: unify-konling-simulation-dock
claim_branch: unify-konling-simulation-dock
series: virtual-simulation-unified-experience
coupling_group: simulation-ui-shell
execution_mode: isolated
base_branch: integration
required_branch:
depends_on:
  - unify-virtual-simulation-information-architecture
  - introduce-simulation-shell-mission-workspace
parent_issue: 468
blocked_by: []
blocking: []
openspec_path: openspec/changes/unify-konling-simulation-dock
risk: high
area: simulation
---

## Goal

Use one shared bottom-right contextual Konling assistant across simulation catalog, simulation detail pages, and simulation mission pages without duplicate assistant regions or control collisions.

## Scope

- Register simulation routes with the shared floating dock model.
- Remove or adapt duplicate page-local assistant panels.
- Define collapsed, expanded, mobile drawer/sheet, safe-area, and collision behavior.
- Load simulation page context from server-owned route, run, task, learner, and permission sources.

## Out of Scope

- Do not add new write-capable Konling tools.
- Do not replace local simulation controls with chat commands.
- Do not implement unrelated teacher/admin assistant modes.

## Acceptance Criteria

- [ ] `rtk openspec validate unify-konling-simulation-dock --strict` passes.
- [ ] Only one Konling assistant entry is visible on simulation routes.
- [ ] Expanded assistant does not cover bottom toolbar, side panels, primary scene, or evaluation controls.
- [ ] Mobile assistant behavior preserves focus order and core control access.
- [ ] Missing simulation context yields explicit degraded/unavailable state.

## Agent Guardrails

- Only execute this issue's change.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
