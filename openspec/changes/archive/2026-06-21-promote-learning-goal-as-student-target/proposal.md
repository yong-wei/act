## Why

The current LearningGoal implementation still describes the student-facing target as a `LearningGoal package` nested under an adaptive path goal. That keeps two goal truths alive at the same time and makes `control-correction` look like a package id instead of the LearningGoal itself.

LearningGoal must be the first-class student-facing target truth: path planning should optimize for achieving the LearningGoal, while the included knowledge, capability, and quality objectives define the planning boundary.

## What Changes

- Replace the nested `LearningGoalPackageDefinition` contract with a first-class `LearningGoalDefinition` contract.
- Treat existing ids such as `control-correction`, `frequency-response-foundations`, and the other path-ready goals as LearningGoal ids, not package ids.
- Require planners, graph expansion, goal-slice bridging, and K/A/Q validation to consume LearningGoal metadata directly.
- Preserve compatibility for existing persisted payloads that still contain `learningGoalPackage`, but stop emitting new nested package payloads as the canonical shape.
- Update active graph-planning terminology so future planner, artifact-versioning, and Konling work refers to LearningGoal as the goal truth.
- Do not introduce LearningGoal variants, nested packages, or a parallel target catalog.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `learning-goal-packages`: Redefine the existing capability around first-class LearningGoal records rather than nested packages.
- `adaptive-learning-path-planning`: Make LearningGoal the planner target and require K/A/Q objectives to constrain planning.
- `goal-subgraph-expansion`: Expand LearningGoal records directly into K/A/Q subgraphs.
- `adaptive-goal-slice-registry`: Clarify that goal slices are internal scope bridges used by LearningGoals, not parent packages.
- `kaq-objective-taxonomy`: Require K/A/Q objectives to bind to LearningGoals rather than LearningGoal packages.

## Impact

- Affected files: `src/lib/adaptive-learning-path-planner.ts`, `src/lib/control-correction-path-rounds.ts`, `src/lib/konling-agent-runtime.ts`, `src/lib/data-governance/*`, and adaptive path API tests.
- API and persistence: new path payloads should expose canonical `learningGoal` metadata; old `learningGoalPackage` payloads remain readable as legacy metadata.
- OpenSpec: existing specs and active graph-planning changes need terminology updates from `LearningGoal package` to first-class `LearningGoal`.
- Database: no Prisma migration is expected because `LearningPath.goalId` already stores the goal id.
