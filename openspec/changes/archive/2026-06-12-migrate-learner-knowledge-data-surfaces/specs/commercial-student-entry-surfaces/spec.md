## ADDED Requirements

### Requirement: Learner surfaces converge on learning atlas and knowledge-data map shells
Student dashboard, profile, growth, evidence, adaptive practice, knowledge, and data surfaces SHALL use unified shell archetypes for navigation, evidence, and next action behavior.

#### Scenario: Learner surface renders
- **WHEN** a student opens dashboard, profile, growth, evidence, adaptive practice, knowledge graph, or data center routes
- **THEN** the route SHALL use route-ledger archetype metadata to render learning-atlas or knowledge-data-map shell behavior
- **AND** the page SHALL preserve account/profile, cockpit, evidence, and adjacent learning navigation without page-local competing headers.

#### Scenario: Adaptive practice opens from different entries
- **WHEN** adaptive practice is opened from homepage, cockpit, profile, or another student entry
- **THEN** the surface SHALL display a complete loading, item, empty, low-evidence, or fallback state
- **AND** the state SHALL keep navigation to learner record, retry, Interactive Learning, Arena, and profile/review paths available.

### Requirement: Learner surfaces prepare path explanation slots
Student learner surfaces SHALL reserve governed shell slots for future path bundle explanation and selection history.

#### Scenario: Path bundle capability is available
- **WHEN** three-style learning path options or selection history are available
- **THEN** the migrated learner shell SHALL display options, evidence basis, confidence, limitations, and cited explanation in shared status and evidence semantics
- **AND** UI components SHALL not fabricate path or mastery truth from presentation state.
