## 1. Manifest Contract

- [ ] 1.1 Register `visual.blockDiagram`.
- [ ] 1.2 Register `visual.signalFlowGraph`.
- [ ] 1.3 Validate graph ids, nodes, edges, branches, labels, positions, path sets, reveal plans, and interaction modes.
- [ ] 1.4 Reject static-image-only block diagrams or signal-flow graphs when interaction or evidence is required.

## 2. Rendering

- [ ] 2.1 Render control block diagrams with blocks, sum points, branch points, input/output ports, disturbances, sensors, arrows, feedback loops, and labels.
- [ ] 2.2 Render signal flow graphs with nodes, directed branches, gain labels, path labels, loop labels, and non-touching loop groups.
- [ ] 2.3 Support teacher reveal and highlight for paths, loops, feedback branches, and formula references.
- [ ] 2.4 Support student read, highlight, construct, and diagnose modes.
- [ ] 2.5 Preserve visual clarity in light, dark, mobile, desktop, and projection states.

## 3. Evidence And Diagnostics

- [ ] 3.1 Record selected nodes, selected paths, selected loops, drag positions, constructed graph state, and comparison against reference structure.
- [ ] 3.2 Record teacher-revealed paths, loops, and feedback structures.
- [ ] 3.3 Surface teacher diagnostics for node/path/loop misconception distribution and graph-construction mismatch heatmaps.
- [ ] 3.4 Ensure diagnostics use teaching labels instead of raw ids.
- [ ] 3.5 Persist selection, construction, submission, teacher reveal, answer reveal, and diagnostic aggregation states across refresh.
- [ ] 3.6 Record evidence with `clientEventId`, `attemptKey`, trusted `sourceLogId`, `schemaVersion`, and explicit `InteractionLog` / `StudentStepResponse` / `LearningFact` classification.
- [ ] 3.7 Record feedback fields for misconception tags, student feedback mode, teacher next prompt, and retry or review action.
- [ ] 3.8 Use the unified evidence sample fields: `eventType`, `clientEventId`, `attemptKey`, trusted `sourceLogId`, `lessonKey`, `stepId`, `moduleId`, `componentKind`, `componentId`, `actorRole`, `clientEventAt`, `schemaVersion`, and `payload`.
- [ ] 3.9 Define diagnostics denominator, dedupe key, latest-vs-all-attempt policy, resubmission display, unreleased-student inclusion, default free-text redaction, and teacher/admin-only access.

## 4. Visual QA

- [ ] 4.1 Capture student and teacher screenshots in light and dark themes.
- [ ] 4.2 Capture required state-matrix screenshots for student unreleased, student released, student constructed graph, submitted state, teacher reveal, answer reveal, and diagnostic aggregation.
- [ ] 4.3 Capture mobile, desktop, and projection screenshots with no horizontal overflow and no controls covering the graph.
- [ ] 4.4 Add tests that Mason formula terms map back to graph paths or loops.
- [ ] 4.5 Add tests that tables cannot replace required graph highlighting.
- [ ] 4.6 Add keyboard and focus tests for selecting nodes, branches, paths, loops, and reveal controls.

## 5. Validation

- [ ] 5.1 Run `rtk openspec validate add-interactive-structure-diagram-visuals --strict`.
- [ ] 5.2 Run manifest runtime, response, and evidence tests.
- [ ] 5.3 Run browser audit for both student and teacher roles.
