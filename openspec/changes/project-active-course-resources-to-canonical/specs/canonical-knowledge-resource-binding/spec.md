## MODIFIED Requirements

### Requirement: Binding work is change-triggered and incremental
Course resource migration MUST begin from the current published/used resource inventory and MUST preserve one coherent authoring capture. It MUST NOT generate candidates for retired courses or unreferenced ActKG objects. Deterministic one-to-one mappings MAY be accepted without semantic review; only directly ambiguous records require one author decision.

#### Scenario: Current lesson is inventoried
- **WHEN** a published runtime lesson or interactive step is in the active course inventory
- **THEN** the migration SHALL emit one deterministic resource identity and binding candidate
- **AND** the candidate SHALL record source path, digest, course scope, and projection mode

#### Scenario: Historical course is not active
- **WHEN** a retired or unreachable course contains a legacy knowledge reference
- **THEN** it SHALL be retained only in the legacy crosswalk
- **AND** it SHALL not enter the current projection gate

### Requirement: Deterministic bindings require two unique signals
A course binding MAY auto-publish only when the Canonical ID is resolved by an existing one-to-one crosswalk, active card reference, explicit manifest field, or exact normalized label/alias match and the resource role is explicit. Fuzzy, split, merge, or model-only matches MUST remain `REVIEW_REQUIRED`.

#### Scenario: Exact one-to-one mapping exists
- **WHEN** one old ID or exact label/alias resolves to one valid Canonical ID and one role
- **THEN** the resource SHALL become `BOUND` with its evidence and mapping method

#### Scenario: Candidate is ambiguous
- **WHEN** an old ID maps to multiple Canonical IDs, multiple old IDs merge, or only semantic similarity exists
- **THEN** the resource SHALL become `REVIEW_REQUIRED`
- **AND** no binding SHALL be published until one course-author decision is persisted

### Requirement: Final cutover requires complete active-resource bindings
The binding gate MUST be calculated per current course package. Every reachable `REQUIRED` resource in that package MUST be `BOUND` or an explicit `EXPLICIT_NONE` is forbidden; unresolved `REVIEW_REQUIRED` records block only that package and MUST expose exact resource IDs and reasons.

#### Scenario: One course has an unresolved step
- **WHEN** a required interactive step remains `REVIEW_REQUIRED`
- **THEN** that course package SHALL fail closed
- **AND** unrelated course packages and Engineering Authority SHALL remain selectable

#### Scenario: Active package is complete
- **WHEN** every reachable required resource has a valid binding and all optional/none resources are explicit
- **THEN** the course package MAY publish its Teaching Projection slice
