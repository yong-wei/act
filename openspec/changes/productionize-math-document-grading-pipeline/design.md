## Context

`document-rubric-grading-workbench.ts` already defines useful document, converted-block, rubric, grading-run, annotation, and teacher-review contracts. The current API still accepts document bytes through JSON, runs MarkItDown synchronously, persists generic `LearningEvidenceDraft` payloads, and defaults to a deterministic scaffold evaluator. It does not provide durable mathematical-layout fidelity, job orchestration, normalized text-answer evidence, real model evaluation, or production batch behavior.

The preceding assignment changes provide immutable assignment-question snapshots, independently submitted answer attempts, and a deployed `SubmissionObjectStore` with question-bound assets. This change consumes that contract, normalizes text and document answers into grading evidence, and productionizes conversion and AI draft grading while keeping teacher approval and student publication in the final series change.

## Goals / Non-Goals

**Goals:**

- Normalize a submitted text answer directly into immutable Markdown/span evidence without document conversion.
- Convert one question-bound document asset into canonical Markdown and honest location anchors asynchronously.
- Prefer Mathpix for formula-, scan-, or image-heavy work and retain a governed local fallback.
- Persist evidence, conversion, batch, grading, criterion, annotation, warning, retry, rerun, provider, and lifecycle metadata as durable records.
- Produce schema-validated AI grading drafts grounded in the exact question, answer, rubric, and submitted evidence.
- Support single and batch jobs with resumability, deduplication, explicit reruns, failure isolation, and operational visibility.
- Protect student answers and prevent unapproved machine output from becoming feedback or evidence.

**Non-Goals:**

- Selecting or deploying a second object-storage backend.
- Teacher review UI, approved derivative generation, or student feedback publication.
- Whole-assignment document segmentation.
- Mutating original uploads.
- Replacing the platform AI provider runtime with a grading-specific model client.

## Decisions

### 1. Normalize every submitted answer into immutable AnswerEvidence

`SubmissionAsset` and `SubmissionObjectStore` remain the immutable upstream source/access contracts. Add or materialize:

- `AnswerEvidence`: one answer attempt, source kind, source hash, canonical Markdown/blocks, anchor version, readiness, and limitation state. Text answers materialize it directly; document answers reference a completed conversion.
- `DocumentConversion`: asset, converter, version, state, dedupe key, output refs, confidence, precision, warnings, failure, and timestamps.
- `ConvertedBlock` or equivalent: canonical block, page, span, optional bbox, source kind, and precision.
- `GradingBatch`: scope, question, assignment revision, requester, progress, cancellation, and aggregate state.
- `GradingRun`: one answer attempt, rubric version, evaluator version, input hashes, rerun identity, state, limitation, and draft totals.
- `CriterionAssessment` and `GradingAnnotation`: schema-validated draft decisions and anchors.

A sealed text answer produces canonical Markdown and stable block/span anchors from its immutable text snapshot and content hash. It enters manual and AI queues through the same readiness contract as document answers, declares `text-native` precision, and does not require a conversion provider.

Alternative rejected: persisting text or base64 document bytes and workflow state in `LearningEvidenceDraft` is unsuitable for versioning, large files, retries, retention, and authorization.

### 2. Run conversion and grading asynchronously

Conversion and grading APIs enqueue jobs and return durable state rather than running expensive conversion or inference inside the request. Manual grading may open whenever `AnswerEvidence` is ready. AI grading additionally requires provider-processing policy and evaluator gates.

The same idempotency key always returns the original job/run. An explicit rerun creates a new rerun identity, records a reason, freezes the same or a new input/evaluator version, never overwrites prior runs, and requires an existing teacher review to explicitly adopt or reject it.

### 3. Route document conversion by evidence needs

The orchestrator detects format and content indicators, then selects:

1. DOCX: render to PDF for stable geometry and extract OOXML structure; use Mathpix for formula/image-heavy regions or pages.
2. PDF or image: use Mathpix when mathematical OCR or layout recovery is required.
3. Text-forward supported documents: use MarkItDown or another approved local adapter.
4. Provider-disabled or failed cases: retain local output if sufficient; otherwise mark conversion blocked for teacher intervention.

Provider request ids, version, latency, policy version, and retention-relevant metadata are recorded without logging document content, signed URLs, prompt/model bodies, direct student identifiers, or secret values.

### 4. Make anchor precision explicit

Canonical output includes Markdown plus an anchor map. Each block declares the strongest supported precision: `bbox`, `span`, `block`, or `page`. The UI and evaluator may cite only that precision or a coarser one. If a converter cannot prove exact text or geometry, it records a warning and must not create fake inline coordinates.

### 5. Evaluate one frozen question answer at a time

Every `GradingRun` binds one assignment question snapshot and one submitted answer attempt. The evaluator receives prompt/response rules, reference answer, immutable rubric/scale, relevant answer evidence, anchors, and declared limitations. It does not receive unrelated student answers or other questions' reference material.

