## Tasks

- [ ] 1. Select the textbook search-document shard.
  - Use helper output to select a deterministic shard of search-document rows connected to active goals, reviewed sections, or high-priority graph domains.
  - Record selected ids, parent refs, blocker codes, and residual unselected counts.

- [ ] 2. Review selected rows item by item.
  - Inspect parent section context and classify each selected row as supporting citation, embedded asset, parent-section evidence support, or excluded-with-rationale.
  - Record citation anchors, graph refs, authority, privacy, source hash, limitation state, and rationale.

- [ ] 3. Enforce long-form planning boundaries.
  - Verify raw search-document rows do not become PathNodes.
  - Verify selected rows cite through reviewed parent sections or explicit citation targets.

- [ ] 4. Validate shard completion.
  - Run `rtk openspec validate review-textbook-search-document-citation-shard --strict`.
  - Run helper and targeted RAG/citation checks.
