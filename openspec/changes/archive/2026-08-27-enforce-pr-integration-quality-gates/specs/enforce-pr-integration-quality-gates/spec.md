## Hard Dependencies

已 qualified 的 `eliminate-accepted-red-test-baseline`、`split-production-tooling-test-typescript-graphs`、`establish-architecture-fitness-budgets` 是本 capability 的硬前置，并消费 `restore-trustworthy-test-command-contracts` 的 command registry；依赖方向只向本 capability 汇入，不得形成回指或环。

## ADDED Requirements

### Requirement: CI has explicit PR, integration, main/release, and nightly layers
The project SHALL define separate quality layers for pull requests, integration pushes, main/release qualification, and nightly breadth, with declared scope and required inputs for each layer.

#### Scenario: A PR is evaluated
- **WHEN** a pull request targets the integration branch
- **THEN** the PR layer SHALL run architecture fitness, affected lint, production/tooling/test typecheck, affected domain unit tests, contract tests, applicable Prisma/migration checks, and necessary critical E2E
- **AND** an incomplete impact denominator SHALL expand the scope or fail closed rather than silently skip a required check.

#### Scenario: An integration push is evaluated
- **WHEN** a commit is pushed to integration
- **THEN** the integration layer SHALL run full unit, contract, integration, Web/worker/tools/test typecheck, Next build, WASM build, migration rehearsal, and critical E2E checks
- **AND** each result SHALL be tied to the pushed source revision/tree.

#### Scenario: Main or release is qualified
- **WHEN** main/release qualification runs
- **THEN** it SHALL require current passing Web/worker/tools/test typecheck receipts and retain release qualification, runtime/knowledge/OSS integrity, rollback smoke, post-deploy readyz, and database compatibility gates
- **AND** missing, stale, or failing `typecheck:tools` or `typecheck:test` receipts SHALL block publication; PR-layer or nightly success SHALL not substitute for or weaken these gates.

#### Scenario: Nightly breadth runs
- **WHEN** the nightly layer runs
- **THEN** it SHALL execute declared isolated, visual, performance, real-provider, course-matrix, data-replay, Arena, and simulation samples
- **AND** nightly results SHALL not be represented as accepted failures in the PR layer or used to repair missing tools/test typecheck receipts.

### Requirement: Required checks map one-to-one to local commands
Every required CI check SHALL resolve to exactly one local command ID or one documented composition of existing governed command IDs with equivalent scope and failure semantics.

#### Scenario: A required check is registered
- **WHEN** a workflow declares a required check
- **THEN** the check registry SHALL resolve its command ID, scope, input manifest, receipt schema, timeout, and failure policy
- **AND** unknown, duplicate, workflow-only, or weaker command semantics SHALL fail contract validation.

#### Scenario: A workflow is changed
- **WHEN** a workflow changes a command, filter, skip, or environment input
- **THEN** the change SHALL update and validate the corresponding local command contract
- **AND** a hand-maintained second test list SHALL not become a new authority.

### Requirement: PR impact selection closes its denominator
PR gates SHALL compute affected domains and required tests from the declared dependency, TypeScript, test-discovery, owner, migration, package, workflow, and release inputs.

#### Scenario: A shared boundary changes
- **WHEN** a PR changes a shared contract, schema, package, tsconfig, workflow, release input, or unresolved graph boundary
- **THEN** the gate SHALL include all affected domain and integration checks or fail closed
- **AND** it SHALL not rely on an empty path match to skip mandatory verification.

#### Scenario: Impact analysis is incomplete
- **WHEN** dynamic imports, unresolved owners, graph drift, or denominator gaps prevent safe narrowing
- **THEN** the gate SHALL expand to the full related scope or return a blocked result
- **AND** the receipt SHALL record the reason and fallback scope.

### Requirement: Integration branch protection is verified from platform truth
The project SHALL require a verifiable GitHub ruleset or branch-protection configuration for integration that prevents merging around required checks.

#### Scenario: Protection is readable
- **WHEN** the configured ruleset/branch protection is queried
- **THEN** the verification receipt SHALL identify enforcement, required check names, strict status behavior, review/conversation requirements, and bypass actors
- **AND** those values SHALL match the local check registry.

#### Scenario: Protection cannot be read
- **WHEN** the platform returns REST 403, plan limitation, insufficient permission, or no verifiable configuration
- **THEN** the result SHALL be `blocked-unverified` with a safe response class, affected gate, source revision, and resolution condition
- **AND** the project SHALL not claim integration is protected or treat local workflow success as equivalent protection.

### Requirement: Main and release quality gates cannot be weakened by this layer
PR/integration workflow changes SHALL preserve the existing strong main/release gates for release authority, runtime integrity, rollback, readiness, and database compatibility.

#### Scenario: A proposed workflow removes a release check
- **WHEN** a change deletes, downgrades, makes advisory, or moves a main/release check behind a non-blocking job
- **THEN** gate validation SHALL fail unless an explicitly authorized capability change updates the protected contract
- **AND** the PR layer SHALL not be used to justify the weakening.

### Requirement: Each TypeScript graph has a mandatory tsc-only gate fixture
The CI gate contract SHALL exercise the Web, worker, tooling, and test graph fixtures defined by the TypeScript graph capability, and a type error found only by a graph's `tsc` command SHALL block the corresponding PR or integration gate.

#### Scenario: A tools or test graph has a tsc-only error
- **WHEN** the tools or test graph fixture is invalid while runtime tests and lint remain green
- **THEN** the PR or integration gate SHALL fail on the corresponding `typecheck:tools` or `typecheck:test` receipt
- **AND** nightly success SHALL not qualify the gate or permit main/release publication.

#### Scenario: All graph fixtures pass
- **WHEN** Web, worker, tools, and test `tsc` fixtures are valid
- **THEN** the layer receipt SHALL retain all four graph command IDs and fixture identities
- **AND** main/release SHALL be eligible to evaluate only after the tools/test receipts are current and passing.

### Requirement: Layered gate receipts are revision-bound and safe
Every layer result SHALL bind source revision/tree, workflow run, check IDs, local command IDs, scope, required inputs, counts, unhandled errors, failure dispositions, external blockers, and artifact identities without secrets or sensitive payloads.

#### Scenario: A layer is incomplete
- **WHEN** a required command is not run, times out, has stale inputs, or returns an external blocker
- **THEN** the receipt SHALL report blocked/incomplete rather than passed
- **AND** it SHALL preserve the resolution condition for the next run.

#### Scenario: A receipt is regenerated
- **WHEN** the same source revision is evaluated again
- **THEN** deterministic check mapping and scope data SHALL remain stable
- **AND** a new workflow run or environment observation SHALL create a new receipt identity rather than overwrite the old one.
