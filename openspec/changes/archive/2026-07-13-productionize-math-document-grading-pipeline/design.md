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

Teachers may request a batch for one question across eligible submitted answers. The batch freezes question, rubric, evaluator, and both provider-policy identities: the existing `policyId/policySnapshot` remains the rubric-grading policy, while optional `conversionPolicyId/conversionPolicySnapshot` is reserved for Mathpix answer conversion. If no conversion policy is frozen, document items use the governed local path and never pass the grading policy to Mathpix. A failed answer blocks only its item; successful runs remain available. Queue concurrency, quotas, provider rate limits, cancellation, backoff, and recovery are explicit.

### 8. Use one failure-closed provider-processing policy

Mathpix and the AI evaluator are external processors governed by the same versioned policy. Before each request, policy must affirm purpose, data categories, minimized input scope, permitted institution/class, processing region and agreement version, training-use prohibition, provider retention window, deletion capability, and credential version. If any required field is absent or disallows processing, the system uses an eligible local path or enters a blocked state; it does not send data.

Credentials remain in server-side secret management and support rotation. All reads require role, class, assignment, answer, frozen/current grant, and purpose authorization. Audit uses purpose-scoped pseudonymous ids rather than direct student identifiers.

### 9. Define retention, deletion, and referential behavior

A versioned lifecycle policy classifies quarantine uploads, source assets, rendered pages, Markdown/anchors, provider metadata, model inputs/outputs, AI drafts, later approved artifacts, audits, and evidence records. The enabled deployment must provide a finite duration or governed long-term record rule for every class; missing policy blocks processing rather than implying indefinite retention.

- failed/in-flight artifacts expire through cancellation and orphan GC;
- source and derived content receive tombstones and `CONTENT_UNAVAILABLE` deletion intent before physical deletion; failed deletes remain retryable and a later GC run completes an existing tombstone idempotently;
- legal or academic hold suspends deletion with actor, reason, scope, and expiry audit;
- student/class/assignment deletion never cascades submitted or approved records;
- retained lineage may be pseudonymized after content deletion while direct identifiers and export payloads are removed;
- jobs/outbox entries referencing deleted content terminate in auditable cancelled or content-unavailable states.

Prisma relations are restrictive across submitted answers, evidence, runs, and audits. Retention jobs, not cascade deletion, coordinate database tombstones and object deletion.

### 10. Protect every pipeline mutation

Conversion, batch, grading, retry, and rerun routes require authenticated non-GET requests, strict Origin/CSRF checks where cookie-authenticated, runtime schemas, bounded payloads, resource authorization, idempotency, and per-user/class/provider quotas. Workers use scoped service identities and purpose-bound object access rather than user bearer URLs.

AI grading remains draft-only. This change exposes no student-visible score and produces no high-confidence learner evidence.

### 11. Close the phase-one retention and lease review findings

Retention GC treats every derived object as an independent deletion attempt. A missing object is a successful result for that object only; a non-404 failure leaves the tombstone retryable and prevents database finalization. Finalization is allowed only after the complete object list has been confirmed deleted or absent.

`GradingTombstone` uses the existing claim token and lease fields as a compare-and-set owner fence. Claim selection accepts only pending/retryable/blocked rows whose lease is absent or expired, and performs a second hold check in the claim path. Physical deletion renews the lease and checks ownership around each object operation. Completion, retry, provider-retention updates, and failure settlement all require the claim token.

Worker stages use the same ownership barrier before and after every provider or converter call and before durable stage writes. The barrier passes a stable hashed idempotency key and an `AbortSignal` to Mathpix, local conversion, and AI evaluation. A lost parent batch/item lease stops child work and prevents the old owner from settling a new owner's state.

Content deletion removes snapshots, policy payloads, exported object references, and nullable direct grading lineage fields. Batch deletion removes child item/job/rerun references and deletes the batch row when the restrictive foreign-key graph permits it; active rows still require their frozen snapshots and lineage fields. `RETAINED`, `BLOCKED`, and `DELETED` are distinct tombstone outcomes, and operational metrics report governed retention, content deletion, pseudonymization, and provider blocking separately.

Legacy records without a provable lifecycle expiry are explicitly blocked and audited. Provider retention without an implemented deletion adapter remains blocked with a deadline and safe reason; the local lifecycle may still delete its own expired content, but the tombstone remains `BLOCKED`/retryable with the frozen provider locator until provider deletion is confirmed. The system never records provider deletion merely because local objects were removed. Audit event identity is independent from command idempotency and includes a fresh trace identity so retry/attempt/error history is preserved without content or raw identifiers.

