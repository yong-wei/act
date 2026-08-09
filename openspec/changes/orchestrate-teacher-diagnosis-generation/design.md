# Design: Governed teacher diagnosis generation

## Context

The existing `DiagnosisReport` read model and report-history UI are governed persisted snapshots. The current POST route bypasses the intended trust boundary by accepting `reportBody` from the browser. The existing Konling runtime already registers the `teacher-diagnosis` mode and its three governed read tools, but it has no server-owned report-generation orchestrator.

## Decisions

### A durable job owns each generation request

`DiagnosisGenerationJob` records the authenticated teacher, server-validated class and optional student scope, idempotency key, fixed evidence cutoff, generator version, lifecycle state, and final report reference. A partial unique constraint permits at most one active job per scope. Reusing an idempotency key returns the original job; a new click after success creates a new snapshot.

### Attempts retain execution audit data

Each worker run creates a `DiagnosisGenerationAttempt` with an attempt number, Konling session identifier, timing, result, error classification, and governed tool-call summary. Recoverable failures receive at most three automatic attempts. Validation, authorization, and evidence-governance failures terminate without automatic retry. An explicit teacher retry requeues the same logical job and preserves its attempt chain.

### PostgreSQL is the business-state authority

BullMQ delivers work and executes the worker; it does not own the public lifecycle. Queue delivery failure leaves the database job visible and retryable. Worker transitions use guarded state updates so duplicate delivery cannot create duplicate reports.

### Evidence is frozen and revalidated

Job creation fixes `evidenceCutoff`. All attempts, including explicit retry, use the same cutoff. The worker invokes only the three tools permitted by `teacher-diagnosis`, captures their governed summaries, and requests strict `DiagnosisReportBody` output. Before persistence the server validates schema, evidence references, cutoff, class/student membership, finding allowlists, and tool provenance.

### Report completion is atomic

The report, unique job-to-report link, and successful terminal transition are committed in one transaction. A job can produce at most one report. Failed validation never writes a partial report.

### Existing teacher workspaces own the UI

The report history component adds a generation control and polls the returned job while active. It distinguishes queued/running, delivery failure, generation failure, timeout, and success. Success refreshes the persisted history. Class and student pages continue to determine the visible scope.

## Risks and mitigations

- Duplicate queue delivery could duplicate reports. Guarded transitions and a unique report/job relationship make completion idempotent.
- A retry could silently use later evidence. The cutoff is persisted at creation and passed to every governed read.
- Model output could cite unobserved evidence. Persistence accepts only references observed through the job's allowlisted tool executions and within scope/cutoff.
- Redis delivery could fail after database creation. The API returns the durable failed-delivery state and exposes explicit retry.
- A worker can die while running. A bounded execution deadline records timeout and makes the job eligible for explicit retry.

## Verification

- Unit tests cover scope authorization, request-key reuse, active-scope exclusion, state transitions, retry classification, fixed cutoff, output validation, and atomic single-report completion.
- Route tests cover create, status, retry, unauthorized scope, and removal of browser-authored report writes.
- Component tests cover generation controls and queued, running, failed, timed-out, and completed states for class and student scopes.
- Typecheck, lint, affected unit suites, strict OpenSpec validation, and a focused browser flow run before publication.

