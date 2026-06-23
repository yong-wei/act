## ADDED Requirements

### Requirement: Knowledge graph floating panel geometry is verified
Commercial UI governance SHALL verify `/knowledge` panel geometry, canvas stability, and shared dock stability whenever graph workspace panels or inspector behavior change.

#### Scenario: Geometry evidence is captured
- **WHEN** a change modifies `/knowledge` local tools, graph canvas sizing, inspector placement, page overflow, global floating controls, or Konling dock avoidance
- **THEN** evidence SHALL include default state, directory opened, filter opened, legend opened, view controls opened, selected-node inspector opened, and a combined stress state
- **AND** each evidence state SHALL record DOM metrics for viewport, graph canvas, local command shell, active local panel, selected-node inspector, right-bottom tools launcher, Konling collapsed button, and document scroll dimensions
- **AND** the evidence SHALL prove that local panel edge gaps are fixed workspace insets rather than canvas-width-derived gaps
- **AND** the evidence SHALL prove that opening the selected-node inspector does not reduce graph canvas dimensions or shift the graph viewport.

#### Scenario: Page scroll regression is detected
- **WHEN** governance validates `/knowledge` graph workspace evidence
- **THEN** route-level vertical or horizontal scrolling caused by the graph canvas workspace SHALL be reported as a blocking regression
- **AND** scrollable content inside local panels or the inspector SHALL remain allowed when it is visibly scoped to that overlay.

#### Scenario: Shared dock regression is detected
- **WHEN** local graph tools or selected-node inspector panels are opened
- **THEN** the collapsed Konling floating button SHALL keep the same right-bottom dock position within a small visual tolerance
- **AND** movement of the collapsed Konling button caused by local graph panels or inspector state SHALL be reported as a blocking regression
- **AND** right-bottom workspace tools SHALL remain reachable without overlapping the active graph panel or inspector.

### Requirement: Knowledge graph UI remediation requires independent visual audit pass
Commercial UI governance SHALL require independent visual review approval before the knowledge graph floating panel remediation can be accepted.

#### Scenario: Independent visual audit runs
- **WHEN** implementation screenshots, DOM metrics, changed files, and validation output are ready for this remediation
- **THEN** an independent visual review subagent SHALL audit panel alignment, fixed edge inset behavior, filter/directory/legend/view consistency, inspector right-edge placement, canvas stability, page scroll suppression, Konling dock stability, non-overlap, focus behavior, theme parity, and mobile behavior
- **AND** unresolved BLOCK findings from that audit SHALL prevent the change from being marked complete
- **AND** final evidence SHALL cite the audit result and the screenshot/metric artifacts used for the decision.
