## MODIFIED Requirements

### Requirement: CI has explicit PR, integration, main/release, and nightly layers
The project SHALL define separate quality-evidence layers for pull-request merge evidence, integration revision evidence, main/release qualification, and nightly breadth. Each layer SHALL declare scope and required local inputs. These layers SHALL be local evidence registries; they SHALL NOT be GitHub-hosted workflows, pull_request triggers, or required GitHub status checks.

#### Scenario: A PR is evaluated
- **WHEN** a pull request targets the integration branch
- **THEN** the PR layer SHALL require locally produced architecture fitness, affected lint, production/tooling/test typecheck, affected domain unit tests, contract tests, applicable Prisma/migration checks, and necessary critical E2E evidence
- **AND** an incomplete impact denominator SHALL expand the scope or fail closed rather than silently skip a required check
- **AND** GitHub Actions SHALL NOT run that PR layer as a `pull_request` workflow or required status check.

#### Scenario: An integration revision is evaluated
- **WHEN** an integration revision needs full-layer evidence
- **THEN** the integration layer SHALL require locally produced full unit, contract, integration, Web/worker/tools/test typecheck, Next build, WASM build, migration rehearsal, and critical E2E evidence bound to the source revision/tree
- **AND** GitHub Actions SHALL NOT run that layer on `push` to `integration`.

#### Scenario: Main or release is qualified
- **WHEN** main/release qualification runs under separately authorized local or later-authorized release verification
- **THEN** it SHALL require current passing Web/worker/tools/test typecheck receipts and retain release qualification, runtime/knowledge/OSS integrity, rollback smoke, post-deploy readyz, and database compatibility gates
- **AND** missing, stale, or failing `typecheck:tools` or `typecheck:test` receipts SHALL block publication; PR-layer or nightly success SHALL not substitute for or weaken these gates
- **AND** this layer SHALL NOT be added as a GitHub Actions job on `main` or `release/**` unless a later change explicitly authorizes release verification.

#### Scenario: Nightly breadth runs
- **WHEN** the nightly layer runs under local or separately authorized execution
- **THEN** it SHALL execute declared isolated, visual, performance, real-provider, course-matrix, data-replay, Arena, and simulation samples
- **AND** nightly results SHALL not be represented as accepted failures in the PR layer or used to repair missing tools/test typecheck receipts
- **AND** GitHub Actions SHALL NOT schedule a generic nightly quality workflow.

### Requirement: Required checks map one-to-one to local commands
Every required merge-evidence check SHALL resolve to exactly one local command ID or one documented composition of existing governed command IDs with equivalent scope and failure semantics. The check registry SHALL be the authority for required evidence; GitHub workflow YAML SHALL NOT become a second test list or required-check authority.

#### Scenario: A required check is registered
- **WHEN** the quality-gate registry declares a required check
- **THEN** the registry SHALL resolve its command ID, scope, input manifest, receipt schema, timeout, and failure policy
- **AND** unknown, duplicate, workflow-only, or weaker command semantics SHALL fail contract validation
- **AND** the check SHALL NOT need a GitHub status-check name to be valid merge evidence.

#### Scenario: A workflow is changed
- **WHEN** a retained GitHub workflow changes a command, filter, skip, or environment input
- **THEN** the change SHALL update and validate the corresponding local command contract if it still maps to a governed command
- **AND** a hand-maintained second test list SHALL not become a new authority
- **AND** adding `pull_request`, `integration` push, nightly schedule, or required quality status checks SHALL fail the GitHub-hosted CI boundary.

### Requirement: Integration branch protection is verified from platform truth
The project SHALL treat GitHub-hosted CI status checks as out of scope for integration PR merge gates. Integration PRs SHALL NOT add a generic quality `pull_request` trigger and SHALL NOT require GitHub CI status checks. Commit and push gates SHALL remain local `verify:commit`, `verify:push`, typecheck, related tests, and exact-current-HEAD review evidence. Platform verification SHALL prove the absence of generic GitHub quality CI for integration, not the presence of required GitHub checks that mirror the local registry.

#### Scenario: Hosted CI boundary is readable
- **WHEN** retained GitHub workflow files and required-check configuration are inspected
- **THEN** generic quality workflows SHALL NOT exist for `pull_request` to `integration` or `push` to `integration`
- **AND** GitHub required status checks SHALL NOT include quality-gate registry check IDs
- **AND** `.github/workflows/ci.yml` SHALL remain limited to `main` push and authorized `workflow_dispatch`
- **AND** `.github/workflows/docker-wolfram-verify.yml` MAY remain a specialized `workflow_dispatch` workflow without becoming a generic quality gate.

