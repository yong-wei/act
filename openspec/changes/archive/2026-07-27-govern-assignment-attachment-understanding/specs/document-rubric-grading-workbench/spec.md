## MODIFIED Requirements

### Requirement: Documents are converted before grading
The system SHALL convert uploaded grading documents into analysis-ready artifacts before rubric grading, except that binary attachments bound to unified assignment responses SHALL use the governed Mathpix-only understanding route.

#### Scenario: Document is converted
- **WHEN** a teacher or authorized service uploads a PDF or supported office document outside the unified assignment-response attachment path
- **THEN** the system SHALL create a submission asset record, run an eligible governed conversion adapter such as MarkItDown, store Markdown or structured blocks, preserve checksum, page or block references, and report conversion confidence.

#### Scenario: Unified assignment-response binary attachment is converted
- **WHEN** a PDF, DOC, DOCX, PPTX, PNG, or JPEG is bound to a sealed unified assignment response
- **THEN** grading understanding SHALL use the governed Mathpix route when policy permits
- **AND** MarkItDown, OOXML extraction, local OCR, or another local semantic result SHALL NOT enter the new evaluator, batch, approval, or writeback chain.

#### Scenario: Conversion loses precise layout
- **WHEN** an eligible converter cannot produce reliable bbox or span mapping
- **THEN** the grading UI SHALL fall back to page-level or block-level references
- **AND** it SHALL NOT pretend to offer precise inline PDF evidence.

### Requirement: Submitted answers normalize into immutable grading evidence
The system SHALL normalize each submitted question answer attempt into versioned `AnswerEvidence` with answer hash, source kind, canonical Markdown or blocks, ordered source manifest, anchor map, precision, readiness, and limitations.

#### Scenario: Submitted text answer is normalized
- **WHEN** a question attempt containing text is formally submitted
- **THEN** the system SHALL create immutable canonical Markdown with stable block/span anchors directly from the sealed text snapshot
- **AND** the answer SHALL enter manual or eligible AI grading without requiring document conversion.

#### Scenario: Embedded image is normalized
- **WHEN** a sealed text snapshot references an eligible embedded image
- **THEN** its governed Mathpix result SHALL be inserted at that image's Markdown position
- **AND** a missing result SHALL retain an explicit limitation at that position rather than silently removing the image.

#### Scenario: Ordered attachments are normalized
- **WHEN** one or more independent attachments reach a terminal understanding state
- **THEN** successful canonical content and explicit missing-understanding entries SHALL be appended after the student text in the student's persisted attachment order
- **AND** the source manifest SHALL bind every segment or limitation to the exact sealed asset identity.

#### Scenario: Submitted document answer is normalized
- **WHEN** all terminal understanding results for a sealed answer attempt are assembled
- **THEN** the resulting ordered canonical blocks, source manifest, and anchor map SHALL become a new immutable grading evidence identity for that exact answer attempt
- **AND** any prior evidence identity SHALL remain unchanged.

#### Scenario: Answer version changes
- **WHEN** a later answer attempt is submitted
- **THEN** the system SHALL create a new evidence identity and preserve prior evidence, runs, source order, and review lineage.

### Requirement: Mathematical document conversion is asynchronous and adapter-driven
The system SHALL process supported binary question attachments asynchronously through the versioned Mathpix adapter when the frozen external-processing policy permits, and SHALL process Markdown and plain-text attachments through the governed direct-text reader.

#### Scenario: Supported binary attachment is processed
- **WHEN** a finalized PDF, DOC, DOCX, PPTX, PNG, or JPEG belongs to a submitted question answer and policy permits external answer conversion
- **THEN** the pipeline SHALL invoke Mathpix with the authorized immutable source asset and record provider routing, version, request lineage, and declared limitations
- **AND** MarkItDown, OOXML extraction, local OCR, or another local semantic result SHALL NOT be used as grading-understanding fallback.

