## Design Notes

The implementation should make the ResourceNode registry consumed by path generation a single server-owned projection path. The path planner may still receive a caller-provided candidate list for tests, but production path-generation entrypoints must not maintain a separate partial registry.

Expected sources include:

- registered resource metadata
- runtime lesson ResourceNode projections
- runtime lesson planning units
- runtime media and handout disposition records
- textbook and reference section PlanningUnits
- audited generated checkpoint contracts

The planner must expose diagnostics that identify registry version, projection version, candidate family counts, excluded-family counts, and reasons a family was not loaded.

Retrieval chunks, search documents, image descriptions, figures, transcript snippets, and citation targets are semantic signals only. They may improve ranking or citation explanation, but they must not become PathNodes unless a separate audited ResourceNode or checkpoint contract authorizes that promotion.

## Verification Strategy

- Add a fixture or runtime-backed test that compares resource-center candidate counts with path-generation candidate counts for the same governed dataset.
- Assert that path generation can see at least one audited runtime lesson step and at least one audited long-form section when those projections exist.
- Assert that raw retrieval chunks remain path-ineligible even when they rank highly for a LearningGoal.
