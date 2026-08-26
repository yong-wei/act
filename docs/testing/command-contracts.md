# Test command contracts

Observation counts are revision-bound. Read `docs/testing/baseline/discovery-core.json` for the current denominator.

- schemaVersion: `act-test-command-contracts/v1`
- sourceCommit: `bc9b8d3000ee54e9edc23bae6d58bc9d818b2352`
- sourceTree: `625a83394c716e7cc65198f10130176ee4ee9ac7`
- baseline census: `40549dcad9b03da31abc6ef05c5ede5bff4e04b47268f86450831aa39788c52a`
- charter: `76850de671d65e821dd2acebe070ab23d6a3f26a3a7d9f9527e32af75c957396`
- discovered: 1233
- classified: 1230
- excluded: 3
- unresolved: 0
- discoveryCoreHash: `a4f2c498f20f96e6109a2221372d746686d2e5fdcbd59338cde68a9831a63b3e`
- `test:unit` receipt: `7bf33b8335e4d1f5a2faf39eb3da19e8daf38589f7ae1034153ba086667ff42d`
- `npm test` receipt: `ac8c9209985abd1142ad85207a0230d720333771269480e2a6cfc8072916ce53`

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
