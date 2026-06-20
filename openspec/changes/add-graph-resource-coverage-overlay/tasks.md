## 1. Coverage Service

- [ ] 1.1 Add graph resource coverage payload types.
- [ ] 1.2 Build coverage from ResourceNode knowledge/capability mappings.
- [ ] 1.3 Include RAG-indexed counts from governed resource projections where available.
- [ ] 1.4 Include citation-ready and verified-citation counts separately from indexed counts.
- [ ] 1.5 Classify assessment, simulation, Arena preview, Arena official, and terminal-validation-capable coverage separately.
- [ ] 1.6 Preserve source-of-record boundaries and avoid raw content copying.

## 2. Graph Center Mode

- [ ] 2.1 Add resource coverage mode to graph-center payload.
- [ ] 2.2 Show coverage counts, state, and missing types in node details.
- [ ] 2.3 Show citation readiness limitations when indexed resources cannot be verified as clickable citations.
- [ ] 2.4 Ensure color is not the only state indicator.

## 3. Verification

- [ ] 3.1 Add tests for sufficient, partial, missing, and not-audited states.
- [ ] 3.2 Add tests proving linked-resource count and path-eligible count are distinct.
- [ ] 3.3 Add tests proving RAG-indexed count and citation-ready / verified-citation count are distinct.
- [ ] 3.4 Run `rtk openspec validate add-graph-resource-coverage-overlay --strict`.