#### Scenario: Formula-heavy DOCX is converted
- **WHEN** a formula-heavy DOCX is outside the unified assignment-response path
- **THEN** the canonical document pipeline MAY preserve an authorized rendered representation, extract available structure, invoke Mathpix as policy permits, and record converter routing and versions
- **AND** a unified assignment-response DOCX SHALL use the Mathpix-only understanding route.

#### Scenario: Local conversion is sufficient
- **WHEN** a supported document outside the unified assignment-response path can produce reliable canonical content through an approved local adapter
- **THEN** the pipeline SHALL use the local result and record its adapter id, version, confidence, and limitations
- **AND** that local result SHALL NOT be reused as unified assignment-response binary evidence.

#### Scenario: Markdown or plain-text attachment is processed
- **WHEN** a finalized Markdown or plain-text attachment belongs to a submitted question answer
- **THEN** the pipeline SHALL verify persisted asset integrity and read it directly through the bounded text adapter
- **AND** it SHALL NOT send that attachment to Mathpix.

#### Scenario: Mathpix is disallowed or finally fails
- **WHEN** the frozen external-processing policy disallows Mathpix or retry policy reaches a terminal unusable result
- **THEN** the attachment SHALL enter an explicit understanding-unavailable state while preserving the original asset for authorized manual review
- **AND** the pipeline SHALL NOT claim conversion success or substitute local binary semantic extraction.

#### Scenario: External provider is disabled or fails
- **WHEN** Mathpix is disabled or finally fails for a unified assignment-response binary attachment
- **THEN** the attachment SHALL enter an explicit understanding-unavailable state and preserve the original asset for authorized manual review
- **AND** eligible fallback remains available only to non-assignment canonical document conversion.

### Requirement: External answer processing is governed by one failure-closed policy
The system SHALL apply a versioned external-processing policy to Mathpix and AI evaluator providers before any student answer content is sent externally.

#### Scenario: Mathpix processes a student document
- **WHEN** the frozen answer-conversion policy confirms purpose `answer-conversion`, data category, minimized scope, institution/class permission, processing region and agreement version, training-use prohibition, provider retention window, deletion capability, and credential version
- **THEN** credentials SHALL remain in rotatable server-side secret management, payload SHALL be limited to the selected attachment, and audit SHALL record safe pseudonymous provider/request/policy metadata without answer content, signed URLs, or secret values.

#### Scenario: AI evaluator processes answer evidence
- **WHEN** the frozen rubric-grading policy confirms purpose `rubric-grading` and permits model evaluation
- **THEN** only the selected question, rubric, reference answer, minimized ordered AnswerEvidence, and declared limitations SHALL be sent under the approved purpose.

#### Scenario: Provider policy is absent or incomplete
- **WHEN** any required Mathpix or evaluator policy field is missing, disallows the class/data/purpose, or cannot confirm retention or training-use constraints
- **THEN** binary attachment understanding or model evaluation SHALL enter an explicit blocked or unavailable state
- **AND** the system SHALL NOT send student content to that provider or substitute an unapproved semantic path.

#### Scenario: Unauthorized actor requests an artifact
- **WHEN** an actor lacks role, class, assignment, answer, or review authorization
- **THEN** the system SHALL deny access to original assets, direct-text content, Mathpix artifacts, anchors, model payloads, and grading drafts.

### Requirement: Batch grading is observable, resumable, and failure-isolated
The system SHALL support question-scoped grading batches with durable progress, per-answer item state, cancellation, retry, deduplication, provider limitation reporting, and source-aware conversion routing.

#### Scenario: Teacher grades one question across a class
- **WHEN** an authorized teacher starts a batch for eligible submitted answers to one assignment question
- **THEN** the batch SHALL freeze assignment question, rubric, evaluator, rubric-grading policy, answer-conversion policy state, and independent item states
- **AND** each unified-response binary attachment SHALL use Mathpix only when the frozen answer-conversion policy permits.

