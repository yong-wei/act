# konling-fair-experiment-entrypoint-smoke Specification

## ADDED Requirements

### Requirement: Fair experiment entrypoints load from a clean checkout

The fair experiment CLI entrypoints (`run-fixture.ts`, `run-live.ts`, `replay-scoring.ts`) and the blind audit live entrypoint SHALL only import currently supported provider runtime public entrypoints and SHALL load without module resolution errors from a clean checkout of the integration branch.

#### Scenario: Live runners import the supported provider runtime

- **WHEN** either the fair experiment or the blind audit live runner module graph is loaded on a clean checkout
- **THEN** it resolves through `@/lib/ai/provider-runtime` and no longer references the deleted `@/lib/ai-client`

#### Scenario: Fixture runner runs end-to-end without network

- **WHEN** the fixture runner executes with its deterministic provider on a clean checkout
- **THEN** it completes generation, scoring, and aggregation for all arms without any network or real provider call, and writes its manifest and snapshots under the experiment artifacts root

### Requirement: Entrypoint drift is caught by commit gates

The repository SHALL type-check the fair experiment and blind audit script entrypoints with `tsc --noEmit` as part of both `verify:commit` and `verify:push`, independently of the production type graphs that exclude `scripts`.

#### Scenario: Stale import fails the commit gate

- **WHEN** a script under `scripts/konling-fair-experiment/` or `scripts/konling-blind-audit/` imports a module specifier that no longer resolves
- **THEN** `typecheck:konling-scripts` fails with a module resolution error and blocks the commit gate

#### Scenario: Pre-existing tooling debt stays out of scope

- **WHEN** the konling-scripts type check runs
- **THEN** it covers only the konling experiment and blind audit script trees, so unrelated pre-existing errors in other script trees do not fail this gate

### Requirement: Provider-free entrypoint smoke test

The repository SHALL provide a vitest smoke test that loads all three fair experiment entrypoints through `tsx` subprocesses without calling any real provider, asserting the opt-in guard, the deterministic fixture run, the scorer replay on frozen snapshots, and manifest provenance fields.

#### Scenario: Live runner refuses without explicit opt-in

- **WHEN** the live runner is executed without `KONLING_FAIR_EXPERIMENT_LIVE=1`
- **THEN** it exits non-zero with the opt-in message before any provider call

#### Scenario: Fixture run and replay succeed with recorded revisions

- **WHEN** the smoke test runs the fixture runner and then replays scoring on the produced run directory
- **THEN** both subprocesses exit zero with complete status
- **THEN** the manifest records non-empty generation revision and scorer revision fields
