## Why

LearningGoal is the student-facing truth for knowledge, capability, and quality objectives. Existing planner compatibility fields can still be broader than the LearningGoal package, which allows unrelated but generally high-scoring resources to enter paths. This is one reason multiple generated path cards can look identical or drift toward old correction resources.

The platform needs path generation to treat LearningGoal K/A/Q objective ids and graph targets as the planning boundary, with legacy knowledge or competency fields acting only as compatibility signals.

## What Changes

- Make LearningGoal K/A/Q objectives and target graph nodes the candidate boundary for graph-driven path planning.
- Treat legacy `knowledgeTargets` and `competencyTargets` as compatibility or scoring features, not as the canonical boundary when a LearningGoal is available.
- Require path diagnostics to explain resources excluded for objective mismatch and resources included through explicit LearningGoal coverage.
- Add tests for all nine registered LearningGoals proving generated candidates are bounded by LearningGoal K/A/Q metadata.

## Impact

- Affects adaptive path planner filtering, LearningGoal catalog consumption, diagnostics, and tests.
- Depends on unified planner candidate loading for full verification.
- Does not complete resource metadata; it enforces the semantics that completed metadata must satisfy.
