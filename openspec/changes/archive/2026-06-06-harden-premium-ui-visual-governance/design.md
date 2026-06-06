## Context

The redesign series needs a hard gate at the end. Early page migrations may require advisory mode and temporary exceptions, but once a route family is migrated, new raw palettes, unregistered shells, missing mobile evidence, or absent archetype mappings must block.

## Goals / Non-Goals

**Goals:**

- Enforce route ledger and archetype conformance.
- Require light/dark and desktop/mobile evidence.
- Require dock collision and text-fit/accessibility checks.
- Require report/export evidence where applicable.

**Non-Goals:**

- Do not fail unrelated historical debt without a migration owner.
- Do not use unrelated TypeScript or dependency debt as UI governance signal.

## Decisions

### Decision 1: Governance follows migration maturity

Before all page families are migrated, governance can report legacy debt advisory-style. After ownership changes complete, routes move to blocking mode.

### Decision 2: Evidence must be structured

Screenshots alone are insufficient. Manifests must identify route, archetype, theme, viewport, auth/role state, dock state, and result.

## Risks / Trade-offs

- Strict gates can slow feature work. -> Use scoped exceptions with owners and expiry.
- Screenshot artifacts can bloat the repo. -> Keep compact manifests and define artifact retention policy separately if needed.
