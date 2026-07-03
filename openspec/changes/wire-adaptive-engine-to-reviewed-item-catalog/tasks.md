## 1. Selection Layer

- [ ] 1.1 Add a catalog-backed assessment item selector.
- [ ] 1.2 Filter candidates by LearningGoal, path node, stage, review state, eligibility, source freshness, readiness, and asked/answered history.
- [ ] 1.3 Preserve low-stakes provisional generated practice with degraded confidence.

## 2. API And Persistence

- [ ] 2.1 Route `/api/assessment/next-question` and adaptive engine calls through the catalog selector for path-scoped requests.
- [ ] 2.2 Snapshot catalog item metadata into `AdaptiveAssessmentItemRef`.
- [ ] 2.3 Preserve historical answer restoration for pre-catalog refs.
- [ ] 2.4 Return honest limitation states when no reviewed path-eligible candidate exists.

## 3. Planner And Evidence

- [ ] 3.1 Bind selected assessment items to path node outcome refs and checkpoint evidence.
- [ ] 3.2 Prevent provisional/generated items from unlocking heavy nodes or satisfying terminal validation.
- [ ] 3.3 Ensure path execution and learner evidence consume typed assessment outcome refs.

## 4. Verification

- [ ] 4.1 Add tests for all current path-ready LearningGoals and required assessment stages.
- [ ] 4.2 Add tests for duplicate prevention, stale item rejection, incomplete coverage fallback, and historical snapshot restoration.
- [ ] 4.3 Run `rtk openspec validate wire-adaptive-engine-to-reviewed-item-catalog --strict`.
- [ ] 4.4 Run targeted adaptive assessment and path planning tests.