#### Scenario: Teacher grades unified assignment responses across a class
- **WHEN** an authorized teacher starts a batch for eligible submitted answers to one assignment question
- **THEN** the batch SHALL freeze assignment question, rubric, evaluator, the rubric-grading policy, and the answer-conversion policy state
- **AND** a binary unified-response attachment SHALL use Mathpix only when the frozen answer-conversion policy permits and otherwise become understanding-unavailable
- **AND** it SHALL NOT use the governed local document path as fallback for that binary attachment
- **AND** the batch SHALL create independent item states and grading runs for each answer.

#### Scenario: Teacher batches non-assignment grading documents
- **WHEN** an authorized workflow starts a batch for grading documents that are not bound to unified assignment responses
- **THEN** the batch MAY continue to use the canonical governed local conversion path
- **AND** this assignment attachment exception SHALL NOT change that route.

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

## ADDED Requirements

### Requirement: Incomplete attachment evidence requires teacher confirmation
The system SHALL distinguish complete grading evidence from evidence where one or more attachments were not understood and SHALL prevent an incomplete-evidence suggestion from becoming a grade without teacher confirmation.

#### Scenario: Some answer evidence remains usable
- **WHEN** student text or at least one attachment is usable but another attachment is understanding-unavailable
- **THEN** the evaluator MAY produce an `EVIDENCE_INCOMPLETE` draft using only the usable ordered evidence
- **AND** the draft SHALL list each omitted attachment by its safe display name and preserve the declared limitation.

#### Scenario: Teacher has not confirmed incomplete evidence
- **WHEN** an `EVIDENCE_INCOMPLETE` draft awaits review
- **THEN** approval, final score persistence, student feedback, and governed evidence writeback SHALL remain blocked
- **AND** conversion completion alone SHALL NOT satisfy the confirmation.

#### Scenario: Teacher confirms after checking originals
- **WHEN** an authorized teacher explicitly confirms the incomplete-evidence draft after reviewing available originals
- **THEN** the grading workflow MAY form the teacher-approved grade
- **AND** the audit SHALL record the confirmation and omitted asset identities without storing original content.

#### Scenario: No gradable evidence is available
- **WHEN** the response has no usable text or successfully understood attachment
- **THEN** AI grading SHALL remain blocked
- **AND** the original submission SHALL remain available for authorized manual grading.

### Requirement: Legacy local binary assignment evidence is migrated fail closed
The system SHALL provide idempotent dry-run and apply modes for legacy local-binary conversion chains bound to unified assignment responses, preserving approved history while preventing unapproved local semantic artifacts from new grading consumption.

#### Scenario: Dry-run classifies legacy chains
- **WHEN** dry-run inspects local-binary conversions bound to assignment response attachments
- **THEN** it SHALL report each conversion, AnswerEvidence, grading run, batch item, queue job, approval state, and evaluator/writeback readiness
- **AND** it SHALL make no data mutation.

#### Scenario: Legacy grading is already approved
- **WHEN** a local-binary grading result has an authoritative teacher-approved state
- **THEN** apply SHALL preserve its historical feedback, score, evidence writeback, lineage, and audit
- **AND** it SHALL NOT reinterpret that historical result as Mathpix-derived.

#### Scenario: Legacy local-binary chain is not approved
- **WHEN** a local-binary conversion, evidence, run, batch item, or queue job has no authoritative teacher approval
- **THEN** apply SHALL mark the chain `legacy-ineligible`, `BLOCKED`, or the model-equivalent non-consumable state
- **AND** it SHALL clear new evaluator and writeback readiness and stop active queue consumption without deleting the original submission asset.

#### Scenario: Migration or new consumption is repeated
- **WHEN** apply is rerun or a new evaluator, batch, approval, or writeback consumer inspects the migrated chain
- **THEN** the same terminal eligibility result SHALL remain stable
- **AND** no local binary adapter output SHALL enter the new assignment grading consumption chain.
