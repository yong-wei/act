# Characterization — externalize-control-correction-learning-record-adapter

Captured on `externalize-control-correction-learning-record-adapter` after #1569/#1584/#1585.

## 1.1 Frozen generic vs plugin ownership

| Surface | Pre-change | Owner after this change |
| --- | --- | --- |
| Course/lesson/Arena ID sets | `src/features/personalization/plugins/control-correction/mappings.ts` | unchanged plugin owner |
| Explicit/legacy LearningFact matchers | `evidence-match.ts` + `db-evidence.ts` | plugin read path for historical facts; adapter write path is explicit-only |
| Generic Learning Record ingest / snapshot / read ports | no course literals | still none; ingest dispatches only on explicit `goalId`/`pluginId` |
| Arena official writeback | hardcoded `courseId: 'control-correction'` in `evidence-writeback-persistence.ts` | plugin registry `taskId` resolution + adapter mapping; unregistered tasks keep official result with `courseId: null` |
| learner-state reducer | re-filtered facts with `isControlCorrectionFact` / Arena task allowlist | consumes plugin-scoped facts; official Arena facts detected via `contextJson.arena.official` |
| Personalization plugin interface | goal plugin + evidence/write ports | same registry plus `createLearningRecordAdapter()` |

## 1.2 Adapter contract

| Field | Value |
| --- | --- |
| adapterId | `control-correction-learning-record-adapter` |
| adapterVersion / releaseRevision | `control-correction-learning-record-adapter.v1` |
| schemaVersion | `control-correction-adapter.schema.v1` |
| pluginId | `control-correction-personalization-plugin` |
| goalId | `control-correction` |
| deletion condition | zero callers of generic course literals and adapter mapping tests green |

Official Arena score remains `arena-submission-result`. Adapter output is `auxiliary-learning-evidence` and cannot promote or overwrite official score.

## 1.3 Producer / consumer denominator

See `evidence/migration-ledger.md`.
