## ADDED Requirements

### Requirement: Knowledge workspace product QA verifies the integrated experience
Commercial UI governance SHALL verify the redesigned knowledge graph as an integrated product workspace across shell, tools, graph interaction, inspector, assistant, theme, and mobile states.

#### Scenario: Knowledge workspace QA matrix is captured
- **WHEN** `/knowledge` is reviewed after redesign
- **THEN** evidence SHALL include AppShell collapsed default, AppShell expanded persisted state, semantic-map presentation, compact local tools, opened directory/filter/legend controls, selected-node inspector, hover preview, node click, dragged-node persistence, explicit relayout, Konling collapsed/expanded/selected/no-selection/degraded states, light theme, dark theme, focus management, and 320px mobile behavior
- **AND** the evidence SHALL identify route, theme, viewport, navigation state, dock state, local tool state, selected node, interaction state, and result.

#### Scenario: Knowledge workspace stress state is captured
- **WHEN** `/knowledge` is reviewed after redesign
- **THEN** evidence SHALL include a combined stress state with expanded AppShell navigation, at least one opened local graph tool, selected-node inspector, and expanded Konling assistant
- **AND** graph interaction, inspector actions, local tool controls, and Konling controls SHALL remain visible, keyboard reachable, focus-managed, and non-overlapping.

#### Scenario: Knowledge workspace empty assistant state is captured
- **WHEN** `/knowledge` renders with no selected node or incomplete selected-node context
- **THEN** Konling evidence SHALL show route-level or degraded guidance
- **AND** it SHALL NOT claim selected-node diagnosis, evidence analysis, or resource access that has not been resolved.

#### Scenario: Product Design concepts are referenced
- **WHEN** knowledge workspace visual evidence is produced
- **THEN** the evidence SHALL cite the approved concept references and state which visual principles were adopted
- **AND** it SHALL state which generated mockup details were rejected to preserve the shared AppShell, role navigation, and dock model.

#### Scenario: Integration regression is detected
- **WHEN** `/knowledge` shows duplicated global navigation, duplicated assistant UI, permanent desktop panels that compete with the graph, text-only relation legend, raw schema labels, semantic-map tangle, hover/click jitter, dragged-node reset, dock overlap, crowded stress-state obstruction, or theme/mobile inconsistency
- **THEN** governance SHALL fail or report the issue as a blocking product QA regression according to the active governance mode.

### Requirement: Knowledge workspace QA checks current behavior
Commercial UI governance SHALL validate current source, DOM, runtime graph data, and browser behavior rather than relying only on historical screenshots.

#### Scenario: Knowledge graph evidence exists from an earlier run
- **WHEN** governance validates the current `/knowledge` route
- **THEN** historical screenshots MAY be used as supporting context
- **AND** current source/runtime checks and fresh browser evidence SHALL remain the acceptance truth.

#### Scenario: Browser validation runs locally
- **WHEN** local browser evidence is captured for `/knowledge`
- **THEN** the capture SHALL use a hydrated local URL that reflects the active Next dev server
- **AND** false positives from non-hydrated `127.0.0.1` proxy paths SHALL be avoided or explicitly marked invalid.
