## 1. Diagnosis Contract

- [x] 1.1 Define student, teacher-class, teacher-student, and service diagnosis DTOs.
- [x] 1.2 Define claim, root-cause, evidence, confidence, limitation, next-action, and privacy field families.
- [x] 1.3 Define deterministic materialization versioning and refresh behavior.

## 2. Data Integration

- [x] 2.1 Consume registered goal slices and learner-state snapshots.
- [x] 2.2 Consume governed feature cache, path outcome summaries, and future control-correction teacher-report metrics where available.
- [x] 2.3 Accept grading summary evidence when the document grading workbench is present, while exposing unavailable state otherwise.

## 3. Verification

- [x] 3.1 Add unit tests for student vs teacher redaction and content differences.
- [x] 3.2 Add tests for missing, stale, low-confidence, and no-path evidence.
- [x] 3.3 Add tests that every diagnosis claim has evidence references and next-action metadata or an explicit unavailable reason.
- [x] 3.4 Run `rtk openspec validate materialize-role-based-diagnosis-views --strict`.
