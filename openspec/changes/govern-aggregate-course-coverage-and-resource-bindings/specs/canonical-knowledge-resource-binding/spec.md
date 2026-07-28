## MODIFIED Requirements

### Requirement: Source evidence and teaching resource roles are distinct
The system MUST represent the imported upstream RAG reference, its reviewed ACT structural-unit alignment, and ACT resource-to-Canonical teaching-role binding as three distinct records with independent identities, versions, and readiness states.

#### Scenario: Imported upstream reference is consumed
- **WHEN** Change A has preserved `published_entity_id`, `retrieval_chunk_id`, and `citation_target_id` for the aggregate bundle
- **THEN** this governance flow SHALL reference that immutable upstream record without copying, rewriting, or assigning it an ACT structural unit or teaching role

#### Scenario: Upstream reference resolves to ACT content
- **WHEN** a governed alignment identifies one ACT source edition, structural unit version/hash, inventory capture, atomic resource, segment, and validation digest
- **THEN** the Crosswalk SHALL resolve the ACT evidence location without assigning a teaching role

#### Scenario: Resource receives a teaching role
- **WHEN** an ACT atomic resource is reviewed as explaining, practicing, assessing, or referencing a Canonical Object
- **THEN** the system SHALL store that role separately without modifying the ActKG Release or upstream reference

### Requirement: Binding work is change-triggered and incremental
The system SHALL process changed aggregate Canonical Objects against one versioned resource index and changed resource segments against the Canonical index, using one candidate-pair contract and current aggregate ReleaseSet identity.

#### Scenario: Object and resource evidence are unchanged
- **WHEN** Canonical ID and semantic digest, resource/segment hash, role, prompt/reviewer version, structural gates, and source evidence match a previously accepted decision
- **THEN** the system SHALL create an auditable revalidation for the aggregate ReleaseSet without invoking semantic review again or copying the old publication identity

#### Scenario: Canonical object changes
- **WHEN** an object is new or its aggregate semantic digest changes
- **THEN** only candidate pairs involving that object SHALL be generated against the stable resource index

#### Scenario: Resource segment changes
- **WHEN** a bound resource segment receives a new content hash
- **THEN** only candidate pairs involving that segment SHALL be invalidated

### Requirement: Deterministic bindings require two unique signals
A binding MUST satisfy both a unique, version-valid ACT EvidenceStructuralUnitCrosswalk selecting the Canonical Object and an atomic resource type uniquely determining the teaching role before it can become shadow-published without semantic review.

#### Scenario: Both deterministic conditions hold
- **WHEN** one governed ACT evidence alignment and one type-defined role are unambiguous under the aggregate ReleaseSet
- **THEN** the binding SHALL pass endpoint, capture-revision, version, hash, and uniqueness gates and MAY be shadow-published directly

#### Scenario: Upstream triple is the only signal
- **WHEN** only an opaque upstream RAG reference is available
- **THEN** the result SHALL remain unresolved or a semantic candidate and MUST NOT satisfy the deterministic Crosswalk gate

#### Scenario: Either condition is ambiguous
- **WHEN** ACT evidence alignment or teaching role is non-unique
- **THEN** the result SHALL remain a semantic candidate

### Requirement: Canonical resource bindings remain shadow before cutover
The system MUST keep formal resource consumers on the Legacy authority selector before final production cutover, even when aggregate CourseCoverage, Crosswalks, and reviewed Canonical bindings are complete.

#### Scenario: Aggregate binding migration completes before cutover
- **WHEN** an effective resource has a current aggregate `SHADOW_PUBLISHED` binding but Legacy remains production authority
- **THEN** formal RAG, recommendation, path, and evidence consumers SHALL continue using Legacy while aggregate results remain shadow diagnostics

#### Scenario: Final selector activates
- **WHEN** the later final downtime transaction satisfies every consumer and Teaching Projection gate
- **THEN** formal resource consumers SHALL resolve only the reviewed Canonical bindings selected by that cutover

## ADDED Requirements

### Requirement: ACT Crosswalks bind one coherent capture identity
Every ACT EvidenceStructuralUnitCrosswalk MUST bind the aggregate ReleaseSet, upstream reference, ACT source edition/version, structural unit ID/version/hash, inventory run, capture revision, atomic resource/segment identity, and validation digest from one coherent capture.

#### Scenario: Crosswalk inputs are coherent
- **WHEN** every referenced identity and hash resolves within one clean ACT capture and aggregate ReleaseSet
- **THEN** the Crosswalk MAY enter current shadow validation

#### Scenario: Crosswalk inputs drift
- **WHEN** a source version, content hash, resource segment, inventory run, Git revision, or aggregate release identity differs
- **THEN** the Crosswalk SHALL be rejected or marked stale and no dependent binding SHALL remain current

### Requirement: Semantic alignment review is isolated and evidence-bearing
When stable identifiers and hashes cannot deterministically align an upstream reference to ACT content, a candidate MAY be generated from the Canonical semantic profile and ACT structural-unit index, but acceptance MUST come from an isolated review context and the result MUST retain evidence and rationale.

#### Scenario: Isolated review accepts one alignment
- **WHEN** the reviewer receives the Canonical profile, exact ACT candidate text, structural identities, upstream reference, and no generator reasoning, and returns one supported match
- **THEN** the candidate SHALL still pass endpoint, version, hash, uniqueness, and capture-revision gates before becoming an ACT Crosswalk

#### Scenario: Review is ambiguous or unsupported
- **WHEN** the reviewer finds multiple plausible units, insufficient evidence, a conflict, or a high-impact case
- **THEN** the candidate SHALL remain unresolved or enter the existing human adjudication queue and MUST NOT publish a Crosswalk
