## MODIFIED Requirements

### Requirement: Binding work is change-triggered and incremental
The system SHALL process object changes declared by the accepted ReleaseSet Delta against one versioned resource index and resource-segment changes against the current Canonical index, using one candidate-pair contract and one coherent capture identity. Course resource migration MUST begin from the current published/used resource inventory and MUST preserve one coherent authoring capture. It MUST NOT generate candidates for retired courses or unreferenced ActKG objects. Deterministic one-to-one mappings MAY be accepted without semantic review; only directly ambiguous records require one author decision.

#### Scenario: Canonical object is unchanged
- **WHEN** Canonical ID/semantic digest, resource/segment hash, role, prompt/reviewer version, structural gates and evidence match a prior accepted decision
- **THEN** the system SHALL create an auditable revalidation for the new ReleaseSet without invoking semantic review or copying the old publication identity

#### Scenario: Canonical object changes
- **WHEN** a Delta adds an object or changes its supported semantic payload
- **THEN** only candidate pairs involving that object SHALL be generated against the stable resource index

#### Scenario: Resource segment changes
- **WHEN** a bound resource segment receives a new content hash
- **THEN** only candidate pairs involving that segment SHALL be invalidated

#### Scenario: Canonical object or Crosswalk is removed
- **WHEN** a Delta removes an object or upstream Crosswalk triple
- **THEN** only dependent ACT Crosswalks and resource bindings SHALL become stale while historical records remain

#### Scenario: Current lesson is inventoried
- **WHEN** a published runtime lesson or interactive step is in the active course inventory
- **THEN** the migration SHALL emit one deterministic resource identity and binding candidate
- **AND** the candidate SHALL record source path, digest, course scope, and projection mode

#### Scenario: Historical course is not active
- **WHEN** a retired or unreachable course contains a legacy knowledge reference
- **THEN** it SHALL be retained only in the legacy crosswalk
- **AND** it SHALL not enter the current projection gate

### Requirement: Deterministic bindings require two unique signals
A binding MUST satisfy both a unique, version-valid ACT EvidenceStructuralUnitCrosswalk selecting the Canonical Object and an atomic resource type uniquely determining the teaching role before it can become shadow-published without semantic review. A course binding MAY auto-publish only when the Canonical ID is resolved by an existing one-to-one crosswalk, active card reference, explicit manifest field, or exact normalized label/alias match and the resource role is explicit. Fuzzy, split, merge, or model-only matches MUST remain `REVIEW_REQUIRED`.

#### Scenario: Both deterministic conditions hold
- **WHEN** one governed ACT evidence alignment and one type-defined role are unambiguous under the same candidate ReleaseSet
- **THEN** the binding SHALL pass endpoint, capture, version, hash and uniqueness gates and MAY be shadow-published

#### Scenario: Upstream triple is the only signal
- **WHEN** only an opaque upstream RAG reference is available
- **THEN** the result SHALL remain unresolved or a semantic candidate and MUST NOT satisfy the deterministic Crosswalk gate

#### Scenario: Either condition is ambiguous
- **WHEN** ACT evidence alignment or teaching role is non-unique
- **THEN** the result SHALL remain a semantic candidate

#### Scenario: Exact one-to-one mapping exists
- **WHEN** one old ID or exact label/alias resolves to one valid Canonical ID and one role
- **THEN** the resource SHALL become `BOUND` with its evidence and mapping method

#### Scenario: Candidate is ambiguous
- **WHEN** an old ID maps to multiple Canonical IDs, multiple old IDs merge, or only semantic similarity exists
- **THEN** the resource SHALL become `REVIEW_REQUIRED`
- **AND** no binding SHALL be published until one course-author decision is persisted

### Requirement: Final cutover requires complete active-resource bindings
Resource binding completeness SHALL be evaluated per ACT consumer package and its current published/used resources, not against every member of the ActKG Release. An unresolved resource SHALL block only the consumer package that can reach it; it SHALL not block Engineering Authority or unrelated consumers. The binding gate MUST be calculated per current course package. Every reachable `REQUIRED` resource in that package MUST be `BOUND` or an explicit `EXPLICIT_NONE` is forbidden; unresolved `REVIEW_REQUIRED` records block only that package and MUST expose exact resource IDs and reasons.

#### Scenario: Only inactive inventory remains unbound
- **WHEN** all unbound items for one consumer package are drafts, disabled, archived, or non-teaching assets
- **THEN** that package's resource binding gate SHALL pass even when unrelated ActKG objects are unprojected

#### Scenario: Effective resource is unresolved
- **WHEN** one effective ACT resource has no active binding and is not explicitly optional
- **THEN** the exact package SHALL fail closed
- **AND** other consumers and Engineering Authority SHALL remain independently selectable

#### Scenario: Effective resource package is complete
- **WHEN** every currently published or path/evidence-eligible resource in one consumer package has an active reviewed Canonical binding or explicit `NONE`
- **THEN** that package MAY pass its binding gate even when unrelated ActKG objects are unprojected

#### Scenario: One course has an unresolved step
- **WHEN** a required interactive step remains `REVIEW_REQUIRED`
- **THEN** that course package SHALL fail closed
- **AND** unrelated course packages and Engineering Authority SHALL remain selectable

#### Scenario: Active package is complete
- **WHEN** every reachable required resource has a valid binding and all optional/none resources are explicit
- **THEN** the course package MAY publish its Teaching Projection slice
