## Context

Commercial UI governance already exists. This change should strengthen the checks around the new unified shell series, not replace the governance model.

## Goals / Non-Goals

**Goals:**

- Validate canonical route ledger coverage, owning change, and temporary exceptions.
- Validate legacy shell retirement or adapter disposition.
- Validate structured visual evidence manifests against the route matrix.
- Validate light/dark, desktop/mobile, navigation state, dock, report/export, and first-viewport task evidence.
- Keep React Doctor error-only validation local.

**Non-Goals:**

- Adding CI or GitHub Actions.
- Requiring every primary route screenshot before representative migration stages are complete.
- Replacing human design review with screenshots alone.

## Decisions

### Decision 1: Advisory comes before blocking

The gate can report debt before all migrations land. Blocking enforcement should begin for migrated routes and new violations first, then expand as route families complete.

### Decision 2: Visual evidence must be structured

Screenshots without route, archetype, theme, viewport, auth state, role, dock state, first-viewport task visibility, and result metadata are not enough for this series.

### Decision 3: React Doctor stays local

Because GitHub Actions quota is constrained, React Doctor should remain a local validation step for migrated surfaces. The gate should track error-level regressions without forcing CI integration.

## Validation

- Governance tests cover missing route metadata, stale visual evidence, missing navigation states, legacy shell exceptions, and dock collisions.
- Local visual evidence manifests fail when required route/theme/viewport states are missing.
- React Doctor local error-only command is documented or wrapped without CI integration.
- `rtk openspec validate harden-unified-ui-governance-gates --strict` passes.
