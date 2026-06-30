## Design

SAR refresh should be an operations workflow around existing projection builders, not a replacement for them. It should read governed platform sources, build SAR projection batches, write through the persisted SAR index, and emit health diagnostics.

## Refresh Inputs

Initial refresh should cover K/A/Q graph nodes, LearningGoal definitions, ResourceNode records, LearningEvidenceCorpusChunk summaries, governed LearningFact summaries, simulation summaries, Arena summaries, and adaptive path summaries where safe summaries already exist.

Arena refresh must preserve official evaluation authority. Official score, validity, ranking, attempt policy, and evaluation metrics may only be sourced from persisted `ArenaSubmission` or official evaluation run records. `LearningFact`, SAR traces, KAQ writeback summaries, and learner evidence projections may support learning evidence context, but must not be used as official Arena result truth.

## Health Model

The health payload should include source family, source version or high-water mark, last attempted refresh, last successful refresh, projected counts, stale counts, failure counts, retry status, and limitation codes. Manual refresh actions should use existing admin operation ledger patterns.

## Verification Strategy

- Tests for stale source detection, idempotent refresh, failed source reporting, and privacy-safe health payloads.
- Admin dashboard/API tests that show SAR refresh health without exposing raw evidence.
- OpenSpec strict validation.