### 12. Close the phase-three data-governance gaps

The phase-three repair keeps the existing lifecycle and worker contracts, but makes their persisted inputs and ownership barriers complete:

- Retention GC selects the actual Prisma scalar fields (`retentionExpiresAt`, lifecycle policy id/version/strategy, and retention seconds) for evidence, conversion, runs, and batches. A finite expiry is eligible when reached; a null expiry is eligible only for a validated `retain-governed-record` policy with a non-empty governed-record rule. A governed record is retained and never treated as a delete candidate.
- Finalized source-asset GC uses the expiry/governed policy branch in both the outer query and the claim CAS. Quarantined/revoked uploads use their independent quarantine expiry or abandoned-upload cutoff and do not inherit a future source-asset retention deadline. Before physical deletion, after every lease renewal, and during completion, the owner token and lease are checked. A zero-row heartbeat update immediately aborts the store call; a hold observed during the barrier has the same effect.
- Provider deletion receives the frozen retention seconds, stable request key, deadline, and abort signal. The adapter call is fenced before and after invocation. A required adapter that is absent, or a missing frozen seconds value, records `BLOCKED` and does not claim provider deletion.
- Provider deletion is independent from local object deletion: an absent, waiting, or failed adapter records `BLOCKED`/retryable provider state while the local tombstone can complete its own expired-content deletion. The provider locator and lookup identity remain available for later retry.
- Retention finalization first moves active batch items and jobs to `BLOCKED`/`CONTENT_UNAVAILABLE`, clears worker claims, and only then removes nullable associations. Workers convert missing attempts or associations into observable blocked content states rather than retrying a null Prisma relation.
- Converter and evaluator workers perform a final parent job/item ownership check before external work, propagate abort signals while work is active, and check ownership again before durable writes. Stable idempotency keys remain unchanged across these barriers.
- The independent timestamp migration adds redaction counters, provider-retention snapshots, nullable redaction relations, and a safe historical audit repair. Because HMAC backfill cannot be assumed, legacy direct ids, provider ids, request hashes, and content-bearing metadata are replaced with opaque redaction markers or nulls.
- Physical source deletion clears direct answer/attempt lineage, original filename, finalization key, access tokens, and object references in the same fenced completion transaction. `GradingRun` deletion handles input and output model objects independently so a later retry can finish a partial delete.

The phase-three migration is additive and independently executable. Static checks cover migration identifier limits, schema/migration correspondence, redaction SQL, nullable relation changes, and the explicit-`DATABASE_URL` PostgreSQL CAS script.

### 13. Close the phase-four review blockers

Phase four preserves the phase-three contracts and makes the remaining deletion and worker edges explicit:

- Quarantine, revoked, and source-asset GC resolve the complete asset-to-answer-to-attempt-to-revision-to-assignment-to-class lineage. The hold set is checked before claim, before every heartbeat/store call, and in the final transaction. A hold observed before physical deletion leaves a controlled retryable outcome; phase five records `CONTENT_UNAVAILABLE`/`DELETED_WITH_HOLD` when the object has already been physically removed.
- Source-asset GC interprets only the asset's frozen retention policy id/version, strategy, seconds, expiry, and governed-record rule. It never reinterprets a historical asset with the latest enabled policy. A missing frozen field, including a finite expiry without a complete policy tuple, creates an auditable `BLOCKED` object tombstone and does not select a deletion strategy by default.
- Text-snapshot GC explicitly selects every lifecycle scalar it reads, including `textSnapshotExpiresAt`. Projection-enforcing tests fail if a field is removed from the Prisma select.
- Lease renewal uses the live clock and monotonic `claimedAt`/expiry values. CAS updates require the owner token, active state, and an unexpired lease; a slow renewal or stale owner cannot move a lease backwards or renew after takeover.
- Nullable cleanup is an explicit content-unavailable boundary. Conversion, batch, retry, cancel, status, and worker control paths return a 410/blocked result when asset, attempt, class, revision, or required content associations are null.
- Production conversion workers pass a stable, ownership-tagged, abortable rendered-byte writer backed by the submission object-store factory. `renderedObjectKey` is persisted only after the object is verified; lease loss deletes an owned orphan or leaves an observable blocked failure.
- Provider retention remains failure-closed. The adapter receives the real provider identity and provider request/deletion handle frozen on the tombstone. Without a locator or adapter, the tombstone is visibly blocked; an internal resource key is never presented as an external deletion handle.
- Pseudonymization replaces raw grading/object keys and direct checksums with purpose-scoped lineage references (or nulls), and source-asset completion clears answer/attempt ids, original name, finalization key, access tokens, and checksum. Only an explicit object-missing code/response is treated as absent; bucket or endpoint failures remain retryable.
- The independent timestamp migration is additive, uses a PostgreSQL-safe name, and contains an explainable terminal-row redaction. Static checks cover schema/migration/index correspondence; the PostgreSQL CAS script refuses to load dotenv or connect without an explicit `DATABASE_URL`.

