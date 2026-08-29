## 1. Consumer characterization

- [x] 1.1 Inventory student, teacher, AI, Personalization and ground-evidence-copilot routes/pages/services/readers, raw inputs, owner, scope, fields, tests and callers.
- [x] 1.2 Capture output parity, LearningFact watermark, projection revision, stale/unknown behavior, small-sample and privacy baselines.
- [x] 1.3 Record every raw aggregator and legacy reader's replacement port and deletion condition.

## 2. Stable read ports

- [x] 2.1 Define student, teacher, AI and Personalization read-port contracts from current projections.
- [x] 2.2 Enforce server-derived subject/tenant/class/role scope and role-minimum field projections.
- [x] 2.3 Preserve status, coverage, freshness, confidence, provenance, stale/conflict and unavailable semantics.
- [x] 2.4 Preserve independent-learner small-sample suppression and student/teacher/admin data separation.

## 3. Vertical migration

- [x] 3.1 Migrate one student evidence/portrait route and page without raw aggregation.
- [x] 3.2 Migrate teacher evidence/insights routes and verify class scope and small-sample behavior.
- [x] 3.3 Migrate AI context and Personalization consumers while preserving their domain ownership and plugin contracts.
- [x] 3.4 Integrate ground-evidence-copilot with the existing server-authorized resolver/read port; do not duplicate its permission/context logic.
- [x] 3.5 Migrate remaining callers and delete only proven-zero raw aggregators/read helpers.

## 4. Verification and ledger

- [x] 4.1 Add route/port tests for cross-user, cross-class, role, minimum-field and privacy boundaries.
- [x] 4.2 Add tests for missing, partial, stale, conflict, unavailable, known-zero and small-sample states.
- [x] 4.3 Add tests proving normal pages and AI/Personalization do not aggregate raw events or accept client evidence.
- [x] 4.4 Add parity/provenance tests against projection revision and LearningFact watermark.
- [x] 4.5 Run strict OpenSpec validation, affected consumer tests, typecheck and `git diff --check`.
- [x] 4.6 Close producer/consumer/worker/backfill/report denominator and legacy deletion ledger.

## 5. Accepted P1 decision B consumer boundary

- [x] 5.1 Define and recursively enforce read-port/export allowlists for opaque subject/scope refs, stable identity, normalized values, times, revision, source summary, status and evidence provenance.
- [x] 5.2 Add forbidden-field and encoding/exception-echo tests for pages, AI, Personalization, Copilot, reports and every transport/export path, including an all-path canary.
- [x] 5.3 Verify raw artifact physical/key/ACL isolation, no permission inheritance, redacted failure/DLQ receipts and Copilot preservation.
- [x] 5.4 Add retention/deletion tests for successful payload, failure receipt, approved raw and public audit, including object/index/cache/replica unreadability.
- [x] 5.5 Add unknown field/version/digest/retention/ref, mixed-schema, ACL-drift, rollback and public-export negative tests.
- [x] 5.6 Add kill/restart/duplicate/out-of-order and Postgres/Redis/queue/deployment integration tests for consumer delivery and replay audit.
