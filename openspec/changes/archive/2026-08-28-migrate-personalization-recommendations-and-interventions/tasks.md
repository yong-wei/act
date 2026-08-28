## 1. Characterization and contracts

- [x] 1.1 Inventory recommendation-engine, intervention-engine, student/profile/AI/assessment routes, remediation/micro-tutoring, EvidenceOutbox producers/consumers and workers; capture current outputs, privacy projections, retry behavior and any direct LearningFact writes.
- [x] 1.2 Map Learning Record fact/event ports, Assessment/Arena/simulation validation ports, learner-state reducer and course-plugin contracts; record owner and deletion conditions.
- [x] 1.3 Add characterization tests proving ordinary browse/prompt/hint/recommendation activity does not elevate mastery and that existing response fields remain compatible.

## 2. Policy boundary

- [x] 2.1 Define `RecommendLearning` and `DecideIntervention` contracts with server-derived learner scope, policy revision, rationale, provenance, confidence and privacy metadata.
- [x] 2.2 Implement Learning Record read/write ports for governed facts, snapshots, event whitelist and idempotency; keep policy decisions out of Learning Record and reuse one EvidenceOutbox contract for cross-process projection.
- [x] 2.3 Implement bounded intervention lifecycle and independent-validation handoff without direct mastery writes or raw source access; in the decision transaction stage one deduplicated outbox row with stable action/causation identity when a worker is required.
- [x] 2.4 Make `staged`/`deduplicated`/`applied` (or equivalent) state and worker replay semantics durable and auditable; preserve synchronous same-transaction Assessment fact writes and Arena evaluator authority.

## 3. Vertical migration

- [x] 3.1 Migrate student recommendations, profile and AI consumers to Personalization public use cases.
- [x] 3.2 Migrate intervention generate/check/feedback routes, assessment remediation/micro-tutoring and companion consumers while preserving role/privacy projections.
- [x] 3.3 Migrate worker/scheduler consumers with stable decision/event identities, retry-safe writes, canonical outcome reads and worker-only LearningFact materialization for outbox paths; use path planner only through its public contract where required.

## 4. Deletion and governance

- [x] 4.1 Prove zero production imports of the old recommendation engine and intervention strategy authority, with retained fact adapters explicitly listed.
- [x] 4.2 Delete old public exports, duplicate strategy helpers and re-exports; do not delete Prisma tables still owned by another domain.
- [x] 4.3 Update owner/deprecation ledger with migrated callers, retained tables, EvidenceOutbox/worker ownership, privacy contract and rollback evidence.

## 5. Verification

- [x] 5.1 Test recommendation soft semantics, provenance, confidence, owner scope and deterministic/idempotent retries.
- [x] 5.2 Test intervention event whitelist, database-level action/causation/dedupe constraints (or equivalent persistent proof), crash-replay, duplicate delivery, privacy-safe projection, direct+outbox double-count negative cases, independent validation and no-mastery behavior.
- [x] 5.3 Run affected Assessment, Personalization, Learning Record and worker suites, typecheck, architecture checks, `openspec validate migrate-personalization-recommendations-and-interventions --type change --strict` and `git diff --check`; record no deployment or production activation.
