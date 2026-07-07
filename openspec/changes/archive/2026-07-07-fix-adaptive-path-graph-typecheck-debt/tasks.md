## Tasks

- [x] 1. Reproduce and isolate the adaptive path/graph cluster.
- [x] 2. Update graph coverage and path graph fixtures to current contracts.
- [x] 3. Update LearningGoal, learner-state, and assessment coverage fixtures.
- [x] 4. Run focused adaptive path/graph tests where practical.
- [x] 5. Run full `rtk npx tsc --noEmit --pretty false` and document remaining clusters outside this change.

## Verification Notes

- Baseline full typecheck captured 10 scoped adaptive path/graph errors in `/tmp/tsc-856-baseline.log`.
- Focused adaptive path/graph tests pass: `rtk npm run test:unit -- src/features/adaptive-assessment/__tests__/learning-goal-assessment-coverage.test.ts src/lib/__tests__/adaptive-learner-state-service.test.ts src/lib/__tests__/adaptive-learning-path-planner.test.ts src/lib/__tests__/control-correction-path-rounds.test.ts` (181 tests).
- Full typecheck was rerun with output captured to `/tmp/tsc-856-final.log`: the scoped adaptive path/graph files have no remaining errors.
- The remaining full typecheck debt is outside this change: 36 errors across existing non-scoped clusters.
