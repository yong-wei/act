## 1. Knowledge Graph Tool Governance

- [x] 1.1 Reuse any `/knowledge` tool-panel migration already completed by `migrate-secondary-route-families-to-unified-shell`; do not duplicate that migration in this change.
- [x] 1.2 Verify or consume the migrated `/knowledge` output so chapter directory, relation filters, legend, view switch, and resource panel are compact or collapsed controls by default; only implement missing `/knowledge` default-state glue when the migration has explicitly handed that gap to this change.
- [x] 1.3 Ensure relation legend, view switch, and resource panel have open/closed/mobile/tablet evidence.
- [x] 1.4 Preserve selected node, active filters, density mode, legend state, and summaries across tool open and close.

## 2. Knowledge Graph Governance Gates

- [x] 2.1 Add governance checks for compact knowledge tools, graphical legends, localized labels, fine-line relations, and bounded node scaling evidence.
- [x] 2.2 Add a runtime relation coverage gate that reads `course-content/runtime/knowledge/graph/relations.jsonl` and fails or blocks on unmapped relation types.
- [x] 2.3 Include common and low-frequency runtime relation samples in evidence, including cross-domain, generalization, instance, support/enablement, complements, contrasts, derives, determines, quantified-by, uses, visualized-by, opposite, and related mappings when present.
- [x] 2.4 Add graph clarity evidence checks for default high-signal, selected-node focused, and all-relations dense states.
- [x] 2.5 Add a scope-protection check proving this change's governance matrix covers `/knowledge` graph states only and does not require simulation, Interactive Learning descendant, teacher, or admin route-family migration evidence.
- [x] 2.6 Run focused UI governance tests and `rtk openspec validate govern-knowledge-graph-navigation-and-visual-qa --strict`.
