## Why

After eligible historical evidence is materialized, profile and recommendation consumers still need an efficient, stable read model. Requiring each surface to rescan raw facts or source tables would recreate the current inconsistency. The platform needs a student-level evidence feature cache that summarizes governed evidence with freshness, source windows, counts, and confidence signals.

## What Changes

- Define the student evidence feature cache schema or storage contract.
- Build deterministic refresh/rebuild logic from governed facts and approved summaries.
- Store per-user evidence windows, counts, source coverage, confidence markers, and feature payloads.
- Expose the cache through internal services for profile, recommendation, and teacher insight consumers.
- Keep recommendation behavior and learner-facing UI changes out of this phase.

## Capabilities

### New Capabilities

- `student-evidence-feature-cache`: Deterministic per-student evidence feature cache for profile and personalization consumers.

### Modified Capabilities

- `historical-learning-evidence-materialization`: Materialized facts become one upstream source for feature cache refresh after the prior change is complete.

## Impact

- Affected data sources: governed facts, profile summaries, snapshots, and approved evidence aggregates.
- Affected code areas: data-governance refresh jobs, cache schema/service, admin freshness reporting, and tests.
- No recommendation ranking or UI behavior is changed in this phase.
- No raw source-table scanning should be required by normal profile consumers once cache reads are available.
