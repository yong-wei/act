## 1. Durable generation contracts

- [ ] 1.1 Add generation job and attempt states, models, constraints, relations, and migration.
- [ ] 1.2 Define server-owned generation request, status projection, retry, error, and audit contracts.
- [ ] 1.3 Enforce teacher ownership, student membership, request-key idempotency, and one active job per scope.

## 2. Governed execution

- [ ] 2.1 Add the diagnosis generation BullMQ queue and worker with bounded automatic retry.
- [ ] 2.2 Invoke Konling `teacher-diagnosis` with the fixed evidence cutoff and allowlisted tools.
- [ ] 2.3 Validate structured output, evidence provenance, cutoff, and scope before atomic report completion.
- [ ] 2.4 Preserve attempt audit data and classify retryable, validation, authorization, timeout, and delivery failures.

## 3. API and teacher workspace

- [ ] 3.1 Replace public report-body writes with generation-intent creation and add authorized job status and retry routes.
- [ ] 3.2 Add generation controls and active, failed, timed-out, and completed states to class and student report history.
- [ ] 3.3 Refresh persisted report history only after successful task completion.

## 4. Verification

- [ ] 4.1 Add persistence, orchestration, worker, and route regressions for authorization, idempotency, recovery, and single-report completion.
- [ ] 4.2 Add component regressions for both report scopes and all generation states.
- [ ] 4.3 Run targeted tests, typecheck, lint, strict OpenSpec validation, and focused browser verification.

