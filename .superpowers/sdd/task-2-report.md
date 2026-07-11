# Task 2 Implementation Report

## Status

DONE_WITH_CONCERNS

Implemented OpenSpec tasks 2.1–2.4 only. Tasks 3+ were not modified.

## Files

- `src/features/knowledge/graph/node-activation.ts`: pure direct-activation state resolver.
- `src/features/knowledge/knowledge-graph-system.tsx`: unified node-id activation for canvas, directory/search, deep link, and Related Knowledge Points; canonical unknown resolution; cache reuse; loading/error/retry/filter recovery; stale response guard; semantic button path; legacy control removal.
- `src/features/knowledge/graph/knowledge-graph-2d.tsx`: removed selected-node screen projection callback/machinery.
- `src/features/knowledge/graph/knowledge-graph-canvas.tsx`: removed selected-node screen projection callback/machinery.
- `src/features/knowledge/__tests__/knowledge-node-activation.test.ts`: resolver state coverage.
- `src/features/knowledge/__tests__/knowledge-node-direct-activation-contract.test.ts`: entry-surface, keyboard semantics, and removal contract coverage.
- `src/features/knowledge/__tests__/knowledge-graph-node-expansion-control.test.ts`: replaced obsolete following-control projection assertion with removal assertions.
- `src/features/knowledge/__tests__/progressive-knowledge-graph-loading.test.ts`: updated the obsolete legacy-control marker assertion to the semantic node-control marker.
- `openspec/changes/redesign-knowledge-graph-direct-manipulation/tasks.md`: checked only 2.1–2.4.

## TDD Evidence

- RED: new test suites failed because `node-activation.ts` and unified activation/removal contracts did not exist.
- GREEN: 3 focused files, 18 tests passed after implementation.
- `rtk npm run typecheck`: passed.
- touched-file ESLint: 0 errors; two pre-existing `react-hooks/exhaustive-deps` warnings remain in renderer layout memo dependencies.
- `rtk openspec validate redesign-knowledge-graph-direct-manipulation --type change --strict`: passed.
- Full knowledge test directory: 89/90 passed; one unrelated pre-existing relation legend sizing assertion expects an obsolete `100vh` class while production uses `100dvh`.

## Self-review

- Native buttons own Enter/Space semantics; no custom keydown double dispatch.
- Expandable activation closes inspector; leaf activation opens/replaces it.
- Unknown nodes branch only from canonical expansion response metadata.
- Duplicate activation is suppressed, errors retry, cached shards are retained, and filter recovery reuses cached neighbors.
- Per-node generations and a global activation sequence prevent stale responses from mutating newer selection state.
- Legacy following control, bottom-left instruction panel, focus restoration, viewport clamping, and renderer projection loop were removed.

## Commit

Recorded by the final local commit for this report; no push performed.

## Concerns

- The semantic node controls are visually hidden and provide reliable native keyboard semantics, but browser-level focus-order and screen-reader behavior should receive the Task 5 Playwright/accessibility evidence required by the wider change.
- Two renderer ESLint warnings about deliberate `layoutState.version` memo invalidation predate this task and remain unchanged.

## Review Fix Follow-up

- Filtered-empty is now derived from final `displayLinks`, after node metadata, relation type, strength, density, focus-neighborhood, and connected-node filtering. Cached shards remain loaded, so filter recovery reveals relations without a second request.
- The semantic native-button layer is no longer permanently `sr-only`: each control becomes visibly positioned on keyboard focus, retains native Enter/Space behavior, and references the shared live activation status through `aria-describedby`.
- Expansion requests now carry per-request abort controllers. Unmount aborts all active requests, while success and failure commits both require a matching per-node generation and global activation sequence; stale HTTP, JSON, network, abort, and target-switch outcomes cannot write state.
- Added focused guard tests for hidden/recovered relations and stale generation, sequence, abort, and unmount outcomes; direct activation contract tests now require visible focus and status association.
