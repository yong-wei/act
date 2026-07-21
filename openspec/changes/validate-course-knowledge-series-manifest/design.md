## Context

The upstream manifests freeze current knowledge inputs, candidate identities/domains, semantic owners, cross-block queues, and atomic resource candidates. Final validation must prove those records are exact and dependency-complete while preserving ADR 0045's historical-fact boundary.

## Goals / Non-Goals

**Goals:**

- Validate the shared future-child schema, exact ownership, endpoint coverage, dependency closure, acceptance profiles, and digest freshness.
- Validate a bounded cutover record for new projection import, reviewed active legacy mappings, active-reference migration, legacy compatibility, and post-cutover new-fact revision binding.
- Keep the existing #947–#955 dependency topology unchanged.

**Non-Goals:**

- Historical `LearningFact` backfill, event replay, or evidence deduplication.
- Portrait, diagnosis, risk, growth, recommendation, class, or Arena reconciliation.
- Full-history decoder closure, polymorphic `sourceLogId` resolution, or full-root writer equality.
- Stage-two creation or production cutover.

## Decisions

### 1. Validate exact governance records

Every child record must remain placeholder-free, typed, digest-bound, uniquely owned, endpoint-complete, and linked through change-ID dependencies. Stage-two changes remain absent until validation passes.

### 2. Keep cutover readiness narrow

The cutover candidate lists new projection import, reviewed mappings, active references, legacy compatibility, and the new-fact revision-binding gate. Historical records retain their old or legacy revision and never enter the new manifest as rewritten facts.

### 3. Validate the post-cutover write boundary

At any instant exactly one new graph revision is active for new fact generation. A post-cutover fact write without that revision fails; unrelated historical producer or writer coverage does not affect readiness.

## Risks / Trade-offs

- [An out-of-scope historical item is supplied] → Reject it before readiness evaluation without building or validating a catalog.
- [An active reference is omitted] → Require complete reconciliation against the bounded inventory.
- [A future child is underspecified] → Reject placeholders, count-only queues, stale digests, and incomplete endpoints.

## Testing Strategy

Change class: medium-risk
Seam status: required
Public behavior: One validator accepts only exact preparation records and the bounded cutover contract.
Public seam: Run the series validator on synthetic malformed/valid manifests and the frozen stage-one outputs.
Existing seam reused: OpenSpec/Buddy proposal validators only; the series manifest validator is new.
AC coverage: fixtures cover schema fields, ownership, endpoints, dependency closure, digest drift, active-reference reconciliation, reviewed mappings, legacy compatibility, and new-fact revision binding; negative fixtures prove historical and learner-state inputs are rejected without catalog generation, consumption, or validation.
Manual-only acceptance: none
Rationale: manifest-level validation is the direct seam used to create the future series.
