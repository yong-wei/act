## ADDED Requirements

### Requirement: Readiness inventory is bounded to current governed truth
The inventory SHALL include only the current formal course and reviewed scope anchors, current authoring content/cards/media/resources, current published graph and binding comparison, active knowledge references, and reviewed active legacy-to-canonical mappings.

#### Scenario: A historical learner dataset is discovered
- **WHEN** the inventory encounters historical facts, events, diagnoses, portraits, risks, growth, recommendations, class aggregates, or Arena records
- **THEN** it SHALL reject that dataset as an out-of-scope input
- **AND** it SHALL NOT generate, consume, or validate a diagnostic catalog for it.

### Requirement: Active knowledge references have a current business use
An active reference SHALL be a course, resource, progress, note, or `LearningPath` reference for which `pathStatus != completed` and a declared current business reader still reads or continues the path at cutover. Completed paths, execution rows, deviations, interventions, historical events, and historical facts SHALL NOT be migration inputs.

#### Scenario: A path has already completed
- **WHEN** `pathStatus = completed` or no declared current business reader reads or continues the path
- **THEN** its knowledge references SHALL be excluded
- **AND** they SHALL NOT enter the active-reference migration manifest.

#### Scenario: An admitted incomplete path contains nested legacy references
- **WHEN** `pathStatus != completed`, a declared current business reader reads or continues the path, and `pathPayload` contains legacy knowledge or resource IDs in prerequisite, readiness, `pathOptions`, `policyBundle`, constraint-repair, execution-status, explanation, visualization, embedded deviation/correction/feedback/activity, or selection-history fields
- **THEN** every reference selected by `remapAdaptivePathPayloadReferences` SHALL enter the active-reference inventory with its declared namespace
- **AND** the same payload on a completed path SHALL be excluded in full before decoding.

### Requirement: Historical facts retain their original interpretation
Historical facts SHALL remain bound to their original graph revision. If that revision cannot be proven, compatibility parsing SHALL use `legacy-unversioned` or a legacy snapshot. The inventory SHALL NOT replay, reinterpret, deduplicate, or backfill those facts against the new graph.

#### Scenario: An old fact has no revision field
- **WHEN** compatibility parsing reads the fact
- **THEN** it SHALL resolve through an explicit legacy record or snapshot
- **AND** current canonical truth SHALL NOT be guessed.

### Requirement: Historical diagnostics are outside the series
The inventory SHALL NOT generate, consume, or validate historical decoder coverage, producer lineage, learner-derived state, evidence deduplication, or full-root writer discovery. Readiness SHALL depend only on the bounded authoritative inputs and active-reference fields.

#### Scenario: A historical decoder shape is unknown
- **WHEN** the unknown shape belongs only to frozen historical data
- **THEN** the inventory SHALL reject it as an out-of-scope input without decoding or cataloging it
- **AND** it SHALL create no missing-input, unknown-shape, or readiness finding.

### Requirement: Inventory output is deterministic and read-only
Every readiness record SHALL use typed identities, versioned normalization, source and snapshot digests, deterministic missing-input records, and expected/observed drift. The CLI SHALL NOT mutate repository files, databases, Git, GitHub, authoring, or runtime projections.

#### Scenario: The same snapshot is inventoried twice
- **WHEN** source bytes, snapshot proof, configuration, and versions are unchanged
- **THEN** both outputs SHALL be byte-identical.
