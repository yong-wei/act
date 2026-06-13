## 1. Visual Grammar

- [ ] 1.1 Inventory every distinct runtime relation type from `course-content/runtime/knowledge/graph/relations.jsonl`.
- [ ] 1.2 Define a shared relation visual grammar for 2D graph edges, 3D graph equivalent encodings, and legend samples.
- [ ] 1.3 Map every runtime relation type to a Chinese teaching label, visual family, direction semantics, default density policy, and legend explanation.
- [ ] 1.4 Map prerequisite/foundation, contains, follows/leads-to, applies-to, opposite, related, cross-domain, generalization, instance, support, and enablement relations to distinct or explicitly grouped fine-line styles.
- [ ] 1.5 Add theme-aware token mappings so relation styles remain visible in light and dark themes without raw page-local palettes.
- [ ] 1.6 Add a validation path that rejects or reports any runtime relation type without visual-semantic coverage.

## 2. Node Expression

- [ ] 2.1 Define the visual node scale contract, including minimum radius, maximum radius, focus emphasis, and tokenized scale classes.
- [ ] 2.2 Ensure the scale contract prioritizes teaching importance visually and treats degree as a capped secondary signal supplied by layout metrics.
- [ ] 2.3 Preserve existing node type and knowledge dimension cues while moving emphasis to the new scale and focus grammar.

## 3. Legend And Labels

- [ ] 3.1 Replace text-only relation legends with graphical edge samples generated from shared style config.
- [ ] 3.2 Localize graph filter and metadata labels into Chinese teaching language.
- [ ] 3.3 Ensure the visible UI does not expose raw schema labels such as `category` or `bloom_level`.

## 4. Verification

- [ ] 4.1 Add unit or component tests for complete runtime relation type coverage, relation style mapping, node scale bounds, and label localization.
- [ ] 4.2 Capture browser evidence based on real runtime graph data, including cross-domain, generalization, instance, support/enablement, opposite, and related relation samples.
- [ ] 4.3 Capture browser evidence for relation legend samples, 2D rendering, and 3D equivalent edge encodings in light and dark themes.
- [ ] 4.4 Run `rtk openspec validate redesign-knowledge-graph-visual-language --strict`.
