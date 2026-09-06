# canonical-knowledge-resource-binding Specification

## Purpose
TBD - created by archiving change bind-active-resources-to-canonical-knowledge. Update Purpose after archive.
## Requirements
### Requirement: Source evidence and teaching resource roles are distinct
The system MUST represent an imported upstream RAG reference, its governed ACT structural-unit alignment, and an ACT resource-to-Canonical teaching-role binding as three records with independent identities, versions and readiness.

#### Scenario: Upstream reference is consumed
- **WHEN** candidate import preserves `published_entity_id`, `retrieval_chunk_id`, and `citation_target_id`
- **THEN** resource governance SHALL reference that immutable record without rewriting it or assigning an ACT structure or teaching role

#### Scenario: EvidenceSegment resolves to ACT content
- **WHEN** a stable source identity, segment identity, version, and content hash match an ACT structural unit
- **THEN** the Crosswalk SHALL resolve the authoritative evidence location without assigning a teaching role

#### Scenario: Upstream reference resolves to ACT content
- **WHEN** governed alignment identifies one source edition, structural unit version/hash, inventory capture, atomic resource/segment and validation digest
- **THEN** the ACT Crosswalk SHALL bind that coherent capture identity without assigning a teaching role

#### Scenario: Resource receives a teaching role
- **WHEN** an ACT atomic resource is reviewed as explaining, practicing, assessing, or referencing a Canonical Object
- **THEN** the system SHALL store that role separately without modifying the ActKG Release or upstream reference

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

#### Scenario: Exact one-to-one mapping exists
- **WHEN** an old ID, normalized label, or alias appears to resolve to one valid Canonical ID and one role
- **THEN** the system SHALL record a binding candidate with its mapping method and evidence
- **AND** label or alias evidence alone SHALL NOT create a formal `BOUND` record

#### Scenario: Candidate is ambiguous
- **WHEN** an old ID maps to multiple Canonical IDs, multiple old IDs merge, or only semantic similarity exists
- **THEN** the resource SHALL remain unresolved or enter the repository review pack
- **AND** no binding SHALL be published until it passes the applicable qualified automatic or governed decision path

### Requirement: Semantic candidates receive independent review
Semantic candidates MAY be admitted automatically only by an exactly qualified Canonical-mapping pipeline and only when every item-level identity, evidence, confidence, atom, role, scope, endpoint, and uniqueness gate passes. A low-confidence, conflicting, high-impact, structurally invalid, or otherwise exceptional candidate SHALL enter the versioned repository review pack and MUST NOT become formal. Automatic qualification MUST NOT require an online review service or a universal per-resource human decision.

#### Scenario: Independent review accepts a candidate
- **WHEN** a matching qualified pipeline produces one candidate that passes every item-level gate
- **THEN** the candidate MAY enter the formal binding set with complete pipeline, input, output, evidence, and qualification lineage
- **AND** a separate runtime or GPT review SHALL NOT be required

#### Scenario: Review is disputed or high impact
- **WHEN** evidence conflicts, impact is high, confidence is insufficient, or an item gate fails
- **THEN** the candidate SHALL enter the repository review pack and MUST NOT become active
- **AND** other individually valid resources and bindings MAY continue

### Requirement: Final cutover requires complete active-resource bindings
Resource binding completeness SHALL be evaluated against the frozen candidate inventory for one target Runtime Release v2 and course package, not against every member of the ActKG Release. Every candidate resource MUST retain an `INCLUDED` or `EXCLUDED` disposition. Every atom of an included teaching resource MUST have one or more valid formal Canonical bindings or an audited `NON_TEACHING` disposition, and every included teaching resource MUST contain at least one `BOUND` atom. `OPTIONAL`, legacy `NONE`, a prior shadow binding, or omission from successful output MUST NOT bypass this gate. An excluded or unresolved resource SHALL block only its own inclusion; it SHALL not block Engineering Authority or unrelated eligible resources.

#### Scenario: Only inactive inventory remains unbound
- **WHEN** every unbound candidate for one package is a draft, disabled, archived, non-teaching, or failed resource with a complete evidence-bearing `EXCLUDED` disposition
- **THEN** the package's formal resource gate MAY pass for the remaining included set
- **AND** candidate counts and the excluded set hash SHALL still include those resources

#### Scenario: Effective resource is unresolved
- **WHEN** one atom of an intended included teaching resource has neither a valid formal binding nor an audited non-teaching disposition
- **THEN** that resource SHALL fail closed and move to the excluded disposition set
- **AND** other eligible resources and Engineering Authority SHALL remain independently selectable

