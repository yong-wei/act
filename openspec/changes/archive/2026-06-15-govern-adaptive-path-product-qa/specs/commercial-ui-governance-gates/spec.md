## ADDED Requirements

### Requirement: Adaptive path center product QA verifies handoff alignment
Commercial UI governance SHALL verify the adaptive learning path center against the accepted Product Design handoff and concept images.

#### Scenario: Adaptive path QA matrix is captured
- **WHEN** the adaptive path center redesign is reviewed
- **THEN** evidence SHALL include generation main, Konling parameter panel, cold-start starter paths, path comparison, active path execution, node detail, skip warning, history/evidence record, light theme, dark theme, desktop, mobile, AppShell navigation states, breadcrumbs, account controls, and shared Konling dock
- **AND** every evidence item SHALL identify route, goal, theme, viewport, auth state, navigation state, dock state, page state, selected path or node where applicable, and result.
- **AND** desktop evidence SHALL prove the center uses fluid AppShell workspace regions rather than a centered fixed-width page.
- **AND** mobile evidence SHALL prove task-first responsive reflow rather than a squeezed desktop table, sidebar, or multi-column layout.

#### Scenario: Handoff alignment is evaluated
- **WHEN** final adaptive path visual evidence is produced
- **THEN** the evidence SHALL cite `artifacts/product-design-audits/adaptive-learning-path-2026-06-14/design-handoff.md`
- **AND** it SHALL cite `01-path-generation-main.png`, `02-path-selection-comparison.png`, `03-active-path-execution.png`, and `04-history-evidence-record.png`
- **AND** it SHALL document adopted, merged, and rejected concept elements according to the handoff.

### Requirement: Adaptive path center QA requires independent visual subagent review
Final adaptive path product QA SHALL require independent browser-based visual review before acceptance.

#### Scenario: Visual review subagent runs
- **WHEN** implementation screenshots and evidence artifacts are ready
- **THEN** an independent visual review subagent SHALL receive the design handoff, all four concept image paths, implementation screenshots, changed files, and evidence artifacts
- **AND** the subagent SHALL report PASS/BLOCK findings for handoff alignment, concept adoption, AppShell continuity, fluid workspace layout, non-card path comparison, Konling dock, icon semantics, path map clarity, history/evidence hierarchy, cold-start usability, theme parity, mobile behavior, text fit, and forbidden strings
- **AND** unresolved BLOCK findings SHALL prevent completion.

#### Scenario: Layout regression is detected
- **WHEN** adaptive path pages render as centered fixed-width desktop pages, squeeze desktop controls into mobile, or present path options as isolated marketing cards rather than comparable routes
- **THEN** final adaptive path QA SHALL fail.

### Requirement: Adaptive path center QA rejects engineering leakage
Commercial UI governance SHALL fail adaptive path center acceptance when student-visible UI leaks internal engineering states.

#### Scenario: Forbidden string appears
- **WHEN** student-visible UI, accessible text, or embedded student page payload contains `Readiness Gate`, `missing-rules-graph-path-payload`, `missing-konling-context`, `terminal-validation-unavailable`, `policyFamily`, `stage`, `no-path`, `low-evidence`, or any raw `missing-*` reason code
- **THEN** final adaptive path QA SHALL fail.

#### Scenario: Generation remains fixed to one goal
- **WHEN** the path generation button, API call, or UI copy remains fixed to `control-correction`
- **THEN** final adaptive path QA SHALL fail unless the route is explicitly opened with that registered goal and generic generation remains available.

### Requirement: Adaptive path center QA validates user actions and data governance
Commercial UI governance SHALL require evidence that path center interactions write governed path activity.

#### Scenario: Path interaction evidence is reviewed
- **WHEN** final adaptive path QA runs
- **THEN** it SHALL verify generation, selection, rejection, switch, start, completion, review, continued interaction, skip, return, checkpoint outcome, Konling adjustment, and external-resource access are recorded or explicitly not applicable
- **AND** continued interaction SHALL not double-count first completion.
