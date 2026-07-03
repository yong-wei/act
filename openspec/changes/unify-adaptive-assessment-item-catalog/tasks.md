## 1. Catalog Contract

- [ ] 1.1 Define catalog item identity, source lineage, content hash, review state, eligibility state, and version refs.
- [ ] 1.2 Define how catalog items relate to immutable `AdaptiveAssessmentItemRef` answer snapshots.
- [ ] 1.3 Define eligibility states for low-stakes practice, readiness, checkpoint, remediation, and terminal validation.

## 2. Source Registration

- [ ] 2.1 Register the existing 50 preset adaptive questions.
- [ ] 2.2 Register existing Prisma `Question` records and report import limitations when data is incomplete.
- [ ] 2.3 Register the parsed static AC-Q question bank from `course-content/questions/questions/AC-Q-*.json` and verify the current 167-item file count.
- [ ] 2.4 Register the iCourse objective-bank artifacts from `course-content/questions/objective-bank/icourse-bank-bankType4.*` and verify the current 226-item index count.
- [ ] 2.5 Register K/A/Q foundation-bank reviewed items without duplicating historical snapshots.
- [ ] 2.6 Register generated questions as provisional and non-path-eligible by default.

## 3. Artifacts And Validation

- [ ] 3.1 Emit catalog manifest, item snapshot, and limitation artifacts.
- [ ] 3.2 Add tests for source counts, identity stability, eligibility states, and snapshot immutability.
- [ ] 3.3 Run `rtk openspec validate unify-adaptive-assessment-item-catalog --strict`.
- [ ] 3.4 Run targeted catalog tests.
