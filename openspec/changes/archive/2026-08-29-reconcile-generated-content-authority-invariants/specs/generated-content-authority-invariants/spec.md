## ADDED Requirements

### Requirement: Generated output remains editable domain-local draft material

AI output in Assessment, Assignment rubric, Smart Lesson, and Smart Courseware
SHALL remain an editable draft or candidate owned by its domain until that
domain's deterministic validation, authorized human action, immutable
revision/snapshot, and publication evidence are complete.

#### Scenario: A generator returns content

- **WHEN** a provider or template returns generated content
- **THEN** the owning domain SHALL persist or project it only as editable
  draft/candidate material with source/input identity, content hash, and
  private provenance and SHALL NOT treat it as published authority

#### Scenario: A draft is edited

- **WHEN** an authorized human edits generated content
- **THEN** the domain SHALL preserve the draft's generation lineage and create
  a new content/revision identity according to its existing state machine

### Requirement: Deterministic validation precedes human approval

Each domain SHALL validate schema, content, source identity, policy, and
applicable safety constraints deterministically against the exact draft hash
before human acceptance or approval.

#### Scenario: Validation is missing or stale

- **WHEN** a validation receipt is absent, mixed-revision, hash-mismatched, or
  stale
- **THEN** the domain matrix SHALL mark the row BLOCKED/NOT_QUALIFIED and SHALL
  NOT authorize human approval or publication from that receipt

#### Scenario: Automated review passes

- **WHEN** automated checks pass but no authorized human decision exists
- **THEN** the output SHALL remain a draft/candidate and SHALL NOT enter a
  catalog, score, feedback, LearningFact, or publication selector

### Requirement: Human decision and immutable revision are domain-owned

Only an authorized human action in the owning domain MAY accept/approve a
validated output, and acceptance SHALL create or reference an immutable
domain-specific revision or snapshot with source, input, content, and actor
lineage.

#### Scenario: Human approves the exact revision

- **WHEN** the authorized human approves a current validated draft
- **THEN** the domain SHALL bind the decision to the exact draft hash and
  create or reference its existing immutable revision/snapshot and audit

#### Scenario: Another domain attempts approval

- **WHEN** a cross-domain route, AI provider, or shared helper attempts to
  approve or mutate a domain's draft
- **THEN** the architecture fitness check SHALL fail and the domain record
  SHALL remain unchanged

### Requirement: Publication requires a domain publication receipt or equivalent

An output SHALL become a consumer-facing published artifact only through its
owning domain's versioned publication receipt or equivalent authority artifact
bound to the immutable revision/snapshot and consumer scope.

#### Scenario: Publication evidence is complete

- **WHEN** deterministic validation, human approval, immutable revision, and
  consumer binding all match
- **THEN** the domain MAY publish through its existing publication contract and
  SHALL retain a content/revision-bound receipt

#### Scenario: A published source is edited

- **WHEN** a teacher or generator changes content after publication
- **THEN** the domain SHALL create a new draft/revision and SHALL NOT mutate
  the published artifact or existing consumer binding

### Requirement: AI cannot write authoritative sinks directly

No generator, provider adapter, automated reviewer, or cross-domain matrix
record SHALL directly write an assessment catalog, assignment score, student
feedback, LearningFact, or production publication selector.

#### Scenario: AI attempts a catalog or score write

- **WHEN** generated output calls a catalog exporter, Assignment score path,
  feedback release, or LearningFact writer before the owning human/revision
  gates
- **THEN** the architecture fitness check SHALL fail closed and SHALL record
  the blocked sink without changing authoritative data

#### Scenario: Approved data reaches a sink

- **WHEN** a domain's existing publication/review contract has all required
  gates and receipt identity
- **THEN** only the owning domain's existing exporter/release/writeback path MAY
  perform the authorized write with its own idempotency and audit rules

### Requirement: Domains retain separate ownership and state machines

Assessment, Assignment rubric, Smart Lesson, and Smart Courseware SHALL retain
their own owner, routes/APIs, models, workers, scripts, tests, state machine,
and rollback contract. The reconciliation matrix SHALL NOT be persisted as a
shared candidate/state model or used as a runtime authority.

#### Scenario: A domain is reconciled

- **WHEN** the matrix records a domain's local contracts
- **THEN** it SHALL reference local identities and public boundaries and SHALL
  not introduce a global candidate id, shared enum, or cross-domain state

#### Scenario: A shared superdomain is proposed

- **WHEN** an implementation adds an AI superdomain, shared candidate table,
  unified state machine, or shared publication service
- **THEN** the fitness check SHALL reject the change as outside this contract

### Requirement: Assessment remains blocked behind #1564

The Assessment matrix row SHALL depend on and reference the concrete contract
owned by reconcile-reviewed-assessment-generation-governance (#1564), whose
draft, deterministic precheck, independent human review, and versioned catalog
publication receipt remain its sole implementation.

#### Scenario: #1564 is not qualified

- **WHEN** the #1564 implementation, tests, source identity, tasks, archive,
  or publication receipt are missing or inconsistent
- **THEN** the Assessment row SHALL remain BLOCKED and this change SHALL NOT
  add a replacement Assessment state machine or catalog path

#### Scenario: #1564 qualifies

- **WHEN** #1564 provides the exact reviewed evidence for its concrete path
- **THEN** the matrix MAY record that evidence while continuing to use #1564's
  domain-owned implementation and publication authority

### Requirement: Matrix and QA receipts preserve privacy and reproducibility

The matrix and retained receipts SHALL bind source/tree revision, content or
revision hashes, status, owner, tool/validator version, and conclusion without
including prompts, raw model responses, student answers, feedback bodies,
credentials, user identifiers, or local absolute paths.

#### Scenario: Run-specific QA completes

- **WHEN** a browser, integration, or generation QA run produces screenshots,
  traces, HARs, or logs
- **THEN** those outputs SHALL remain external and the repository matrix MAY
  retain only their content-addressed reference, revision/hash, and conclusion

#### Scenario: A receipt contains sensitive payload

- **WHEN** a matrix or QA receipt contains a raw answer, credential, user id,
  provider payload, or local path
- **THEN** privacy validation SHALL reject the receipt and SHALL NOT mark its
  invariant row qualified
