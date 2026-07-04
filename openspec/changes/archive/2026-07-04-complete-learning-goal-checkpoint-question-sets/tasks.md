## 1. Coverage Policy

- [x] 1.1 Define minimum reviewed item counts by LearningGoal and assessment stage.
- [x] 1.2 Define how terminal-validation LearningGoals combine item checkpoints with typed simulation, workbench, Arena, or project outcomes.
- [x] 1.3 Define blocker behavior for incomplete minimum coverage.

## 2. Item Set Completion

- [x] 2.1 Review and reuse eligible preset adaptive questions.
- [x] 2.2 Review and reuse eligible Prisma `Question` rows.
- [x] 2.3 Review and reuse eligible parsed static AC-Q items from `course-content/questions/questions/AC-Q-*.json`, verifying the current repository file count.
- [x] 2.4 Review and reuse eligible iCourse objective-bank items from `course-content/questions/objective-bank/icourse-bank-bankType4.*`, verifying the current index count.
- [x] 2.5 Author or rewrite additional items for uncovered LearningGoal/stage gaps.
- [x] 2.6 Record review audit, source hash, K/A/Q, graph-node, stage, difficulty, cognitive-level, misconception, and remediation fields for every path-eligible item.

## 3. Coverage Matrix And Tests

- [x] 3.1 Emit LearningGoal-by-stage assessment coverage matrix and limitations.
- [x] 3.2 Add tests that all current path-ready LearningGoals meet the minimum reviewed coverage policy or are explicitly blocked.
- [x] 3.3 Add tests that template/generated/unreviewed items do not count toward minimum coverage.
- [x] 3.4 Run `rtk openspec validate complete-learning-goal-checkpoint-question-sets --strict`.
- [x] 3.5 Run targeted coverage tests.
