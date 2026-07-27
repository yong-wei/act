# document-rubric-grading-workbench Specification

## Purpose
TBD - created by archiving change add-document-rubric-grading-workbench. Update Purpose after archive.
## Requirements
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

### Requirement: Rubric grading remains teacher-approved
The system SHALL keep a human teacher in the loop for document grading.

#### Scenario: Draft grading is produced
- **WHEN** a grading run evaluates a converted document against an analytic rubric
- **THEN** it SHALL produce criterion-level draft scores, evidence references, comments, confidence, citation metadata, and profile writeback candidates.

#### Scenario: Teacher approves grading
- **WHEN** the teacher approves or edits a grading run
- **THEN** returned feedback, annotations, score breakdown, and governed evidence writeback SHALL use the approved state
- **AND** unapproved machine drafts SHALL NOT update competency profiles as high-confidence evidence.

### Requirement: Grading UI is part of the workflow
The grading workbench SHALL support professional teacher review states.

#### Scenario: Teacher opens grading workbench
- **WHEN** a teacher opens a grading draft
- **THEN** the UI SHALL show converted document precision, evaluator limitations, criterion-level AI draft, teacher-edit controls, evidence anchors, approval state, and writeback preview.

### Requirement: Document grading persists first-class artifacts
The system SHALL persist document submissions, conversion artifacts, rubric assessments, and annotation anchors as durable grading workflow records.

#### Scenario: Submission is created
- **WHEN** an authorized student, teacher, or service creates a grading submission
- **THEN** the system SHALL persist owner, class, assignment, original file reference, mime type, checksum, status, and timestamps
- **AND** repeated submission processing SHALL be idempotent by checksum or workflow dedupe key where policy allows.

#### Scenario: Conversion artifact is created
- **WHEN** a document conversion finishes
- **THEN** the system SHALL persist converter id, converter version, markdown or structured blocks, page/block/span anchor map, checksum, confidence, and warnings
- **AND** conversion precision SHALL be visible to downstream grading and UI consumers.

### Requirement: Draft rubric grading is anchor-backed
Draft rubric grading SHALL evaluate document quality through schema-validated scoring-item assessments selected from the frozen rubric version rather than fixed scaffold scores.

#### Scenario: Draft criterion grade is produced
- **WHEN** a converted document is evaluated against its frozen rubric
- **THEN** each scoring-item assessment SHALL include the fields required by that rubric version and detailed-rubric mode
- **AND** its score and optional selected level SHALL be derived from document content, rubric requirements, and evaluator reasoning rather than a fixed scaffold value.

#### Scenario: Scoring-standard-only draft is produced
- **WHEN** an answer is evaluated against a frozen scoring item whose detailed rubric is disabled
- **THEN** its assessment SHALL include scoring-item id, one-decimal score within zero and the scoring-item maximum, rationale, confidence, evidence anchors, and limitation state
- **AND** it SHALL NOT require or infer a selected evaluation-level identity.

#### Scenario: Detailed-rubric draft is produced
- **WHEN** an answer is evaluated against a frozen scoring item whose detailed rubric is enabled
- **THEN** its assessment SHALL include scoring-item id, selected evaluation-level identity, suggested score, rationale, confidence, evidence anchors, and limitation state
- **AND** the selected level SHALL belong to that frozen scoring item and the AI suggested score SHALL be clamped to the selected level's legal one-decimal interval.

#### Scenario: Evaluator output is invalid
- **WHEN** evaluator output is malformed, uses the wrong schema for the frozen detailed-rubric flag, references unsupported scoring items, levels, or evidence anchors, exceeds the applicable score range, or violates safety constraints
- **THEN** the draft SHALL NOT be approved or written back automatically
- **AND** the workbench SHALL expose a retry or blocked-evaluator state for teacher review.

### Requirement: Teacher review governs feedback and writeback
Teacher review SHALL remain the governing step for student feedback and learner-profile writeback.

#### Scenario: Teacher edits a criterion assessment
- **WHEN** a teacher changes score, rationale, evidence anchor, or an applicable detailed-rubric level before approval
- **THEN** the system SHALL preserve AI draft values and teacher-approved values
- **AND** it SHALL record the diff for quality metrics and audit.

#### Scenario: Teacher edits a scoring-item assessment
- **WHEN** a teacher changes score, rationale, evidence anchor, or an applicable detailed-rubric level before approval
- **THEN** the teacher score SHALL require one decimal place and remain between zero and the scoring-item maximum
- **AND** it SHALL NOT be clamped to the AI-selected level interval
- **AND** the system SHALL preserve AI draft values, teacher-approved values, and their diff for quality metrics and audit.

