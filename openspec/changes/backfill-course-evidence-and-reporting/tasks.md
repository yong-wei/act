## 1. Candidate Discovery

- [ ] 1.1 Add dry-run selection for sessions, lessons, and date ranges.
- [ ] 1.2 Report recoverable, already enriched, and unrecoverable rows.
- [ ] 1.3 Load runtime manifest metadata needed for answer scoring.

## 2. Enrichment

- [ ] 2.1 Enrich eligible `StudentStepResponse` evidence where safe.
- [ ] 2.2 Enrich or supplement eligible `LearningFact.contextJson` with interactive quiz context.
- [ ] 2.3 Mark unrecoverable rows with explicit legacy evidence quality.
- [ ] 2.4 Ensure repeated apply runs are idempotent.

## 3. Report Regeneration

- [ ] 3.1 Add targeted class session report regeneration.
- [ ] 3.2 Add targeted student session report regeneration.
- [ ] 3.3 Print before/after coverage metrics.

## 4. Verification

- [ ] 4.1 Add tests for dry-run behavior.
- [ ] 4.2 Add tests for final-state enrichment and unrecoverable marking.
- [ ] 4.3 Add tests for duplicate safety.
- [ ] 4.4 Run targeted data-governance tests.
