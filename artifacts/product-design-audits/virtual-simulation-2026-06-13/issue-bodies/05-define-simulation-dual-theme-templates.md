---
change_id: define-simulation-dual-theme-templates
claim_branch: define-simulation-dual-theme-templates
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
openspec_path: openspec/changes/define-simulation-dual-theme-templates
risk: medium
area: simulation
---

## Goal

Define premium light and dark visual templates for simulation catalog, `SimulationShell`, local panels, bottom toolbar, hints, and learning mission surfaces.

## Scope

- Map simulation shell chrome and panel roles to governed platform/commercial tokens.
- Apply separate light and dark treatments for catalog, workspace shell, local controls, hints, and status/evidence states.
- Preserve natural 3D scene colors while governing surrounding UI chrome.
- Remove page-local palettes from migrated simulation surfaces.

## Out of Scope

- Do not redesign the logo or generate new 3D model assets.
- Do not implement final governance scripts.
- Do not change simulation algorithms, route architecture, or assistant runtime behavior.

## Acceptance Criteria

- [ ] `rtk openspec validate define-simulation-dual-theme-templates --strict` passes.
- [ ] `/simulations` and representative detail pages have light and dark visual evidence.
- [ ] Translucent top, side, control, and bottom panels preserve contrast and focus visibility.
- [ ] No generic AI gradients, decorative glow blobs, or unmanaged page-local palettes are introduced.
- [ ] Status, evidence, replay, preview, official, warning, success, and danger states use governed roles.

## Agent Guardrails

- Only execute this issue's change.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
