## 1. Persistence Contract

- [ ] 1.1 Extend the `LearningPath` contract with goal, planner version, status, current node, input snapshot, path payload, explanation payload, alternatives, entry node, terminal validation, and last execution metadata.
- [ ] 1.2 Define `LearningPathExecution`, `LearningPathDeviation`, and path-scoped intervention records or equivalent additive storage.
- [ ] 1.3 Document data ownership, privacy classes, migration, rollback, and legacy mapping to existing recommendation outputs.

## 2. API Boundary

- [ ] 2.1 Add or update route-handler contracts for plan, read, execute, deviation, and intervention writes.
- [ ] 2.2 Enforce authenticated owner-user scope for students and authorized class scope for teachers.
- [ ] 2.3 Make writes idempotent where retries are expected.
- [ ] 2.4 Preserve existing adaptive practice and recommendation behavior when the new path feature flag is disabled.

## 3. Verification

- [ ] 3.1 Add migration or schema tests for additive path-round persistence.
- [ ] 3.2 Add API tests for plan creation, path read, execution write, deviation write, intervention write, and unauthorized access.
- [ ] 3.3 Add tests proving legacy path or recommendation consumers still receive compatible output.
- [ ] 3.4 Run `rtk openspec validate persist-control-correction-path-rounds --strict`.
- [ ] 3.5 Run focused planner, API, and Prisma validation commands required by the implementation.
