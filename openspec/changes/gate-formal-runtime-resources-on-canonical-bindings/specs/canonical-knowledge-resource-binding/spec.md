## MODIFIED Requirements

### Requirement: Deterministic bindings require two unique signals
A formal binding MUST satisfy a unique, version-valid governed structural or explicit identity signal selecting the Canonical Object and an explicit atomic teaching role under the same frozen resource, Authority, course, and release envelope. An existing one-to-one crosswalk, active card reference, or explicit manifest field MAY generate an automatically admissible candidate when all formal pipeline and item gates pass. An exact normalized label or alias, fuzzy match, vector result, model output, split, or merge MAY generate a candidate only and MUST NOT directly create `BOUND` or formal publication.

#### Scenario: Both deterministic conditions hold
- **WHEN** one governed version-valid identity alignment and one explicit atomic teaching role are unambiguous under the same formal release envelope
- **THEN** the binding SHALL still pass endpoint, atom, source, capture, version, content hash, qualification, scope, role, and uniqueness gates before becoming formal

#### Scenario: Upstream triple is the only signal
- **WHEN** only an opaque upstream RAG reference is available
- **THEN** the result SHALL remain unresolved or a semantic candidate and MUST NOT satisfy the formal identity gate

#### Scenario: Either condition is ambiguous
- **WHEN** the Canonical alignment or teaching role is non-unique
- **THEN** the result SHALL remain a candidate and SHALL NOT enter the formal binding set

#### Scenario: Exact label or alias matches one object
- **WHEN** an old ID, normalized label, or alias appears to resolve to one valid Canonical ID and one role
- **THEN** the system SHALL record a binding candidate with its mapping method and evidence
- **AND** label or alias evidence alone SHALL NOT create a formal `BOUND` record

#### Scenario: Candidate is ambiguous
- **WHEN** an old ID maps to multiple Canonical IDs, multiple old IDs merge, or only semantic similarity exists
- **THEN** the resource SHALL remain unresolved or enter the repository review pack
- **AND** no binding SHALL be published until it passes the applicable qualified automatic or governed decision path

### Requirement: Semantic candidates receive independent review
Semantic candidates MAY be admitted automatically only by an exactly qualified Canonical-mapping pipeline and only when every item-level identity, evidence, confidence, atom, role, scope, endpoint, and uniqueness gate passes. A low-confidence, conflicting, high-impact, structurally invalid, or otherwise exceptional candidate SHALL enter the versioned repository review pack and MUST NOT become formal. Automatic qualification MUST NOT require an online review service or a universal per-resource human decision.

#### Scenario: Qualified pipeline accepts a candidate
- **WHEN** a matching qualified pipeline produces one candidate that passes every item-level gate
- **THEN** the candidate MAY enter the formal binding set with complete pipeline, input, output, evidence, and qualification lineage
- **AND** a separate runtime or GPT review SHALL NOT be required

#### Scenario: Generation is disputed or high impact
- **WHEN** evidence conflicts, impact is high, confidence is insufficient, or an item gate fails
- **THEN** the candidate SHALL enter the repository review pack and MUST NOT become active
- **AND** other individually valid resources and bindings MAY continue

### Requirement: Final cutover requires complete active-resource bindings
Resource binding completeness SHALL be evaluated against the frozen candidate inventory for one target Runtime Release v2 and course package, not against every member of the ActKG Release. Every candidate resource MUST retain an `INCLUDED` or `EXCLUDED` disposition. Every atom of an included teaching resource MUST have one or more valid formal Canonical bindings or an audited `NON_TEACHING` disposition, and every included teaching resource MUST contain at least one `BOUND` atom. `OPTIONAL`, legacy `NONE`, a prior shadow binding, or omission from successful output MUST NOT bypass this gate. An excluded or unresolved resource SHALL block only its own inclusion; it SHALL not block Engineering Authority or unrelated eligible resources.

#### Scenario: Only governed excluded inventory remains unbound
- **WHEN** every unbound candidate for one package is a draft, disabled, archived, non-teaching, or failed resource with a complete evidence-bearing `EXCLUDED` disposition
- **THEN** the package's formal resource gate MAY pass for the remaining included set
- **AND** candidate counts and the excluded set hash SHALL still include those resources

