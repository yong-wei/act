## Verification

Generated assessment governance artifacts:

- `course-content/runtime/resource-governance/adaptive-assessment-item-catalog-manifest.json`
  - itemCount: 530
  - pathEligibleItemCount: 137
  - source counts: preset adaptive 50, AC-Q static 167, iCourse objective-bank 226, authored checkpoint 87
- `course-content/runtime/resource-governance/assessment-item-semantic-review-coverage.json`
  - reviewedItemCount: 137
  - pathEligibleItemCount: 137
  - staleReviewCount: 0
- `course-content/runtime/resource-governance/learning-goal-assessment-coverage-matrix.json`
  - learningGoalCount: 9
  - complete: 9
  - limited: 0
  - required stage counts: readiness 3, practice 6, checkpoint 3, remediation 3

Source treatment:

- Existing K/A/Q reviewed seed items remain the main reused reviewed source.
- AC-Q static files are verified at 167 repository files and remain registered but uncounted until semantic review.
- iCourse objective-bank index and JSONL are both verified at 226 items and remain registered but uncounted until semantic review.
- Prisma `Question` rows remain database-backed and are represented by the existing catalog limitation when no DB input is supplied.
- 87 authored reviewed items close current readiness, practice, checkpoint, and remediation gaps; every authored item carries review audit, source hash, K/A/Q objective refs, graph-node refs, stage, difficulty, cognitive level, misconception refs, and remediation refs.
- Stage coverage is counted from the human review decision stage, not from broad `allowedStages`; readiness/checkpoint items cannot satisfy practice/remediation minimums unless their review stage matches that matrix stage.

Local validation:

- `rtk npm run db:adaptive-assessment-item-catalog`
- `rtk npm run db:assessment-item-semantic-review`
- `rtk npm run db:learning-goal-assessment-coverage`
- `rtk npm run test:unit -- src/features/adaptive-assessment/__tests__/adaptive-assessment-item-catalog.test.ts src/features/adaptive-assessment/__tests__/adaptive-assessment-semantic-review.test.ts src/features/adaptive-assessment/__tests__/learning-goal-assessment-coverage.test.ts src/lib/__tests__/adaptive-learning-path-planner.test.ts`
  - 4 files passed
  - 143 tests passed