### 14. Close the phase-five data-governance blockers

Phase five keeps the phase-four ownership and lifecycle contracts, and makes the ambiguous race outcomes explicit:

- Submission-object deletion accepts an `AbortSignal`. The worker performs a token-and-hold barrier before and after the physical delete. If a hold or owner fence is observed after physical deletion, the asset becomes `CONTENT_UNAVAILABLE` and its object tombstone becomes `DELETED_WITH_HOLD`, retaining the physical deletion timestamp and an audit reason. No path restores an inaccessible object to a usable state after that fact. A retained governed record never invokes `store.delete`.
- Grading job, grading tombstone, batch-item, and source-asset heartbeats use database `updateMany` compare-and-set predicates that require the owner token/state and only advance the live claim/expiry clock. A zero-row update rereads the token and clocks only to recognize a later winner; it never performs a stale read-then-write fallback.
- Provider runtime results carry only the safe provider identity, provider request id, and deletion handle. `GradingRun` persists these locator fields and tombstones receive them unchanged. Positive provider retention without a request id or deletion handle is explicitly `BLOCKED` before local deletion can be reported as provider deletion.
- Finalized source-asset GC uses the asset's frozen policy tuple and `sourceAssetLifecycleDecision`. Missing policy id/version, strategy, finite retention seconds/expiry, or governed-record rule produces a persisted blocked tombstone/state and audit event. `retain-governed-record` completes as `RETAINED` without touching object storage. Quarantined/revoked uploads use a separate quarantine lifecycle and are deleted when that quarantine deadline or abandoned-upload cutoff is reached, even if a future source-asset policy deadline exists.
- Legacy evidence, conversion, run, batch, and text-snapshot rows record `lifecycleBlockedAt` and `lifecycleBlockReason` in addition to the audit event, and move to an observable blocked/content-unavailable boundary before later GC or worker control can consume them as ready.
- Lineage resolution treats only an explicit not-found result as absent; database and Prisma failures propagate. Rendered orphan cleanup is reachable after the post-upload owner fence, carries attempt identity and a worker-claim fingerprint, verifies the current object's ownership metadata before delete, and creates a retryable tombstone/audit when cleanup fails. Object-missing classification remains limited to explicit object-missing codes.
- The phase-five timestamp migration is additive and independently executable. The real-PostgreSQL script covers interleaved CAS renewals, stale-owner takeover, and a hold barrier, and exits before dotenv loading when `DATABASE_URL` is absent.

### 15. Close the phase-six lifecycle-safety blockers

Phase six is additive and preserves the phase-five migration history. The phase-five snapshot-block update only records the lifecycle block; it never writes `textSnapshot = NULL`. The independent phase-six migration adds the missing frozen governed-rule/provider-time fields, enforces the finite-versus-governed policy contract for new policy writes, and freezes all active item/job/batch associations in the same migration transaction. Unknown historical content remains present but is `BLOCKED`/`CONTENT_UNAVAILABLE`, audited, and unavailable to workers.

- Lifecycle decisions read only the immutable fields stored on the record (or its tombstone). A finite retention policy has a positive `retentionSeconds`, a non-retain delete strategy, and no governed-record rule. A governed record has no finite retention or expiry and has a non-empty versioned rule. Current policy rows cannot repair a historical record with missing fields.
- Provider deadlines start at the persisted provider request/processed timestamp and are copied to the tombstone as `providerRetentionStartedAt`. A GC clock is never used as the start time. Positive provider retention without a real locator, start time, or production deletion adapter remains explicitly blocked.
- Physical deletion truth is monotonic across owner loss and takeover. A failed old-owner CAS is reconciled by object key into `DELETED_WITH_HOLD` and `CONTENT_UNAVAILABLE`, with the physical-delete timestamp and audit fact preserved. It cannot become ordinary `RETRYABLE` or `DELETED`.
- Rendered artifacts use conversion/attempt/claim-specific object keys. Post-upload ownership failure verifies owner, attempt, checksum, and worker-claim fingerprint before deleting. A mismatch or failed cleanup creates a retryable tombstone and audit record; replacement-owner objects are not touched.
- BullMQ failure settlement fences the durable job by the attempt identity, settles child and parent terminal state while the claim is held, and clears the token only in the terminal CAS. A failure listener does not depend on an already-cleared token to create the terminal state.
- The migration/static gate validates historical snapshot preservation, active association freezing, policy mutual exclusion, PostgreSQL identifier lengths, and explicit `DATABASE_URL` behavior. The real PostgreSQL script exercises the same legacy, lease, hold, policy, and token-state boundaries.