#### Scenario: Included resource atom is unresolved
- **WHEN** one atom of an intended included teaching resource has neither a valid formal binding nor an audited non-teaching disposition
- **THEN** that resource SHALL fail closed and move to the excluded disposition set
- **AND** other eligible resources and Engineering Authority SHALL remain independently selectable

#### Scenario: Formal resource package is complete
- **WHEN** every frozen candidate is dispositioned, every included resource atom is closed, and every included teaching resource has at least one valid binding
- **THEN** that package MAY pass its formal binding gate even when unrelated ActKG objects have no resources or teaching projection

#### Scenario: One course has an unresolved step
- **WHEN** a required interactive step remains unresolved at any atom
- **THEN** that step SHALL be excluded from the formal manifest with exact bounded reasons
- **AND** unrelated course packages, resources, and Engineering Authority SHALL remain selectable

#### Scenario: Optional or none teaching resource is unbound
- **WHEN** a teaching resource is marked `OPTIONAL` or legacy `NONE` but lacks atomic closure
- **THEN** it SHALL NOT enter the formal included set on that status alone
- **AND** it SHALL require valid bindings, audited non-teaching atom dispositions, or formal exclusion

### Requirement: Canonical resource bindings remain shadow before cutover
Before the target Runtime Release v2 formal-resource envelope, Teaching Projection, readiness, and activation gates all pass, every new binding SHALL remain candidate or shadow evidence and the consumer SHALL stay on its prior active release or explicit pin. Completion of the global CourseCoverage list MUST NOT be required to stage an unrelated resource package. Only the binding set sealed by the selected v2 release envelope MAY drive formal resource markers, launches, RAG, recommendation, path, or evidence consumers.

#### Scenario: Binding migration completes before cutover
- **WHEN** an effective resource has a current `SHADOW_PUBLISHED` or candidate binding but its formal release envelope has not been selected
- **THEN** formal consumers and graph markers SHALL continue using only the prior active release or explicit pin
- **AND** candidate results SHALL remain repository or shadow diagnostics

#### Scenario: Final selector activates
- **WHEN** a later authorized lifecycle transaction satisfies the exact Runtime Release v2 envelope, Teaching Projection, binding, source, qualification, readiness, and authorization gates
- **THEN** formal resource consumers SHALL resolve only the binding set sealed by that selected release

#### Scenario: Engineering-only consumer is ready
- **WHEN** Engineering Authority is valid and an Engineering RAG consumer has no ACT resource dependency
- **THEN** it MAY activate without Canonical resource bindings
- **AND** Teaching Resource consumers SHALL remain on their own pinned release state

## ADDED Requirements

### Requirement: Binding invalidation follows resource-type semantics
Formal binding eligibility SHALL be invalidated according to the resource's stable content model. A media content hash change SHALL invalidate its complete script, segmentation, timing, and bindings. A text rebuild SHALL preserve only paragraph atoms whose stable IDs and content hashes are both unchanged. A question change to stem, options, answer, or explanation SHALL invalidate that question atom. Authority, course scope, role, source identity, qualification, or launch-contract drift SHALL invalidate every dependent binding.

#### Scenario: Media file changes
- **WHEN** a bound video or audio receives a different final content hash
- **THEN** all of its transcript, semantic-paragraph, timing, and Canonical binding artifacts SHALL become stale
- **AND** no prior timecode or binding SHALL enter the new formal envelope

#### Scenario: Text changes locally
- **WHEN** one paragraph changes while another retains the same stable ID and content hash
- **THEN** only the changed paragraph and its dependent bindings SHALL require regeneration
- **AND** the byte-identical paragraph MAY receive a deterministic revalidation

#### Scenario: Question answer changes
- **WHEN** a bound exercise changes its answer or explanation while retaining its item ID
- **THEN** the item binding SHALL become stale despite the stable ID
- **AND** the prior binding SHALL not enter the formal set
