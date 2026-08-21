# Verification

Date: 2026-08-21

## Completed locally

- `node scripts/tests/test-math-calc-wolfram.mjs` passed on the local activated WolframScript 1.14.0 / Wolfram Engine 15.0.
- `npx --yes tsx ./scripts/tests/test-konling-math-real-smoke.ts` passed: real shared executor Laplace result and representative Konling inverse-Laplace precompute context.
- `npx vitest run src/app/api/math/calculate/__tests__/route.real-smoke.test.ts` passed: authenticated `/api/math/calculate` handler returned a real Wolfram result.
- `npx vitest run src/lib/__tests__/math-calc.test.ts src/lib/__tests__/konling-math-precompute.test.ts src/lib/__tests__/konling-agent-runtime.test.ts` passed: 3 files, 225 tests.
- `npm run typecheck` passed.
- `npx --yes @fission-ai/openspec validate switch-konling-math-to-wolfram-precompute --type change --strict` passed; `add-teaching-grade-wolfram-derivations` also passed. Other unrelated active changes have pre-existing validation failures and are not part of this PR.
- `git diff --check` reported no whitespace errors.
- WSL `sh -n` syntax check passed for `docker-entrypoint.sh` and `scripts/math-calc/check-wolfram-ready.sh`.

## Not completed in this local environment

- Building and running the final production-equivalent container image: Docker is not available in this Windows workspace. `scripts/tests/test-docker-migration-readiness.mjs` now supports `MATH_CALC_TEST_IMAGE` and `MATH_CALC_TEST_NEGATIVE_IMAGE` for a real in-container Wolfram smoke and for asserting that a Wolfram-less image is rejected by the entrypoint; these must be executed where Docker exists.
- Running-chat-service HTTP E2E: no PostgreSQL/model service is available locally, so `tasks.md` 3.4 remains unchecked and the PR body must not claim this acceptance as final evidence.
- Re-running the full verification on the final test-merge revision: `origin/integration` is 225 commits ahead of the branch merge-base; `git merge-tree --write-tree origin/integration HEAD` reports no conflicts for the committed branch tip, but the commit gate suite must be re-run on the intended merge revision after rebase/merge.
