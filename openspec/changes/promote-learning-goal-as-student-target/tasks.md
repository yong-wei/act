## 1. LearningGoal Contract

- [ ] 1.1 Replace `LearningGoalPackageDefinition` and related package status, intent, policy, and validation names with `LearningGoalDefinition` equivalents.
- [ ] 1.2 Make `ADAPTIVE_LEARNING_GOAL_DEFINITIONS` store canonical LearningGoal metadata once instead of duplicating it under `goal.learningGoalPackage`.
- [ ] 1.3 Replace `getLearningGoalPackage`, `listLearningGoalPackages`, and `validateLearningGoalPackageCatalog` with LearningGoal-named APIs while keeping temporary deprecated aliases only where needed for compatibility.

## 2. Planner And Persistence Semantics

- [ ] 2.1 Update planner goal resolution so every path generation resolves the server-owned LearningGoal by id before scoring resources.
- [ ] 2.2 Stop emitting canonical `goal.learningGoalPackage` and `payload.learningGoalPackage` in newly generated plans and persistence records.
- [ ] 2.3 Add read-time compatibility normalization for legacy persisted payloads that still contain `learningGoalPackage`.
- [ ] 2.4 Keep `LearningPath.goalId` as the persisted LearningGoal id and avoid Prisma schema changes.

## 3. Graph, Goal Slice, And Assistant Consumers

- [ ] 3.1 Update goal-subgraph expansion inputs and outputs to use `learningGoalId` and canonical LearningGoal metadata.
- [ ] 3.2 Keep goal slices as internal adaptive scope bridges and prevent student-facing output from presenting slices as packages or parent targets.
- [ ] 3.3 Update Konling path generation and citation context wording to consume LearningGoal metadata directly.
- [ ] 3.4 Update active graph-planning OpenSpec changes that still refer to `LearningGoal package` so follow-up implementation does not reintroduce the nested model.
- [ ] 3.5 Decide whether to rename the historical `learning-goal-packages` capability folder at archive time or keep it as a compatibility alias with corrected requirement text.

## 4. Tests And Validation

- [ ] 4.1 Update adaptive path planner tests to assert first-class LearningGoal catalog validation and forged nested package rejection.
- [ ] 4.2 Add regression coverage for legacy `learningGoalPackage` payload normalization.
- [ ] 4.3 Update graph subgraph expansion tests to assert LearningGoal id/version terminology.
- [ ] 4.4 Add acceptance assertions that new payloads do not contain canonical `goal.learningGoalPackage` or `payload.learningGoalPackage`, while legacy payloads normalize to `learningGoal` only at read boundaries.
- [ ] 4.5 Run `rtk openspec validate promote-learning-goal-as-student-target --type change --strict`.
- [ ] 4.6 Run `rtk openspec validate extend-adaptive-planner-for-kaq-graph-inputs --type change --strict`.
- [ ] 4.7 Run `rtk openspec validate version-kaq-graph-overlay-path-artifacts --type change --strict`.
- [ ] 4.8 Run `rtk openspec validate --changes --strict`.
- [ ] 4.9 Run focused tests covering `src/lib/__tests__/adaptive-learning-path-planner.test.ts`, `src/lib/__tests__/goal-subgraph-expansion-service.test.ts`, `src/lib/__tests__/konling-agent-runtime.test.ts`, `src/lib/__tests__/control-correction-path-rounds.test.ts`, and `src/app/api/learning-paths/__tests__/route.test.ts`.
