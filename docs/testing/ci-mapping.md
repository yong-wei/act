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

The historical `npm test` commercial UI evidence validator is not a PR command. It is a `test:release` component.
The historical Playwright bundle `test:integration` is retained as `test:e2e:playwright` and is not the integration command contract.

Pinned charter: `76850de671d65e821dd2acebe070ab23d6a3f26a3a7d9f9527e32af75c957396`.
Pinned census: `40549dcad9b03da31abc6ef05c5ede5bff4e04b47268f86450831aa39788c52a`.
