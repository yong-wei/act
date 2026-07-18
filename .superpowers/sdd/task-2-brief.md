# Task 2: Direct Node Activation

Implement OpenSpec tasks 2.1–2.4 for `redesign-knowledge-graph-direct-manipulation`:

- 2.1 Replace the selected-node toggle closure with a node-id activation resolver covering collapsed, expanded, filtered-empty, leaf, unknown, loading, error, retry, and filter-recovery states.
- 2.2 Route 2D/3D nodes, directory, search, deep links, and inspector Related Knowledge Points through the resolver; expandable nodes close inspector and leaf nodes open/replace it.
- 2.3 Add a synchronized semantic node-control path so Enter and Space produce the same outcomes with accessible focus, busy, expanded, leaf, and error states.
- 2.4 Remove the node-following expansion button, positioning/focus machinery, and bottom-left expansion instruction panel after direct activation parity is verified.

Binding behavior:

- `expandable + collapsed`: close inspector, select/focus node, load/reveal shard, expand.
- `expandable + expanded`: close inspector and collapse without evicting cached shard data.
- `leaf`: select and open inspector.
- `unknown`: show node-local busy state, resolve once through expansion endpoint, then branch only from canonical response metadata; never guess leaf.
- `filtered-empty`: remain logically expanded/cached, explain filtered state, reveal cached neighbors after filter recovery without duplicate request; next activation collapses.
- `loading`: suppress duplicate activation while keeping honest busy state.
- `error`: next activation retries same node; stale responses cannot open inspector or overwrite newer state.
- Pointer and keyboard must invoke one resolver across 2D/3D, directory, search, deep link, and Related Knowledge Points.
- Native button keyboard semantics must not double-dispatch Enter/Space.
- Preserve filters, progressive cache, coordinates, layout, viewport, Konling, local tools, and relation semantics. Do not implement sector layout, motion, drag freeze, or inspector reordering/dismissal beyond expandable-node close; those belong to Tasks 3–4.
- Remove the old node-following control only after behavioral parity tests pass.

Required workflow:

1. Read this brief and the OpenSpec proposal/design/specs.
2. Use TDD: failing component/integration tests first, then minimal implementation.
3. Cover every resolver state and all entry surfaces, pointer/Enter/Space parity, duplicate suppression, retry, filter recovery/cache reuse, and stale async response protection.
4. Run focused tests, typecheck, ESLint for touched files, OpenSpec strict, and diff-check.
5. Check only tasks 2.1–2.4 after their evidence passes.
6. Commit locally; do not push or modify GitHub.
7. Write `.superpowers/sdd/task-2-report.md` with files, tests/results, commits, self-review, and concerns.

Return one of DONE, DONE_WITH_CONCERNS, NEEDS_CONTEXT, or BLOCKED.
