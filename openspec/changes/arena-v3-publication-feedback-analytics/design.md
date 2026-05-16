## Context

Arena currently persists official submissions, publication context, class context, and selected LearningFact Arena context. Student profile already exposes an `ArenaStudentPortfolio`, and class insights already have general governance aggregation. What is still missing is a coherent teaching layer: publication reports for teachers, reusable diagnostics for students, and stable Arena summaries that profile and class insight APIs can consume.

This change depends on stable official evaluation semantics from `arena-v3-plant-adapter-and-blackbox-official-evaluation`. It should not change scoring, hidden scenario execution, or the official submission API. It should consume official submission records and LearningFact context as evidence.

## Goals / Non-Goals

**Goals:**
- Add a teacher report page for a specific Arena publication.
- Provide reusable student diagnostic feedback rules for white-box and black-box submissions.
- Surface Arena summaries in student profile and teacher class insights through backend aggregation.
- Keep all report and feedback calculations server-side or shared pure functions.
- Preserve publication visibility, class scoping, deadline hiding, and hidden-scenario privacy.

**Non-Goals:**
- No new official evaluator behavior.
- No unified workbench route migration.
- No Prisma schema changes unless current submission and LearningFact fields are insufficient.
- No student-facing disclosure of hidden black-box scenario details.
- No replacement of existing leaderboard pages.

## Decisions

- Build publication reports from `ArenaSubmissionRecord` plus publication metadata.
  Rationale: submissions already carry `publicationId`, `classId`, validity, score, artifact, evaluation, and submitted time; reports should not scrape front-end leaderboards.

- Add pure analytics modules before UI pages.
  Rationale: teacher reports, profile cards, and class insights need shared calculations and testable behavior.

- Put diagnostic rules under `src/features/arena/student/`.
  Rationale: feedback is student-facing behavior but must be reusable by current submission panels and the future unified workbench panel.

- Keep black-box feedback aggregate-only.
  Rationale: official black-box scoring uses hidden scenarios; feedback can mention aggregate safety, energy, tracking, and identification weaknesses without revealing scenario definitions.

- Prefer submission-backed summaries and use LearningFact as an additional evidence source.
  Rationale: `ArenaSubmission` is authoritative for official scoring; LearningFact is useful for governance timelines and cross-system evidence but may lag if event ingestion is delayed.

## Risks / Trade-offs

- [Risk] Report statistics may accidentally ignore publication/class visibility. → Mitigation: require publicationId/classId filters in analytics inputs and test cross-class leakage.
- [Risk] Feedback text may diverge between old panels and unified workbench. → Mitigation: all submission surfaces call the same `arena-feedback-rules` functions.
- [Risk] Hidden black-box diagnostics could leak scenario behavior. → Mitigation: feedback only names aggregate metric classes and hard-constraint labels.
- [Risk] Profile and insight APIs could become slow if they load all submissions. → Mitigation: use scoped queries by user, class, publication, and task; keep pure summary functions separate from data access.

## Migration Plan

1. Add analytics and feedback pure functions with tests.
2. Add teacher publication report route and link from `/teacher/arena`.
3. Add student feedback rendering to existing Arena submission panels.
4. Add profile and class-insight summary consumption.
5. Verify empty states, class scoping, deadline hiding, and hidden-scenario privacy.

## Open Questions

- Whether excellent-solution summaries should initially be deterministic metric summaries or wait for later AI-assisted narrative generation.
- Whether teacher class insight should expose Arena summary in the existing payload or behind a small nested `arena` field to avoid breaking consumers.
