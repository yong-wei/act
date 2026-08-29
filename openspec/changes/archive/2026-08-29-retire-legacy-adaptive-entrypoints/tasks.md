## 1. Inventory and gates

- [x] 1.1 Build a current-HEAD inventory of `src/features/adaptive-learning`, `src/lib/adaptive-*`, adaptive flags/fallbacks/shims/re-exports, EvidenceOutbox producers/consumers, dynamic imports, routes, workers, tests and generated entrypoints.
- [x] 1.2 Verify all six predecessor changes and the new EvidenceOutbox protocol are qualified by implementation, characterization, targeted/domain tests, database-level identity/dedupe proof and archive/Issue evidence; do not infer completion from closed GitHub status.
- [x] 1.3 Record each entrypoint's owner, production callers, replacement public API, retained storage, EvidenceOutbox consumer status, deletion condition and rollback reference in the owner/deprecation ledger.

## 2. Caller migration and deletion

- [x] 2.1 Migrate any residual Assessment, learner-state, plugin, planner, recommendation or intervention caller to its canonical public API; preserve role, privacy, idempotency, evidence and historical semantics.
- [x] 2.2 Prove zero production imports/dynamic loads/re-exports for each retired entrypoint and zero production callers of the old EvidenceOutbox consumer using source, build and architecture scans.
- [x] 2.3 Delete `src/features/adaptive-learning/kaq-quiz-coverage.ts`, obsolete adaptive forwarding, old `src/lib/adaptive-*` authorities, fallback helpers, flags and shims only after the relevant zero-consumer proof and qualified replacement protocol.
- [x] 2.4 Preserve legacy Prisma tables, snapshots, LearningFacts and path history when another domain owns them; delete only superseded authority/adapters.

## 3. Governance and verification

- [x] 3.1 Add negative architecture tests for second Assessment attempt, learner-state, planner, recommendation/mastery and course-policy authorities.
- [x] 3.2 Update owner/deprecation ledger with deleted paths, retained adapters/tables, EvidenceOutbox/worker ownership, current revision, verification output and code-only rollback evidence.
- [x] 3.3 Run affected Assessment, Personalization, Learning Record, path, EvidenceOutbox worker and build/import suites, typecheck, `openspec validate retire-legacy-adaptive-entrypoints --type change --strict` and `git diff --check`.
- [x] 3.4 Archive only after all gates pass; explicitly record no deployment, production activation or data deletion.
