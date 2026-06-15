## 1. QA Matrix

- [x] 1.1 Define the route and state matrix for `/knowledge` product QA.
- [x] 1.2 Include AppShell collapsed default, expanded persistence, local tools, inspector, semantic-map presentation, hover, click, drag, relayout, Konling selected/no-selection/degraded states, light/dark, mobile states, focus management, and the combined stress state.
- [x] 1.3 Define structured evidence metadata for route, theme, viewport, navigation state, dock state, local tool state, selected node, interaction state, and result.
- [x] 1.4 Define a handoff-to-implementation matrix for `design-handoff.md`, `concepts/README.md`, and the three concept images, covering adopted, rejected, and merged guidance.

## 2. Governance Checks

- [x] 2.1 Add checks that `/knowledge` uses the shared AppShell and does not introduce competing global navigation.
- [x] 2.2 Add checks for default compact local tools, graphical legend, localized labels, and active summaries.
- [x] 2.3 Add checks that hover and selection do not trigger graph relayout or graph data remount.
- [x] 2.4 Add checks that dragged node coordinates persist until explicit relayout or reset.
- [x] 2.5 Add checks that Konling uses the shared dock and receives selected-node context without duplicating assistant UI.
- [x] 2.6 Add checks that Konling no-selection and degraded context states are explicit and do not claim selected-node diagnosis.
- [x] 2.7 Add checks that local tools, mobile sheets, inspector, and expanded Konling assistant manage keyboard focus and focus return predictably.
- [x] 2.8 Add checks that the combined stress state keeps graph interaction, inspector actions, local tool controls, and Konling reachable without obstruction.

## 3. Visual Evidence

- [x] 3.1 Capture desktop and mobile screenshots for required matrix states.
- [x] 3.2 Capture light and dark theme evidence that uses platform tokens and avoids page-local palette regressions.
- [x] 3.3 Capture evidence showing the inspector and Konling expanded state do not overlap required controls.
- [x] 3.4 Capture combined stress-state evidence with expanded AppShell, opened local tool, selected-node inspector, and expanded Konling assistant.
- [x] 3.5 Capture focus management evidence for opened local tools, mobile sheets, inspector, and expanded Konling assistant.
- [x] 3.6 Capture Konling no-selection and degraded context evidence.
- [x] 3.7 Record which Product Design concept elements were adopted and which were intentionally rejected.
- [x] 3.8 Record which handoff decisions were merged across concept references and prove the implementation does not treat generated labels, shell chrome, role switches, exact node positions, or duplicate assistant panels as product truth.

## 4. Independent Visual Review

- [x] 4.1 Run an independent visual review subagent with `design-handoff.md`, `concepts/README.md`, the three concept image paths, implementation screenshots, changed files, and evidence artifacts.
- [x] 4.2 Require the visual review subagent to return PASS/BLOCK findings for handoff alignment, concept adoption/rejection, AppShell continuity, local tools, semantic map, inspector hierarchy, Konling dock, interaction stability, keyboard/focus behavior, theme parity, mobile behavior, and combined stress-state non-overlap.
- [x] 4.3 Treat every unresolved visual review BLOCK as a QA blocker and fix it before completion.
- [x] 4.4 Re-run visual subagent review after blocking fixes until no blocking findings remain.

## 5. Final Gate

- [x] 5.1 Run knowledge graph unit/component tests and commercial UI governance checks.
- [x] 5.2 Run local browser validation against `http://localhost:3001` or the active local dev URL, avoiding `127.0.0.1` hydration false negatives.
- [x] 5.3 Document temporary exceptions with owner and removal condition.
- [x] 5.4 Run `rtk openspec validate govern-knowledge-workspace-product-qa --strict`.
