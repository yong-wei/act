# Test command contracts

Observation counts are revision-bound. Read `docs/testing/baseline/discovery-core.json` for the current denominator.

- schemaVersion: `act-test-command-contracts/v1`
- sourceCommit: `5ee65d52343029756a09a2ad0ba50504fb4f9557`
- sourceTree: `03f832624c9ec800ff76702cdd4af1927946f895`
- baseline census: `40549dcad9b03da31abc6ef05c5ede5bff4e04b47268f86450831aa39788c52a`
- charter: `76850de671d65e821dd2acebe070ab23d6a3f26a3a7d9f9527e32af75c957396`
- discovered: 1229
- classified: 1226
- excluded: 3
- unresolved: 0

The denominator above is the current discovery output for the clean `HEAD`
identity. The working tree used for the 2026-08-27 execution was dirty, so it
cannot mint a qualified receipt. Current execution observations and individual
fingerprints are revision-bound in
`docs/testing/baseline/failure-inventory.json`.

The live dirty discovery observation at `2026-08-27T03:35:00+08:00` produced
discovery core hash
`be6d44be80bf6399b7c95ddf260b0f6c649960a8094693cc6e369ea19269ff70` and the
single fail-closed reason `dirty-worktree`.

Direct `test:unit` execution in this dirty tree is green and has zero accepted
failures. Wrapper qualification remains blocked until the worktree is clean.

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
