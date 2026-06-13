## Why

The document grading workflow exists, but the draft grader still behaves like a scaffold: it anchors evidence and chooses a middle rubric level rather than evaluating control-design reasoning. For competition use, the platform needs teacher-approved professional grading that can explain criterion-level judgments, formula or chart issues, teacher overrides, and student remediation actions.

## What Changes

- Replace scaffold draft grading with a schema-validated evaluator contract for control-correction documents.
- Add rubric criteria that cover model assumptions, target specification, compensator design, simulation evidence, and written engineering rationale.
- Require evidence anchors for every draft criterion assessment and block invalid evaluator outputs from writeback.
- Track AI draft versus teacher-approved deltas, override rate, and feedback visibility metrics for effect reports.
- Enrich student feedback with action cards that link grading comments to diagnosis, learning paths, and resources.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `document-rubric-grading-workbench`: upgrades draft grading, teacher review, student feedback, writeback, and quality metric requirements.
- `intelligent-teaching-assistant-demo-package`: requires grading quality metrics and professional grading artifacts to be represented in demo/effect exports.

## Impact

- Affects document conversion, rubric definitions, draft evaluator adapters, grading workbench UI, student feedback UI, LearningEvidenceDraft persistence, writeback preview, assistant effect-report metrics, and tests.
- Depends on `freeze-competition-baseline`.
- Should consume shared citation/evidence surfaces when `harden-assistant-evidence-loop` is complete, but can keep its own anchors until that dependency lands.