#### Scenario: Student feedback is generated
- **WHEN** grading is approved for student feedback
- **THEN** the student feedback SHALL include scoring-item results, evidence anchors, teacher-approved comments, and remediation action cards
- **AND** each action card SHALL link to a valid learner-record, path, resource, or practice destination.

### Requirement: Grading writeback is idempotent and auditable
Writeback SHALL include grading quality metadata.

#### Scenario: Writeback is audited
- **WHEN** approved grading creates learning facts or profile contributions
- **THEN** the audit SHALL include rubric version, evaluator version, teacher reviewer, AI/teacher delta, source anchors, and idempotency key
- **AND** repeated writeback SHALL NOT duplicate learner facts.

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

### Requirement: Question documents use immutable protected source assets
The system SHALL process only finalized question-bound submission assets that preserve object reference, ownership, assignment revision, question answer attempt, MIME, size, checksum, scan state, and timestamps.

#### Scenario: Eligible document enters conversion
- **WHEN** a supported asset is finalized, passes validation, and belongs to a submitted question answer
- **THEN** the system SHALL enqueue conversion using the immutable object reference and a deterministic dedupe key.

#### Scenario: Asset is unbound or unsafe
- **WHEN** an asset lacks a question answer, fails MIME or malware validation, exceeds policy, or is outside the caller's authorization scope
- **THEN** conversion SHALL be rejected before document content is read by a converter or external provider.

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
The system SHALL accept an AI grading draft only when every scoring-item assessment and annotation satisfies the schema selected by the frozen rubric version, the applicable score scale, and the conversion anchor schema.

#### Scenario: Evaluator returns a valid draft
- **WHEN** output satisfies the schema selected by the frozen rubric version and includes supported evidence anchors, rationale, confidence, limitations, and overall comment
- **THEN** the system SHALL persist the draft as awaiting teacher review.

#### Scenario: Evaluator returns a valid scoring-standard-only draft
- **WHEN** detailed rubric is disabled and output includes known scoring-item ids, in-range one-decimal scores, rationale, confidence, supported evidence anchors, location-aware annotations, limitations, and overall comment without requiring selected levels
- **THEN** the system SHALL persist the draft as awaiting teacher review.

#### Scenario: Evaluator returns a valid detailed-rubric draft
- **WHEN** detailed rubric is enabled and output includes known scoring-item ids, valid frozen level identities, level-clamped one-decimal scores, rationale, confidence, supported evidence anchors, location-aware annotations, limitations, and overall comment
- **THEN** the system SHALL persist the draft as awaiting teacher review.

#### Scenario: Evaluator output is invalid
- **WHEN** output uses a schema inconsistent with the frozen rubric version or detailed-rubric flag, references unknown scoring items, levels, or anchors, exceeds score ranges, lacks required evidence, contains malformed annotations, or violates safety constraints
- **THEN** the run SHALL enter a retryable or blocked-evaluator state
- **AND** no draft SHALL be approved, shown to students, or written back as governed evidence.

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

### Requirement: Grading data follows a versioned retention and deletion lifecycle
The system SHALL classify quarantine objects, source assets, rendered pages, Markdown/anchors, provider metadata, model inputs/outputs, AI drafts, approved derivatives, audit, and evidence records under a versioned lifecycle policy with explicit finite retention or governed record rules.

#### Scenario: Required lifecycle policy is incomplete
- **WHEN** an enabled deployment lacks a duration, deletion/anonymization rule, provider-retention value, or referential action for a required data class
- **THEN** new external processing and grading intake SHALL remain blocked rather than retaining data indefinitely by implication.

#### Scenario: Content reaches retention expiry
- **WHEN** source or derived content reaches its policy expiry without a legal or academic hold
- **THEN** the system SHALL cancel or fence in-flight consumers, persist `CONTENT_UNAVAILABLE` deletion intent and an auditable tombstone, delete only derived objects, remove direct identifiers and export payloads as required, and preserve only policy-permitted pseudonymous lineage
- **AND** a failed physical delete SHALL retain retryable state, while a later GC run SHALL finish an existing tombstone idempotently before marking final deletion state.

#### Scenario: Legal or academic hold applies
- **WHEN** an authorized actor places a hold with reason, scope, and expiry
- **THEN** deletion SHALL pause for covered records and objects while the hold and every later release remain audited.

#### Scenario: Parent user, class, or assignment is deleted
- **WHEN** a parent entity is archived, anonymized, or deleted
- **THEN** Prisma relations SHALL NOT cascade-delete submitted, graded, approved, or audited records
- **AND** lifecycle jobs SHALL apply the configured restrict, tombstone, content deletion, or pseudonymization action.

