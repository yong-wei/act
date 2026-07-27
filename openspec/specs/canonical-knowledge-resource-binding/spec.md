# canonical-knowledge-resource-binding Specification

## Purpose
TBD - created by archiving change bind-active-resources-to-canonical-knowledge. Update Purpose after archive.
## Requirements
### Requirement: Source evidence and teaching resource roles are distinct
The system MUST represent ActKG Canonical-to-Evidence alignment separately from ACT resource-to-Canonical teaching-role bindings.

#### Scenario: EvidenceSegment resolves to ACT content
- **WHEN** a stable source identity, segment identity, version, and content hash match an ACT structural unit
- **THEN** the Crosswalk SHALL resolve the authoritative evidence location without assigning a teaching role

#### Scenario: Resource receives a teaching role
- **WHEN** an ACT atomic resource is reviewed as explaining, practicing, assessing, or referencing a Canonical Object
- **THEN** the system SHALL store that role in ACT without modifying the ActKG Release

### Requirement: Binding work is change-triggered and incremental
The system SHALL process changed Canonical Objects against the resource index and changed resource segments against the Canonical index, using one candidate-pair contract.

#### Scenario: Canonical object is unchanged
- **WHEN** the object revision, resource hash, and prompt version match a previous binding decision
- **THEN** the system SHALL reuse the decision and MUST NOT invoke semantic review again

#### Scenario: Resource segment changes
- **WHEN** a bound resource segment receives a new content hash
- **THEN** only candidate pairs involving that segment SHALL be invalidated

### Requirement: Deterministic bindings require two unique signals
A binding MUST satisfy both a unique EvidenceSegment Crosswalk selecting the Canonical Object and an atomic resource type uniquely determining the teaching role before it can become active without semantic review.

#### Scenario: Both deterministic conditions hold
- **WHEN** one evidence alignment and one type-defined role are unambiguous
- **THEN** the binding SHALL pass structural gates and MAY be published directly

#### Scenario: Either condition is ambiguous
- **WHEN** evidence alignment or teaching role is non-unique
- **THEN** the result SHALL remain a semantic candidate

### Requirement: Semantic candidates receive independent review
Lexical, vector, or GPT-generated binding candidates MUST be reviewed by an isolated GPT context that did not generate the candidate.

#### Scenario: Independent review accepts a candidate
- **WHEN** the reviewer reads the Canonical semantic profile, atomic resource segment, proposed role, and evidence and returns accept
- **THEN** the candidate SHALL still pass endpoint, version, role, and uniqueness gates before publication

#### Scenario: Review is disputed or high impact
- **WHEN** generation and review conflict, the impact is high, or the reviewer returns dispute
- **THEN** the candidate SHALL enter human adjudication and MUST NOT become active

### Requirement: Final cutover requires complete active-resource bindings
Every currently published, recommendable, path-eligible, or evidence-producing atomic teaching resource MUST have an active, reviewed Canonical binding before production authority cutover.

#### Scenario: Only inactive inventory remains unbound
- **WHEN** all unbound items are drafts, disabled, archived, or non-teaching assets
- **THEN** the resource binding gate SHALL pass

#### Scenario: Effective resource is unresolved
- **WHEN** an effective teaching resource has no active Canonical binding
- **THEN** the cutover gate SHALL fail with the exact resource and missing disposition

### Requirement: Canonical resource bindings remain shadow before cutover
The system MUST keep formal resource consumers on the Legacy authority selector before the final production cutover, even when reviewed Canonical bindings are complete.

#### Scenario: Binding migration completes before cutover
- **WHEN** an effective resource has an active reviewed Canonical binding but Legacy remains the production authority
- **THEN** formal recommendation, path, and evidence consumers SHALL continue using the Legacy resource knowledge identity while Canonical results remain shadow diagnostics

#### Scenario: Final selector activates
- **WHEN** the final downtime transaction switches all knowledge consumers together
- **THEN** formal resource consumers SHALL resolve only the reviewed Canonical bindings

