---
change_id: govern-simulation-experience-visual-qa
claim_branch: govern-simulation-experience-visual-qa
series: virtual-simulation-unified-experience
coupling_group: simulation-ui-shell
execution_mode: isolated
base_branch: integration
required_branch:
depends_on:
  - unify-virtual-simulation-information-architecture
  - introduce-simulation-shell-mission-workspace
  - standardize-simulation-local-tools-and-panels
  - unify-konling-simulation-dock
  - define-simulation-dual-theme-templates
parent_issue: 468
blocked_by: []
blocking: []
openspec_path: openspec/changes/govern-simulation-experience-visual-qa
risk: medium
area: simulation
---

## Goal

Add final simulation experience governance so the redesigned routes prove route inventory coverage, shell conformance, dual-theme quality, mobile behavior, dock safety, and nonblank simulation scenes.

## Scope

- Define simulation-specific visual QA matrix and structured evidence metadata.
- Check `/simulations`, final `/virtual-lab` behavior, representative detail pages, Control Workbench regression, and mobile.
- Govern conflicting availability truth, student-facing model status leakage, duplicate assistant entries, and local-control collisions.
- Keep React Doctor error-level checks local only.

## Out of Scope

- Do not implement the preceding shell, local-tool, dock, or theme migrations.
- Do not add GitHub Actions integration.
- Do not require pixel-perfect matching to generated concept images.

## Acceptance Criteria

- [ ] `rtk openspec validate govern-simulation-experience-visual-qa --strict` passes.
- [ ] Evidence matrix covers required routes, themes, viewport states, navigation states, dock states, and local-tool states.
- [ ] Representative simulation evidence proves nonblank primary scene or instrument area.
- [ ] Governance rejects conflicting `/virtual-lab` availability, duplicate assistants, and unmanaged local palettes after migration.
- [ ] Local React Doctor error-level checks are documented for affected route set where feasible.

## Agent Guardrails

- Only execute this issue's change.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