#### Scenario: Protection or workflow state cannot be read
- **WHEN** the platform returns REST 403, plan limitation, insufficient permission, or no verifiable configuration
- **THEN** the result SHALL be `blocked-unverified` with a safe response class, affected gate, source revision, and resolution condition
- **AND** the project SHALL not claim GitHub CI protects integration
- **AND** unread GitHub protection SHALL NOT be used to reintroduce required CI checks or to treat missing local evidence as passed.

### Requirement: Main and release quality gates cannot be weakened by this layer
PR/integration evidence-layer changes SHALL preserve the existing strong main/release gates for release authority, runtime integrity, rollback, readiness, and database compatibility. Restoring the GitHub Actions main baseline SHALL NOT delete, downgrade, or make advisory those local release contracts. Existing `main` push CI MAY keep lint, smoke test, build, and WASM production paths, but SHALL NOT gain a new quality-gate registry job unless a later change explicitly authorizes release verification.

#### Scenario: A proposed workflow removes a release check
- **WHEN** a change deletes, downgrades, makes advisory, or moves a main/release evidence check behind a non-blocking path
- **THEN** gate validation SHALL fail unless an explicitly authorized capability change updates the protected contract
- **AND** the PR layer SHALL not be used to justify the weakening.

#### Scenario: GitHub Actions is restored to the main baseline
- **WHEN** `ci.yml` is restored to `main` push and `workflow_dispatch`
- **THEN** the `main-release-quality-gates` job and `release/**` trigger SHALL be absent
- **AND** protected local release checks SHALL remain in the registry as blocking publication evidence.

### Requirement: Each TypeScript graph has a mandatory tsc-only gate fixture
The quality-gate contract SHALL exercise the Web, worker, tooling, and test graph fixtures defined by the TypeScript graph capability, and a type error found only by a graph's `tsc` command SHALL block the corresponding PR or integration evidence layer. These graph receipts SHALL be produced by local commands; GitHub-hosted CI SHALL NOT be required to generate them for integration PRs.

#### Scenario: A tools or test graph has a tsc-only error
- **WHEN** the tools or test graph fixture is invalid while runtime tests and lint remain green
- **THEN** the PR or integration evidence layer SHALL fail on the corresponding `typecheck:tools` or `typecheck:test` receipt
- **AND** nightly success SHALL not qualify the gate or permit main/release publication.

#### Scenario: All graph fixtures pass
- **WHEN** Web, worker, tools, and test `tsc` fixtures are valid
- **THEN** the layer receipt SHALL retain all four graph command IDs and fixture identities
- **AND** main/release SHALL be eligible to evaluate only after the tools/test receipts are current and passing.

### Requirement: Layered gate receipts are revision-bound and safe
Every layer result SHALL bind source revision/tree, local producer identity, check IDs, local command IDs, scope, required inputs, counts, unhandled errors, failure dispositions, external blockers, and artifact identities without secrets or sensitive payloads. A GitHub workflow run ID, if present, is optional observation and SHALL NOT be required to accept local evidence.

#### Scenario: A layer is incomplete
- **WHEN** a required command is not run, times out, has stale inputs, or returns an external blocker
- **THEN** the receipt SHALL report blocked/incomplete rather than passed
- **AND** it SHALL preserve the resolution condition for the next run.

#### Scenario: A receipt is regenerated
- **WHEN** the same source revision is evaluated again
- **THEN** deterministic check mapping and scope data SHALL remain stable
- **AND** a new local run or environment observation SHALL create a new receipt identity rather than overwrite the old one.

## ADDED Requirements

### Requirement: GitHub Actions stays on the authorized main baseline
GitHub Actions SHALL keep the existing `main` push workflow, explicitly authorized `workflow_dispatch`, and later separately authorized release verification. The project SHALL NOT add a generic quality-gate workflow for integration PRs, integration pushes, or nightly schedules. `#1554` MAY govern which auditable evidence a PR needs to merge, but SHALL NOT require that evidence to be produced by GitHub-hosted CI.

#### Scenario: Integration PR workflows are inspected
- **WHEN** `.github/workflows/` is validated against the quality-gate registry
- **THEN** `.github/workflows/quality-gates.yml` SHALL be absent
- **AND** no retained generic quality workflow SHALL declare `on.pull_request` targeting `integration`
- **AND** validation SHALL fail closed if a later change reintroduces that hosted CI.

#### Scenario: Existing main CI remains
- **WHEN** `.github/workflows/ci.yml` is read
- **THEN** it SHALL trigger on `push` to `main` and `workflow_dispatch` only
- **AND** it SHALL NOT trigger on `release/**` or run `quality-gates:run`.
