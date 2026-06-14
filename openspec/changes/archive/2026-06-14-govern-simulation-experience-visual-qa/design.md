## Context

Prior UI migrations showed that token usage and screenshots alone are not sufficient. The existing commercial UI governance spec already requires archetype conformance, structured metadata, dock non-overlap, mobile quality, and React Doctor local checks. This change specializes those gates for virtual simulation.

## Goals / Non-Goals

**Goals:**

- Define the required simulation visual QA matrix.
- Ensure `/simulations` and `/virtual-lab` cannot regress to conflicting states.
- Verify representative detail pages across task families.
- Check AppShell navigation states, dock behavior, local tools, theme parity, and scene visibility.

**Non-Goals:**

- Implement the preceding shell, local-tool, dock, or theme migrations.
- Add GitHub Actions integration.
- Enforce pixel-perfect matching to concept images.

## Decisions

### 1. Governance runs after the functional design changes

This change depends on the information architecture, shell, local tools, dock, and theme changes. It should not own those implementations, only the acceptance and prevention of regressions.

Alternative considered: put gates in every child change. That fragments the acceptance matrix and makes final readiness hard to judge.

### 2. Evidence must cover route semantics, not just visuals

The manifest must record archetype, route, viewport, theme, navigation state, dock state, first-viewport task, and scene visibility because simulation quality depends on navigation and interaction, not screenshots alone.

Alternative considered: capture only before/after PNGs. That cannot detect route inventory drift or hidden dock collisions.

### 3. Local-only React Doctor remains sufficient

The user has explicitly kept React Doctor out of CI due to GitHub Actions quota. This change should integrate local commands and review evidence, not CI workflow files.

Alternative considered: add CI checks. That violates the current quota constraint.

## Risks / Trade-offs

- Visual QA can be time-consuming. Mitigation: use representative matrix and structured evidence rather than exhaustive full-site capture.
- Scene nonblank checks can be flaky in WebGL. Mitigation: accept canvas-pixel or DOM fallback checks with evidence notes.
- Governance may expose unrelated UI debt. Mitigation: narrow scope to simulation routes and documented regressions.

## Migration Plan

1. Define route matrix and evidence schema additions.
2. Add or update visual capture scripts for required simulation routes.
3. Add route inventory and governance checks for simulation information architecture.
4. Run local React Doctor/error and accessibility checks for affected routes.
5. Document any temporary exceptions with owner and removal condition.

## Open Questions

- Which local React Doctor command variant should be canonical for route-limited simulation checks.
