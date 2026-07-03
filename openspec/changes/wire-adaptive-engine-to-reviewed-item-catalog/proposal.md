## Why

Even with a governed catalog and reviewed item sets, the student experience will remain inconsistent if `/api/assessment/next-question` and the adaptive engine continue to select from hard-coded presets or generated questions first. The engine must select from reviewed, path-eligible catalog items when a request is tied to a LearningGoal, path node, checkpoint, readiness gate, or remediation stage.

The runtime also needs to preserve compatibility: historical answer snapshots must still render, generated questions may remain available for limited practice, and incomplete catalog coverage should produce honest limitations instead of silent fallback.

## What Changes

- Route adaptive next-question selection through the reviewed assessment item catalog.
- Select by server-owned LearningGoal, path, node, assessment stage, learner state, and asked/answered history.
- Snapshot selected catalog item metadata into `AdaptiveAssessmentItemRef`.
- Prevent generated/provisional items from satisfying readiness, checkpoint, remediation gate, or terminal-validation policies.
- Add tests for all current path-ready LearningGoals and path stages.

## Impact

- Depends on unified catalog, semantic review workflow, and LearningGoal checkpoint item completion.
- Modifies adaptive assessment persistence and adaptive learning path planning behavior.
- Preserves historical answer readability and compatibility for existing clients.