Student content is untrusted data, remains separated from system/rubric instructions, cannot request tools, browsing, code execution, or external retrieval, and is covered by prompt-injection tests. Batch grading across students reuses the same frozen question/rubric/evaluator policy but creates independent runs.

### 6. Replace scaffold scoring with a provider-backed schema

Use the platform AI provider/runtime through a grading adapter. The versioned structured result contains criterion id, selected level or band, score, rationale, confidence, evidence anchors, annotations, limitations, and overall comment.

Server validation rejects unknown criteria, out-of-range totals, unsupported anchors, missing evidence, malformed annotations, or unsafe content. Rejected output becomes `blocked-evaluator` or retryable failure. The deterministic evaluator remains only as an explicit fixture/test adapter and cannot be the production default.

### 7. Make batch grading observable and failure-isolated

Teachers may request a batch for one question across eligible submitted answers. The batch freezes question, rubric, evaluator, and policy versions and stores item-level progress. A failed answer blocks only its item; successful runs remain available. Queue concurrency, quotas, provider rate limits, cancellation, backoff, and recovery are explicit.

### 8. Use one failure-closed provider-processing policy

Mathpix and the AI evaluator are external processors governed by the same versioned policy. Before each request, policy must affirm purpose, data categories, minimized input scope, permitted institution/class, processing region and agreement version, training-use prohibition, provider retention window, deletion capability, and credential version. If any required field is absent or disallows processing, the system uses an eligible local path or enters a blocked state; it does not send data.

Credentials remain in server-side secret management and support rotation. All reads require role, class, assignment, answer, frozen/current grant, and purpose authorization. Audit uses purpose-scoped pseudonymous ids rather than direct student identifiers.

### 9. Define retention, deletion, and referential behavior

A versioned lifecycle policy classifies quarantine uploads, source assets, rendered pages, Markdown/anchors, provider metadata, model inputs/outputs, AI drafts, later approved artifacts, audits, and evidence records. The enabled deployment must provide a finite duration or governed long-term record rule for every class; missing policy blocks processing rather than implying indefinite retention.

- failed/in-flight artifacts expire through cancellation and orphan GC;
- source and derived content receive tombstones before physical deletion;
- legal or academic hold suspends deletion with actor, reason, scope, and expiry audit;
- student/class/assignment deletion never cascades submitted or approved records;
- retained lineage may be pseudonymized after content deletion while direct identifiers and export payloads are removed;
- jobs/outbox entries referencing deleted content terminate in auditable cancelled or content-unavailable states.

Prisma relations are restrictive across submitted answers, evidence, runs, and audits. Retention jobs, not cascade deletion, coordinate database tombstones and object deletion.

### 10. Protect every pipeline mutation

Conversion, batch, grading, retry, and rerun routes require authenticated non-GET requests, strict Origin/CSRF checks where cookie-authenticated, runtime schemas, bounded payloads, resource authorization, idempotency, and per-user/class/provider quotas. Workers use scoped service identities and purpose-bound object access rather than user bearer URLs.

AI grading remains draft-only. This change exposes no student-visible score and produces no high-confidence learner evidence.

## Risks / Trade-offs

- [Mathpix availability, cost, or policy changes] → Use a provider adapter, failure-closed policy, explicit blocked state, request accounting, and local fallback.
- [DOCX rendering differs from the student's editor] → Preserve original checksum/file, record renderer version, and let teachers compare original/rendered/Markdown forms.
- [Anchor drift between converters] → Version anchor maps and validate every citation against the exact evidence artifact.
- [Batch inference overloads workers/providers] → Apply queue concurrency, quotas, progress, cancellation, and backoff.
- [AI scoring varies across students] → Freeze question/rubric/evaluator/policy versions per batch and preserve confidence, rationale, and teacher review.
- [Text answers bypass document conversion] → Normalize them into the same immutable AnswerEvidence contract with native anchors.
- [Deletion creates orphan jobs or evidence] → Use restrictive relations, lifecycle tombstones, job cancellation, holds, and pseudonymized retained lineage.

## Migration Plan

1. Add AnswerEvidence, conversion, block/anchor, batch, run, criterion, and annotation persistence with restrictive relations, policy versions, tombstones, and retention fields.
2. Consume the upstream object-store adapter and add queue/job adapters; keep existing demo endpoints behind compatibility flags.
3. Add text-native evidence and local document conversion, then Mathpix routing and shared provider-policy controls.
4. Add provider-backed evaluation, untrusted-input isolation, and strict schema validation; keep deterministic evaluation only for fixtures/tests.
5. Add status, retry/rerun identity, dedupe, metrics, deletion/hold/GC jobs, mutation security, and privacy audit.
6. Enable per class only when provider/lifecycle policies are complete and text, DOCX, formula, image, failure, authorization, deletion, and batch tests pass.

Rollback stops job intake and disables external/model adapters while retaining immutable source and completed artifact records under lifecycle policy. In-flight jobs move to an explicit blocked or cancelled state.

## Open Questions

No product decision blocks proposal approval. Exact queue implementation should use the repository's existing worker infrastructure behind these contracts.
