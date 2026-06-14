---
change_id: standardize-simulation-local-tools-and-panels
claim_branch: standardize-simulation-local-tools-and-panels
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
openspec_path: openspec/changes/standardize-simulation-local-tools-and-panels
risk: high
area: simulation
---

## Goal

Standardize simulation-local tools, collapsible side panels, bottom toolbar, hints, and task-family panel templates across current virtual simulations.

## Scope

- Define bottom toolbar, left telemetry/status panel, right control/evaluation panel, and hint-strip behavior.
- Make both side panels collapsible and mobile-safe.
- Define templates for heading-control, DP/positioning, comfort/frequency, and ice-propulsion simulation families.
- Improve icon-button labels, form labels, focus order, and spinbutton semantics where affected.

## Out of Scope

- Do not alter controller algorithms or runtime state semantics.
- Do not implement global dock or assistant runtime behavior.
- Do not own route information architecture or `SimulationShell` global navigation.

## Acceptance Criteria

- [ ] `rtk openspec validate standardize-simulation-local-tools-and-panels --strict` passes.
- [ ] Bottom toolbar is pinned to the workspace bottom and hints appear above it.
- [ ] Side panels collapse and restore without covering the scene.
- [ ] Mobile moves secondary controls into sheets, drawers, tabs, or command surfaces.
- [ ] Representative simulations keep existing run/control behavior.

## Agent Guardrails

- Only execute this issue's change.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
