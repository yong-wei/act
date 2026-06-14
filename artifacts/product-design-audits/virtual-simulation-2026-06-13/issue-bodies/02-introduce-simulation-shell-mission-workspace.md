---
change_id: introduce-simulation-shell-mission-workspace
claim_branch: introduce-simulation-shell-mission-workspace
series: virtual-simulation-unified-experience
coupling_group: simulation-ui-shell
execution_mode: isolated
base_branch: integration
required_branch:
depends_on:
  - unify-virtual-simulation-information-architecture
parent_issue: 468
blocked_by: []
blocking: []
openspec_path: openspec/changes/introduce-simulation-shell-mission-workspace
risk: high
area: simulation
---

## Goal

Introduce a shared `SimulationShell` mission-workspace contract for `/simulations/*` detail pages while preserving existing simulation runtime behavior.

## Scope

- Define AppShell-derived simulation mission workspace slots.
- Register simulation detail routes as `mission-workspace` surfaces.
- Preserve breadcrumbs, user center, theme switching, route-derived return targets, and scene primacy.
- Migrate representative heading-control, DP/positioning, and cruise/course-context pages or register bounded exceptions.

## Out of Scope

- Do not redesign every local control panel in this issue.
- Do not implement final Konling dock placement or dual-theme templates.
- Do not change Rust/WASM runtime calls, simulation clocks, telemetry semantics, or Arena official evaluation.

## Acceptance Criteria

- [ ] `rtk openspec validate introduce-simulation-shell-mission-workspace --strict` passes.
- [ ] Representative simulation detail pages render through AppShell or approved mission workspace shell.
- [ ] Breadcrumbs, user center, theme switch, return target, and primary scene visibility are verified.
- [ ] Existing simulation controls still drive the same model behavior after shell wrapping.
- [ ] Temporary exceptions name route, owner, and removal condition.

## Agent Guardrails

- Only execute this issue's change.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
