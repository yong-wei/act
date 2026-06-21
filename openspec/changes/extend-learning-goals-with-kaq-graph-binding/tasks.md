## 1. LearningGoal Package Contract

- [ ] 1.1 Define LearningGoal package types and validation rules on top of existing registered goal contracts.
- [ ] 1.2 Add package fields for K/A/Q objective ids, graph node ids, resource mix, evidence policy, terminal validation policy, status, and version.
- [ ] 1.3 Add student-facing goal title, description, intent type, and completion meaning fields.

## 2. Catalog Seeding

- [ ] 2.1 Upgrade `control-correction` into a LearningGoal package without breaking existing consumers.
- [ ] 2.2 Upgrade `frequency-response-foundations` into a LearningGoal package without breaking existing consumers.
- [ ] 2.3 Add at least six additional automatic-control `path-ready` LearningGoal packages.
- [ ] 2.4 Ensure every `path-ready` package binds at least one quality objective and records a governed evidence limitation when quality evidence is not fully available.

## 3. Compatibility

- [ ] 3.1 Preserve existing adaptive path registered-goal lookups.
- [ ] 3.2 Expose LearningGoal package metadata for later graph expansion and graph-center entry points.
- [ ] 3.3 Reject unknown package ids through the existing governed error path.

## 4. Verification

- [ ] 4.1 Add tests for package validation and minimum catalog coverage.
- [ ] 4.2 Add tests proving existing `control-correction` and `frequency-response-foundations` path calls remain compatible.
- [ ] 4.3 Run `rtk openspec validate extend-learning-goals-with-kaq-graph-binding --strict`.
