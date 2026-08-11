## Context

Issue #1157 introduced immutable `WrongAnswerAttribution` records that bind an incorrect adaptive-assessment answer to one canonical knowledge node and one misconception when the governed evidence is unambiguous. Issue #1158 consumes that record to assemble a short remediation activity from existing platform resources and assessment items.

The current resource and assessment models carry extensible governed metadata in `TeachingResource.config` and `AdaptiveAssessmentItemRef.metadata`. The implementation must preserve their immutable hashes/versions, enforce learner ownership, avoid exposing answer material, and fail closed when a reference cannot be proven current and accessible.

## Goals / Non-Goals

**Goals:**

- Produce deterministic, idempotent remediation orchestration from an owned attribution.
- Persist a complete 5–10 minute task or a sanitized unavailable result.
- Bind every selected resource and validation question to a governed version.
- Recheck ownership, authorization and version integrity on retrieval.
- Keep the learner projection free of answers, explanations, raw evidence and teacher-private data.

**Non-Goals:**

- Measuring final intervention effectiveness.
- Mutating mastery, learner paths or recommendations automatically.
- Generating assessment questions with an LLM.
- Adding teacher aggregation or management UI.

## Decisions

### Persist one immutable orchestration result per attribution and orchestrator version

`RemediationOrchestrationResult` uses `(wrongAnswerAttributionId, orchestratorVersion)` as its idempotency key. An `AVAILABLE` row stores a complete task snapshot; an `UNAVAILABLE` row stores only a controlled reason and governed manual-practice path. Upsert uses an empty update so concurrent retries converge without rewriting history.

Alternative considered: compute on every read. Rejected because catalog changes would silently alter prior decisions and prevent reliable drift detection.

### Consume existing ResourceNode and assessment-catalog authority

`TeachingResource.config.remediation` may contribute only remediation-specific relevance tags. It cannot grant eligibility, visibility, duration, version or launch authority. The orchestrator builds the existing ResourceNode registry projection and accepts only audited `pathEligible` PlanningUnits with a verified launch/render target, `student-visible` privacy, available/allowed policy, complete evidence instrumentation, reviewed path-plannable disposition, governed estimated time and source version.

Validation candidates are discovered through the production-written `metadata.adaptiveAssessmentItemRef.semanticRefs.graphNodeIds`, not through optional remediation extensions. The persisted answer-time snapshot is rebound to `findAdaptiveAssessmentCatalogSnapshot(questionId)` and checked with `evaluateAssessmentEvidenceSnapshotWithCurrentCatalogAuthority(..., { requestedStage: 'remediation' })`. The current catalog must retain remediation authority, content and version agreement, human semantic review, `path-eligible` state and stage permission. Optional `metadata.remediationValidation` fields may refine relationship or duration but cannot establish candidate existence or authority; absent optional metadata uses the versioned orchestrator's canonical adaptive-practice launch and validation duration.

Malformed, provisional, stale, private, broken or incomplete authority excludes the candidate. No candidate data is inferred from titles or free text, and neither remediation metadata block can create a parallel eligibility path.

Alternative considered: add dedicated catalog tables or self-asserted eligibility fields in this issue. Rejected because the existing ResourceNode and assessment catalog already own authoritative versioning, audit and eligibility semantics.

### Select candidates with deterministic tiers and a strict time budget

Resources are ordered by: exact knowledge-node plus misconception match, exact knowledge-node match, then declared prerequisite match. Stable version and ID resolve ties. The orchestrator chooses the first deterministic resource combination whose resource minutes plus validation minutes total 5–10 minutes.

Validation items must differ from the source question, target the same canonical node, and have either an optional isomorphic/variant relationship to the source item or the same reviewed catalog misconception reference. Stable ID resolves ties.

Alternative considered: model-based ranking. Rejected because it is not reproducible or suitable for governed validation.

### Separate stored evidence from learner projection

The persisted task contains opaque IDs, immutable versions/hashes, goal text derived from governed node metadata, duration and action paths. A separate learner projection copies only task version, goal, duration, learner resource actions and the validation-question reference; it excludes the source question ID, internal knowledge-node ID, misconception tag, correct answers, explanations, options, raw answer payloads and teacher-only fields. `UNAVAILABLE` results expose only a reason enum and a configured generic practice path.

### Authorize both creation and retrieval

Only the attribution owner may create or read an orchestration result. Creation filters out teacher-only or non-learner-visible resources and validation items. Retrieval loads the referenced records again and verifies their versions/hashes and learner visibility; revocation, deletion or drift yields a sanitized unavailable projection without mutating the stored row.

## Risks / Trade-offs

- [Catalog metadata is missing on existing content] → Return a precise unavailable reason and cover each exclusion path with tests; catalog backfill is outside this issue.
- [JSON metadata contracts can drift] → Parse narrowly, require explicit version fields and persist immutable hashes/versions.
- [Concurrent creation races] → Use a database unique constraint and empty-update upsert.
- [A stored task later loses access] → Revalidate on every read and fail closed without leaking the stale reference.
- [The strict 5–10 minute budget reduces availability] → Prefer truthful unavailable results over fabricated duration estimates.

## Migration Plan

1. Add the nullable-payload orchestration result table, enum checks and unique idempotency index.
2. Deploy the service and authenticated route; no backfill is required because orchestration is learner-triggered.
3. Rollback removes the route/service first. The additive table can remain inert or be removed by a follow-up migration after confirming no consumers remain.

## Open Questions

None.
