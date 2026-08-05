## 1. Persistence and contracts

- [ ] 1.1 Add append-only intervention and event models, relations, idempotency constraints, and an additive migration.
- [ ] 1.2 Define strict source-snapshot, event, recommendation, and learner-projection contracts.

## 2. Outcome service

- [ ] 2.1 Create server-authorized intervention start and progress-event recording with event-key idempotency.
- [ ] 2.2 Revalidate the orchestration snapshot and evaluate only its governed validation question without adaptive persistence side effects.
- [ ] 2.3 Select deterministic governed pass/fail recommendations and construct a privacy-safe evidence-basis projection.

## 3. Learner API

- [ ] 3.1 Add authenticated nested remediation endpoints for start, events, validation submission, and read.
- [ ] 3.2 Reject foreign, stale, substituted, malformed, and duplicate submissions without protected-data disclosure.

## 4. Verification

- [ ] 4.1 Add unit tests for independent starts, retry idempotency, version/session binding, validation scoring, recommendations, and no-mutation guarantees.
- [ ] 4.2 Add route tests for learner authorization, invalid requests, projection privacy, and controlled unavailable paths.
- [ ] 4.3 Run Prisma validation, targeted tests, TypeScript checks, repository gates, strict OpenSpec validation, and inspect the final diff.
