---
change_id: unify-virtual-simulation-information-architecture
claim_branch: unify-virtual-simulation-information-architecture
series: virtual-simulation-unified-experience
coupling_group: simulation-ui-shell
execution_mode: isolated
base_branch: integration
required_branch:
depends_on: []
parent_issue: 468
blocked_by: []
blocking: []
openspec_path: openspec/changes/unify-virtual-simulation-information-architecture
risk: medium
area: simulation
---

## Goal

Unify virtual simulation entry architecture so `/simulations` is the canonical catalog and `/virtual-lab` no longer presents conflicting availability truth.

## Scope

- Make `/simulations` the student-facing source of truth for simulation catalog and open-state metadata.
- Convert `/virtual-lab` into a redirect, compatibility wrapper, or model-library route under the same catalog truth.
- Remove student-facing model deployment/status information from the primary catalog.
- Register route-family semantics in central role/navigation inventory.

## Out of Scope

- Do not implement `SimulationShell` detail-page layout.
- Do not redesign local control panels, Konling dock, or dual-theme templates.
- Do not change simulation physics, Arena scoring, or generated 3D assets.

## Acceptance Criteria

- [ ] `rtk openspec validate unify-virtual-simulation-information-architecture --strict` passes.
- [ ] `/simulations` and `/virtual-lab` cannot show conflicting open simulation counts.
- [ ] Student navigation exposes one canonical simulation entry targeting `/simulations`.
- [ ] Existing deep links to current simulation detail pages remain reachable.
- [ ] Visual or route evidence covers `/simulations`, final `/virtual-lab` behavior, and mobile entry behavior.

## Agent Guardrails

- Only execute this issue's change.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
