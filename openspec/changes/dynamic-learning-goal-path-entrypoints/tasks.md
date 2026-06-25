## 1. LearningGoal Catalog Projection

- [ ] 1.1 Add a shared adaptive path LearningGoal option projection derived from `listLearningGoals()`.
- [ ] 1.2 Include student-facing title, description, completion meaning, intent type, recommended phase, terminal-validation summary, limitations, and route hrefs in the projection.
- [ ] 1.3 Add catalog validation tests that fail when any `path-ready` LearningGoal lacks path entrypoint metadata or Konling context metadata.
- [ ] 1.4 Add a regression assertion that all current nine path-ready LearningGoals are projectable.

## 2. Adaptive Path Center Dynamic Goals

- [ ] 2.1 Replace `AdaptivePracticeGoalId` two-value unions and hard-coded goal labels with catalog-validated dynamic goal ids.
- [ ] 2.2 Render generation goal options from the catalog projection instead of the page-local `generationGoalOptions` literal.
- [ ] 2.3 Update URL resolution, session storage, latest-path restore, path selection, path execution, evidence review, and generate-new-path actions to preserve the selected LearningGoal id.
- [ ] 2.4 Rename active path page state and helpers away from `controlCorrection*` where they affect dynamic goal behavior.
- [ ] 2.5 Render unknown-goal and incomplete-context states as student-safe unavailable or generic path-center fallbacks without calling planner or Konling tools.

## 3. Konling Dynamic Path Advisor

- [ ] 3.1 Replace fixed `PathAdvisorEntryPointBridge` goal unions and fixed mode token maps with active-goal server-owned context.
- [ ] 3.2 Derive path-advisor course title, topic, learning objectives, quick prompts, graph grounding, and mode-token context from LearningGoal metadata for every path-ready goal.
- [ ] 3.3 Ensure `/api/adaptive/path-advisor-context` and `/api/adaptive/path-advisor-tool` reject unknown goals and preserve graph-node validation for all registered goals.
- [ ] 3.4 Add tests for at least one foundation goal, one analysis goal, and one terminal-validation goal beyond `control-correction`.

## 4. Verification

- [ ] 4.1 Add or update adaptive-practice UI tests covering all nine goal options, goal switching, and non-control-correction path restore.
- [ ] 4.2 Add Konling entrypoint tests proving every visible path-ready goal can obtain title, topic, objectives, quick prompts, graph grounding, mode-token context, and goal-specific prompt metadata.
- [ ] 4.3 Run targeted unit tests for adaptive path planner, adaptive-practice page contracts, path-advisor routes, and Konling graph context.
- [ ] 4.4 Run `rtk openspec validate dynamic-learning-goal-path-entrypoints --strict`.
- [ ] 4.5 Capture browser evidence for the adaptive path center goal selector and one non-control-correction generation flow.
