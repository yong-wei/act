# Task 1: Expandability Contract

Implement the following OpenSpec tasks from `redesign-knowledge-graph-direct-manipulation`:

- 1.1 Add a versioned expandable, leaf, or unknown descriptor and optional revealable-neighbor count to progressive knowledge-node payload types.
- 1.2 Compute expansion descriptors from canonical graph relations for root, expansion, active-filter, and remaining payload builders without exposing or loading the full graph in the browser.
- 1.3 Update graph fixtures, cache merge behavior, and unit tests for version changes, missing compatibility metadata, leaf nodes, and expandable nodes.

Binding design contract:

```ts
type KnowledgeNodeExpansion = {
  state: 'expandable' | 'leaf' | 'unknown';
  revealableNeighborCount?: number;
};
```

- `expandable` means canonical unfiltered graph relations can reveal at least one neighbor.
- `leaf` means no expansion shard can reveal a neighbor.
- `unknown` is only for stale or compatibility payloads and must not be inferred as leaf.
- Metadata belongs in root, expansion, active-filter, and remaining payloads, is tied to `graphVersion`, and must not expose the full relation set.
- Chapter roots use outgoing `contains` neighbors; ordinary nodes use canonical incident expansion relations.
- Preserve current progressive root performance: root may use relations bytes/count/version evidence but must not parse/build the full link payload.
- Do not change knowledge semantics, relation taxonomy, ResourceNode binding, learning paths, Konling permissions, course content, direct activation UI, layout, motion, or inspector behavior in this task.

Required workflow:

1. Read the OpenSpec proposal, design, both delta specs, and this brief.
2. Follow TDD: add failing focused tests first, then minimal implementation.
3. Run focused tests plus typecheck for touched contracts.
4. Update only Tasks 1.1-1.3 checkboxes after tests pass.
5. Commit the implementation. Do not push or open a PR.
6. Write a detailed report to `.superpowers/sdd/task-1-report.md` with files changed, tests/commands/results, commit SHA, self-review, and concerns.

Report status must be one of DONE, DONE_WITH_CONCERNS, NEEDS_CONTEXT, or BLOCKED.
