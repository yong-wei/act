## 1. Indicator Definitions

- [ ] 1.1 Define persisted or registry-backed `DiagnosisIndicatorDefinition`, `DiagnosisIndicatorSnapshot`, and `DiagnosisReportSnapshot` contracts.
- [ ] 1.2 Register the nine control-correction dimensions and at least three indicators per dimension.
- [ ] 1.3 Require every indicator to declare source families, query spec, normalization policy, confidence policy, privacy scope, and fallback behavior.
- [ ] 1.4 Add validation that rejects indicators without query specs or evidence thresholds.

## 2. Materialization

- [ ] 2.1 Build a materializer that reads governed evidence, feature cache payloads, adaptive assessment records, simulation/Arena summaries, path evidence, and approved grading facts.
- [ ] 2.2 Implement score normalization for ratio, bounded numeric, inverse-bounded numeric, and rubric-level sources.
- [ ] 2.3 Implement confidence from source trust, evidence count, freshness, and cross-source agreement.
- [ ] 2.4 Implement class percentile and growth percentile with explicit sample-size and cold-start fallbacks.

## 3. Snapshot Access

- [ ] 3.1 Expose service functions for latest student, teacher-student, teacher-class, and service diagnosis snapshots.
- [ ] 3.2 Integrate snapshots into role-based diagnosis without removing existing fallback behavior.
- [ ] 3.3 Ensure ordinary student and teacher payloads include evidence references and limitations, not raw answer bodies or private Konling dialogue.

## 4. Verification

- [ ] 4.1 Add unit tests for indicator validation and score/confidence calculations.
- [ ] 4.2 Add materializer tests for missing, stale, partial, and low-confidence evidence.
- [ ] 4.3 Add authorization tests for student and teacher snapshot reads.
- [ ] 4.4 Run `rtk openspec validate control-correction-diagnosis-indicator-engine --strict`.
