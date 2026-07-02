## Tasks

- [x] 1. Define the normalized citation presentation contract.
  - Add a deterministic normalized shape for final Konling citation items, summary state, diagnostics, and citation-level limitations.
  - Keep development diagnostics separate from final display state.

- [x] 2. Implement citation normalization and type-aware deduplication.
  - Normalize content, Source Pack, knowledge node, path-execution, learner-state, simulation, and other governed citation sources into one ordered list.
  - Deduplicate by type-aware stable keys without merging unrelated source types.

- [x] 3. Restore per-citation linkability.
  - Allow high-confidence or medium-confidence citations with safe server-owned targets to remain clickable even when personalization evidence is limited.
  - Disable only citations that individually lack a safe target or carry citation-level restrictions.

- [x] 4. Suppress model-authored footnote links.
  - Strip or neutralize generated GFM footnotes and current-page `#user-content-fn*` anchors.
  - Ensure citation numbering comes only from normalized metadata.

- [x] 5. Add focused citation presentation tests.
  - Cover streaming diagnostic separation, limited personalization with clickable content citations, missing target display, duplicate path evidence, and fake footnote suppression.

- [x] 6. Validate the change.
  - Run `rtk openspec validate normalize-konling-citation-presentation --strict`.
  - Run targeted citation presentation tests.
