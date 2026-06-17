## ADDED Requirements

### Requirement: Derivation stage is a registered visual module
The interactive module taxonomy SHALL support `visual.derivationStage` for two-dimensional formula derivation reveal.

#### Scenario: Derivation stage is authored
- **WHEN** a runtime manifest declares `kind: visual.derivationStage`
- **THEN** the registry SHALL validate formulas, formula blocks, text blocks, connectors, reveal steps, regions, layer ordering, transition metadata, and teacher control metadata
- **AND** the renderer SHALL be shared by manifest runtime rather than a lesson-private page branch.

#### Scenario: Formula lacks LaTeX source
- **WHEN** a derivation stage formula or formula block is represented only by an image, plain text, or an unparseable display string
- **THEN** validation SHALL fail
- **AND** the error SHALL identify the formula id or formula block id.

### Requirement: Derivation reveal order is non-linear
Derivation stage reveal SHALL be driven by explicit target ids and regions rather than DOM order.

#### Scenario: Reveal returns to an earlier visual region
- **WHEN** reveal step 3 targets a lower-left formula, reveal step 4 targets an upper-right note, and reveal step 5 targets a middle formula block
- **THEN** the renderer SHALL reveal those targets in the declared order
- **AND** acceptance SHALL fail if the implementation can only reveal vertical cards from top to bottom.

### Requirement: Derivation formula blocks support semantic color roles
Derivation stage formula blocks SHALL support semantic color roles for local teaching emphasis.

#### Scenario: Formula block is marked as a cancel term
- **WHEN** a formula block has `colorRole: cancel`
- **THEN** only that formula block SHALL receive the cancel visual treatment
- **AND** adjacent formula blocks SHALL remain independently addressable and readable in light and dark themes.

### Requirement: Derivation stage controls cognitive load
Derivation stage authoring SHALL define cognitive load limits for reveal density, long-formula splitting, semantic color usage, and default release pace.

#### Scenario: Reveal step is overloaded
- **WHEN** a derivation reveal step introduces too many formula blocks, too many simultaneous color roles, or an undeclared long-formula split strategy
- **THEN** validation SHALL fail or require an explicit teaching-load exception
- **AND** the acceptance artifact SHALL explain the intended learner reasoning step.