### Requirement: Retention deletion is object-complete and lease-fenced
The system SHALL claim each grading tombstone with a compare-and-set lease, recheck legal or academic holds at claim time, renew ownership during physical deletion, and require the claim token for every completion, retry, provider-retention, and failure update.

#### Scenario: One derived object fails after another succeeds
- **WHEN** object A is deleted and object B fails, then a later GC pass observes A as 404/not found
- **THEN** the later pass SHALL continue to attempt B
- **AND** the tombstone and database content references SHALL remain non-final until every object is deleted or confirmed absent.

#### Scenario: A stale tombstone owner resumes after lease takeover
- **WHEN** owner A's lease expires and owner B successfully claims the tombstone
- **THEN** owner A SHALL NOT be able to complete, retry, or overwrite the tombstone or content state with A's old token.

### Requirement: Worker ownership barriers cover external calls and persistence
The system SHALL check batch/item and job ownership before and after every provider or converter call and before durable stage writes. External adapters SHALL receive a stable idempotency key and abort signal where supported.

#### Scenario: Lease takeover occurs before a provider call
- **WHEN** a second worker takes the lease before Mathpix or AI evaluation starts
- **THEN** the first worker SHALL stop without sending a new request
- **AND** it SHALL not write a new owner's state.

### Requirement: Lifecycle redaction removes content and direct grading lineage
The system SHALL remove question, rubric, reference-answer, policy, exported-object, and direct answer/class/question/assignment/requester references from deleted or pseudonymized grading runs and batches, while active records SHALL fail closed if required snapshots or lineage are null.

#### Scenario: Delete-content and pseudonymize-lineage are applied
- **WHEN** an expired run or batch is processed under either strategy
- **THEN** both strategies SHALL remove sensitive snapshots and direct associations
- **AND** the tombstone SHALL distinguish content deletion from retained pseudonymous lineage.

### Requirement: Retention outcomes and provider retention are observable
The system SHALL represent governed retention, physical content deletion, pseudonymization, provider blocking, and legacy-policy blocking as distinct auditable outcomes.

#### Scenario: Provider deletion is not implemented
- **WHEN** a lifecycle policy requires provider retention but no provider deletion adapter exists
- **THEN** the tombstone SHALL record the provider deadline, blocked request state, and safe reason
- **AND** local processing SHALL fail closed without claiming provider deletion.

#### Scenario: Legacy record lacks expiry or policy evidence
- **WHEN** evidence, conversion, run, batch, or text-snapshot GC encounters a record without a provable lifecycle policy and expiry
- **THEN** it SHALL mark the record blocked and write an audit event rather than silently retaining it indefinitely.

### Requirement: Audit history is distinct from command idempotency
The system SHALL assign each audit event a traceable identity independent of command idempotency, preserving retry, attempt, and error history without storing answer bodies, secrets, or raw identifiers.

#### Scenario: A command is retried after a provider failure
- **WHEN** the same idempotent command produces multiple attempts or provider errors
- **THEN** each audit event SHALL retain a distinct traceable identity and safe attempt/error metadata
- **AND** command replay SHALL remain idempotent without collapsing the retry history into one fixed audit event.

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

### Requirement: Phase-three retention queries and ownership barriers are schema-complete
Retention GC SHALL query the actual Prisma lifecycle fields for every governed record type and SHALL use claim-token/lease CAS barriers before physical deletion, provider calls, completion, and retry.

#### Scenario: A finite record reaches expiry
- **WHEN** an evidence, conversion, run, or batch row has a non-null `retentionExpiresAt` at or before the GC time
- **THEN** GC SHALL treat it as eligible using the row's frozen lifecycle policy fields
- **AND** it SHALL NOT classify the row as missing-retention-expiry.

#### Scenario: A governed record has no expiry
- **WHEN** a row has no expiry and its frozen policy is `retain-governed-record` with a non-empty governed-record rule
- **THEN** GC SHALL retain it as governed content
- **AND** it SHALL NOT physically delete or mark the record as deleted.

#### Scenario: A lease is lost during deletion
- **WHEN** a heartbeat or ownership CAS update returns zero rows, or a hold appears after claim
- **THEN** the worker SHALL mark ownership lost and stop before the next store/provider operation
- **AND** the previous owner SHALL not complete, retry, or overwrite the new owner's state.

### Requirement: Provider retention and batch association cleanup fail closed
Provider deletion SHALL use frozen retention seconds, a stable request key, deadline, and abort signal where supported. Active batch items and jobs SHALL be made observable as blocked/content-unavailable before nullable grading associations are cleared.

