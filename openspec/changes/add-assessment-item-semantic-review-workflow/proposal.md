## Why

After assessment items are registered in one catalog, the main risk becomes false semantic authority. Imported questions, generated questions, and legacy table rows may have plausible tags, but adaptive learning depends on exact LearningGoal, K/A/Q objective, graph-node, difficulty, cognitive-level, misconception, remediation, and stage semantics. These fields cannot be trusted if they are inferred by a script without human review.

The platform needs a repeatable semantic review workflow so agents and teachers can review items in batches, record audit decisions, and keep unreviewed items visible without letting them drive path readiness.

## What Changes

- Add an assessment item semantic review packet and validation workflow.
- Require manual review audit before an item can become `semantically-reviewed` or `path-eligible`.
- Cover all catalog sources, including the 50 preset questions, legacy Prisma `Question` rows, current AC-Q static files, current iCourse objective-bank items, generated questions, and K/A/Q foundation-bank items.
- Extend data-quality gates so missing semantic review blocks path eligibility rather than silently degrading selection.
- Produce review backlog, reviewed snapshot, and semantic coverage reports.

## Impact

- Builds on `unify-adaptive-assessment-item-catalog`.
- Extends `adaptive-assessment-item-catalog` and `course-data-quality-gates`.
- Does not complete the full item review backlog; it provides the workflow and gates used by later item completion.
