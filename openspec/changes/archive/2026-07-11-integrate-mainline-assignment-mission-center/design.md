## Context

The student profile currently places a class-join action in the name card and shows task progress farther down the page. `/missions` is a legacy mission grid backed by `Mission` and `UserProgress`, with feedback tasks mixed into the same surface. There is no durable student answer model for teacher-published assignments.

The upstream assignment-authoring change provides immutable assignment revisions and class audiences. This change turns them into a student task journey while preserving legacy missions under `任务进阶`.

## Goals / Non-Goals

**Goals:**

- Make `任务中心` the prominent student action beneath the profile name card.
- Present teacher-published assignments as `主线作业` and existing missions as `任务进阶`.
- Persist and formally submit each question answer and attachment independently.
- Derive assignment completion and downstream readiness from submitted required questions.
- Provide the private object-storage and immutable asset foundation required by downstream conversion.
- Maintain responsive, accessible, authorization-safe student states.

**Non-Goals:**

- Whole-assignment document upload or automatic question segmentation.
- Document conversion, AI grading, teacher review, teacher return commands, resubmission activation, or reviewed-document generation.
- Replacing existing Mission/UserProgress records.
- Revealing reference answers or rubric internals before approved feedback.

## Decisions

### 1. Make `/missions` a two-mode task center

`/missions` defaults to `主线作业`. `任务进阶` contains the existing mission grid and feedback tasks with their behavior preserved. The mainline list uses compact rows or cards optimized for due date, question completion, submission, grading, and next action rather than decorative mission statistics.

The profile name-card action routes to `/missions`; class join remains available in the existing class card so capability is not removed.

### 2. Make each question answer the formal submission unit

Use a relational submission envelope plus question-level answer records:

- `AssignmentSubmission` binds student, audience, assignment revision, and an aggregate state derived from required question attempts; it is not an all-or-nothing document envelope.
- `SubmissionAnswer` binds one assignment question and stores response type, draft/submitted state, text snapshot where applicable, and current attempt identity.
- `SubmissionAsset` stores object reference, checksum, safe display metadata, scan state, and ownership for one answer.

Draft saves update only the selected question. `提交本题` validates and atomically seals a new attempt for that question alone. When every required question has a valid submitted attempt, the server derives the assignment aggregate as `已提交`; no second whole-assignment sealing action is required. Repeating a question submission with the same idempotency key returns the same attempt. A later resubmission can create a new attempt without replacing historical attempts, but teacher return and resubmission activation belong to the final review change.

Alternative rejected: one JSON blob per assignment makes attachment ownership, partial returns, conversion, and grading idempotency difficult.

### 3. Derive assignment and question states separately

Question states in this change include `not-started`, `draft`, `uploading`, `ready`, and `submitted`. Assignment presentation derives `未开始`, `作答中`, `已提交`, `解析中`, `待批阅`, `批阅中`, `待教师确认`, `已批阅`, `需重交`, or `已逾期` from required question attempts and downstream state; teacher-return transitions are added only by the final review change.

The UI must not infer authoritative state only from client completion counts. Server responses include valid next actions and policy reasons.

### 4. Keep one assignment page for answering and feedback

Use `/missions/assignments/[assignmentId]` for instructions, question navigation, answering, upload, submission history, and later approved feedback. This preserves route continuity and lets the final series change add feedback without creating a second disconnected destination.

Question cards expose independent save/upload state and a `提交本题` action. A sticky summary shows required-question submitted count, blockers, deadline, and aggregate assignment state. Each submitted question becomes read-only unless a later authorized resubmission grant permits a new attempt.

### 5. Own the protected object-store foundation in this change

Define `SubmissionObjectStore` against a private S3-compatible API. Production deployment must configure and validate a private bucket or self-hosted MinIO-compatible service; a local filesystem adapter is permitted only for tests and local development. The downstream grading change consumes this adapter and does not choose another storage backend.

The server creates an opaque object key that is not derived from the student name or original filename. After assignment, audience, question, response type, size, MIME, and ownership checks, it issues a method- and object-bound upload URL with a maximum ten-minute TTL and exact length/type/checksum constraints. The full bearer URL is never persisted or logged.

Uploads first enter a quarantine prefix. Finalization performs object `HEAD` verification for key, owner intent, size, MIME, checksum, and scan state before recording a finalized immutable asset version. Replacing a draft file creates a new object and asset version; finalized or submitted objects are never overwritten. Failed or abandoned quarantine objects are revoked and garbage-collected through policy.

Authorized reads perform fresh ownership/purpose checks before issuing a method-bound URL with at most ten-minute TTL. Original documents use attachment download or isolated preview with trusted `Content-Type`, `Content-Disposition`, `X-Content-Type-Options: nosniff`, and private no-store caching.

### 6. Enforce class, schedule, and attempt authorization server-side

Students may first receive and answer only an active assignment revision addressed to one of their current classes. Historical access to their own submitted answers follows the frozen ownership contract from the upstream change. Each question submission checks availability, deadline, late policy, current attempt, answer schema, and asset readiness in one transaction. Duplicate finalization or question-submission requests use idempotency keys.

All mutation routes require non-GET authenticated requests, strict Origin/CSRF validation, runtime schemas, body and field bounds, resource authorization, and rate or quota limits for upload signing, finalization, autosave, and submission.

## Risks / Trade-offs

- [Legacy missions and assignments have different state models] → Keep separate persistence and compose only at the task-center query/view-model layer.
- [Autosave can race with question submission] → Use answer versions and a question-scoped transaction that seals one explicit answer version.
- [Large uploads can outlive page navigation] → Show resumable upload state and prevent submission until asset finalization succeeds.
- [Deadline crossings can occur during upload] → Evaluate deadline policy on final submission and return the exact server decision.
- [Object-store infrastructure is absent in the repository] → Deliver the S3-compatible adapter, private deployment configuration, health check, and local test adapter in this change before uploads are enabled.
- [Signed URLs can be replayed] → Bind them to method/object/purpose, cap TTL at ten minutes, never log or persist bearer URLs, and reauthorize finalization and reads.

## Migration Plan

1. Add submission, answer, attempt, and immutable asset persistence plus authorization/indexes.
2. Add and deploy the private S3-compatible object-store adapter, quarantine/finalization/GC policies, health checks, and local test adapter.
3. Add student assignment query, draft-save, signed upload, finalization, and per-question submission APIs behind a feature flag.
4. Add profile entry and `/missions` tabs while preserving the existing mission implementation.
5. Add assignment detail, per-question editor/upload/submit, history, and aggregate state UI.
6. Enable by class or environment after storage, authorization, mutation-security, idempotency, deadline, responsive, and end-to-end tests pass.

Rollback hides `主线作业` and restores the prior profile action while retaining submission data. Existing legacy mission state remains untouched.

## Open Questions

No product decision remains open: each question independently forms a formal submitted attempt, assignment state is aggregated from required questions, and a whole-assignment document is explicitly unsupported.
