# Verification

Date: 2026-08-21
Stable HEAD for the local run: f720835c8

## Completed locally

- `node scripts/tests/test-math-calc-wolfram.mjs` passed on the local activated WolframScript 1.14.0 / Wolfram Engine 15.0.
- `npx --yes tsx ./scripts/tests/test-konling-math-real-smoke.ts` passed: real shared executor Laplace result and representative Konling inverse-Laplace precompute context.
- `npx vitest run src/app/api/math/calculate/__tests__/route.real-smoke.test.ts src/lib/__tests__/math-calc.test.ts src/lib/__tests__/konling-math-precompute.test.ts src/lib/__tests__/konling-agent-runtime.test.ts` passed: 4 files, 226 tests.
- `npm run typecheck` passed.
- `npm run verify:commit` passed.
- `npx --yes @fission-ai/openspec validate switch-konling-math-to-wolfram-precompute --type change --strict` passed; `add-teaching-grade-wolfram-derivations` also passed. Other unrelated active changes have pre-existing validation failures and are not part of this PR.
- `git diff --check` reported no whitespace errors.
- WSL `sh -n` syntax check passed for `docker-entrypoint.sh` and `scripts/math-calc/check-wolfram-ready.sh`.
- `deploy/podman/deploy.sh` and `scripts/remote-deploy.sh` were wired to provision a persistent Wolfram licensing volume, forward activation secrets, run a real in-image `check-wolfram-ready.sh` smoke before application startup, and re-verify `calc.wls` during remote deployment. Bash syntax checks passed after CRLF normalization.
- `scripts/math-calc/check-wolfram-ready.sh` passed a real smoke against local WolframScript 1.14.0 / Wolfram Engine 15.0 through WSL, and returned non-zero when the command is missing.
- After committing the AI-provider remediation as `f720835c8`, `npm run typecheck` and the focused provider-settings Vitest files passed (34/35). The sole failure is the DeepSeek curl abort test, which cannot run on this Windows host because the fixture creates a shebang `curl` file without an executable extension; it is a local-environment issue unrelated to this change and must be re-run on Linux/CI.

## Not completed in this local environment

- Building and running the final production-equivalent container image: Docker is not available in this Windows workspace. `scripts/tests/test-docker-migration-readiness.mjs` now supports `MATH_CALC_TEST_IMAGE` and `MATH_CALC_TEST_NEGATIVE_IMAGE` for a real in-container Wolfram smoke and for asserting that a Wolfram-less image is rejected by the entrypoint; these must be executed where Docker exists.
- Running-chat-service HTTP E2E: no PostgreSQL/model service is available locally, so `tasks.md` 3.4 remains unchecked and the PR body must not claim this acceptance as final evidence.
- Re-running the full verification on the final test-merge revision: `origin/integration` is currently 236 commits ahead of the branch merge-base (`e4ba81298`); the commit gate suite must be re-run on the intended merge revision after rebase/merge.
