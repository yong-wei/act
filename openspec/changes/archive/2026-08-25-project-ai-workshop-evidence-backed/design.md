## Context

The `/ai` page currently renders `PersonalLearningCenter` without a server-owned learner-state input. The component therefore falls back to hard-coded profile, milestone, task, achievement, experiment, and journal arrays. In a student-facing product these values look like personal records even when the learner has no corresponding evidence.

The existing `readAdaptiveLearnerState` service already enforces authentication at its route boundary and exposes server-owned evidence coverage, confidence, portrait availability, path state, and missing-evidence markers. This change makes that service the only source for the AI Workshop overview. The existing report-feedback task contract remains independent and must continue to work.

## Goals / Non-Goals

**Goals:**

- Load the current authenticated learner state in the server page.
- Project only student-safe, serializable evidence metadata into the client component.
- Render explicit available, no-record, and unavailable states.
- Remove production defaults that can be mistaken for a learner's personal data.
- Keep the existing `/ai` route and report-feedback task intent compatible.

**Non-Goals:**

- No new database table or migration.
- No new recommendation, scoring, or portrait algorithm.
- No client-controlled learner identity or client-provided profile values.
- No write-back to grades, rankings, LearningFact, or learner portraits.
- No claim that an empty state represents a score of zero.

## Decisions

### 1. Server page reads learner state

`src/app/ai/page.tsx` will read the authenticated session and call `readAdaptiveLearnerState(prisma, { userId, role: 'student' })`. If the service is disabled or throws, the page will pass an unavailable projection. The client will not fetch learner state itself and will not accept query parameters as evidence.

### 2. Use a narrow projection DTO

`src/features/ai/ai-workshop-evidence.ts` will convert the large learner-state payload into a student-safe DTO containing status, evidence count, confidence, source coverage, portrait availability, path summary, and user-facing limitations. Raw audit references, internal reason codes, and unrestricted payloads stay server-side.

The status rules are deterministic:

- `unavailable`: service disabled, read state unavailable, or portrait state is `UNAVAILABLE`.
- `empty`: no governed evidence count and no current portrait.
- `available`: at least one governed evidence item or a current server-owned portrait.

Stale or partial evidence remains available but displays its limitation; it is not silently converted to a complete profile.

### 3. Empty child collections are explicit

`PersonalLearningCenter` will have no sample defaults. Empty tasks, achievements, experiments, journals, and milestones will render student-facing no-record states. Dashboard metrics will display verified evidence metadata rather than invented study minutes, scores, unlocked counts, or recommendation percentages.

Existing typed collection props remain available for future server-owned projections, but production `/ai` passes only the new projection and empty collections until a governed source for each collection exists.

### 4. Preserve task intent

The report-feedback candidate panel remains controlled by the current URL task context. Evidence projection is additive and does not change its candidate/adopt/discard state machine.

## Risks / Trade-offs

- [Risk] Existing users lose attractive sample content on cold start. → [Mitigation] Replace it with clear next actions and evidence explanations; fabricated personalization is not acceptable for this project.
- [Risk] The existing learner-state service can return partial or stale evidence. → [Mitigation] Preserve status markers and show limitations instead of presenting complete claims.
- [Risk] Some legacy callers may pass profile collections. → [Mitigation] Keep compatible prop types while removing all production defaults and validate the `/ai` route with focused tests.
- [Risk] Service failure could make `/ai` less informative. → [Mitigation] Render an explicit unavailable state with a retry or adjacent learning action, never a synthetic profile.

## Migration Plan

1. Add the projection helper and focused unit tests.
2. Add the server-side `/ai` projection and remove sample defaults.
3. Update child panels to render empty and unavailable states.
4. Run focused Vitest, typecheck, OpenSpec strict validation, and browser checks at 1440px and 320px.
5. Rollback is a code revert; no database migration or data rewrite is involved.

## Open Questions

None. Detailed learner metrics remain intentionally deferred until each metric has a governed source and provenance contract.
