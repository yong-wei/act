## Why

The platform already stores extensive classroom-adjacent and out-of-class learning data, but those sources are not cataloged under one governance policy. Before historical materialization or recommendation upgrades can be safe, the system needs a reproducible source inventory that distinguishes real learning evidence from seed, showcase, demo, and test data.

## What Changes

- Introduce an evidence source catalog for existing learning data sources.
- Classify each source by provenance, learning scope, value level, profile eligibility, and materialization readiness.
- Add a dry-run coverage report that reproduces source counts, affected users, source windows, eligibility counts, and exclusion reasons without writing data.
- Normalize the policy for canonical event type resolution, especially `InteractionLog.eventData.eventType` vs legacy wrapper types.
- Keep passive views and navigation events as activity context rather than competency evidence.

## Capabilities

### New Capabilities

- `learning-evidence-source-catalog`: Catalog and coverage reporting for raw learning evidence sources and their governance policies.

### Modified Capabilities

- `interactive-governance-evidence`: Align interactive evidence with the catalog and canonical event type policy.

## Impact

- Affected data sources: `InteractionLog`, `StudentStepResponse`, `SimulationLog`, `UserAnswer`, `AbilityAssessment`, `PromptAssessment`, `DesignSession`, Arena tables, and `LearningFact`.
- Affected code areas: data-governance utilities, coverage scripts, admin data-governance status reporting, and tests.
- No historical records are materialized in this change.
- No profile, recommendation, or UI behavior change is required beyond exposing catalog/coverage information.
