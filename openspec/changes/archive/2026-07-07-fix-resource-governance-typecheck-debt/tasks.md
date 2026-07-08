## Tasks

- [x] 1. Reproduce and isolate the resource-governance cluster from `rtk npx tsc --noEmit --pretty false`.
- [x] 2. Fix helper/source type mismatches in resource field-completion and baseline code.
- [x] 3. Update resource-governance test fixtures to current review audit and evidence-contract shapes.
- [x] 4. Run focused tests for touched resource-governance files.
- [x] 5. Run full `rtk npx tsc --noEmit --pretty false` and document remaining clusters outside this change.

## Verification Notes

- `rtk npm run test:unit -- src/lib/__tests__/resource-field-completion-audit.test.ts src/lib/__tests__/textbook-media-grounding.test.ts` passed: 2 files, 42 tests.
- `rtk npx tsc --noEmit --pretty false` now reports 69 errors in 20 files, with no remaining errors in the four files scoped to this change.
- Remaining clusters are outside this change: adaptive assessment fixtures, Arena evidence/submission fixtures, assessment/classroom/interactive UI fixtures, adaptive learner/path planner fixtures, Konling context fixtures, resource-node-registry media fixtures, source-pack fixtures, learning-evidence/SAR/teacher-evidence data-governance fixtures, and AppShell governance role fixture.
