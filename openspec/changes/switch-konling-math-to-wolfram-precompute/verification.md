# Verification

Date: 2026-08-21
Stable HEAD for the local run: f720835c8`nLatest verified HEAD: 6475f9146

## Remediation status (2026-08-22)

- Docker cross-libc: `base`/`deps`/`prod-deps`/`builder` 已统一到 `node:20-bookworm-slim`，避免 Alpine musl 原生模块进入 glibc runner；已增加 same-distro 回归断言，真实生产镜像构建仍待 green。
- `calc.wls`: 已恢复 `Sqrt`/`Factorial`/`Gamma` 的 plain 归一化与 held allowlist，并让未知 plain 函数调用 fail closed；已补 `sqrt`/`factorial`/unknown-function 回归用例，真实 Wolfram 运行需在已激活环境重跑。
- 2026-08-22: `npm run typecheck` 通过；`math-calc`/`konling-math-precompute` 相关 Vitest 21 项通过；`git diff --check` 通过。

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

## Verification tooling added

- `.github/workflows/docker-wolfram-verify.yml` builds the production-equivalent image, runs the in-container `MATH_CALC_TEST_IMAGE` Wolfram smoke through the default entrypoint, and asserts a Wolfram-less negative image is rejected fail-closed. It is triggered by `workflow_dispatch`; the runner must provide at least 20 GiB Docker VM memory and the repository must expose `WOLFRAM_ACTIVATION_EMAIL`/`WOLFRAM_ACTIVATION_PASSWORD` or `WOLFRAMSCRIPT_ENTITLEMENTID` secrets.
- `scripts/tests/test-konling-http-e2e.mjs` records the running-chat-service HTTP E2E evidence for the representative inverse-Laplace question and asserts no `calculate` tool call plus Wolfram/verification content. It requires a running service with PostgreSQL, an authenticated session cookie (`KONLING_E2E_AUTH_COOKIE`), and a configured model provider.

## GitHub Actions run history

- Run `32507278912` and `32507769322` both failed at `Build production image` with `no space left on device` on the default `ubuntu-latest` runner. The repository variable `WOLFRAM_VERIFY_RUNNER` is now set to `ubuntu-latest-16-cores`; the verification is being re-run on that runner.
- Run `32563554313`（job `97008737125`）for HEAD `09e17b217` is still `queued` as of 2026-08-22; production-equivalent image and Wolfram-less negative image must both be green before this P1 can clear.

## Not completed in this local environment

- Building and running the final production-equivalent container image: Docker is not available in this Windows workspace. `scripts/tests/test-docker-migration-readiness.mjs` now supports `MATH_CALC_TEST_IMAGE` and `MATH_CALC_TEST_NEGATIVE_IMAGE` for a real in-container Wolfram smoke and for asserting that a Wolfram-less image is rejected by the entrypoint; these must be executed where Docker exists.
- Running-chat-service HTTP E2E: no PostgreSQL/model service is available locally, so `tasks.md` 3.4 remains unchecked and the PR body must not claim this acceptance as final evidence.
- Re-running the full verification on the final test-merge revision: `origin/integration` is currently at `b0314b1e2`; branch HEAD is `09e17b217`; merge-base is `661c09a1e`; branch is behind 27 / ahead 16. The commit gate suite must be re-run on the intended merge revision after runtime acceptance and final sync.