#### Scenario: Provider deletion is required but no adapter exists
- **WHEN** a tombstone has a positive frozen provider-retention window and no deletion adapter is configured
- **THEN** the tombstone SHALL remain explicitly `BLOCKED` with a safe reason and deadline
- **AND** local deletion SHALL not claim that provider deletion completed.
- **AND** local expired content SHALL still follow its own deletion policy; the tombstone SHALL retain the provider locator and remain retryable until provider deletion is confirmed.

#### Scenario: A batch item loses its attempt or evidence association
- **WHEN** retention cleanup clears an association while the item or parent job is converting or grading
- **THEN** the item SHALL become `BLOCKED`, the parent job SHALL become `CONTENT_UNAVAILABLE`, and worker claims SHALL be cleared
- **AND** a worker SHALL not invoke Prisma with a null attempt id or report the condition as an opaque parameter failure.

### Requirement: Phase-three privacy repair removes historical direct identifiers
Historical audit repair SHALL not retain raw resource, class, assignment, answer, provider, request, or content-bearing metadata when safe HMAC backfill is unavailable. Source-asset physical deletion or pseudonymization SHALL clear direct lineage, original filename, finalization key, access-token associations, and object references atomically with the fenced tombstone completion.

Submission-object tombstones SHALL retain a stable opaque lookup key derived from the pre-redaction object key. Terminal completion SHALL clear the raw object key and checksum for delete-content as well as pseudonymization, and the lifecycle lookup key SHALL remain stable when the rotatable audit secret changes.

#### Scenario: Historical audit rows cannot be safely HMAC-backfilled
- **WHEN** the migration finds existing audit rows without a trusted HMAC key or provenance
- **THEN** it SHALL replace raw identifiers with opaque redaction markers or nulls, replace content-bearing metadata, and record a redaction count
- **AND** it SHALL preserve only the minimum audit outcome needed for operational accountability.

#### Scenario: A run has two model objects and the first delete partially succeeds
- **WHEN** deletion of one `GradingRun` model object succeeds and the other fails
- **THEN** the tombstone SHALL remain retryable without restoring the deleted object
- **AND** a later run SHALL independently confirm the first object absent and delete the remaining object before final completion.

### Requirement: Phase-four GC uses frozen lineage and retention metadata
Quarantine, revoked, and source-asset GC SHALL resolve asset, answer, attempt, assignment revision, assignment, and class scopes when available. Finalized source-asset GC SHALL interpret source retention only from the asset's frozen policy fields; quarantine and revoked cleanup SHALL use the independent quarantine lifecycle.

#### Scenario: A legal hold covers a parent scope
- **WHEN** a class, assignment, answer, or other resolved parent scope is held before claim, during heartbeat, or before completion
- **THEN** physical deletion SHALL stop when it has not yet occurred and the tombstone SHALL remain retryable or blocked
- **AND** if the object was already physically removed, the phase-five `DELETED_WITH_HOLD`/`CONTENT_UNAVAILABLE` outcome SHALL preserve that fact without restoring access.

#### Scenario: A finalized source asset predates the current enabled policy
- **WHEN** the finalized asset freezes policy version `v1` and the current enabled policy is `v2`
- **THEN** GC SHALL use the asset's frozen strategy, expiry, seconds, and governed-record rule
- **AND** it SHALL not reinterpret the asset using `v2`.

#### Scenario: Frozen source retention fields are incomplete
- **WHEN** any frozen policy identifier, version, strategy, or required finite-retention field is absent
- **THEN** GC SHALL create an auditable `BLOCKED` outcome and retain the object
- **AND** it SHALL never default to `delete-content`.

### Requirement: Phase-four leases and projections are monotonic and schema-complete
All grading, batch-item, and source-asset lease renewals SHALL use a live current time, require owner token/state/lease CAS conditions, and never write an earlier claim or expiry value. Retention selects SHALL explicitly include every lifecycle field used by the decision.

#### Scenario: A renewal completes after a slow call
- **WHEN** a worker renews after another heartbeat has already extended its lease
- **THEN** the renewal SHALL preserve or extend the later claim and expiry values
- **AND** a stale token or expired lease SHALL not renew.

#### Scenario: A Prisma projection omits a lifecycle timestamp
- **WHEN** a retention query returns a projection without `textSnapshotExpiresAt`
- **THEN** the projection contract test SHALL fail before deletion logic can run.

### Requirement: Phase-four content-unavailable, provider, object, and pseudonymization boundaries are explicit
Nullable asset/attempt/class/revision associations and `CONTENT_UNAVAILABLE` parents SHALL produce an explicit 410 or blocked result across conversion, batch, retry, cancel, status, and worker entrypoints. Rendered DOCX bytes SHALL be written through the submission object store with ownership and abort semantics, and provider retention SHALL use real provider identity and deletion handles.

