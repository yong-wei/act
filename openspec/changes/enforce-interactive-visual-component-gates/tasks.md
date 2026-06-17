## 1. Acceptance Artifact

- [ ] 1.1 Define a standard implementation acceptance artifact for interactive visual components.
- [ ] 1.2 Require design contract path, visual source path, teaching mapping, screenshot matrix, viewport matrix, manifest audit path, test command output, browser audit path, evidence sample path, and reviewer evidence path.
- [ ] 1.3 Require teaching mapping fields: `lesson_id`, `step_id`, `learning_goal_id`, `handout_anchor` or `evidence_unit_id`, `boppps_phase`, and `interactive_contract_step_id`.
- [ ] 1.4 Require screenshot artifact filenames or manifest entries to encode `componentId`, `route`, `role`, `theme`, `viewport`, and `state`.
- [ ] 1.5 Fail validation when required artifact paths are missing, stale, duplicated, point to non-existent files, or do not map back to a component and state-matrix entry.

## 2. Visual Gates

- [ ] 2.1 Gate light and dark theme coverage.
- [ ] 2.2 Gate student and teacher role coverage.
- [ ] 2.3 Gate component state-matrix coverage: student unreleased, student released, student submitted, teacher reveal or derivation-in-progress, teacher answer reveal, and teacher diagnostic aggregation.
- [ ] 2.4 Gate component-specific states: graph constructed state for block/signal-flow diagrams and selected hotspot state for annotated media.
- [ ] 2.5 Gate mobile, desktop, and projection viewport coverage with no horizontal overflow and no teacher controls covering the primary stage.
- [ ] 2.6 Gate keyboard reachability, visible focus, and teaching-semantic labels for hotspots, graph nodes, graph paths, formula blocks, and reveal controls.
- [ ] 2.7 Gate engineering semantic leaks in titles, captions, fallbacks, diagnostics, and media frames.
- [ ] 2.8 Gate against `interactive-figure` as a generic visual or control carrier.

## 3. Component-Specific Gates

- [ ] 3.1 Gate derivation stage against vertical card-list fallback.
- [ ] 3.2 Gate derivation stage against missing KaTeX/LaTeX rendering.
- [ ] 3.3 Gate derivation stage against missing formula block reveal and color roles.
- [ ] 3.4 Gate block diagram and signal-flow graph against static-image-only interaction.
- [ ] 3.5 Gate annotated media against unrecorded hotspots.
- [ ] 3.6 Gate control workbench reuse against course-private duplicate panels.
- [ ] 3.7 Gate derivation stage cognitive load: per-step reveal density, long-formula split strategy, simultaneous color roles, default release pace, and student self-study visible range.
- [ ] 3.8 Gate visual pages against returning to single-column card stitching when a stage, diagram, derivation, or annotated media component is required.

## 4. Evidence Gates

- [ ] 4.1 Require backend evidence samples for each interactive visual component with `eventType`, `clientEventId`, `attemptKey`, trusted `sourceLogId`, `lessonKey`, `stepId`, `moduleId`, `componentKind`, `componentId`, `actorRole`, `clientEventAt`, `schemaVersion`, and `payload`.
- [ ] 4.2 Require each component to classify events as `InteractionLog` only, `StudentStepResponse`, or `LearningFact` materialization input.
- [ ] 4.3 Require teacher diagnostics aggregation semantics: denominator, dedupe key, latest-vs-all-attempt policy, resubmission display, unreleased-student inclusion, and redaction of free-text answers by default.
- [ ] 4.4 Require persistence and refresh recovery for student visual state, submitted state, teacher reveal state, answer reveal state, and diagnostic aggregation state.
- [ ] 4.5 Require teacher diagnostics evidence for each evidence-producing component.
- [ ] 4.6 Ensure teacher diagnostics do not expose student answer inputs, free-text payloads, or internal ids as labels.
- [ ] 4.7 Gate teacher diagnostic routes and APIs so only teacher/admin roles can access diagnostic data; student, guest, and unreleased views must not expose diagnostics.

## 5. Review Gates

- [ ] 5.1 Require browser audit for both student and teacher roles.
- [ ] 5.2 Require independent visual review or Product Design QA for substantial visual changes.
- [ ] 5.3 Require subagent review for pedagogy, UI flow, data governance, and critical risk only when the user, issue, or PR explicitly authorizes subagents; otherwise require an equivalent independent reviewer or Product Design QA record.

## 6. Validation

- [ ] 6.1 Run `rtk openspec validate enforce-interactive-visual-component-gates --strict`.
- [ ] 6.2 Run visual gate tests and manifest audit tests.
- [ ] 6.3 Run browser audit in light and dark themes for student and teacher roles across mobile, desktop, and projection viewports.
- [ ] 6.4 Run `rtk npm run db:session-data-quality` and `rtk npm run db:evidence-source-coverage` when a backing classroom session exists.
