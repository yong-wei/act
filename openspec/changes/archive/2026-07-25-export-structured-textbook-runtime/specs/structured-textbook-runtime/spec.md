## ADDED Requirements

### Requirement: Textbook authoring sources remain canonical
The system SHALL treat the existing chapter Markdown and referenced local assets as the canonical textbook authoring sources.

#### Scenario: Runtime structure is exported
- **WHEN** a textbook runtime export runs
- **THEN** it SHALL derive all hierarchy, units, anchors, and retrieval windows from the authoring source and per-book parsing configuration
- **AND** it SHALL NOT rewrite the authoring source merely to match runtime folder layout.

#### Scenario: Authoring structure is defective
- **WHEN** distributed review confirms that a heading, numbering level, or content boundary is defective in the Mathpix-converted source
- **THEN** the source defect SHALL be corrected in the authoring Markdown before the runtime is regenerated
- **AND** the runtime output SHALL NOT be patched independently.

### Requirement: Textbook hierarchy is parsed deterministically
The exporter SHALL combine common numbering rules with declarative per-book configuration and SHALL fail when a parent-child relationship cannot be determined.

#### Scenario: Numbering is recognized
- **WHEN** Markdown headings, Chinese or Arabic numbering, parenthesized numbering, or configured book-specific structures are encountered
- **THEN** the exporter SHALL produce one deterministic hierarchy with explicit parent identifiers and source spans.

#### Scenario: Hierarchy remains ambiguous
- **WHEN** common rules and the book configuration cannot uniquely assign a structural unit
- **THEN** the export SHALL fail with a bounded anomaly identifying the source location and ambiguity
- **AND** it SHALL NOT silently flatten or guess the unit.

### Requirement: Citation units and retrieval windows are separate
The runtime SHALL store non-overlapping structural units as citation identities and MAY derive overlapping retrieval windows only as machine retrieval context.

#### Scenario: Retrieval window crosses unit boundaries
- **WHEN** a retrieval window combines a primary unit with ancestor or adjacent text
- **THEN** every included span SHALL retain its owning structural-unit identifier
- **AND** the window identifier SHALL NOT become a citation target.

#### Scenario: Citation support is selected
- **WHEN** a claim is supported by one deepest sufficient structural unit
- **THEN** the citation SHALL address that unit or one of its fragment anchors
- **AND** a parent unit SHALL be used only when the claim genuinely spans multiple children.

### Requirement: Structural identities and fragment anchors are stable
The runtime SHALL derive structural-unit paths from book identity, edition, and deterministic hierarchy rather than mutable body text.

#### Scenario: Numbered unit text changes
- **WHEN** the title or body of an existing naturally numbered unit is corrected without changing its structural number
- **THEN** its structural path SHALL remain unchanged.

#### Scenario: Formula, figure, or table is addressed
- **WHEN** a formula, figure, or table belongs to a structural unit
- **THEN** it SHALL receive a stable fragment anchor inside that unit
- **AND** it SHALL NOT create an independent directory or duplicate the surrounding prose.

### Requirement: Structural exports are anomaly-audited
The export workflow SHALL detect abnormal units and SHALL require distributed chapter sampling before the v2 test runtime is accepted.

#### Scenario: Full source set is prepared
- **WHEN** the first v2 runtime is generated for six textbooks and one reference collection
- **THEN** every chapter SHALL be checked for empty or extreme units, numbering discontinuity, hierarchy jumps, misplaced text, and unrecognized natural numbering
- **AND** sampled deepest units, boundaries, sequences, and maximum/minimum units SHALL be reviewed.

#### Scenario: Review finds no unresolved anomaly
- **WHEN** all confirmed source and parser defects have been corrected and the export is repeated
- **THEN** the v2 test runtime SHALL be accepted as input to downstream retrieval and reader changes
- **AND** it SHALL remain disconnected from production consumers until the final integration change.
