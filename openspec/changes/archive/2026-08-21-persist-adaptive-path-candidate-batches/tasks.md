## 1. Candidate Batch Persistence

- [x] 1.1 Add Prisma candidate batch and candidate models, ownership relations, uniqueness constraints, indexes, and an additive migration.
- [x] 1.2 Implement a typed candidate-batch persistence module that validates planner output, creates immutable snapshots transactionally, and deduplicates by generation request ID.
- [x] 1.3 Add unit tests for successful persistence, idempotent retries, immutable candidate identity, and preservation of an existing active path.

## 2. Authorized Batch APIs

- [x] 2.1 Add exact and latest candidate-batch read endpoints using existing learning-path requester and class-scope authorization boundaries.
- [x] 2.2 Return stable batch/candidate projections with planner ordering and reject mismatched or unauthorized candidate identities.
- [x] 2.3 Add route tests for learner ownership, teacher class scope, administrator access, latest ordering, and invalid deep links.

## 3. Generation Integration

- [x] 3.1 Persist a candidate batch only after an explicitly successful path-advisor generation and return its batch and candidate IDs.
- [x] 3.2 Preserve the generation lifecycle contract for pending, running, awaiting approval, blocked, failed, and transport-unknown results.
- [x] 3.3 Add focused path-advisor tests for successful batch identity and same-request retry deduplication.

## 4. Path Center Integration

- [x] 4.1 Load the latest or URL-selected candidate batch independently from the current selected or executing path.
- [x] 4.2 Adapt the existing comparison workspace to persisted candidates without changing planner order or rebuilding the UI.
- [x] 4.3 Support `batch` and `candidate` deep links, fail closed for mismatches, and retain the compare-all entry.
- [x] 4.4 Add component and Playwright coverage for latest batch display, focused candidate links, compare-all navigation, and active-path preservation.

## 5. Verification And Evidence

- [x] 5.1 Run focused unit and route tests, Prisma validation, lint, full typecheck, and `git diff --check`.
- [x] 5.2 Create a code checkpoint commit, capture 1440px and 320px browser evidence with a hash-bound manifest, and verify it in non-update mode.
- [x] 5.3 Update Issue 1140 phase B evidence documentation, OpenSpec task status, and OpenWolf handoff state.
