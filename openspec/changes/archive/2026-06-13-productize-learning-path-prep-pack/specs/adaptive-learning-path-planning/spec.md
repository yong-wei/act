## MODIFIED Requirements

### Requirement: Control-correction planner returns three path styles
Displayed path styles SHALL be directly comparable by students before selection.

#### Scenario: Three-style bundle is generated
- **WHEN** a student opens the control-correction path center from diagnosis or adaptive practice
- **THEN** the system SHALL display available path styles with style id, policy family, target deficits, estimated effort, resource mix, terminal validation strategy, evidence basis, and limitations
- **AND** unavailable or insufficient path diversity SHALL be represented as fallback state rather than three cosmetic cards.

### Requirement: Path choice writes back as preference evidence
Student path selection SHALL be visible and governed without inflating mastery directly.

#### Scenario: Student selects a path style
- **WHEN** a student chooses a displayed path style
- **THEN** the system SHALL record selected style, rejected alternatives, diagnosis snapshot reference, resource mix, and rationale metadata
- **AND** the path center SHALL show the selection history
- **AND** the original selection alone SHALL NOT be treated as mastery evidence.

### Requirement: Path execution feedback is captured
Path execution SHALL produce a learner-visible timeline and teacher-visible evidence summary.

#### Scenario: Path checkpoint is recorded
- **WHEN** a learner completes, skips, deviates from, or receives an intervention for a path node
- **THEN** the path center SHALL show checkpoint state, evidence confidence, and next action
- **AND** teacher-facing summaries SHALL aggregate checkpoint, deviation, and intervention evidence without exposing private raw answers.

### Requirement: Control-correction paths use simulation and Arena terminal validation
Terminal validation SHALL be summarized as a product-visible result.

#### Scenario: Terminal validation succeeds or fails
- **WHEN** a path reaches simulation or Arena terminal validation
- **THEN** the path center SHALL show validation source, result state, evidence references, and remediation or completion next action
- **AND** validation preview evidence SHALL NOT be represented as official Arena success.
