## ADDED Requirements

### Requirement: Knowledge graph relation styles use semantic visual grammar
The knowledge graph SHALL render each supported relation family with a distinct visual grammar that does not rely on color alone.

#### Scenario: Multiple relation types render together
- **WHEN** prerequisite, contains, follows/leads-to, applies-to, opposite, and related relations are visible in the graph
- **THEN** each relation family SHALL use a distinct combination of fine line pattern, arrow behavior, endpoint treatment, curvature or opacity
- **AND** the visual difference SHALL remain distinguishable in both light and dark themes.

#### Scenario: Dense graph renders by default
- **WHEN** the graph opens with many available relations
- **THEN** relation edges SHALL render as fine lines by default
- **AND** emphasis SHALL come from hover, focus, selection, or filter state rather than permanently thick strokes.

### Requirement: Runtime relation types have complete visual-semantic coverage
The knowledge graph SHALL map every relation type present in the runtime knowledge graph to explicit teaching semantics before rendering.

#### Scenario: Runtime graph relation types are loaded
- **WHEN** relation types are read from `course-content/runtime/knowledge/graph/relations.jsonl`
- **THEN** every distinct relation type SHALL have a Chinese teaching label, visual family, direction semantics, default density policy, and graphical legend explanation
- **AND** unknown relation types SHALL NOT silently fall back to the generic `related` visual family.

#### Scenario: Specialized relation types exist
- **WHEN** relation types such as `cross_domain`, `generalizes`, `instance_of`, `supports`, `enables`, `opposite`, or `related` exist in runtime data
- **THEN** each type SHALL remain distinguishable through its mapped teaching label, filter option, visual family, and graph legend
- **AND** the mapping SHALL preserve the intended teaching logic instead of flattening specialized relations into weak association.

### Requirement: Knowledge graph node scale reflects instructional and graph importance
The knowledge graph SHALL scale node size from bounded importance signals rather than rendering all nodes at the same size.

#### Scenario: Nodes have different importance or connection counts
- **WHEN** nodes include importance metadata, degree centrality, or selected-neighborhood relevance
- **THEN** node radius SHALL prioritize explicit teaching importance or course-core metadata before degree centrality
- **AND** degree or connection count SHALL act only as a capped secondary signal within a bounded range that preserves labels and neighboring nodes
- **AND** selected or focused nodes SHALL remain visually prominent without hiding nearby nodes.

### Requirement: Relation legend is graphical
The knowledge workspace SHALL show relationship legend items as visual samples generated from the same relation style contract used by the graph.

#### Scenario: User reads the relation legend
- **WHEN** the legend is visible
- **THEN** each legend item SHALL include a miniature graphical edge sample matching the actual edge style
- **AND** the legend SHALL NOT rely on text-only descriptions such as "long dashed arrow" as the only explanation.

### Requirement: Knowledge graph communicates a learner-readable concept map
The knowledge graph SHALL make the main conceptual structure understandable from the default view before learners open dense tools or all-relation modes.

#### Scenario: Learner opens the default graph view
- **WHEN** a learner first opens the knowledge graph
- **THEN** the learner SHALL be able to distinguish prerequisite/foundation, contains, and follows/leads-to relation families through visible edge grammar and legend samples
- **AND** weak related edges SHALL NOT form the primary visual skeleton of the graph.

### Requirement: Knowledge graph visible labels use Chinese teaching language
The knowledge workspace SHALL localize visible graph filter, legend, and metadata labels into Chinese learner-facing language.

#### Scenario: User opens graph filters
- **WHEN** category, Bloom level, relation type, density, strength, or connected-node filters are shown
- **THEN** the labels SHALL use Chinese teaching terms
- **AND** raw field names such as `category`, `bloom_level`, or implementation enum keys SHALL NOT appear as primary visible labels.
