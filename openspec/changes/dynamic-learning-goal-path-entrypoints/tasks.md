## 1. LearningGoal Catalog Projection

- [x] 1.1 Add a shared adaptive path LearningGoal option projection derived from `listLearningGoals()`.
- [x] 1.2 Include student-facing title, description, completion meaning, intent type, recommended phase, terminal-validation summary, limitations, and route hrefs in the projection.
- [x] 1.3 Add catalog validation tests that fail when any `path-ready` LearningGoal lacks path entrypoint metadata or Konling context metadata.
- [x] 1.4 Add a regression assertion that all current nine path-ready LearningGoals are projectable.

## 2. Adaptive Path Center Dynamic Goals

- [x] 2.1 Replace `AdaptivePracticeGoalId` two-value unions and hard-coded goal labels with catalog-validated dynamic goal ids.
- [x] 2.2 Render generation goal options from the catalog projection instead of the page-local `generationGoalOptions` literal.
- [x] 2.3 Update URL resolution, session storage, latest-path restore, path selection, path execution, evidence review, and generate-new-path actions to preserve the selected LearningGoal id.
- [x] 2.4 Rename active path page state and helpers away from `controlCorrection*` where they affect dynamic goal behavior.
- [x] 2.5 Render unknown-goal and incomplete-context states as student-safe unavailable or generic path-center fallbacks without calling planner or Konling tools.

## 3. Konling Dynamic Path Advisor

- [x] 3.1 Replace fixed `PathAdvisorEntryPointBridge` goal unions and fixed mode token maps with active-goal server-owned context.
- [x] 3.2 Derive path-advisor course title, topic, learning objectives, quick prompts, graph grounding, and mode-token context from LearningGoal metadata for every path-ready goal.
- [x] 3.3 Ensure `/api/adaptive/path-advisor-context` and `/api/adaptive/path-advisor-tool` reject unknown goals and preserve graph-node validation for all registered goals.
- [x] 3.4 Add tests for at least one foundation goal, one analysis goal, and one terminal-validation goal beyond `control-correction`.

## 4. Verification

- [x] 4.1 Add or update adaptive-practice UI tests covering all nine goal options, goal switching, and non-control-correction path restore.
- [x] 4.2 Add Konling entrypoint tests proving every visible path-ready goal can obtain title, topic, objectives, quick prompts, graph grounding, mode-token context, and goal-specific prompt metadata.
- [x] 4.3 Run targeted unit tests for adaptive path planner, adaptive-practice page contracts, path-advisor routes, and Konling graph context.
- [x] 4.4 Run `rtk openspec validate dynamic-learning-goal-path-entrypoints --strict`.
- [x] 4.5 Capture browser evidence for the adaptive path center goal selector and one non-control-correction generation flow.
