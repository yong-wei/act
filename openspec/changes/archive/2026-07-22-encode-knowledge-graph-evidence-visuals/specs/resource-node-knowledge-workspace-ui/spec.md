## MODIFIED Requirements

### Requirement: Knowledge graph relation styles use semantic visual grammar
The knowledge graph SHALL render child, post-requisite, and association presentation families with distinct visual grammar that does not rely on color alone. Within each family's grammar, edge evidence state SHALL be encoded as a bounded modulation of opacity and width: edges whose public link carries `evidenceState: 'unavailable'` SHALL render muted relative to evidence-available edges of the same family, while edges whose evidence state is absent SHALL render exactly as before this modulation existed.

#### Scenario: Three relation families render together
- **WHEN** child, post-requisite, and association edges are enabled
- **THEN** each family SHALL use a distinct combination of line pattern, target-arrow behavior, opacity, and curvature
- **AND** raw relation distinctions SHALL remain available in the inspector rather than multiplying canvas grammars.

#### Scenario: Dense domain renders by default
- **WHEN** the active domain has many available relations
- **THEN** relation edges SHALL remain fine and association edges subordinate
- **AND** emphasis SHALL come from selection, corridor focus, or family visibility rather than permanently thick strokes.

#### Scenario: Unavailable-evidence edge renders muted within its family
- **WHEN** an enabled edge's public link carries `evidenceState: 'unavailable'`
- **THEN** the edge SHALL render with reduced opacity and reduced width relative to an evidence-available edge of the same family and theme
- **AND** it SHALL keep its family's line pattern, arrow behavior, and curvature
- **AND** the muted variant SHALL remain distinguishable from the family's available variant in both light and dark themes without relying on color alone.

#### Scenario: Unknown evidence state preserves prior rendering
- **WHEN** an enabled edge's public link omits `evidenceState`
- **THEN** the edge SHALL render with the same opacity, width, pattern, and arrow behavior it had before evidence modulation existed.

#### Scenario: Evidence modulation respects density budgets
- **WHEN** evidence modulation is applied in a dense domain
- **THEN** default visible edge counts per family, the post-requisite structural foreground cap, and the association one-hop cap SHALL be unchanged
- **AND** muted edges SHALL NOT be hidden or reordered solely because of their evidence state.

### Requirement: Knowledge graph node scale reflects instructional and graph importance
The knowledge graph SHALL scale node size from bounded importance signals rather than rendering all nodes at the same size. When a node carries `sourceCoverageCount`, that count SHALL act only as a capped tertiary signal after teaching importance and degree centrality, and its absence SHALL never reduce a node below the size it would have had without coverage data.

#### Scenario: Nodes have different importance or connection counts
- **WHEN** nodes include importance metadata, degree centrality, or selected-neighborhood relevance
- **THEN** node radius SHALL prioritize explicit teaching importance or course-core metadata before degree centrality
- **AND** degree or connection count SHALL act only as a capped secondary signal within a bounded range that preserves labels and neighboring nodes
- **AND** selected or focused nodes SHALL remain visually prominent without hiding nearby nodes.

#### Scenario: Coverage count modulates within a cap
- **WHEN** two nodes share the same importance and degree signals but differ in `sourceCoverageCount`
- **THEN** the higher-coverage node MAY render larger within the bounded tertiary range
- **AND** neither node SHALL exceed the existing size bounds that preserve labels and neighbors.

#### Scenario: Absent coverage never penalizes
- **WHEN** a node omits `sourceCoverageCount`
- **THEN** its radius SHALL equal the radius it would have had from importance and degree signals alone.

## ADDED Requirements

### Requirement: Evidence state parity across canvas, legend, and inspector

The knowledge workspace SHALL present one consistent evidence vocabulary: the graphical relation legend SHALL include an evidence-available versus evidence-unavailable swatch pair, and inspector relation rows SHALL continue to show evidence state or the honest `关系依据未提供` fallback, so the same edge never appears verified in one surface and unverified in another. Evidence presentation SHALL use platform tokens and SHALL NOT invent evidence where none exists.

#### Scenario: Legend explains the evidence dimension
- **WHEN** the relation legend is visible
- **THEN** it SHALL include a graphical swatch pair distinguishing evidence-available from evidence-unavailable edges
- **AND** the swatches SHALL match the canvas modulation in the active theme.

#### Scenario: Canvas and inspector agree
- **WHEN** a user selects a node whose relations include both evidence-available and evidence-unavailable edges
- **THEN** each inspector relation row's evidence presentation SHALL match the canvas modulation of the same relation
- **AND** relations without evidence SHALL show the honest `关系依据未提供` wording rather than fabricated support.

### Requirement: Knowledge graph nodes present concept macro-categories

The knowledge graph SHALL classify nodes into six teaching-oriented concept macro-categories (systems, models, methods, criteria-and-metrics, phenomena-and-objects, constraints-and-tasks) for presentation purposes. The classification SHALL be sourced from a node's `conceptKind` when present (grouping ActKG's fifteen concept kinds into the six categories), and SHALL otherwise fall back to the existing `nodeType`/`knowledgeDim` mapping so current data receives sensible categories today. Macro-category presentation SHALL use shape or token-role cues in addition to any color, and uncategorized nodes SHALL render in the neutral default presentation.

#### Scenario: Concept kind takes precedence when present
- **WHEN** a node carries `conceptKind`
- **THEN** its macro-category SHALL be derived from the concept-kind grouping table
- **AND** nodes whose `conceptKind` differs but maps to the same macro-category SHALL share one presentation.

#### Scenario: Current data falls back to legacy mapping
- **WHEN** a node omits `conceptKind`
- **THEN** its macro-category SHALL be derived from the existing `nodeType`/`knowledgeDim` mapping
- **AND** the rendered presentation SHALL remain readable in both themes without relying on color alone.

#### Scenario: Unknown kind renders neutral
- **WHEN** a node carries a `conceptKind` outside the grouping table
- **THEN** it SHALL render in the neutral default node presentation and the unknown kind SHALL be surfaced for contract review rather than silently guessed.

### Requirement: Knowledge graph governs candidate node visibility

Nodes carrying `candidate: true` SHALL be treated as governance candidates: learner-facing graph views SHALL exclude them by default, while teacher or review contexts MAY display them with a dashed candidate outline and a candidate badge so they are never mistaken for reviewed knowledge. Candidate filtering SHALL NOT alter the visibility of non-candidate nodes or edges, except that edges touching an excluded candidate SHALL be hidden with it.

#### Scenario: Learner view excludes candidates
- **WHEN** a learner-facing view renders a graph containing `candidate: true` nodes
- **THEN** those nodes and their incident edges SHALL NOT appear on the canvas, in the legend counts, or in default label layout.

#### Scenario: Teacher review shows candidates distinctly
- **WHEN** a teacher or review context renders the same graph
- **THEN** candidate nodes SHALL appear with a dashed outline and candidate badge distinct from reviewed nodes
- **AND** their incident edges SHALL render with the candidate-muted treatment in addition to any evidence modulation.
