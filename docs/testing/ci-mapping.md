# CI command mapping

Each required CI check must invoke exactly one governed local command, or a documented composition of governed commands, with the same scope and receipt semantics.

| command id | npm script | current CI check | scope |
| --- | --- | --- | --- |
| `test` | `test` | .github/workflows/ci.yml job `quality` | pr-default-deterministic-fast-mandatory |
| `test:unit` | `test:unit` | none yet; later CI change must reuse this command id | all-domain-pure-unit-tests |
| `test:contract` | `test:contract` | none yet; later CI change must reuse this command id | api-event-manifest-bundle-wasm-facade-boundaries |
| `test:integration` | `test:integration` | none yet; later CI change must reuse this command id | postgres-redis-worker-repository-filesystem-adapters |
| `test:e2e:critical` | `test:e2e:critical` | none yet; later CI change must reuse this command id | critical-user-journeys-only |
| `test:release` | `test:release` | none yet; later CI change must reuse this command id | explicit-release-qualification-evidence |
| `test:nightly` | `test:nightly` | none yet; later CI change must reuse this command id | full-visual-performance-real-provider-smoke |

## TypeScript graph mapping

The production typecheck command is an aggregate of the two production graphs;
tooling and test graphs remain independent inputs and are not swallowed by the
root compatibility `tsconfig.json`.

| graph command | npm script | scope | CI/release contract |
| --- | --- | --- | --- |
| `typecheck:web` | `typecheck:web` | Next App Router production | production aggregate |
| `typecheck:worker` | `typecheck:worker` | worker/scheduler production | production aggregate |
| `typecheck:tools` | `typecheck:tools` | content/knowledge/runtime/evidence/one-off tooling | PR/integration mandatory; main/release receipt required |
| `typecheck:test` | `typecheck:test` | Vitest/Playwright/script tests | PR/integration mandatory; main/release receipt required |

Each command writes a graph manifest and a revision-bound measurement receipt
under `.logs/typescript-graphs/`. `typecheck:tools` and `typecheck:test` cannot
be replaced by `test:nightly`; missing, stale, dirty, or failed receipts must
fail closed in the consuming PR/integration and main/release gates.

The historical `npm test` commercial UI evidence validator is not a PR command. It is a `test:release` component.
The historical Playwright bundle `test:integration` is retained as `test:e2e:playwright` and is not the integration command contract.

Pinned charter: `76850de671d65e821dd2acebe070ab23d6a3f26a3a7d9f9527e32af75c957396`.
Pinned census: `40549dcad9b03da31abc6ef05c5ede5bff4e04b47268f86450831aa39788c52a`.
