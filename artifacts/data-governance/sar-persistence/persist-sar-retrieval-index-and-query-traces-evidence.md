# Persist SAR Retrieval Index and Query Traces Evidence

## Scope

- Added `src/lib/data-governance/sar-persistence.ts` as a TypeScript persistence contract and repository for governed SAR records.
- Persisted records cover events, entities, event-entity relations, and query traces.
- Persistence uses stable SAR ids and deterministic relation keys so repeated writes update existing records without duplicating relations.
- Query traces store `queryHash` only; raw query identity is never serialized into persisted trace records.
- Student-scoped trace retention stores explicit `storedAt`, `retainUntil`, optional `minimizeAfter`, minimization policy, and export eligibility.
- Direct source `ownerUserId` and `classId` values are converted to hash-only persisted refs before snapshot storage or safe export.

## Privacy Boundary

- All SAR result writes call the existing `validateSarResult` contract before persistence.
- Query trace writes call the existing trace validation and then persist only seed ids, hops, selected refs, rejected refs, limitations, version refs, handoff state, and hash-only query identity.
- Restored snapshots reject raw query fields, raw source identity fields, invalid export/handoff/retention enum values, non-hash scope refs, and restricted raw text inside selected refs, rejected reasons, or limitations.
- Safe exports exclude `audit-only` and `system-internal` event/entity records.
- Expired/minimized traces clear seed ids, hops, selected refs, and rejected refs, apply delete/aggregate/redact policy branches, and are excluded from safe exports.

## Verification

- `rtk npm run test:unit -- src/lib/data-governance/__tests__/sar-persistence.test.ts src/lib/data-governance/__tests__/structured-associative-retrieval.test.ts`
- Result: passed, 2 files / 31 tests.
- `rtk openspec validate persist-sar-retrieval-index-and-query-traces --strict`
  - Result: passed.
- `rtk npm run lint`
  - Result: passed.
- `rtk proxy git diff --check`
  - Result: passed.

## Deferred Scope

- No Prisma migration was added in this change. The OpenSpec proposal permits but does not require a database migration, and the current acceptance criteria can be verified through the TypeScript persistence contract plus durable JSON snapshot repository.
- Scheduler refresh orchestration, teacher trace UI, source pack ranking, final citation verification, and live eval reports remain outside this change scope.
