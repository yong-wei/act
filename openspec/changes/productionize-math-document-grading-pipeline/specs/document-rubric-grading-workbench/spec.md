## ADDED Requirements

### Requirement: Submitted answers normalize into immutable grading evidence
The system SHALL normalize each submitted question answer attempt into versioned `AnswerEvidence` with answer hash, source kind, canonical Markdown or blocks, anchor map, precision, readiness, and limitations.

#### Scenario: Submitted text answer is normalized
- **WHEN** a text answer attempt is formally submitted
- **THEN** the system SHALL create immutable canonical Markdown with stable block/span anchors directly from the sealed text snapshot
- **AND** the answer SHALL enter manual or eligible AI grading without requiring a document conversion.

#### Scenario: Submitted document answer is normalized
- **WHEN** a document conversion completes successfully
- **THEN** the resulting canonical blocks and anchor map SHALL become the immutable grading evidence for that exact answer attempt.

#### Scenario: Answer version changes
- **WHEN** a later answer attempt is submitted
- **THEN** the system SHALL create a new evidence identity and preserve prior evidence, runs, and review lineage.

### Requirement: Question documents use immutable protected source assets
The system SHALL process only finalized question-bound submission assets that preserve object reference, ownership, assignment revision, question answer attempt, MIME, size, checksum, scan state, and timestamps.

#### Scenario: Eligible document enters conversion
- **WHEN** a supported asset is finalized, passes validation, and belongs to a submitted question answer
- **THEN** the system SHALL enqueue conversion using the immutable object reference and a deterministic dedupe key.

#### Scenario: Asset is unbound or unsafe
- **WHEN** an asset lacks a question answer, fails MIME or malware validation, exceeds policy, or is outside the caller's authorization scope
- **THEN** conversion SHALL be rejected before document content is read by a converter or external provider.

### Requirement: Mathematical document conversion is asynchronous and adapter-driven
The system SHALL convert supported question documents through asynchronous, versioned adapters and SHALL route formula- or image-heavy content to Mathpix when provider policy permits.

#### Scenario: Formula-heavy DOCX is converted
- **WHEN** a DOCX contains mathematical or image content requiring layout-aware recognition
- **THEN** the pipeline SHALL preserve an authorized rendered representation, extract available document structure, invoke the configured Mathpix adapter as needed, and record converter routing and versions.

#### Scenario: Local conversion is sufficient
- **WHEN** a supported document can produce reliable canonical content through an approved local adapter
- **THEN** the pipeline SHALL use the local result and record its adapter id, version, confidence, and limitations.

#### Scenario: External provider is disabled or fails
- **WHEN** Mathpix is disabled by policy, unavailable, or returns an unusable result
- **THEN** the pipeline SHALL use an eligible fallback or enter a visible blocked-conversion state
- **AND** it SHALL NOT discard the original asset or claim conversion success without adequate output.

### Requirement: Canonical conversion artifacts preserve honest anchor precision
Every completed conversion SHALL persist canonical Markdown or structured blocks with source checksum, converter metadata, page/block/span mapping, optional bounding boxes, confidence, precision, warnings, and timestamps.

#### Scenario: Exact bounding boxes are supported
- **WHEN** the selected converter proves a block or text region bounding box on a rendered page
- **THEN** the anchor map SHALL persist that geometry with page and converter coordinate metadata.

#### Scenario: Only coarse placement is supported
- **WHEN** reliable span or bounding-box mapping is unavailable
- **THEN** the conversion SHALL declare block-level or page-level precision
- **AND** downstream grading and UI SHALL NOT present the anchor as exact inline placement.

#### Scenario: Conversion is repeated with the same inputs
- **WHEN** source checksum, converter configuration, and converter version match a completed conversion dedupe key
- **THEN** the system SHALL reuse or return the existing artifact according to policy rather than duplicating conversion records.

### Requirement: AI grading evaluates one frozen question answer against its rubric
Every production AI grading run SHALL bind one submitted question answer attempt, one immutable assignment question snapshot, one reference answer, and one rubric version.

#### Scenario: Eligible question answer is evaluated
- **WHEN** text-native or converted AnswerEvidence is ready and an authorized teacher or service requests AI-assisted grading
- **THEN** the evaluator SHALL receive only the selected question contract, rubric, relevant answer evidence, and declared limitations
- **AND** the run SHALL record input hashes, assignment revision, question id, answer attempt, rubric version, evaluator id, and evaluator version.

#### Scenario: Production evaluator is selected
- **WHEN** production AI-assisted grading is enabled
- **THEN** the system SHALL use the configured provider-backed evaluator adapter
- **AND** a deterministic fixture evaluator SHALL NOT be the production default.

#### Scenario: Student answer contains prompt-like instructions
- **WHEN** submitted content attempts to override grading instructions, request tools, browse, execute code, or access other answers
- **THEN** the evaluator SHALL treat it as untrusted answer data, use no tools or external retrieval, and remain scoped to the frozen question evidence.

### Requirement: Evaluator drafts are schema-validated and evidence-anchored
The system SHALL accept an AI grading draft only when every criterion assessment and annotation satisfies the frozen rubric, score scale, and conversion anchor schema.

#### Scenario: Evaluator returns a valid draft
- **WHEN** output includes known criterion ids, in-range scores, selected levels or bands, rationale, confidence, supported evidence anchors, location-aware annotations, limitations, and overall comment
- **THEN** the system SHALL persist the draft as awaiting teacher review.

