## 1. Persistence and contracts

- [x] 1.1 Add append-only intervention and event models, relations, idempotency constraints, and an additive migration.
- [x] 1.2 Define strict source-snapshot, event, recommendation, and learner-projection contracts.

## 2. Outcome service

- [x] 2.1 Create server-authorized intervention start and progress-event recording with event-key idempotency.
- [x] 2.2 Revalidate the orchestration snapshot and evaluate only its governed validation question without adaptive persistence side effects.
- [x] 2.3 Select deterministic governed pass/fail recommendations and construct a privacy-safe evidence-basis projection.

## 3. Learner API

- [x] 3.1 Add authenticated nested remediation endpoints for start, events, validation submission, and read.
- [x] 3.2 Reject foreign, stale, malformed, substituted, second-validation, and concurrent idempotency-conflict submissions without protected-data disclosure; return the original result only for an identical retry.

## 4. Verification

- [x] 4.1 Add unit tests for independent starts, retry idempotency, version/session binding, validation scoring, recommendations, and no-mutation guarantees.
- [x] 4.2 Add route tests for learner authorization, invalid requests, projection privacy, and controlled unavailable paths.
- [x] 4.3 Run Prisma validation/generation, targeted tests (including ordering and concurrent idempotency conflicts), a disposable PostgreSQL 17 migration smoke, TypeScript checks, repository gates, strict OpenSpec validation, and inspect the final diff.