#### Scenario: Effective resource package is complete
- **WHEN** every frozen candidate is dispositioned, every included resource atom is closed, and every included teaching resource has at least one valid binding
- **THEN** that package MAY pass its formal binding gate even when unrelated ActKG objects have no resources or teaching projection

#### Scenario: One course has an unresolved step
- **WHEN** a required interactive step remains unresolved at any atom
- **THEN** that step SHALL be excluded from the formal manifest with exact bounded reasons
- **AND** unrelated course packages, resources, and Engineering Authority SHALL remain selectable

#### Scenario: Active package is complete
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

### Requirement: ACT Crosswalks bind one coherent capture identity
Every ACT EvidenceStructuralUnitCrosswalk MUST bind the candidate ReleaseSet, ReleaseSet Delta Receipt, upstream reference, source edition/version, structural unit ID/version/hash, inventory run, capture revision, atomic resource/segment identity and validation digest from one coherent capture.

#### Scenario: Crosswalk inputs are coherent
- **WHEN** every referenced identity and hash resolves within one clean ACT capture and candidate ReleaseSet
- **THEN** the Crosswalk MAY enter current shadow validation

#### Scenario: Crosswalk inputs drift
- **WHEN** a source version, content hash, resource segment, inventory run, Git revision, Delta identity or ReleaseSet differs
- **THEN** the Crosswalk SHALL be rejected or marked stale and no dependent binding SHALL remain current

### Requirement: Semantic alignment review is isolated and evidence-bearing
When stable identifiers and hashes cannot deterministically align an upstream reference to ACT content, a candidate MAY be generated from the Canonical semantic profile and ACT structural-unit index, but acceptance MUST come from an isolated review context and retain evidence and rationale.

#### Scenario: Isolated review accepts one alignment
- **WHEN** the reviewer receives the Canonical profile, exact candidate text, structural identities and upstream reference and returns one supported match
- **THEN** the candidate SHALL still pass endpoint, version, hash, uniqueness and capture gates before becoming an ACT Crosswalk

#### Scenario: Review is ambiguous or unsupported
- **WHEN** the review finds multiple plausible units, insufficient evidence, a conflict or a high-impact unresolved case
- **THEN** the candidate SHALL remain unresolved or enter the existing adjudication queue and MUST NOT publish a Crosswalk

### Requirement: Packaging revisions preserve semantic governance
When an accepted Delta has no semantic changes, the system MUST retain current CourseCoverage, ACT Crosswalk and resource-binding eligibility through a no-op revalidation and MUST NOT rerun model review.

#### Scenario: Compatible packaging revision arrives
- **WHEN** only Bundle packaging metadata changes
- **THEN** governance SHALL record the new Bundle/Delta identity and preserve the existing semantic decisions

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

### Requirement: Active teaching resources cannot remain orphans
The active Teaching Projection resource inventory MUST bind every in-scope runtime resource to at least one current Canonical Object under an explicit teaching role, unless the resource is recorded on the exception ledger with a closed reason. Bindings to retired, missing, or non-current objects do not satisfy this gate. Inspector projection MUST skip empty titles instead of showing identity-mismatch for the whole node, and the package MUST still fail closed until titles and bindings are complete for every non-ledger resource. The product denominator is the runtime file set, not the git-tracked fixture set.

#### Scenario: Inventory contains an unbound resource
- **WHEN** a resource row in the active projection has no current canonical binding and is not on the exception ledger
- **THEN** projection publication SHALL fail closed
- **AND** the inspector SHALL not treat every other node as identity-mismatched because of that orphan

#### Scenario: Bound resource lacks a title
- **WHEN** a bound resource has a canonical id but a null or blank title
- **THEN** the inspector SHALL NOT list it as available
- **AND** the completeness gate SHALL fail until a human-readable title exists

#### Scenario: Genuine leftover is ledgered
- **WHEN** a resource has no corresponding overlay core after exact identity and one-to-one crosswalk checks
- **THEN** it SHALL be written to the exception ledger with an explicit reason
- **AND** it SHALL NOT be published as BOUND

### Requirement: Task-formed simulations enter the binding inventory
Published Arena tasks, Odyssey task levels, and control-workbench catalog tasks MUST appear as simulation resources in the active Teaching Projection. Classroom simulations that encode a lesson unit MUST bind to that unit's overlay cores.

#### Scenario: Lesson-unit classroom simulation is bound
- **WHEN** a simulation resource id encodes a lesson unit that overlay `nodeUnits` maps to one or more cores
- **THEN** the restage SHALL bind that simulation to those cores with role PRACTICES or EXPLAINS

