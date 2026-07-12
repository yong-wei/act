# Task 1 Implementation Report

Status: DONE

## Scope

Completed only OpenSpec tasks 1.1-1.3 for `redesign-knowledge-graph-direct-manipulation`.
Tasks 2.1 and later were not modified or implemented. No `.wolf` files, other issues,
stashes, remotes, or GitHub state were changed.

## Commit

- `79be7cd39973f722c0cfd0679e8d1244bf640c54`
- Message: `feat(knowledge): add progressive expansion descriptors`
- Local commit only; not pushed.

## Files Changed

- `src/lib/knowledge-graph-source.ts`
  - Added the `KnowledgeNodeExpansion` contract and optional node descriptor.
  - Added canonical incident-neighbor descriptor computation with unique-neighbor
    counting in O(N+E) time.
  - Added chapter-root descriptors based only on their outgoing synthetic
    `contains` neighbors.
  - Added descriptors to root, expansion, active-filter, and remaining payloads.
  - Kept the full canonical relation set server-side; payload links retain their
    pre-existing shard boundaries.
- `src/features/knowledge/knowledge-graph-system.tsx`
  - Added the compatible client node descriptor type.
  - Normalized progressive payload nodes without metadata to `unknown` during
    cache merge instead of inferring `leaf`.
  - Preserved the existing graph-version reset behavior, which discards stale
    descriptors and shard keys when the version changes.
- `src/features/knowledge/__tests__/progressive-knowledge-graph-loading.test.ts`
  - Added chapter-root, expandable-node, leaf-node, all-builder, graph-version,
    and missing-compatibility-metadata coverage.
- `openspec/changes/redesign-knowledge-graph-direct-manipulation/tasks.md`
  - Checked only tasks 1.1, 1.2, and 1.3.

## TDD Evidence

RED:

- Command: `rtk npm run test:unit -- src/features/knowledge/__tests__/progressive-knowledge-graph-loading.test.ts`
- Result after correcting an initial test import setup error: 3 expected assertion
  failures, covering missing root descriptors, missing canonical node descriptors,
  and missing compatibility normalization.

GREEN:

- Same focused command passed 9/9 tests after the minimal implementation.
- The descriptor computation was then refactored from repeated relation scans to
  a single adjacency pass; focused tests and typecheck remained green.

## Final Verification

- `rtk npm run typecheck` — passed, zero TypeScript errors.
- `rtk npm run test:unit -- src/features/knowledge/__tests__/progressive-knowledge-graph-loading.test.ts src/features/knowledge/__tests__/knowledge-graph-interaction-state.test.ts` — passed, 2 files and 25 tests.
- `rtk openspec validate redesign-knowledge-graph-direct-manipulation --type change --strict` — passed.
- `rtk git diff --check` — passed.
- Commit hook verification during `git commit` — passed.

## Self-review

- The binding state vocabulary is exactly `expandable | leaf | unknown`.
- `revealableNeighborCount` is emitted only for expandable nodes.
- Duplicate relations between the same endpoints do not inflate the count.
- Self-relations do not make a node expandable because they reveal no neighbor.
- Ordinary-node descriptors use unfiltered canonical incident relations, while
  chapter roots use chapter membership as outgoing `contains` neighbors.
- Filtered link payloads do not influence canonical expandability.
- Missing compatibility metadata becomes `unknown`, never `leaf`.
- Graph-version changes clear old cached nodes and their descriptors.
- The root response still contains no links and the root loader still reads only
  relation version/count evidence rather than parsing the full relation payload.

## Concerns

None blocking. Direct activation behavior intentionally remains unimplemented
because it belongs to Task 2.

## Independent Review Fixes

Status: DONE

Commit:

- `a915fc1a42b7012e83fd6a43b638d0ac20352c6c`
- Message: `fix(knowledge): keep root graph loading lightweight`
- Local commit only; not pushed.

### P1: Database root fallback

- Replaced the database root fallback's `knowledgeLink.findMany()` with
  `knowledgeLink.count()`.
- The root path now passes an empty relation array plus count evidence into the
  database payload builder, so it neither normalizes nor constructs the full
  relation payload.
- Database root and full payloads now derive their shared version digest from
  normalized node content plus relation count evidence, preserving version
  alignment without loading relation rows for root.
- Added behavior assertions that root calls `count()` exactly once, does not call
  relation `findMany()`, returns no links, and remains version-aligned with the
  subsequently loaded full payload.

### P2: Initial and legacy cache compatibility

- Extracted progressive cache logic into
  `src/features/knowledge/progressive-graph-cache.ts` so cache behavior can be
  tested directly without importing the React/Next component runtime.
- `buildInitialGraphCache` and `mergeProgressiveGraphPayload` now share one
  normalization function; missing expansion metadata becomes `{ state: 'unknown' }`
  in both paths.
- Replaced implementation-string assertions with behavior tests covering initial
  legacy nodes, same-version authoritative descriptors, graph-version reset,
  compatibility unknown state, and shard-key reset.

### Review-fix TDD evidence

RED:

