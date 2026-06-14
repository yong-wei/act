## 1. Presentation Audit

- [ ] 1.1 Compare current graph rendering against archived relation visual grammar and layout clarity specs.
- [ ] 1.2 Identify which edge families, node states, labels, halos, cluster cues, and theme states still fail semantic-map readability.
- [ ] 1.3 Document which Product Design concept references are adopted and rejected.

## 2. Edge And Node Refinement

- [ ] 2.1 Refine default edge width, opacity, dash, arrow, curvature, and endpoint treatment so edges remain fine and subordinate.
- [ ] 2.2 Refine selected and focused neighborhood emphasis without increasing global graph noise.
- [ ] 2.3 Refine node radius, halo, focus ring, and label priority so importance and degree remain bounded and readable.
- [ ] 2.4 Ensure graph and relation legend samples are generated from the same visual style contract.

## 3. Semantic Region Treatment

- [ ] 3.1 Add or refine semantic cluster territories, chapter regions, or equivalent grouping cues when they improve graph readability.
- [ ] 3.2 Ensure cluster cues use platform tokens, remain subtle, and do not obscure edges or labels.
- [ ] 3.3 Provide a fallback when cluster territories are unavailable or too dense.

## 4. Verification

- [ ] 4.1 Add tests or source checks for shared graph/legend visual config usage.
- [ ] 4.2 Add theme checks for edge contrast and non-color visual differentiation.
- [ ] 4.3 Capture browser evidence for default semantic map, selected neighborhood, dense/all-relations mode, light theme, and dark theme.
- [ ] 4.4 Run `rtk openspec validate refine-knowledge-graph-semantic-map-presentation --strict`.