#### Scenario: Evaluator output is invalid
- **WHEN** output references unknown criteria or anchors, exceeds score ranges, lacks required evidence, contains malformed annotations, or violates safety constraints
- **THEN** the run SHALL enter a retryable or blocked-evaluator state
- **AND** no draft SHALL be approved, shown to students, or written back as governed evidence.

### Requirement: Batch grading is observable, resumable, and failure-isolated
The system SHALL support question-scoped grading batches with durable progress, per-answer item state, cancellation, retry, deduplication, and provider limitation reporting.

#### Scenario: Teacher grades one question across a class
- **WHEN** an authorized teacher starts a batch for eligible submitted answers to one assignment question
- **THEN** the batch SHALL freeze assignment question, rubric, evaluator, and policy versions
- **AND** it SHALL create independent item states and grading runs for each answer.

#### Scenario: One batch item fails
- **WHEN** one answer conversion or evaluator call fails
- **THEN** that item SHALL expose its failure and retry state without invalidating successful sibling items.

#### Scenario: Same batch request is repeated
- **WHEN** an equivalent active or completed batch dedupe key is requested
- **THEN** the system SHALL return the existing batch for the same idempotency key.

#### Scenario: Teacher explicitly requests a rerun
- **WHEN** an authorized teacher supplies a rerun reason for the same or a newer frozen evaluator/input version
- **THEN** the system SHALL create a new rerun identity without overwriting prior runs
- **AND** any existing teacher review SHALL explicitly adopt or reject the new run.

### Requirement: External answer processing is governed by one failure-closed policy
The system SHALL apply a versioned external-processing policy to Mathpix and AI evaluator providers before any student answer content is sent externally.

#### Scenario: Mathpix processes a student document
- **WHEN** policy confirms purpose, data category, minimized scope, institution/class permission, processing region and agreement version, training-use prohibition, provider retention window, deletion capability, and credential version
- **THEN** credentials SHALL remain in rotatable server-side secret management, payload SHALL be limited to the selected answer, and audit SHALL record safe pseudonymous provider/request/policy metadata without answer content, signed URLs, or secret values.

#### Scenario: AI evaluator processes answer evidence
- **WHEN** the same versioned provider policy permits model evaluation
- **THEN** only the selected question, rubric, reference answer, minimized AnswerEvidence, and declared limitations SHALL be sent under the approved purpose.

#### Scenario: Provider policy is absent or incomplete
- **WHEN** any required Mathpix or evaluator policy field is missing, disallows the class/data/purpose, or cannot confirm retention or training-use constraints
- **THEN** the system SHALL use an eligible local path or enter an explicit blocked state
- **AND** it SHALL NOT send student content to that provider.

#### Scenario: Unauthorized actor requests an artifact
- **WHEN** an actor lacks role, class, assignment, answer, or review authorization
- **THEN** the system SHALL deny access to original assets, rendered pages, Markdown, anchors, model payloads, and grading drafts.

### Requirement: Grading data follows a versioned retention and deletion lifecycle
The system SHALL classify quarantine objects, source assets, rendered pages, Markdown/anchors, provider metadata, model inputs/outputs, AI drafts, approved derivatives, audit, and evidence records under a versioned lifecycle policy with explicit finite retention or governed record rules.

#### Scenario: Required lifecycle policy is incomplete
- **WHEN** an enabled deployment lacks a duration, deletion/anonymization rule, provider-retention value, or referential action for a required data class
- **THEN** new external processing and grading intake SHALL remain blocked rather than retaining data indefinitely by implication.

#### Scenario: Content reaches retention expiry
- **WHEN** source or derived content reaches its policy expiry without a legal or academic hold
- **THEN** the system SHALL cancel or fence in-flight consumers, write an auditable tombstone, delete the protected object/artifact, remove direct identifiers and export payloads as required, and preserve only policy-permitted pseudonymous lineage.

#### Scenario: Legal or academic hold applies
- **WHEN** an authorized actor places a hold with reason, scope, and expiry
- **THEN** deletion SHALL pause for covered records and objects while the hold and every later release remain audited.

#### Scenario: Parent user, class, or assignment is deleted
- **WHEN** a parent entity is archived, anonymized, or deleted
- **THEN** Prisma relations SHALL NOT cascade-delete submitted, graded, approved, or audited records
- **AND** lifecycle jobs SHALL apply the configured restrict, tombstone, content deletion, or pseudonymization action.

### Requirement: Pipeline mutations are protected and abuse-bounded
Conversion, grading, batch, retry, and rerun mutations SHALL require authenticated non-GET requests, strict Origin or CSRF validation where cookie-authenticated, runtime schemas, bounded payloads, resource authorization, idempotency, and per-user/class/provider quotas.

#### Scenario: Forged or over-limit batch request is attempted
- **WHEN** a request has invalid Origin/CSRF proof, unauthorized answer ids, malformed versions, excessive batch size, or exceeded retry/provider quotas
- **THEN** the system SHALL reject or throttle it before enqueuing jobs or reading answer content.

### Requirement: Machine drafts remain non-authoritative until teacher approval
Conversion and AI grading completion SHALL NOT by themselves publish student feedback, alter final assignment scores, or write high-confidence learner evidence.

#### Scenario: AI grading finishes successfully
- **WHEN** a valid grading draft is persisted
- **THEN** its state SHALL remain awaiting teacher review
- **AND** student-facing APIs and governed evidence writeback SHALL continue to exclude the draft.