### 16. Close the issue #916 data-plane reconciliation blockers

The next repair remains additive and keeps the existing failure-closed provider, legacy snapshot, orphan-ownership, and exhausted-job contracts:

- Each derived grading object receives a child `GradingTombstoneObject` fact. A successful delete or explicit object-missing result is recorded with its own physical timestamp. If the post-delete owner CAS loses to a hold or takeover, reconciliation uses the resource key and object key without the old claim token, records `DELETED_WITH_HOLD`, and marks the affected grading content unavailable. Other object failures are recorded individually and do not skip later keys.
- Historical `GradingAuditEvent.metadata` is projected through a bounded allowlist. Retry, attempt, state, duration, and safe error-code fields remain available after redaction; raw request/provider/content keys are removed, direct identifiers are nulled, and the existing redaction marker/count is monotonic. The migration does not require an HMAC backfill.
- Finalized source claims re-read the current frozen policy tuple under the row lock. The CAS includes policy id/version, delete strategy, retention seconds, expiry, governed-record rule, and current-time eligibility. A changed tuple or not-yet-reached finite expiry abandons the claim. Quarantine/revoked claims instead fence on quarantine expiry or abandoned-upload age and do not wait for source-asset retention.
- Reverse grading relations are cleared by actual schema foreign keys. Jobs, reruns, batch items, run/evidence/conversion references, direct hashes, and content keys are removed or pseudonymized by purpose; teacher-review timestamps and approved statistical totals remain, while no tombstoned artifact can still attribute content to a student through a reverse relation.

The reconciliation migration adds only the child tombstone table and the durable hold outcome. Static fixtures cover the audit allowlist and migration correspondence; focused concurrency tests cover the lock-time policy recheck and post-delete takeover.

### 17. Close the issue #916 P0/P1 lifecycle-isolation blockers

The P0/P1 repair keeps the existing worker fences and failure-closed deletion semantics while separating parent expiry, child lifecycle, and terminal lookup identity:

- Expiry of AnswerEvidence, DocumentConversion, or GradingBatch may detach unsafe upstream foreign keys and mark downstream records `CONTENT_UNAVAILABLE`/`BLOCKED`, but it does not delete a later-retained GradingRun's model input/output keys, provider locators, batch-item evidence handles, job dedupe identity, or rerun identity. A downstream record is redacted only when its own frozen lifecycle is due and its strategy permits it.
- Parent tombstone timestamps may retain the aggregate physical-delete fact. Every `GradingTombstoneObject` records `physicalDeletedAt` and `deletedAt` from the current object-delete input, so two objects cannot inherit a stale parent timestamp.
- Historical audit redaction maps a strictly bounded producer `metadata.error` or `metadata.errorCode` into `safeRuntime.errorCode`, preserves the approved attempt/retry/error/state/status/outcome/stage/duration/latency and safe policy/delete/provider enums, and removes raw identifiers, request hashes, provider locators, and content fields. Allowed fields are excluded from `redactedFields`.
- A terminal delete-content tombstone replaces `resourceKey`/`resourceId` with stable opaque operation identities while retaining a separate unique `lookupKey` derived from the pre-redaction key. Repeated GC lookup therefore finds the existing terminal row and cannot recreate or repeat deletion work.
- Grading and submission-object tombstones use a dedicated stable lifecycle lookup secret, separate from the rotatable audit secret. Submission tombstone completion clears the raw object key and checksum for both delete-content and pseudonymization strategies while retaining only the opaque lookup identity.
- `QUARANTINED`/`REVOKED` abandoned uploads are governed by quarantine purpose and deadline independently of future source-asset retention. `FINALIZED` source assets continue to use their complete frozen source policy tuple and CAS.
- Provider locator/deadline and adapter failure-closed behavior, `DELETED_WITH_HOLD`, per-object retry/continue, source-claim frozen-tuple CAS, historical text snapshots, and exhausted-job token fencing remain unchanged.

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
