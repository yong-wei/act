## 1. Governed Training Evidence

- [x] 1.1 Add a failing data-governance regression test proving an Arena preview `SimulationRun` keeps its task id, preview boundary, and bounded training contribution in the resulting `LearningFact`.
- [x] 1.2 Add a failing Arena virtual-run store regression test proving the canonical run summary preserves the task context needed by evidence materialization.
- [x] 1.3 Extend the Arena preview run and simulation evidence materializer with compact task attribution, preview provenance, and low-confidence contribution handling without copying trace samples.
- [x] 1.4 Re-run the focused evidence-materialization and virtual-run store tests.

## 2. Personal Center Training Summary

- [x] 2.1 Add failing profile analytics tests for separate virtual-training records, task attribution, quality availability, and unchanged official submission aggregates.
- [x] 2.2 Add a backend-owned user-scoped training-run query and extend the Arena portfolio/profile API contract with separate training statistics and recent records.
- [x] 2.3 Render the training summary in the personal center with preview provenance while preserving the official Arena growth section.
- [x] 2.4 Re-run focused Arena profile and personal-center route tests.

## 3. End-to-End Verification

- [x] 3.1 Verify a persisted Arena preview reaches the canonical run, `LearningFact`, personal-center training summary, and learning-profile-safe context with no official promotion.
- [ ] 3.2 Capture current-revision `/profile` evidence at 1440px and 320px, including training-only and unavailable-quality states, with source and screenshot hashes.
- [ ] 3.3 Run strict OpenSpec validation, typecheck, affected tests, full unit/build gates, and inspect the diff for unrelated official evaluation, leaderboard, progress, and historical evidence changes.
- [ ] 3.4 Complete independent risk-focused review and resolve all accepted blocking findings in one remediation batch.
