## Context

The platform already has a K/A/Q objective catalog, a LearningGoal catalog with at least nine path-ready entries, and a goal-subgraph expansion service. The current naming and data shape still preserve a nested model: `AdaptiveLearningPathGoal` can contain `learningGoalPackage`, and registered goal definitions can also contain the same package metadata.

This contradicts the intended product model. A LearningGoal is not a wrapper around another package. It is the student-facing target truth that bundles knowledge, capability, and quality objectives so the planner can choose resources and order a path toward that target.

## Goals / Non-Goals

**Goals:**

- Make `LearningGoalDefinition` the canonical in-code and API-facing model for student-facing goals.
- Treat `control-correction` and every current path-ready id as a LearningGoal id.
- Remove new emission of `goal.learningGoalPackage` and `payload.learningGoalPackage` as canonical fields.
- Keep old persisted payloads readable when they contain `learningGoalPackage`.
- Update active graph-planning OpenSpec wording so follow-up changes consume LearningGoal directly.

**Non-Goals:**

- Do not introduce LearningGoal variants, subpackages, teacher-created custom goals, or a second target catalog.
- Do not migrate Prisma schema or rewrite existing `LearningPath.goalId`.
- Do not change the K/A/Q objective ids or graph node ids.

## Decisions

### LearningGoal Is The Catalog Unit

Use `LearningGoalDefinition` for the fields currently held by `LearningGoalPackageDefinition`: student-facing text, learning intent, recommended phase, K/A/Q objective ids, graph node ids, resource mix, evidence policy, terminal validation policy, path policy family, status, version, and limitations.

Alternative considered: keep `LearningGoalPackageDefinition` and document that package means goal. That preserves the confusion and would force future planner, Konling, and artifact-versioning work to carry the wrong term.

### Planner Requests Stay Goal-Id Based

Keep planner requests and persisted paths keyed by `goal.id` / `goalId`. The registry resolves that id to the canonical LearningGoal. This matches the existing database shape and avoids migration.

Alternative considered: add a separate `learningGoalId` column. That duplicates `goalId` without adding meaning because the goal id already identifies the LearningGoal.

### Legacy Package Payloads Are Read-Only Compatibility

New serialized payloads should expose `learningGoal`. Readers may accept `learningGoalPackage` from old records and normalize it to `learningGoal` at read boundaries. Tests should prove forged client-supplied nested package data cannot override the server-owned LearningGoal.

Alternative considered: write both fields indefinitely. That keeps two truths alive and makes downstream graph artifacts ambiguous.

### Goal Slice Remains Internal Scope

LearningGoal may reference a goal slice for learner-state and evidence scope, but the slice is not a parent package and not the student-facing target. It is an internal bridge for existing adaptive evidence contracts.

Alternative considered: model goal slices as the public goal layer. That exposes implementation scope to students and keeps fixed goal-slice limits in the product surface.

## Risks / Trade-offs

- Future active OpenSpec changes could reintroduce `LearningGoal package` terminology -> Verify graph-planning proposals before implementation and keep LearningGoal as the target truth.
- Existing tests assert `learningGoalPackage` fields -> Rewrite tests around `learningGoal` and add legacy-read tests.
- Existing persisted JSON may contain package metadata -> Normalize legacy payloads at read time and avoid rewriting history silently.
- The spec folder name `learning-goal-packages` remains historical until archive/rename policy is decided -> Correct requirement text now; a later cleanup can rename the capability folder if desired.

## Migration Plan

1. Introduce `LearningGoalDefinition` and helper names such as `getLearningGoal`, `listLearningGoals`, and `validateLearningGoalCatalog`.
2. Replace registered goal definitions so LearningGoal metadata is stored once, not nested under `goal.learningGoalPackage`.
3. Serialize canonical `learningGoal` metadata in new path payloads.
4. Add compatibility normalization for legacy `learningGoalPackage` payloads.
5. Update planner, Konling, graph expansion, and evidence tests to use LearningGoal terminology.
6. Update active OpenSpec deltas that refer to LearningGoal packages before those changes are implemented.
