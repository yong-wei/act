# Test command contracts

Observation counts are revision-bound. Read `docs/testing/baseline/discovery-core.json` for the current denominator.

- schemaVersion: `act-test-command-contracts/v1`
- sourceCommit: `49117482cdda904ac0fde0ba33c93c82fe45d48d`
- sourceTree: `2614e8ae6eb6c84f08f156d8f90f69c5a105a4f3`
- baseline census: `40549dcad9b03da31abc6ef05c5ede5bff4e04b47268f86450831aa39788c52a`
- charter: `76850de671d65e821dd2acebe070ab23d6a3f26a3a7d9f9527e32af75c957396`
- discovered: 1233
- classified: 1230
- excluded: 3
- unresolved: 0
- discoveryCoreHash: `5531b98699f0dafb75aae48ad49ad6216a3bebf99de43e3f1a011c76e0dc4137`
- `test:unit` receipt: `5ac6378629e30a988645f601727f19b74c5cf4b7bb8384aefa3e14ceb96e56f1`
- `npm test` receipt: `7533baefc0ad4729d7a682a1ea8b20dfd7d505d58b92caeb10ebc83e217812c3`

The denominator above is the current discovery output for the clean `HEAD`
identity. Execution fingerprints are in
`docs/testing/baseline/failure-inventory.json`.

`test:unit` and `npm test` have zero accepted failures on this revision.
`test:release` remains fail-closed without `qualification-manifest`.

## `test`

- command id: `test`
- scope: pr-default-deterministic-fast-mandatory
- layers: (PR composition, not a layer)
- required inputs: none
- excluded scopes: release-evidence, nightly-visual, postgres, playwright-full
- CI: .github/workflows/ci.yml / quality
- retained components:
  - `test:smart-courseware` (course: pr-fast-component)
  - `test:commercial-ui-governance` (platform: moved-to-test-release)

## `test:unit`

- command id: `test:unit`
- scope: all-domain-pure-unit-tests
- layers: `unit`
- required inputs: none
- excluded scopes: contract-api, integration-datastore, e2e, release-evidence
- CI: not a current required check
- retained components: none

## `test:contract`

- command id: `test:contract`
- scope: api-event-manifest-bundle-wasm-facade-boundaries
- layers: `contract`
- required inputs: none
- excluded scopes: unit, release-evidence
- CI: not a current required check
- retained components:
  - `test:course-knowledge-input-inventory` (knowledge: inventory-contract-runner)

## `test:integration`

- command id: `test:integration`
- scope: postgres-redis-worker-repository-filesystem-adapters
- layers: `integration`
- required inputs: none
- excluded scopes: playwright-e2e, release-evidence
- CI: not a current required check
- retained components:
  - `test:e2e:playwright` (platform: former-test-integration-playwright-bundle)
  - `test:data-governance` (learning-record: postgres-scripts-remain-nightly-until-executed)

## `test:e2e:critical`

- command id: `test:e2e:critical`
- scope: critical-user-journeys-only
- layers: `e2e-critical`
- required inputs: none
- excluded scopes: visual-acceptance, performance, real-provider
- CI: not a current required check
- retained components:
  - `test:e2e:playwright` (platform: full-playwright-bundle)

## `test:release`

- command id: `test:release`
- scope: explicit-release-qualification-evidence
- layers: `release`
- required inputs: qualification-manifest
- excluded scopes: product-behavior-tests
- CI: not a current required check
- retained components:
  - `test:commercial-ui-governance` (platform: release-evidence-validator)

Missing `qualification-manifest` is a fail-closed
`release-manifest-missing:qualification-manifest` result. The contract is
covered by `test-command-contracts.test.ts`; no default product command reads
this evidence.

## `test:nightly`

- command id: `test:nightly`
- scope: full-visual-performance-real-provider-smoke
- layers: `nightly`
- required inputs: none
- excluded scopes: pr-default
- CI: not a current required check
- retained components: none

## Discovery rules

Include:
- **/*.{test,spec}.{ts,tsx,js,jsx,mjs,cjs,mts,cts}
- **/test_*.py
- **/tests/*.rs
- **/*_test.rs
- scripts/tests/**/*.{ts,tsx,js,mjs,mts,cts,py}

Exclude:
- fixtures
- artifacts-evidence
- agent-skill-tests

Environment-sensitive capture tests use `*.real-smoke.test.*`. Vitest excludes
that suffix from `test:unit`, while discovery classifies it as `nightly` so the
coverage remains explicit rather than silently skipped.
