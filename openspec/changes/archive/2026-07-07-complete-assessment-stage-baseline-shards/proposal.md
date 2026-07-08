## Why

The current completeness helper still reports all path-ready LearningGoals as limited because diagnostic, practice, checkpoint, and remediation assessment stages have no reviewed path-eligible coverage. The earlier baseline change established the policy, but the remaining work is too large to finish honestly as one open-ended semantic pass.

This change opens the next executable assessment batch: a fixed shard of the lowest-completeness assessment stages, reviewed item by item against source questions and LearningGoal semantics.

## What Changes

- Generate or reuse a deterministic assessment baseline shard that targets the lowest-completeness LearningGoal/stage cells first.
- Review candidate items item by item against source content, answer/rubric context, graph nodes, K/A/Q objectives, difficulty, cognitive level, misconception/remediation fit, and source hash.
- Reuse existing registered question sources before authoring new items.
- Author only the minimum new items needed for this shard when no existing item can satisfy the reviewed stage requirement.
- Preserve helper before/after evidence and leave all unselected items in the workqueue with residual counts.

## Impact

- Improves the most visible shortfall in path planning: LearningGoal assessment stage coverage.
- Does not claim full assessment completeness for every LearningGoal.
- Does not block Yang Fan or other test-account fixture data completion.
