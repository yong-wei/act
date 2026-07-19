## Context

This child consumes archived teacher course-basis versions and existing Provider Registry, Source Pack, SAR, citation, aggregate diagnosis, BullMQ, and Postgres foundations. It ends at an approved immutable text lesson-plan revision; courseware is a later child.

## Goals / Non-Goals

**Goals:** one-lesson setup, natural-language multi-turn intake, teacher-controlled knowledge points/goals, canonical goal-source states and stable gap identities, privacy-safe class adaptation, staged structured generation, durable jobs, advisory AI review, deterministic validation, and immutable plan versions.

**Non-Goals:** interactive modules, courseware publication, whole-course batch generation, or provider choice by teachers.

## Decisions

### 1. Use a single-lesson aggregate

`SmartLessonTask` records selected source versions, 30–120 minute duration, audience, prerequisites, optional class, confirmed knowledge points/goals, and outline policy. Confirmed goals are immutable inputs to one generation attempt.

### 2. Reuse the Konling session and prep-coauthor mode

The smart-preparation workspace mounts the existing teacher-only `prep-coauthor` mode and `/api/ai/sessions/[id]/messages` session history. Server-owned smart-task context exposes the current structured fields and unresolved ambiguities. Natural-language suggestions remain draft-only; missing or conflicting course basis, duration, audience, knowledge points, or goals produce a clarification turn, and only an explicit teacher confirmation updates the same `SmartLessonTask`.

### 3. Persist job truth in Postgres and deliver with BullMQ

One active job is allowed per draft. Start, resume, and cancel are idempotent. Completed stages survive navigation, failure, cancellation, and worker redelivery. Provider attempts record service/model/prompt/schema/timing and cost metadata without exposing secrets.

### 4. Generate outline then six BOPPPS stages

The default does not pause after the outline; an explicit option does. Completed stages are read-only while active. The complete draft includes all agreed teaching-design fields and exact duration totals.

### 5. Preserve goal source gaps without creating publication acknowledgement

Goals use the shared three-value source-state contract. A pending goal receives a stable identity from its goal content, source-binding-set, canonical state, and smart-task lineage. Unrelated plan revisions preserve that identity; target content, source bindings, canonical state, or delete-and-recreate changes create a new identity. Approval carries the state and identity into the immutable revision but never creates a publication acknowledgement.

### 6. Freeze revisions only on teacher approval

AI review is optional advice. Deterministic checks enforce structure, timing, goals, and source/gap states. Teacher approval freezes `教案第N版`; subsequent edits derive a new draft.

## Risks / Trade-offs

- [Structured output fails] -> Validate every stage, preserve prior output, and resume the failed stage.
- [Learner privacy leaks] -> Use an explicit aggregate projection and prompt fixtures that reject raw evidence.
- [Duplicate worker delivery causes duplicate cost] -> Use durable stage identities and idempotency keys before provider calls.

## Migration Plan

Deploy task/job/draft/revision records and worker support behind the feature flag after the course-basis child is archived. No existing `LessonPlan` rows are migrated. Rollback stops new jobs and preserves drafts/revisions.

## Open Questions

None.

## Testing Strategy
Change class: high-risk
Seam status: required
Public behavior: A teacher can create and refine one source-grounded lesson through a natural-language multi-turn conversation or structured controls, confirm goals, generate a complete BOPPPS text plan through resumable jobs, optionally request AI review, approve the plan, and obtain immutable sequential revisions.
Public seam: Playwright teacher plan-authoring and Konling prep-coauthor flows plus public session/task/job/review/approval route handlers backed by Postgres, BullMQ fixtures, Source Packs, aggregate diagnosis fixtures, and the deterministic Provider.
Existing seam reused: Konling session history and mode-contract tests, Provider adapter fixtures, Source Pack tests, data-governance worker idempotency tests, Prisma integration patterns, and teacher Playwright harness.
AC coverage: AC-1: Konling session, setup/API, ambiguity, multi-turn, prompt-projection, canonical source-state, and goal-gap creation evidence verifies natural-language task creation, confirmed decisions, knowledge points, goals, duration, both pending lineages, sources, and aggregate-only class context; AC-2: deterministic-provider and worker evidence verifies capability selection, staged progress, cancellation, failure resume, and redelivery idempotency; AC-3: browser, revision, goal-gap stability/change/delete-recreate, and no-implicit-acknowledgement evidence verifies complete BOPPPS content, deterministic checks, advisory-only AI review, teacher approval, immutable plan numbers, unchanged-gap preservation across unrelated revisions, and new identities for gap-defining changes.
Manual-only acceptance: none
Rationale: The public teacher and job seams cover the observable workflow across authorization, retrieval, provider routing, workers, source-gap lineage, and persistence, while deterministic fixtures force privacy, both pending states, stable/change/delete-recreate identity behavior, forbidden implicit acknowledgement, and failure cases without weakening the production contract.
