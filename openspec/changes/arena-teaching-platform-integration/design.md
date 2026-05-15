## Context

Arena currently has useful ingredients but not a full teaching workflow. Teachers can preview challenge configuration, students can submit to global task-level evaluation, and Odyssey has its own score pipeline. The platform still lacks a persisted publication object that binds a challenge to a class, deadline, visibility, homework policy, and leaderboard rule.

Current persisted Arena submissions include `classId` and `seasonId`, but not `publicationId`. `LearningFact` stores generic fact fields and competency contribution; Arena events can materialize, but Arena-specific context is not yet first-class for class insight aggregation.

This change turns Arena from a standalone challenge area into a class-aware teaching workflow.

## Goals / Non-Goals

**Goals:**

- Persist teacher Arena publications and expose them to students by class/course/public visibility.
- Carry publication context into official submissions and class-scoped leaderboards.
- Support homework-like behavior such as deadlines, hidden leaderboard policy, personal status, and post-deadline class comparison.
- Preserve Arena evidence context for student profile and teacher insight aggregation.
- Bridge Control Odyssey completion into Arena official submissions while preserving existing Odyssey progression.

**Non-Goals:**

- Do not replace the existing Control Odyssey credits, upgrade levels, or game leaderboard.
- Do not make every Arena task homework-bound by default.
- Do not let publication context alter official scoring formulas unless a publication-specific grading policy explicitly interprets the result.
- Do not reopen the analysis metric implementation; this change consumes the official evaluation path.

## Decisions

### Decision: Add a persisted `ArenaChallengePublication` model

The publication should be a first-class Prisma model rather than a JSON blob in teacher profile state. It needs queryable fields:

- `id`
- `taskId`
- `classId`
- `teacherId`
- `visibility`
- `deadline`
- `leaderboardPolicyId`
- `homeworkBinding`
- `gradingPolicy`
- `status`
- `createdAt` / `updatedAt`

Alternative considered: keep preview-only configuration and encode class context in URLs. That cannot support reliable class leaderboards or teacher management.

### Decision: Add `publicationId` to Arena submissions

`ArenaSubmission` should store `publicationId` in addition to existing `classId` and `seasonId`. The evaluate API should accept publication context only after validating that the student is allowed to submit against that publication.

### Decision: Publication visibility controls leaderboard presentation, not official scoring

Official score remains produced by `/api/arena/evaluate`. Publication policy determines whether students see only personal status, class ranking, or public ranking before and after the deadline.

### Decision: Extend learning evidence context explicitly

Arena high-value facts need task, object, method, score, valid state, artifact hash, metric profile, leaderboard policy, and publication/class context. If current `LearningFact` fields are insufficient, add a JSON context field or a linked evidence-detail table rather than overloading `moduleId`.

### Decision: Odyssey bridge submits a derived Arena artifact

Odyssey completion should build a deterministic Arena-recognizable artifact from level, tier, controller configuration, metrics, and run id, then submit through Arena official evaluation. Existing `submitGameScore` continues to write the game score and credits.

## Risks / Trade-offs

- [Risk] Publication permissions can leak class tasks. → Validate teacher ownership on publication writes and student class membership on reads/submissions.
- [Risk] Students may submit after deadline. → Decide whether late submissions are rejected or stored as late but excluded from grading; encode this in publication policy.
- [Risk] Odyssey game scores and Arena scores may confuse users. → Keep labels and storage separate; Arena submission is the official control-evaluation record, Odyssey score remains game progression.
- [Risk] LearningFact schema migration affects data governance jobs. → Add backfill-safe optional context field and update materialization tests before consuming it in insights.

## Migration Plan

1. Add publication persistence schema and migration.
2. Implement teacher publication store and APIs.
3. Update teacher Arena page from preview-only to preview plus publish/manage.
4. Add student publication resolution and submission context validation.
5. Extend submission persistence with `publicationId`.
6. Add class-scoped leaderboard filtering and deadline visibility policy.
7. Extend Arena LearningFact context storage and aggregation tests.
8. Add Odyssey-to-Arena submission bridge while leaving game score flow unchanged.

Rollback can leave existing task-level Arena submissions intact because publication context is additive. If the publication workflow must be disabled, hide publication APIs/UI and keep `/api/arena/evaluate` accepting ordinary task-level submissions.

## Open Questions

- Should late submissions be rejected or stored with a late flag for teacher review?
- Should publication grading policy live as structured JSON initially, or should it get a normalized table from the start?
- Which Odyssey levels map to official Arena tasks first: existing PID-style levels only, or all completed levels with a template result artifact?
