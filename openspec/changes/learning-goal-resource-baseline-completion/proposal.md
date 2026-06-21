## Why

The LearningGoal catalog can list multiple path-ready goals, but most goals still lack enough audited resources to generate executable paths. Existing registered resources are field-complete, while runtime lessons, knowledge cards, infographs, media, and quiz candidates need a targeted baseline completion pass.

This change performs the first large-scale resource field completion pass, scoped to the minimum resource mix needed for the first batch of path-ready LearningGoals. It records explicit limitations instead of expanding scope when a goal cannot meet the baseline.

## What Changes

- Complete human-reviewed field mappings for the baseline resource set needed by current path-ready LearningGoals.
- Ensure each in-scope LearningGoal has diagnosis, concept support, practice, checkpoint, and remediation resources or an explicit low-resource limitation.
- Materialize resource coverage overlays that prove coverage by LearningGoal and K/A/Q objective.
- Keep high-complexity resources locked unless readiness metadata and prerequisite resources are complete.
- Preserve low-resource fallback when a LearningGoal cannot yet meet the baseline.

## Capabilities

### Modified Capabilities

- `graph-resource-coverage-overlay`: require LearningGoal baseline coverage reporting.
- `adaptive-learning-path-planning`: require graph-driven paths to respect baseline coverage and readiness gates.

## Impact

- Depends on `resource-field-completion-audit` and `runtime-resource-projection-contract`.
- Affects resource projection data, coverage overlay materialization, planner input preparation, and path readiness tests.
- Does not complete textbook/media grounding at full depth; that follows in `textbook-media-grounding-completion`.
- Does not create the full quiz bank; this change may use existing quiz candidates and must record low-resource limitations where quiz coverage is insufficient. Full diagnostic, checkpoint, and readiness-gate quiz coverage follows in `kaq-quiz-foundation-bank`.
