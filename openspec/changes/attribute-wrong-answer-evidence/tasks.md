## 1. Persistence contract

- [x] 1.1 Add the immutable wrong-answer attribution model, constraints, indexes, and answer relation to Prisma.
- [x] 1.2 Add and validate the forward migration for the attribution table.

## 2. Attribution service

- [x] 2.1 Add failing public-boundary tests for ownership, traceability, correct-answer rejection, and missing semantic evidence.
- [x] 2.2 Implement verified answer-time evidence parsing and fail-closed eligibility.
- [x] 2.3 Add failing tests for deterministic and low-confidence attribution states.
- [x] 2.4 Implement versioned confidence, limitations, and follow-up action rules.
- [x] 2.5 Add failing tests for idempotent persistence and privacy-safe public projection.
- [x] 2.6 Implement immutable upsert and allowlisted projection.

## 3. Verification

- [x] 3.1 Run focused attribution tests and related adaptive-attempt regression tests.
- [x] 3.2 Run Prisma validation, type checking, OpenSpec strict validation, and the full test suite.
- [x] 3.3 Review the final diff for issue #1157 scope and sensitive-data leakage.
