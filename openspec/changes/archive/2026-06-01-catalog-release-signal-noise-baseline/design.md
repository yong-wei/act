## Context

The current migration branch has useful but noisy readiness signals. Treating them as one defect would couple unrelated work; ignoring them would make dependency upgrades unverifiable.

## Classification Model

The baseline should classify findings into these lanes:

- `stale-log-residue`: historical errors in `.logs/` that no longer reproduce.
- `command-scope-defect`: verification commands scanning the wrong files or resolving imports from the wrong base path.
- `existing-contract-drift`: tests or fixtures behind current runtime contracts.
- `real-blocking-debt`: a failing gate that represents actual product or governance debt.
- `owned-residual-risk`: true audit/deprecation findings that are deferred to a named migration issue.
- `environment-drift`: local, CI, or server version ambiguity that makes results non-reproducible.

## Evidence To Capture

- Branch and commit.
- Commands run and exact failing summaries.
- Affected files or scripts.
- Whether the signal should be eliminated, allowed temporarily, or preserved as a real blocker.
- The follow-up change responsible for removing or owning the signal.

## Baseline Evidence

Branch: `catalog-release-signal-noise-baseline`
Base branch: `migration/audit-vulnerabilities`
Baseline commit: `3cc67bbdda6e69acad2d9d64f148b737ef20c389`
Capture date: 2026-06-01
Local runtime: Node `v26.0.0`, npm `11.12.1`, Browserslist `4.25.1`

