## Why

Adaptive assessment currently has several question sources that are not governed as one selectable item catalog: the 50 in-code `PRESET_QUESTIONS`, legacy Prisma `Question` table rows, the `course-content/questions/questions/AC-Q-*.json` parsed static question bank currently counted at 167 files, the `course-content/questions/objective-bank/icourse-bank-bankType4.*` objective-bank artifacts currently counted at 226 items from their index, generated practice questions, and the reviewed K/A/Q foundation-bank artifacts. Because these sources do not share one eligibility and lineage contract, path planning cannot reliably decide which items may be used as readiness checks, checkpoints, remediation practice, or low-stakes variety.

The platform needs a single assessment item catalog before broader manual semantic review and engine wiring can be safe. This catalog should preserve source lineage and historical assessment snapshots while making `path-eligible` selection an explicit reviewed state.

## What Changes

- Define a governed assessment item catalog that registers all current and future adaptive-assessment item sources.
- Normalize item identity, source lineage, immutable content hash, version refs, review state, and path eligibility.
- Distinguish imported, generated, reviewed, deprecated, and path-eligible states.
- Preserve `AdaptiveAssessmentItemRef` as an immutable answer-time snapshot rather than the catalog truth.
- Produce catalog coverage and limitation artifacts for downstream semantic review and engine migration.

## Impact

- Adds a new `adaptive-assessment-item-catalog` capability.
- Provides the prerequisite contract for manual semantic review, LearningGoal checkpoint item completion, and adaptive engine selection.
- Does not manually review all item semantics or switch runtime selection in this change.
