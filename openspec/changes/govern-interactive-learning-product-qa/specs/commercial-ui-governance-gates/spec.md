## ADDED Requirements

### Requirement: Interactive learning product QA verifies handoff alignment
Commercial UI governance SHALL verify the interactive learning redesign against the accepted Product Design handoff and concept images.

#### Scenario: Interactive learning product QA matrix is captured
- **WHEN** the interactive learning redesign is reviewed
- **THEN** evidence SHALL include atlas, course catalog, chapter components, cross-domain list, course entry, teacher waiting, student runtime, guest runtime, teacher projection runtime, invalid session, representative module states, Konling dock, light theme, dark theme, desktop, mobile, and focus management
- **AND** every evidence item SHALL identify route, role, theme, viewport, navigation state, dock state, page state, module state, source concept, and result.

#### Scenario: Per-change design QA is aggregated
- **WHEN** final interactive learning product QA runs
- **THEN** the design-qa report for each child change SHALL be present
- **AND** every child design-qa report SHALL say `final result: passed`
- **AND** missing, blocked, or stale design-qa evidence SHALL fail final QA.

#### Scenario: Handoff alignment is evaluated
- **WHEN** final visual evidence is produced
- **THEN** the evidence SHALL cite `artifacts/product-design-audits/interactive-learning-2026-06-14/design-handoff.md`
- **AND** it SHALL cite the accepted concept images used by each route family
- **AND** route inventory, token usage, or nonblank screenshots SHALL NOT be sufficient when the visible result contradicts the handoff.

### Requirement: Interactive learning final QA requires independent visual review
Final interactive learning product QA SHALL require an independent visual review subagent before acceptance.

#### Scenario: Visual review subagent runs
- **WHEN** implementation screenshots and evidence artifacts are ready
- **THEN** an independent visual review subagent SHALL receive the design handoff, accepted concept image paths, implementation screenshots, changed files, and evidence artifacts
- **AND** the subagent SHALL report PASS/BLOCK findings for atlas, course entry, waiting, runtime modes, module chrome, AppShell continuity, Konling dock, theme parity, mobile behavior, accessibility, and concept alignment
- **AND** unresolved BLOCK findings SHALL prevent completion.

#### Scenario: Interactive learning regression is detected
- **WHEN** pages show duplicated global navigation, missing breadcrumbs, fixed full-page centered width, missing Konling dock, Konling embedded into a course right rail, permanent teacher right drawer, top duplicate next-page action, missing teacher page-jump dropdown, oversized teacher bottom navigation, student answer inputs in teacher mode, teacher stats in student/guest mode, or unregistered module chrome
- **THEN** governance SHALL fail or report the issue as a blocking product QA regression.
