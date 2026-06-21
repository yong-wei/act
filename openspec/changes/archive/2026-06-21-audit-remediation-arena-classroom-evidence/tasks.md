## 1. Arena Semantics

- [x] 1.1 Define official, active, expired, late, zero-score, effective, best, latest, and all-attempt display rules.
- [x] 1.2 Update student challenge and teacher report UI to explain multiple submissions and ranking source.
- [x] 1.3 Prevent zero-score or late submissions from appearing as excellent without explicit policy explanation.

## 2. Classroom And Evidence

- [x] 2.1 Add classroom join, release, submit, summary, end, and post-class review state labels and recovery/review entrypoints.
- [x] 2.2 Add Arena and classroom evidence writeback or explicit non-writeback explanations.
- [x] 2.3 Deduplicate classroom evidence by session/step/card/submission identity.

## 3. Verification And Audit Ledger

- [x] 3.1 Verify audited Arena publication, official submission, expired/late, and classroom join/submission/end paths.
- [x] 3.2 Run `rtk openspec validate audit-remediation-arena-classroom-evidence --strict`.
- [x] 3.3 Update only verified Arena/classroom findings in the audit report.
