## Why

Once governed facts and student evidence features exist, the platform should stop relying on fragmented raw reads or generic profile assumptions for personalization. Recommendations and profile explanations need to use governed evidence, expose why an item is suggested, and show confidence boundaries when evidence is incomplete.

## What Changes

- Update personalization and profile consumers to read governed facts, snapshots, summaries, or evidence feature cache data.
- Add recommendation reason codes, evidence windows, evidence counts, and low-confidence markers.
- Keep raw source-table reads limited to audit, debug, migration, and drilldown paths.
- Add teacher/admin explanation surfaces or service outputs where existing pages already show recommendation/profile rationale.
- Avoid introducing a new AI recommendation engine in this phase.

## Capabilities

### New Capabilities

- `evidence-driven-personalization`: Profile and recommendation consumers use governed evidence features with explainable reason and confidence metadata.

### Modified Capabilities

- `student-evidence-feature-cache`: The cache becomes the preferred evidence read model for profile and recommendation consumers after the preceding phase is complete.

## Impact

- Affected consumers: profile APIs, recommendation APIs, teacher insight services, and any admin governance explanation surfaces that expose profile/recommendation rationale.
- Affected code areas: personalization service layer, profile summary reads, recommendation reason generation, teacher/admin explanation helpers, and tests.
- No new AI recommender or broad UI redesign is required.
- Recommendation outputs should become more explainable, not more opaque.
