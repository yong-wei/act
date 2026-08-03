## 1. Persistence and contracts

- [ ] 1.1 Add the immutable remediation orchestration result model, constraints, relations and migration.
- [ ] 1.2 Define strict governed resource, validation-item, stored-result and learner-projection contracts.

## 2. Orchestration service

- [ ] 2.1 Implement ownership checks and sanitized unavailable-result persistence.
- [ ] 2.2 Implement governed candidate parsing and deterministic resource/validation selection within the 5–10 minute budget.
- [ ] 2.3 Implement idempotent available-task persistence and read-time authorization/version drift validation.

## 3. Learner API

- [ ] 3.1 Add authenticated learner endpoints to explicitly create and retrieve remediation orchestration results.
- [ ] 3.2 Ensure route responses and errors do not expose answers, private teacher data or unauthorized record existence.

## 4. Verification

- [ ] 4.1 Add unit coverage for success, deterministic ordering, idempotency, uncertainty, missing resources/questions and duration failure.
- [ ] 4.2 Add route/read coverage for ownership, authorization revocation, version drift and sensitive-data exclusion.
- [ ] 4.3 Run Prisma validation, targeted tests, TypeScript checks and final repository gates; update task status and inspect the final diff.
