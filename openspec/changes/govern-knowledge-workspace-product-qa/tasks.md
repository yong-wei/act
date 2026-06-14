## 1. QA Matrix

- [ ] 1.1 Define the route and state matrix for `/knowledge` product QA.
- [ ] 1.2 Include AppShell collapsed default, expanded persistence, local tools, inspector, semantic-map presentation, hover, click, drag, relayout, Konling selected/no-selection/degraded states, light/dark, mobile states, focus management, and the combined stress state.
- [ ] 1.3 Define structured evidence metadata for route, theme, viewport, navigation state, dock state, local tool state, selected node, interaction state, and result.

## 2. Governance Checks

- [ ] 2.1 Add checks that `/knowledge` uses the shared AppShell and does not introduce competing global navigation.
- [ ] 2.2 Add checks for default compact local tools, graphical legend, localized labels, and active summaries.
- [ ] 2.3 Add checks that hover and selection do not trigger graph relayout or graph data remount.
- [ ] 2.4 Add checks that dragged node coordinates persist until explicit relayout or reset.
- [ ] 2.5 Add checks that Konling uses the shared dock and receives selected-node context without duplicating assistant UI.
- [ ] 2.6 Add checks that Konling no-selection and degraded context states are explicit and do not claim selected-node diagnosis.
- [ ] 2.7 Add checks that local tools, mobile sheets, inspector, and expanded Konling assistant manage keyboard focus and focus return predictably.
- [ ] 2.8 Add checks that the combined stress state keeps graph interaction, inspector actions, local tool controls, and Konling reachable without obstruction.

## 3. Visual Evidence

- [ ] 3.1 Capture desktop and mobile screenshots for required matrix states.
- [ ] 3.2 Capture light and dark theme evidence that uses platform tokens and avoids page-local palette regressions.
- [ ] 3.3 Capture evidence showing the inspector and Konling expanded state do not overlap required controls.
- [ ] 3.4 Capture combined stress-state evidence with expanded AppShell, opened local tool, selected-node inspector, and expanded Konling assistant.
- [ ] 3.5 Capture focus management evidence for opened local tools, mobile sheets, inspector, and expanded Konling assistant.
- [ ] 3.6 Capture Konling no-selection and degraded context evidence.
- [ ] 3.7 Record which Product Design concept elements were adopted and which were intentionally rejected.

## 4. Final Gate

- [ ] 4.1 Run knowledge graph unit/component tests and commercial UI governance checks.
- [ ] 4.2 Run local browser validation against `http://localhost:3001` or the active local dev URL, avoiding `127.0.0.1` hydration false negatives.
- [ ] 4.3 Document temporary exceptions with owner and removal condition.
- [ ] 4.4 Run `rtk openspec validate govern-knowledge-workspace-product-qa --strict`.
