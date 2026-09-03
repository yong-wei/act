## Context

The interactive event route is both an ingestion endpoint and a teacher-facing read endpoint. Its POST path already normalizes and persists student evidence, but the GET path directly queries `InteractionLog` and `StudentStepResponse` using request-provided identifiers. `ClassSession` has an optional `classId` and `teacherId`; `Class` owns its student roster through `StudentProfile.classId`. These are the server-owned relationships that must determine teacher scope.

## Goals

- Ensure a teacher can review only sessions and students in classes owned by that teacher.
- Ensure client filters narrow an authorized scope but never grant or expand it.
- Return only teaching-safe event summaries and aggregate diagnostics from normal APIs.
- Keep private AI question text and raw event payloads out of ordinary teacher reads.
- Preserve student ingestion and the durable raw-event store for explicit governance operations.

## Non-Goals

- No change to POST ingestion, event deduplication, or LearningFact materialization.
- No change to official scores, rankings, learner portraits, or recommendation eligibility.
- No general-purpose raw-event export or new teacher data warehouse.
- No redesign of the teacher diagnostics UI beyond consuming the corrected response contract.

## Decisions

1. **Resolve scope before the event query.** For a teacher, query `Class` by `teacherId`, derive its class ids, then resolve class sessions and enrolled student ids. A requested `sessionId` must belong to one of those sessions; a requested `userId` must belong to the roster of the requested or derived class scope. An explicit mismatch returns `403` without querying `InteractionLog` or `StudentStepResponse` for the target.

2. **Do not authorize from request parameters.** `resourceId`, `resourceKey`, `sessionId`, `userId`, and `eventType` are optional filters only after scope is established. Teacher reads without a session anchor include only class-bound events from the teacher's owned sessions; standalone student telemetry is not inferred to be teacher-visible.

3. **Use an allowlisted teacher projection.** The normal event response may contain canonical event type, resource/lesson/step labels, safe timestamps, attempt status, and aggregate counts needed for teaching review. It must omit direct user ids, names, email addresses, raw `eventData`, prompts, answers, free text, tokens, stack traces, and provider/parser content. Private AI-query events are excluded from ordinary teacher results rather than returned with their question text.

4. **Apply one scope boundary to diagnostics.** Control-workbench and annotated-media diagnostics resolve the same authorized session and roster scope before reading `StudentStepResponse`. Builders receive only safe diagnostic inputs and return teaching labels/counts, not student identifiers or raw response JSON.

5. **Keep raw access physically and logically separate.** The ordinary GET route is not a raw read operation. If an authorized audit, debug, migration, or drilldown workflow later needs raw payloads, it must use a separate operation carrying purpose, actor scope, source revision, and a durable receipt. This change records the boundary and prevents the normal route from acting as that operation.

## Rejected Alternatives

- **Trust the teacher role alone:** rejected because role membership does not identify the teacher's classes and permits cross-class access.
- **Accept the requested `userId`/`sessionId` as scope:** rejected because a client-controlled selector is not authorization.
- **Return the full row but rely on UI redaction:** rejected because API consumers, logs, and alternate clients would still receive private payloads.
- **Delete raw `InteractionLog` records:** rejected because ingestion, audit, migration, and governance still require durable raw evidence.

## Verification Strategy

- Route tests prove unauthenticated and non-teacher access behavior, teacher-owned class scope, cross-class rejection before raw queries, roster filtering, private AI question exclusion, and safe field allowlisting.
- Diagnostic tests prove control-workbench and annotated-media requests cannot bypass the same scope through `userId`, `sessionId`, or resource filters.
- Projection tests prove forbidden fields are absent from normal responses.
- Run the affected unit/route suite, TypeScript checks, strict OpenSpec validation, and `git diff --check`.
