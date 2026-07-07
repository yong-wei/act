## 1. Catalog Contract

- [x] 1.1 Define catalog item identity, source lineage, content hash, review state, eligibility state, and version refs.
- [x] 1.2 Define how catalog items relate to immutable `AdaptiveAssessmentItemRef` answer snapshots.
- [x] 1.3 Define eligibility states for low-stakes practice, readiness, checkpoint, remediation, and terminal validation.

## 2. Source Registration

- [x] 2.1 Register the existing 50 preset adaptive questions.
- [x] 2.2 Register existing Prisma `Question` records and report import limitations when data is incomplete.
- [x] 2.3 Register the parsed static AC-Q question bank from `course-content/questions/questions/AC-Q-*.json` and verify the current 167-item file count.
- [x] 2.4 Register the iCourse objective-bank artifacts from `course-content/questions/objective-bank/icourse-bank-bankType4.*` and verify the current 226-item index count.
- [x] 2.5 Register K/A/Q foundation-bank reviewed items without duplicating historical snapshots.
- [x] 2.6 Register generated questions as provisional and non-path-eligible by default.

## 3. Artifacts And Validation

- [x] 3.1 Emit catalog manifest, item snapshot, and limitation artifacts.
- [x] 3.2 Add tests for source counts, identity stability, eligibility states, and snapshot immutability.
- [x] 3.3 Run `rtk openspec validate unify-adaptive-assessment-item-catalog --strict`.
- [x] 3.4 Run targeted catalog tests.
