## Tasks

- [x] 1. Reproduce and isolate the Konling typecheck cluster.
- [x] 2. Add narrow typed helpers for Konling tool-result assertions.
- [x] 3. Update stale Konling context keys, page types, knowledge types, and learner-state fixtures.
- [x] 4. Run focused Konling tests where practical.
- [x] 5. Run full `rtk npx tsc --noEmit --pretty false` and document remaining clusters outside this change.

## Verification Notes

- Focused Konling tests pass: `rtk npm run test:unit -- src/lib/__tests__/konling-agent-runtime.test.ts src/lib/__tests__/konling-teaching-assistant-server-context.test.ts` (167 tests).
- Full typecheck was rerun with output captured to `/tmp/tsc-853-final-review.log` after local review fixes: the scoped Konling files have no remaining errors.
- The remaining full typecheck debt is outside this change: 49 errors across 19 files, including resource field audit, adaptive assessment coverage, Arena evidence/leaderboard, assessment/classroom/interactive tests, adaptive learner/path planner tests, resource node/source-pack tests, data-governance RAG/SAR/teacher evidence tests, `src/lib/resource-node-registry.ts`, and `tests/appshell-governance-representative-matrix.spec.ts`.