| Signal | Command | Summary | Affected surface | Lane | Disposition | Owner change |
| --- | --- | --- | --- | --- | --- | --- |
| Lint | `rtk proxy npm run lint` | Passed with exit 0. The earlier broad lint-scope concern is not active on this baseline. | `package.json` script `lint`; ESLint project scan. | command-scope-defect | Preserve as a currently clean signal; later command-surface work should keep it scoped and passing. | `stabilize-validation-command-surfaces` |
| Typecheck | `rtk proxy npx tsc --noEmit --pretty false` | Failed with 123 `error TS` lines across 66 parsed source paths. Main clusters include promise-shaped Next route params, AI SDK v6 API drift, missing spreadsheet packages, stale Arena/control fixtures, adaptive assessment transaction mocks, and data-governance JSON shape drift. | `src/app/**/__tests__`, `src/app/api/ai/**`, `src/lib/konling-agent-runtime.ts`, `src/lib/ai-tools.ts`, `src/lib/data-governance/**`, spreadsheet helper imports. | existing-contract-drift | Preserve as a real gate failure until repaired; do not classify as dependency-install noise. | `restore-typecheck-contract-signal` |
| Default test | `rtk proxy npm run test` | Smoke, Arena home-entry, and Arena route checks passed; commercial UI governance failed for `/` because `src/app/page.tsx` contains raw page-local palette literals and the route uses an unregistered route frame. | `scripts/tests/test-commercial-ui-governance.ts`; `src/app/page.tsx`. | real-blocking-debt | Preserve as product/UI governance debt, not dependency noise. | `settle-commercial-ui-governance-noise` |
| Unit test | `rtk proxy npm run test:unit` | Failed: 10 files failed, 229 passed; 14 tests failed, 1788 passed. Clusters: interactive manifest canonical kind/renderer drift, data-governance feature-cache expectations, lesson knowledge-map ordering, dynamic route guard coverage, AI message compatibility, and missing spreadsheet packages. | `src/features/interactive/__tests__`, `src/lib/data-governance/__tests__`, `src/app/api/admin/data-governance/status/__tests__`, spreadsheet route tests, AI compatibility tests. | existing-contract-drift | Preserve as runtime contract debt separate from TypeScript-only repair. | `restore-unit-contract-signal` |
| Model render policy script | `rtk proxy npm run test:model-render-policy` | Failed with `MODULE_NOT_FOUND`: script imports `../src/lib/model-render-policy` from `scripts/tests`, resolving to `scripts/src` instead of repo `src`. | `scripts/tests/test-model-render-policy.ts`. | command-scope-defect | Eliminate as command entrypoint/import-base defect. | `stabilize-validation-command-surfaces` |
| Runtime log residue | `rtk proxy sed -n '1,200p' .logs/database.log` and `.logs/*` listing | `.logs/database.log` contains repeated PostgreSQL `FATAL: database "yw" does not exist` entries from 2026-05-31 and 2026-06-01 plus normal checkpoint/shutdown messages; other log files are currently zero bytes. | `.logs/database.log`; startup/runtime log interpretation. | stale-log-residue | Do not treat historical database log lines as current product failures without a current-run boundary. | `normalize-runtime-log-and-environment-signals` |
| Dependency audit | `rtk proxy npm audit --omit=dev --json` | Failed with 2 moderate vulnerabilities: direct `next` via bundled `next/node_modules/postcss <8.5.10`; npm suggests unsafe `next@9.3.3` semver-major downgrade. | `next`, nested `postcss`; dependency audit governance. | owned-residual-risk | Preserve as real owned residual risk with explicit allowlist/removal condition; reject unsafe downgrade. | `own-dependency-audit-residual-signals` |
| Deprecated package warnings | Existing series evidence in `own-dependency-audit-residual-signals` | Residual deprecation owners are already identified: ESLint 8 transitive packages, Tailwind 3 `sucrase -> glob@10.5.0`, and Drei 9 `three-mesh-bvh@0.7.8` where Drei 10 requires React 19/R3F 9. | ESLint dev tooling, Tailwind transitive tooling, React 18/R3F 8/Drei 9 graphics dependency line. | owned-residual-risk | Preserve as real owned residual signals with owner issue and removal condition; do not treat them as local install residue or security audit findings. | `own-dependency-audit-residual-signals` |
| Package tree / extraneous packages | `rtk proxy npm ls --depth=0 --json` | Failed with `ELSPROBLEMS`: invalid installed versions for Next/AI/BullMQ/mathjs/postcss/tailwind/vitest and others, missing `read-excel-file` and `write-excel-file`, plus extraneous packages including `xlsx`, `@auth/prisma-adapter`, `jose`, and native remnants. | Local `node_modules`; package install hygiene. | environment-drift | Eliminate through clean install and environment normalization; do not encode these local residues as package manifest changes in this baseline. | `normalize-runtime-log-and-environment-signals` |
| Clean-install drift | `rtk proxy npm ci --dry-run --ignore-scripts` | Dry run would add 74 packages, remove 78, and change 73, including adding spreadsheet packages, aligning Next/AI/Vitest/Tailwind/PostCSS, and removing stale `xlsx`/adapter remnants. | Lockfile-to-`node_modules` reproducibility. | environment-drift | Use as evidence that current local install is stale; actual install hygiene belongs to follow-up work. | `normalize-runtime-log-and-environment-signals` |
| Browserslist data | `rtk proxy npm run test:unit` | Vitest run emitted: `Browserslist: browsers data (caniuse-lite) is 6 months old`. | Browserslist/caniuse-lite data freshness. | environment-drift | Eliminate as reproducibility hygiene, separate from UI behavior. | `normalize-runtime-log-and-environment-signals` |
| Node version | `rtk proxy node -v && rtk proxy npm -v && rtk proxy npx browserslist --version` | Local run uses Node `v26.0.0` and npm `11.12.1`; package metadata does not yet declare an intended Node/package-manager contract. | Local/CI/server runtime comparability. | environment-drift | Add supported runtime metadata in follow-up; do not infer product failures from Node-version drift alone. | `normalize-runtime-log-and-environment-signals` |

## Blocker Classification

Real blockers that should remain red until fixed:

- `npm run test` commercial UI governance failure on `/`.
- `npx tsc --noEmit --pretty false` TypeScript contract failures.
- `npm run test:unit` runtime contract failures.
- `npm audit --omit=dev --json` residual Next/PostCSS moderate finding, unless explicitly governed with owner and review condition.
- Residual deprecation warnings for ESLint 8, Tailwind 3 `glob@10.5.0`, and Drei 9 `three-mesh-bvh@0.7.8`, unless explicitly governed with owner and removal condition.

Noise or environment signals to eliminate before they are used as release evidence:

- `test:model-render-policy` import-base failure.
- Historical `.logs/database.log` entries without a current-run boundary.
- Stale local `node_modules` state, missing spreadsheet packages, extraneous packages, Browserslist data age, and undeclared Node/package-manager contract.

## Boundaries

This change is documentation and coordination only. It must not modify source, tests, scripts, package manifests, lockfiles, or logs.

## Verification

- `rtk openspec validate catalog-release-signal-noise-baseline --strict`
- Confirm `git diff --name-only` for this change contains only the OpenSpec artifacts for this baseline.