- Command: `rtk npm run test:unit -- src/features/knowledge/__tests__/progressive-knowledge-graph-loading.test.ts`
- Result: 2 expected failures: initial cache did not call the shared unknown
  normalizer, and DB root made zero `count()` calls because it still used
  relation `findMany()`.

GREEN and final verification:

- Focused progressive test: 9/9 passed after the minimal fixes.
- `rtk npm run typecheck` — passed after exporting the existing shared link-key
  helper required by the extracted pure cache module.
- `rtk npm run test:unit -- src/features/knowledge/__tests__/progressive-knowledge-graph-loading.test.ts src/features/knowledge/__tests__/knowledge-graph-interaction-state.test.ts` — 2 files, 25 tests passed.
- `rtk openspec validate redesign-knowledge-graph-direct-manipulation --type change --strict` — passed.
- `rtk git diff --check` — passed.

### Review-fix concerns

None blocking. The database schema has no `KnowledgeLink.updatedAt`; therefore
the lightweight database root version evidence uses relation count. This meets
the root performance contract but, as before any count-only evidence strategy,
a same-count in-place relation mutation is not independently observable until a
full graph load. No schema or knowledge-semantics change was introduced in Task 1.

## Fresh Review: Content-sensitive Database Graph Version

Status: DONE

Commit:

- `f95cfe720dcb058da65ee684e375386d8103a29a`
- Message: `fix(knowledge): fingerprint database graph relations`
- Local commit only; not pushed.

### Resolution

- Replaced count-only database relation version evidence with a DB-side stable
  aggregate fingerprint.
- The aggregation returns one row containing relation count and an MD5 of all
  canonical relation identity fields: `id`, `sourceId`, `targetId`, and
  `relation`, ordered by the same tuple before aggregation.
- Database root and full loaders call the same evidence function and include
  both `linkCount` and `relationFingerprint` in their shared version digest.
- Root still queries only nodes plus the single aggregate evidence row; it does
  not call relation `findMany`, normalize relation rows, or construct a complete
  link payload.
- Full loading continues to materialize links because expansion/remaining
  payloads require them, while deriving graphVersion from the same aggregate
  evidence contract as root.

### TDD evidence

RED:

- Command: `rtk npm run test:unit -- src/features/knowledge/__tests__/progressive-knowledge-graph-loading.test.ts`
- After correcting an initial obsolete mock setup error, 2 expected failures
  remained: the DB aggregate query was never called, and two relation snapshots
  with equal counts but different endpoint/type fingerprints produced the same
  graphVersion.

GREEN and final verification:

- Focused progressive suite passed 10/10 tests after implementation.
- Added SQL contract assertions that the aggregate includes and orders
  `id/sourceId/targetId/relation`, root does not call relation `findMany`, and
  root/full both call the shared fingerprint evidence query.
- Added behavior coverage proving equal relation counts with changed relation
  content produce different graph versions.
- `rtk npm run typecheck` — passed.
- `rtk npm run test:unit -- src/features/knowledge/__tests__/progressive-knowledge-graph-loading.test.ts src/features/knowledge/__tests__/knowledge-graph-interaction-state.test.ts` — 2 files, 26 tests passed.
- `rtk openspec validate redesign-knowledge-graph-direct-manipulation --type change --strict` — passed.
- `rtk git diff --check` — passed.

### Concerns

None. The previous count-only version-evidence concern is resolved.

## Final Review: Active Relation Scope

Status: DONE

Commit:

- `17588410301aacd374dd513fbda59e7b4a65fecd`
- Message: `fix(knowledge): scope graph relations to active nodes`
- Local commit only; not pushed.

### Resolution

- Unified the canonical database relation scope with the active-node scope.
- The full relation `findMany` now requires both `sourceNode.isActive` and
  `targetNode.isActive`.
- The DB-side relation fingerprint query joins both endpoint nodes and applies
  the same two active predicates before count and stable aggregation.
- Root and full therefore use identical active-relation version evidence, while
  root still receives only the aggregate row and never materializes links.
- Relations from active to inactive nodes and from inactive to active nodes can
  no longer create dangling payload links or make an active node appear
  expandable when no active neighbor can be revealed.

### TDD evidence

RED:

- `rtk npm run test:unit -- src/features/knowledge/__tests__/progressive-knowledge-graph-loading.test.ts`
- 2 expected failures: fingerprint SQL lacked active endpoint joins, and full
  relation `findMany` lacked the two-endpoint active filter.

GREEN and final verification:

- Focused progressive suite passed 11/11 tests.
- Added active-to-inactive and inactive-to-active regression coverage proving
  no dangling links, a canonical leaf descriptor, and root/full graphVersion
  equality under the same active-only evidence snapshot.
- Added query contract checks for both active endpoint joins and predicates.
- `rtk npm run typecheck` — passed.
- `rtk npm run test:unit -- src/features/knowledge/__tests__/progressive-knowledge-graph-loading.test.ts src/features/knowledge/__tests__/knowledge-graph-interaction-state.test.ts` — 2 files, 27 tests passed.
- `rtk openspec validate redesign-knowledge-graph-direct-manipulation --type change --strict` — passed.
- `rtk git diff --check` — passed.

### Concerns

None.
