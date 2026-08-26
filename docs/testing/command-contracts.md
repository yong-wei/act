# Test command contracts

Observation counts are revision-bound. Read `docs/testing/baseline/discovery-core.json` for the current denominator.

- schemaVersion: `act-test-command-contracts/v1`
- sourceCommit: `8dbfa8627fe70b8c5cd90ff9bc087ee93a3424d0`
- sourceTree: `0f29f93fab84b83e1cb492b57b2c7e64bef35988`
- baseline census: `40549dcad9b03da31abc6ef05c5ede5bff4e04b47268f86450831aa39788c52a`
- charter: `76850de671d65e821dd2acebe070ab23d6a3f26a3a7d9f9527e32af75c957396`
- discovered: 1229
- classified: 1226
- excluded: 3
- unresolved: 0

Current red executions are not accepted failures. They remain blockers for `eliminate-accepted-red-test-baseline`.

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
  - `test:data-governance` (learning-record: postgres-integration-component)

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
