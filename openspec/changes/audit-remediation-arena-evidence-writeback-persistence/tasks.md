## Tasks

- [ ] 1. Inventory remaining Arena evidence writeback findings and current projection-only boundaries.
- [ ] 2. Define persistent Arena KAQ writeback outcome, idempotency key, limitation model, and consumer contract.
- [ ] 3. Implement materialization for accepted official attempts and blocked/degraded outcomes for invalid attempts.
- [ ] 4. Update student feedback, teacher publication report, evidence timeline, and path-planning evidence consumers to read persisted outcomes.
- [ ] 5. Add tests for persistence, idempotency, invalid attempt blocking, duplicate submission, and consumer consistency.
- [ ] 6. Update audit report and evidence with closure ids and residual gaps.

## Validation

- [ ] Run `openspec validate audit-remediation-arena-evidence-writeback-persistence --strict`.
- [ ] Run targeted Arena submission/writeback/report/evidence tests.
- [ ] Attach report diff and representative consumer evidence before marking findings closed.
