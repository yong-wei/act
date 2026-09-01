## ADDED Requirements

### Requirement: AI Workshop renders governed learning collections
The adaptive learning center SHALL render AI Workshop tasks, path milestones, achievements, experiments, and journals from the server-owned governed collection projection. Production panels MUST NOT depend on default empty arrays when eligible student records exist.

#### Scenario: Student has eligible records in a collection
- **WHEN** a governed collection is `available`
- **THEN** its AI Workshop panel SHALL render the returned student records with source/status meaning and a reachable next action
- **AND** it SHALL NOT substitute sample content or client-constructed items.

#### Scenario: Collection is empty
- **WHEN** a governed collection is `empty`
- **THEN** its panel SHALL state that no verified record is currently available
- **AND** it SHALL provide the collection's adjacent learning or evidence-creation action.

#### Scenario: Collection source is unavailable
- **WHEN** a governed collection is `unavailable`
- **THEN** its panel SHALL explain that the source cannot currently be confirmed
- **AND** it SHALL NOT present zero, an empty achievement lock list, or another personal fact as the result.

#### Scenario: AI Workshop contains mixed collection states
- **WHEN** available, empty, and unavailable collection envelopes appear on the same page
- **THEN** each panel SHALL render its own state without replacing the entire page with one aggregate fallback
- **AND** available learning work SHALL remain usable.

### Requirement: Governed collection panels remain operable across supported viewports
AI Workshop collection records, statuses, and actions SHALL remain readable and operable at desktop and 320px widths with keyboard navigation and without horizontal page overflow.

#### Scenario: Student uses a 320px viewport
- **WHEN** populated and non-populated collection panels render at 320px
- **THEN** record titles, status text, source labels, and primary actions SHALL remain visible and reachable
- **AND** the page SHALL not require horizontal scrolling.

#### Scenario: Student uses keyboard navigation
- **WHEN** the student navigates collection records and adjacent actions without a pointer
- **THEN** focus order and accessible names SHALL identify the collection, record, state, and destination
- **AND** an unavailable panel SHALL not expose an action that depends on the unavailable source.
