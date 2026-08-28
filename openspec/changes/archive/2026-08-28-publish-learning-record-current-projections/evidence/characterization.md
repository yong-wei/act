# Characterization

Captured on `publish-learning-record-current-projections` against `integration@3444be5b5`.

## Writers

| Surface | Role | Input | Pointer today |
| --- | --- | --- | --- |
| `portrait-v2-materialization.publishState` | student immutable version + current | trusted LearningFact + fence | fenced CAS via Learning Record `publishCurrentPointer` |
| `cumulative-class-materialization` | class snapshot / current | member current portraits | existing class fence; teacher aggregates gated by independent-learner count 5 |
| `student-evidence-feature-cache` | rebuildable cache | LearningFact window | not a current pointer; cache only |
| `StudentCompetencySnapshot` | legacy snapshot | compatibility | not written as current |

## Readers

| Surface | Owner | Raw events for page response |
| --- | --- | --- |
| `readCurrentCumulativePortrait` | student portrait | no; current pointer + version |
| `readCurrentCumulativeClassPortrait` | teacher class | no; class current + member set digest |
| `projectSafeFeatureRead` | AI / Personalization | no; envelope fields only |
| `graph-center` class overlay | teacher | already suppresses below 5 independent learners |
| profile / session reports | audit | InteractionLog remains for reports; not a current read port |

## Envelope mapping (existing schema)

`LearnerPortraitStateVersion` is the immutable snapshot. `LearnerPortraitCurrentState` is the pointer. Envelope fields overlay:

- processing vs state watermark: journal sequence vs `stateWatermark`
- generation / queueGeneration / cutoverFence: existing fence columns
- input digest: `taskInputDigest` / `trustedInputDigest`
- coverage / confidence: `dimensionCoverage` / `confidence`
- anchors: contributing `sourceEventId` / `sourceLogId` retained on facts; projection envelope copies the set

## Deletion / retirement

Caches may rebuild. Historical `LearnerPortraitStateVersion` and `StudentPortraitV2Snapshot` are retained. Raw aggregators on admin/report routes stay until a later consumer change records a replacement receipt.
