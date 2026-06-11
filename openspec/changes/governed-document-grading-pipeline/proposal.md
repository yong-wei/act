## Why

The current document grading workbench defines submission, conversion, Rubric, evidence references, annotations, teacher approval, and LearningFact writeback as service-layer contracts. That is enough for a scripted demo, but not enough for a durable assistant closed loop. The platform needs first-class persisted artifacts so PDF or Office submissions can be converted, anchored, graded, reviewed, returned, and written back with auditability.

## What Changes

- Persist document submission assets, conversion artifacts, rubric assessments, and annotation anchors.
- Run document conversion through MarkItDown or a fallback adapter and preserve block/page references with confidence.
- Produce draft rubric assessments that require criterion-level evidence anchors.
- Keep teacher approval as the only path to returned feedback and profile writeback.
- Add grading APIs and UI contracts for upload, draft grading, review, writeback, and student feedback.

## Capabilities

### Modified Capabilities

- `document-rubric-grading-workbench`
- `learning-evidence-rag-corpus`
- `role-based-learning-diagnosis`

## Impact

- Adds data models and APIs for document grading lifecycle.
- Extends current workbench and feedback pages from demo-state to persisted workflow.
- Feeds approved grading evidence into learner-state, diagnosis, paths, RAG, and teacher prep packs.
- Does not implement the diagnosis indicator engine itself.
