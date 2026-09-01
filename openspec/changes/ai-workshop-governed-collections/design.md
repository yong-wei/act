## Context

Issue #1454 removed hard-coded learner samples from `/ai` and introduced a server-owned learner-evidence summary. Its accepted design deliberately left `milestones`, `achievements`, `tasks`, `experiments`, and `journals` empty until each collection had an authoritative source and provenance contract. The production route still passes none of those collections, so the panels remain empty even when the authenticated student has published assignments, persisted path activity, simulations, Arena submissions, growth records, or confirmed reflections.

The repository already has the necessary source systems, but they have different authorization, lifecycle, freshness, and failure semantics. Treating an available portrait or one successful source as authorization for every panel would recreate the same false-personalization defect in a different form.

## Goals / Non-Goals

**Goals:**

- Project five student-safe AI Workshop collections from existing server-owned sources.
- Preserve an independent `available`, `empty`, or `unavailable` state for every collection.
- Define explicit eligibility rules so candidates, drafts, previews and inferred achievements do not become personal records.
- Preserve stable source identity, occurrence time, status and navigation without exposing raw payloads or internal diagnostics.
- Keep partial source failure honest and local to the affected panel.

**Non-Goals:**

- No new LearningFact, learner portrait, score, ranking or task-completion write.
- No new recommendation or achievement inference algorithm.
- No automatic promotion of Copilot output or reflection drafts.
- No replacement of the assignments, Learner State, profile evidence or growth-record source contracts.
- No cross-source total that claims all learning activity has been exhaustively measured.

## Decisions

### 1. Assemble collections in a server-only application service

Add an AI Workshop collection assembler that receives the authenticated student identity and calls existing server-side readers or shared projection helpers directly. `/ai` passes its serializable result to `PersonalLearningCenter`; the browser does not provide `userId`, fetch arbitrary student collections, or construct personal records from query parameters.

The assembler returns one envelope per collection:

```text
state: available | empty | unavailable
total: number | null
items: student-safe items
limitation: optional student-facing text
action: stable adjacent route and label
```

`available` means the source read succeeded and at least one eligible item exists. `empty` means the authoritative read succeeded and confirmed no eligible item. `unavailable` means eligibility cannot be determined. A portrait, evidence summary, or another collection's state cannot override this envelope.

Alternative considered: extend the single overall evidence status and reuse it for all panels. Rejected because source availability differs and would turn unknown values into empty personal records.

### 2. Use explicit source and lifecycle eligibility

- **Tasks:** use assignments published to the current student through the assignment domain and path tasks from a student-adopted, persisted path. Recommendations, report-feedback candidates and browser-only selections are excluded.
- **Milestones:** use persisted ordered nodes from the student's adopted path, retaining completed/current/pending state. Do not synthesize milestones from task counts, portrait levels or recommendation percentages.
- **Experiments:** use current-student `SimulationLog` and `ArenaSubmission` records that satisfy the existing display/evidence eligibility rules. Preserve source kind and official/preview/result semantics; do not describe a preview score as official.
- **Achievements:** use only persisted achievement, certificate or other explicitly registered attainment records. Do not infer badges from score, portrait level, task count or locked badge definitions.
- **Journals:** use only student-confirmed reflection, ethics or growth records that have entered a formal displayable lifecycle. Copilot messages, candidates and editable reflection drafts remain excluded until an existing explicit promotion action creates a qualifying record.

Each adapter owns a narrow allowlist of accepted source types and a student-safe mapper. Reusing route response builders is preferred where they already encode privacy and source status; server components must not call the application's own HTTP routes.

Alternative considered: map all `GrowthRecord` rows into achievements or journals. Rejected because record type alone does not make lifecycle and panel semantics interchangeable.

### 3. Preserve provenance without exposing raw evidence

Every item carries a stable item id, source kind, source record id or stable opaque identity, occurred/published time, display status and navigation target. Titles, summaries and parameters use existing student-safe projectors or bounded allowlists. Raw response payloads, audit references, arbitrary JSON, internal reason codes and other students' data remain server-only.

Items are deduplicated by collection-specific stable identity, ordered deterministically by domain order or descending occurrence time with id as tie-breaker, and bounded for initial page rendering. `total` reflects the eligible source query where it is known; it is `null` when the source is unavailable rather than fabricated as zero.

### 4. Isolate source failures

The assembler reads independent sources without converting one failure into a page-wide empty result. A failed task source yields an unavailable task panel while a successful experiment source can still render. Errors are logged with source category and no student content. Authentication failure remains a route-level access failure rather than five unavailable collections.

Alternative considered: fail the whole `/ai` route if any source fails. Rejected because it removes usable learning context and obscures which source needs recovery.

### 5. Keep UI props compatible but make collection state authoritative

Replace optional bare arrays with a governed collection projection, or add a single collection DTO prop and remove production reliance on default empty arrays. Each panel renders records only from its own envelope, distinguishes empty from unavailable, and uses the supplied adjacent action. Existing report-feedback candidate behavior remains separate and cannot mutate these collections locally.

Desktop and 320px browser tests cover mixed states, populated collections, navigation, keyboard focus and overflow. Commercial UI evidence is captured from a clean, revision-bound runtime after the implementation reaches a stable checkpoint.

## Risks / Trade-offs

- [Risk] Source domains expose incompatible shapes and statuses. -> Use small per-source adapters and one student-safe collection contract rather than a cross-domain union of raw records.
- [Risk] The first release may show fewer records than legacy pages. -> Prefer explicit eligibility and honest empty states; expand allowlists only through later reviewed contracts.
- [Risk] Multiple source reads increase `/ai` latency. -> Run independent reads concurrently, bound item counts and retain per-source failure isolation.
- [Risk] A source record changes after projection. -> Keep stable identity and current display status; do not claim immutable history unless the source itself is immutable.
- [Risk] The same activity appears in experiment and journal sources. -> Deduplicate within each semantic collection, not across different learning meanings, and retain source labels.

## Migration Plan

1. Introduce collection DTOs, eligibility projectors and direct regression tests without changing the page.
2. Add server-only source adapters and mixed-success aggregation tests using current-student fixtures.
3. Pass the projection from `/ai` and update panels to consume independent collection states.
4. Run focused unit/route/component tests, TypeScript checks and strict OpenSpec validation.
5. Capture revision-bound 1440px and 320px evidence for populated, empty and unavailable representative states.

Rollback is a code revert. No database migration or persisted record rewrite is required.

## Open Questions

None. New record types require a later explicit eligibility decision rather than a permissive fallback.