#### Scenario: A rendered conversion loses its lease after upload
- **WHEN** rendered bytes were written under a stable owned key and the worker lease is lost before persistence
- **THEN** the worker SHALL remove or quarantine only the owned orphan and SHALL not silently discard the rendered artifact.

#### Scenario: A provider deletion locator is unavailable
- **WHEN** positive provider retention is frozen but provider identity, request id, deletion handle, or adapter capability is missing
- **THEN** the tombstone SHALL remain visibly `BLOCKED` with a safe reason
- **AND** local deletion SHALL not be reported as provider deletion.

#### Scenario: Pseudonymization completes
- **WHEN** a grading or submission object tombstone completes under `pseudonymize-lineage`
- **THEN** raw resource/object keys and direct checksums SHALL no longer be stored in the tombstone
- **AND** source-asset answer/attempt ids, original name, finalization key, access tokens, and checksum SHALL be cleared.

#### Scenario: Object storage returns a 404-like error
- **WHEN** the response has an explicit object-missing code such as `NoSuchKey`
- **THEN** GC MAY treat that object as absent
- **BUT** bucket-missing, endpoint, or generic transport failures SHALL remain retryable and SHALL not complete the tombstone.

### Requirement: Phase-five deletion barriers record physical deletion truth
Source-asset and quarantine GC SHALL pass an abort signal to object deletion and SHALL fence the delete with the current owner token and all resolved hold scopes before and after the store call.

#### Scenario: A parent hold appears after the object is physically deleted
- **WHEN** the post-delete ownership barrier observes a new hold or a lost claim
- **THEN** the asset SHALL become `CONTENT_UNAVAILABLE`
- **AND** the object tombstone SHALL become `DELETED_WITH_HOLD` with `physicalDeletedAt`, a safe error code, and an audit event
- **AND** the system SHALL not restore the asset to a usable or merely retryable state as if the object were preserved.

#### Scenario: A hold or owner fence is observed before deletion
- **WHEN** the pre-delete barrier or an abortable delete observes a hold or lost owner before physical deletion
- **THEN** the store call SHALL stop or be skipped
- **AND** the claim SHALL remain auditable and eligible for a later controlled retry without claiming physical deletion.

#### Scenario: Retention is governed by a long-term record rule
- **WHEN** the frozen source policy is `retain-governed-record` with a valid governed-record rule and no finite expiry
- **THEN** GC SHALL persist `RETAINED` and SHALL not call `SubmissionObjectStore.delete`.

### Requirement: Phase-five lease renewal is a monotonic database CAS
All grading-job, grading-tombstone, batch-item, and source-asset lease renewals SHALL use an atomic database update whose predicate requires the current owner/state and only accepts a proposed clock later than the stored clock.

#### Scenario: Two heartbeats interleave
- **WHEN** a slower heartbeat writes after a later heartbeat has extended the same lease
- **THEN** the slower `updateMany` SHALL affect zero rows or preserve the later value
- **AND** a reread MAY recognize the later owner clock but SHALL not write the stale snapshot back.

#### Scenario: A stale owner renews after takeover
- **WHEN** another worker has changed the claim token
- **THEN** the stale renewal SHALL return false and SHALL not change the new owner's expiry or claimed timestamp.

### Requirement: Provider deletion locators are safe and persisted
Provider runtime results and `GradingRun` SHALL persist only a provider identity, provider request id, and deletion handle needed for provider deletion; secrets, prompts, payloads, and credentials SHALL not be stored in these fields.

#### Scenario: A provider returns a deletion locator
- **WHEN** grading completes with positive provider retention and a provider request id or deletion handle
- **THEN** the real locator SHALL be copied to the run and the tombstone
- **AND** the retention adapter SHALL receive that provider and locator rather than an internal resource key.

#### Scenario: Positive provider retention has no locator
- **WHEN** the provider returns a valid grading result but neither a request id nor deletion handle
- **THEN** the run and job SHALL become visibly `BLOCKED` with `provider-deletion-locator-missing`
- **AND** local GC SHALL not wait indefinitely for an unaddressable provider deletion.

### Requirement: Phase-five lifecycle blocks are persisted and observable
Missing frozen lifecycle policy id/version/strategy, required retention seconds/expiry, or governed-record rule SHALL persist a block timestamp and reason on the affected evidence, conversion, run, batch, or text-snapshot record as well as an audit event.

