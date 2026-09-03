## 1. Generation-side consistency validation

- [x] 1.1 Add `enforceLimitationCoverageConsistency` to the generation provider: when the persisted `sourceCoverage` is complete (`coverage = 1`, `includedStudents >= classMembers`, assignment/assessment missing = 0), limitations whose clauses assert that some students' data may be missing (closed wording family: 部分/少数/个别/某些学生 + 数据/证据/进度/记录 + 缺失/缺少/未覆盖/未纳入/不完整/不全) are violations.
- [x] 1.2 Add the `DiagnosisLimitationCoverageError` model-behavior error class and wire it into `generateGovernedDiagnosisReport` after the existing pseudo-conflict gate.
- [x] 1.3 Classify the new error in the worker as a retryable model-behavior defect with failure code `diagnosis-limitation-coverage-contradiction`, requeueing within the existing attempt budget.
- [x] 1.4 Extend the provider system prompt: when the governed input coverage is complete, the model must not emit hypothetical missing-student-data limitations.

## 2. Availability projection split

- [x] 2.1 In `buildAvailability`, remove the unconditional medium-confidence「证据部分可用」fallback: with complete coverage and no pseudo or declared conflict, show「证据覆盖完整，结论需复核」with a teacher-review recovery action.
- [x] 2.2 Route complete-coverage attribution-limited reports to the existing「知识节点归因受限」status instead of the partial-availability fallback.
- [x] 2.3 Keep「证据部分可用」only for structurally incomplete coverage, and keep real conflict/pseudo-conflict presentations unchanged.

## 3. Benchmark and regression tests

- [x] 3.1 Add a benchmark scenario `full-coverage-medium-boundary` (complete coverage, medium max confidence, non-conflict judgment boundary) with a `forbidHypotheticalMissingData` boundary flag enforced via the same production validation.
- [x] 3.2 Regression tests: generation rejects the contradictory limitation and requeues; general boundary and real-gap limitations pass; worker classifies the new failure code; history projection shows the new status for complete-coverage medium reports (including the historical report from the issue), attribution routing, and unchanged gap/conflict statuses.

## 4. Delivery

- [x] 4.1 `openspec validate fix-teacher-diagnosis-full-coverage-status --type change --strict`, targeted tests, typecheck; archive in the same PR as the implementation.
