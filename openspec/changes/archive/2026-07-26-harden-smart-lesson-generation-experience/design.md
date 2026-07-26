## Context

The existing durable generation service already stores jobs, stages, attempts, and failure codes, but UI polling and provider normalization leave raw payloads visible and recovery unclear. The provider can also return almost-correct structured objects that should be normalized once without unbounded repair.

## Goals / Non-Goals

**Goals:**

- Make progress immediate, localized, and understandable.
- Preserve completed work and resume from the failed stage.
- Bound provider correction and retry costs.

**Non-Goals:**

- Change BOPPPS content requirements.
- Add unlimited automated retries.
- Replace the Provider Registry or queue.

## Decisions

### 1. Project two orthogonal status axes

Each stage exposes its teaching-stage label and one action state: waiting, preparing, generating, validating, auto-fixing, waiting for confirmation, retryable, completed, or cancelled. Motion supplements rather than replaces the text.

### 2. Persist before presentation

Only schema-valid normalized content becomes a completed stage projection. The client refreshes active jobs automatically and renders each committed stage as soon as it is available.

### 3. Use one bounded correction pass

Provider output first enters deterministic normalization. Remaining schema violations produce one correction request containing the original structured result, validation errors, schema, and stable prompt prefix. A second invalid result pauses the job.

### 4. Separate delivery identity from teacher retry

Queue redelivery reuses one attempt identity and is idempotent. A teacher retry explicitly creates a new attempt and idempotency key for the first incomplete stage; completed stages are not regenerated.

## Risks / Trade-offs

- [Polling overload] → Poll only active jobs with backoff and stop on terminal state.
- [Correction changes valid fields] → Validate the entire corrected object and record both attempts.
- [Retry duplicates charges] → Enforce attempt identity at the worker boundary.

## Migration Plan

Backfill presentation state from existing job and stage records. Preserve valid completed output. Normalize historical failure codes into retryable or terminal Chinese states without rewriting provider payloads.

## Open Questions

None.
