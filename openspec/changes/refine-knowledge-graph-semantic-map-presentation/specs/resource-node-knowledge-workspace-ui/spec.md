## ADDED Requirements

### Requirement: Knowledge graph renders as a semantic map
The knowledge graph SHALL present nodes, edges, labels, and semantic regions as a readable concept map rather than an all-edge tangle.

#### Scenario: Default semantic map renders
- **WHEN** `/knowledge` renders its default graph view
- **THEN** relation lines SHALL be thin, visually subordinate, and distinguishable through non-color visual grammar
- **AND** the learner SHALL be able to identify major conceptual regions, important nodes, and high-signal relation families without opening dense all-relations mode.

#### Scenario: Selected neighborhood renders
- **WHEN** a node is selected or explicitly focused
- **THEN** directly relevant nodes and relations SHALL become visually prominent through bounded emphasis
- **AND** unrelated graph content SHALL dim enough to clarify the selected neighborhood without disappearing unless the user requests focused mode.

#### Scenario: Graph legend renders
- **WHEN** the relation legend is visible
- **THEN** legend edge samples SHALL be generated from the same visual style contract as the graph renderer
- **AND** the legend SHALL remain accurate in both light and dark themes.

#### Scenario: Semantic clusters are available
- **WHEN** chapter, category, or graph-structure grouping can be represented safely
- **THEN** the graph MAY show subtle semantic regions or cluster territories
- **AND** those regions SHALL be derived from graph semantics, use platform tokens, and remain visually subordinate to nodes and selected relations.

### Requirement: Knowledge graph presentation follows approved concept direction
Knowledge graph presentation SHALL adopt the approved Product Design direction without copying generated mockup chrome.

#### Scenario: Concept direction is applied
- **WHEN** the graph visual presentation is implemented
- **THEN** it SHALL adopt layered semantic organization, premium dark depth, and clear light-mode readability from the approved concept references
- **AND** it SHALL NOT copy standalone shell chrome, role switchers, exact generated node positions, or generated labels as product truth.
