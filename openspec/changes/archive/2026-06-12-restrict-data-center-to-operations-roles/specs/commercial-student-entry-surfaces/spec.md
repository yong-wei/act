## MODIFIED Requirements

### Requirement: Learner surfaces converge on learning atlas and knowledge-data map shells
Student dashboard, profile, growth, evidence, adaptive practice, knowledge, and data surfaces SHALL use unified shell archetypes for navigation, evidence, and next action behavior.

#### Scenario: Learner surface renders
- **WHEN** a student opens dashboard, profile, growth, evidence, adaptive practice, knowledge graph, or student-visible learner data routes
- **THEN** the route SHALL use route-ledger archetype metadata to render learning-atlas, knowledge-data-map, or report-ledger shell behavior
- **AND** the page SHALL preserve account/profile, cockpit, evidence, and adjacent learning navigation without page-local competing headers.
- **AND** student-visible learner data routes SHALL NOT include the operations Data Center route.

#### Scenario: Adaptive practice opens from different entries
- **WHEN** adaptive practice is opened from homepage, cockpit, profile, or another student entry
- **THEN** the surface SHALL display a complete loading, item, empty, low-evidence, or fallback state
- **AND** the state SHALL keep navigation to learner record, retry, Interactive Learning, Arena, and profile/review paths available.
- **AND** platform operations Data Center links SHALL NOT be presented as a student review destination.

### Requirement: Student review destinations use learner records instead of operations data center
Student review and evidence flows SHALL route to learner-record surfaces rather than operations Data Center.

#### Scenario: Student opens a review or evidence action
- **WHEN** a student selects a review, evidence, progress, or learning-record destination
- **THEN** the destination SHALL target profile, evidence, growth, dashboard, or another student-visible learner-record route
- **AND** it SHALL NOT target `/data-center`.
