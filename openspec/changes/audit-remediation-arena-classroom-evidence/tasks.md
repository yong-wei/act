## 1. Arena Semantics

- [ ] 1.1 Define official, active, expired, late, zero-score, effective, best, latest, and all-attempt display rules.
- [ ] 1.2 Update student challenge and teacher report UI to explain multiple submissions and ranking source.
- [ ] 1.3 Prevent zero-score or late submissions from appearing as excellent without explicit policy explanation.

## 2. Classroom And Evidence

- [ ] 2.1 Add classroom join, release, submit, summary, end, and post-class review states.
- [ ] 2.2 Add Arena and classroom evidence writeback or explicit non-writeback explanations.
- [ ] 2.3 Deduplicate classroom evidence by session/step/card/submission identity.

## 3. Verification And Audit Ledger

- [ ] 3.1 Verify audited Arena publication, official submission, expired/late, and classroom join/submission/end paths.
- [ ] 3.2 Run `rtk openspec validate audit-remediation-arena-classroom-evidence --strict`.
- [ ] 3.3 Update only verified Arena/classroom findings in the audit report.