#### Scenario: A legacy record lacks lifecycle proof
- **WHEN** GC encounters an evidence, conversion, run, batch, or text snapshot without policy/expiry proof
- **THEN** it SHALL set `lifecycleBlockedAt` and `lifecycleBlockReason` (or the model's equivalent terminal blocked/content-unavailable state)
- **AND** later GC, worker, control, and approval paths SHALL not consume the row as ready, succeeded, or awaiting review.

### Requirement: Phase-five lineage and rendered orphan cleanup fail closed
`resolveGradingLineage` SHALL return an empty relation only for an explicit missing-row result. Rendered orphan cleanup SHALL verify attempt identity and worker-claim identity for the current stable-key object before deleting it.

#### Scenario: Lineage storage fails
- **WHEN** a Prisma or database error occurs while resolving lineage
- **THEN** the error SHALL propagate and the deletion operation SHALL stop
- **AND** the error SHALL not be converted into an empty scope set.

#### Scenario: Ownership is lost after rendered upload
- **WHEN** rendered bytes are uploaded and the next ownership check fails
- **THEN** cleanup SHALL be reachable and SHALL delete only an object whose owner, attempt identity, checksum, and worker-claim fingerprint match the uploading worker
- **AND** a replacement owner on the same stable key SHALL remain untouched.

#### Scenario: Orphan cleanup itself fails
- **WHEN** the cleanup delete fails for a non-missing reason
- **THEN** the system SHALL create an auditable retryable tombstone with a safe error code
- **AND** it SHALL not silently swallow the cleanup failure.

### Requirement: Phase-five missing-object classification remains narrow
Object storage errors SHALL be treated as missing only when an explicit object-missing code/name identifies the object; bucket, endpoint, authorization, and generic transport failures SHALL remain failures.

#### Scenario: A bucket or endpoint returns a 404-shaped error
- **WHEN** the error lacks an explicit object-missing code
- **THEN** GC SHALL retain retryable/error state and SHALL not finalize the tombstone as deleted.

### Requirement: Phase-six lifecycle policy snapshots are mutually exclusive and immutable
Lifecycle policy records SHALL use either a positive finite retention with a non-retain delete strategy and no governed-record rule, or a retain-governed-record strategy with no finite retention/expiry and a non-empty versioned governed-record rule. Runtime GC SHALL use only the frozen record/tombstone fields and SHALL not supplement them from the current policy.

#### Scenario: A finite policy carries a governed rule
- **WHEN** a policy has positive `retentionSeconds` and `retain-governed-record` or a non-empty governed rule
- **THEN** validation and persistence SHALL reject it.

#### Scenario: A governed record lacks its rule
- **WHEN** a retain-governed-record row has a null/blank rule or finite expiry
- **THEN** the row SHALL be blocked and SHALL not be consumed by GC.

### Requirement: Legacy lifecycle blocking preserves content and freezes durable work
The phase-six migration and runtime legacy-block path SHALL preserve historical text snapshots, write an audit/block fact, freeze related `GradingBatchItem` rows as `BLOCKED`, freeze related queue jobs as `CONTENT_UNAVAILABLE`, clear all claims/leases, and block active parent batches in one transaction.

#### Scenario: A historical text snapshot has no lifecycle proof
- **WHEN** migration or GC encounters a non-null snapshot without a complete frozen policy
- **THEN** the snapshot text SHALL remain unchanged, the attempt SHALL be blocked and audited, and related item/job consumption SHALL be stopped.

### Requirement: Provider retention starts from persisted provider time
Provider retention deadlines SHALL be calculated from persisted provider request/processed time on the conversion or run and SHALL be copied to the tombstone. GC time SHALL never be used as the deadline origin. Positive retention without a locator, start time, or production deletion adapter SHALL remain blocked.

#### Scenario: GC runs after provider processing
- **WHEN** a conversion has a provider processed timestamp and positive provider retention
- **THEN** its tombstone deadline SHALL equal that timestamp plus the frozen provider seconds, independent of the GC invocation time.

### Requirement: Physical deletion facts survive hold and owner takeover
After an object store delete succeeds, an old-owner CAS failure or newly observed hold SHALL converge the asset to `CONTENT_UNAVAILABLE` and the tombstone to `DELETED_WITH_HOLD`, preserving `physicalDeletedAt` and an audit event. The path SHALL not silently return the row to ordinary `RETRYABLE` or `DELETED`.

#### Scenario: A new owner replaces the old deletion lease
- **WHEN** the old owner loses its CAS after physical deletion
- **THEN** a reconciliation path SHALL record the physical deletion fact and the new owner/recovery path SHALL inherit the hold outcome.

### Requirement: Rendered artifacts are claim-specific and cleanup is observable
Rendered object keys SHALL include conversion, attempt, and worker-claim identity. Cleanup after upload SHALL verify owner, attempt, checksum, and claim fingerprint; a replacement owner SHALL never be deleted. Cleanup mismatch/failure SHALL create a retryable tombstone and audit event.

#### Scenario: A replacement owner occupies the old key
- **WHEN** post-upload ownership validation fails
- **THEN** cleanup SHALL not delete the replacement object and SHALL persist an observable retryable orphan record.

### Requirement: Exhausted BullMQ attempts settle before claim clearing
The worker SHALL atomically fence a durable job by its attempt identity, settle failed/blocked child and parent records while the token is held, and clear the claim token only in the terminal update. Failure handling SHALL not require a previously cleared token to create the terminal state.

#### Scenario: The final BullMQ attempt fails
- **WHEN** `attemptsMade` reaches the configured maximum
- **THEN** the durable job SHALL be `FAILED` or `BLOCKED`, related records SHALL be terminal/blocked, and the final update SHALL clear the exact token; a stale token SHALL affect zero rows.

### Requirement: Phase-six verification is explicit and failure-closed
Migration static checks SHALL cover snapshot preservation, active job/item freezing, policy mutual exclusion, and identifier limits. The real PostgreSQL script SHALL cover historical content, token state, lease/hold takeover, and policy checks, and SHALL exit with code 2 without an explicit `DATABASE_URL` without loading dotenv.

#### Scenario: The PostgreSQL integration gate has no database URL
- **WHEN** the phase-six retention script starts without an explicit `DATABASE_URL`
- **THEN** it SHALL exit with code 2 before importing any dotenv-backed repository wrapper
- **AND** the static migration gate SHALL still pass.

### Requirement: Grading physical deletion facts are object-complete and hold-safe
For each AnswerEvidence, DocumentConversion, or GradingRun object key, the lifecycle SHALL persist an independent deletion fact. A successful delete or explicit object-missing result SHALL record its physical deletion time. A post-delete ownership CAS failure caused by a hold or takeover SHALL reconcile without the old claim token to `DELETED_WITH_HOLD`, persist the physical fact and reason, and mark associated grading content unavailable.

#### Scenario: One derived object fails while a later object is deletable
- **WHEN** deletion of one object returns a non-missing error in a multi-object resource
- **THEN** that object SHALL be recorded as retryable
- **AND** later object keys SHALL still be attempted and recorded independently.

#### Scenario: Ownership is lost after one object is physically deleted
- **WHEN** a hold or replacement owner makes the post-delete CAS fail
- **THEN** the deleted object SHALL be recorded as `DELETED_WITH_HOLD` with `physicalDeletedAt`
- **AND** the parent tombstone SHALL not be downgraded to ordinary `RETRYABLE` or lose the deletion fact.

### Requirement: Historical audit redaction preserves bounded runtime semantics
The phase-three `GradingAuditEvent` migration SHALL redact only fields outside an explicit safe-runtime allowlist. It SHALL preserve retry, attempt, state, duration, and safe error-code semantics, retain a monotonic redaction marker/count, and remove raw request hashes, provider locators, direct identifiers, and content-bearing metadata without requiring historical HMAC material.

#### Scenario: A historical event contains safe and raw fields
- **WHEN** metadata contains `attempt`, `retryable`, and `errorCode` alongside a request hash or raw content marker
- **THEN** the bounded safe fields SHALL remain in the redacted runtime projection
- **AND** the raw fields and direct provider/request identifiers SHALL not remain.

### Requirement: Source-asset claims are frozen-tuple and current-time CAS decisions
Finalized source-asset deletion SHALL re-read the current row under lock and SHALL include the complete frozen lifecycle tuple (`retentionPolicyId`, version, delete strategy, retention seconds, expiry, and governed-record rule) plus current-time eligibility in the claim CAS. A policy change or finite retention deadline that has not arrived SHALL abandon the source claim. `QUARANTINED` and `REVOKED` uploads SHALL instead use their independent quarantine expiry or abandoned-upload cutoff and SHALL not be blocked by a future finalized-source retention deadline.

#### Scenario: Policy changes between scan and claim
- **WHEN** any frozen lifecycle tuple member differs after the scan
- **THEN** the database claim SHALL affect zero rows
- **AND** the asset SHALL remain available for a later scan under its current persisted policy.

#### Scenario: Finalized source retention is not yet due at lock time
- **WHEN** a finalized source-asset scan is old enough by a fallback but the current finite `retentionExpiresAt` is later than now
- **THEN** the claim SHALL be abandoned
- **AND** no object-store deletion or deletion tombstone completion SHALL occur.

### Requirement: Reverse grading lineage cannot re-attribute tombstoned content
Deleting or pseudonymizing an evidence, conversion, run, or batch SHALL clear every no-longer-valid reverse foreign-key association in `GradingJob`, `GradingRerun`, `GradingBatchItem`, and related grading records. Direct content hashes, checksums, object keys, and student-attribution ids SHALL be removed or purpose-scoped pseudonyms. Teacher-review markers and purpose-limited aggregate statistics SHALL remain when required by policy.

#### Scenario: A run and its queue graph are tombstoned
- **WHEN** a run, evidence, or conversion becomes content-unavailable
- **THEN** jobs, reruns, batch items, and reverse run/evidence/conversion links SHALL no longer resolve to the student content
- **AND** terminal item/job state, teacher review time, and approved statistical totals SHALL be preserved where required.

### Requirement: Parent expiry SHALL not consume a later-retained grading child
When AnswerEvidence, DocumentConversion, or GradingBatch reaches its own frozen expiry, the lifecycle SHALL detach only unsafe upstream associations and SHALL mark later-retained GradingRun, GradingBatchItem, GradingJob, and GradingRerun records `CONTENT_UNAVAILABLE`/`BLOCKED` as applicable. It SHALL preserve their own model object keys, provider locators, safe model input/output handles, dedupe/idempotency keys, and future deletion handles until each child reaches its own lifecycle decision. A child SHALL be fully redacted only when its own policy is due and permits that strategy.

#### Scenario: Parents expire before a retained run
- **WHEN** evidence, conversion, and batch tombstones are due but the run's frozen retention is later
- **THEN** the first GC pass SHALL leave the run's model input/output and provider deletion handles present and SHALL not mark the run as deleted
- **AND** a later GC pass after the run's own expiry SHALL delete the run's handles and associated objects.

### Requirement: Grading object timestamps SHALL use the current delete input
`GradingTombstone.physicalDeletedAt` MAY retain the parent aggregate physical-delete fact, but each `GradingTombstoneObject.physicalDeletedAt` and `deletedAt` SHALL be written from the current object's `physicalDeletedAt` input.

#### Scenario: Two object facts have different delete times
- **WHEN** object T1 and object T2 are reconciled with different physical-delete inputs
- **THEN** T1 and T2 SHALL retain their respective input timestamps
- **AND** neither child fact SHALL inherit a stale parent aggregate timestamp.

### Requirement: Historical audit redaction SHALL preserve bounded producer error semantics
Phase-three `GradingAuditEvent` redaction SHALL map a producer `metadata.error` or a valid `metadata.errorCode` into `safeRuntime.errorCode` only when it matches the bounded safe code character set and length. It SHALL preserve the approved attempt/retry/error/state/status/outcome/stage/duration/latency fields and safe `policyVersion`, `deleteStrategy`, `blockedReason`, and `provider` enums when present. These allowed fields SHALL be excluded from `redactedFields`; raw ids, request hashes, provider locators, and content-bearing fields SHALL be removed.

#### Scenario: A producer writes an object-store deletion error
- **WHEN** historical metadata contains `{attempt: 2, error: 'object-store-delete-failed'}`
- **THEN** the redacted projection SHALL contain `safeRuntime.errorCode = 'object-store-delete-failed'` and `attempt = 2`
- **AND** it SHALL not retain arbitrary raw text or list `error` among the redacted fields.

### Requirement: Terminal delete-content tombstones SHALL retain a safe lookup identity
When `lineageRetained = false`, a terminal delete-content tombstone SHALL not expose its original `resourceId` or `resourceKey`. It SHALL persist a stable opaque operation identity and a separate unique lookup key derived from the pre-redaction key. Lifecycle lookup, claim fencing, and repeated completion SHALL resolve the existing row through that lookup key and SHALL remain idempotent.

#### Scenario: GC revisits a terminally redacted tombstone
- **WHEN** a later GC pass looks up the original resource after delete-content completion
- **THEN** it SHALL find the existing terminal tombstone through its stable lookup key
- **AND** it SHALL not create a second tombstone or repeat object deletion.

### Requirement: Quarantine cleanup SHALL be independent from finalized source retention
`QUARANTINED` and `REVOKED` uploads that pass their quarantine expiry or abandoned-upload cutoff SHALL be deleted under quarantine purpose even when a future source-asset retention deadline exists. `FINALIZED` source assets SHALL continue to use the complete frozen source policy tuple, including retain-governed-record behavior.

#### Scenario: An abandoned quarantine precedes source retention
- **WHEN** a quarantined upload is past its quarantine deadline but its source-asset retention expiry is in the future
- **THEN** quarantine GC SHALL delete the quarantined object and write a delete-content tombstone
- **AND** it SHALL not remain permanently blocked waiting for source retention.

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
