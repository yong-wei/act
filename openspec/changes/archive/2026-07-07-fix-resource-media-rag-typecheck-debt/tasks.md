## Tasks

- [x] 1. Reproduce and isolate the ResourceNode/media/RAG cluster.
- [x] 2. Update media manifest fixtures to current contract shapes.
- [x] 3. Update Source Pack and RAG citation fixtures to current required fields.
- [x] 4. Fix the production ResourceNode projection type mismatch if required.
- [x] 5. Run focused ResourceNode/RAG tests and full `rtk npx tsc --noEmit --pretty false`.

## Verification Notes

- Baseline full typecheck captured 13 scoped ResourceNode/media/RAG errors in `/tmp/tsc-854-baseline.log`.
- Focused ResourceNode/RAG tests pass: `rtk npm run test:unit -- src/lib/__tests__/resource-node-registry.test.ts src/lib/__tests__/source-pack-corpus-adapters.test.ts src/lib/__tests__/source-pack.test.ts src/lib/data-governance/__tests__/learning-evidence-rag-corpus.test.ts` (160 tests).
- Full typecheck was rerun after rebasing onto the #853 integration baseline with output captured to `/tmp/tsc-854-after-rebase.log`: the scoped ResourceNode/media/RAG files have no remaining errors.
- The remaining full typecheck debt is outside this change: 36 errors, including resource field audit, adaptive assessment coverage, Arena evidence/leaderboard, assessment/classroom/interactive tests, adaptive learner/path planner tests, SAR/teacher evidence tests, and AppShell governance tests.
