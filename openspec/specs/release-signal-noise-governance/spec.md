## Purpose

Define how release-readiness signals are cataloged, classified, and owned before broad dependency or framework upgrades.
## Requirements
### Requirement: Release signal noise baseline classifies every known noisy signal
The project SHALL maintain a release signal noise baseline before broad dependency or framework upgrades.

#### Scenario: Baseline is created
- **WHEN** the baseline change is prepared
- **THEN** it SHALL record the branch, commit, command, failing summary, affected surface, classification lane, owner change, and expected disposition for each known noisy signal
- **AND** it SHALL distinguish stale noise from real blocking debt.

### Requirement: Noise baseline preserves implementation boundaries
The baseline change SHALL NOT modify application code, verification scripts, package versions, lockfiles, runtime logs, or test fixtures.

#### Scenario: Baseline is reviewed
- **WHEN** the baseline change is validated
- **THEN** it SHALL contain only OpenSpec planning artifacts
- **AND** implementation work SHALL be delegated to follow-up changes.

### Requirement: Validation commands only scan owned project surfaces
Release validation commands SHALL avoid scanning embedded sample repositories, vendored examples, or unrelated evaluation fixtures unless a command explicitly targets them.

#### Scenario: Lint validation runs
- **WHEN** the default lint command is executed
- **THEN** it SHALL scan project-owned application, script, config, and test files
- **AND** it SHALL exclude `evaluate/**/*` and other non-project sample repositories.

### Requirement: Standalone validation scripts resolve repository modules deterministically
Standalone validation scripts SHALL resolve repository modules from the repository root or a stable alias rather than from the script directory by accident.

#### Scenario: Model render policy validation runs
- **WHEN** `test:model-render-policy` is executed from the repository root
- **THEN** it SHALL import the intended `src/lib/model-render-policy` module
- **AND** it SHALL not fail with a path-derived `MODULE_NOT_FOUND` error.

### Requirement: Runtime logs distinguish current failures from historical residue
Runtime verification SHALL distinguish errors produced during the current check from historical log entries.

#### Scenario: A fixed runtime error remains in old logs
- **WHEN** a route smoke check succeeds and `.logs/error.log` contains older errors
- **THEN** the verification result SHALL report whether new error bytes or timestamped current-run errors appeared
- **AND** old entries SHALL NOT be treated as active failures without reproduction.

### Requirement: Environment signal is reproducible across machines
The project SHALL declare enough runtime and package-manager metadata for dependency validation to be reproducible across local worktrees, CI, and deployment hosts.

#### Scenario: Dependency hygiene is checked
- **WHEN** a clean install is performed
- **THEN** the expected Node range, package-manager version, lockfile behavior, Browserslist data state, and extraneous-package result SHALL be known
- **AND** deviations SHALL be reported as environment drift rather than mixed with application test failures.

### Requirement: Typecheck signal is restored before dependency upgrades
The project SHALL restore the TypeScript no-emit gate before using it to validate dependency or framework upgrades.

#### Scenario: Typecheck gate is run on the migration branch
- **WHEN** `npx tsc --noEmit --pretty false` is executed
- **THEN** stale route parameter fixtures, runtime field fixtures, mock generic signatures, and compiler target/lib mismatches SHALL be repaired or classified as real blockers
- **AND** the command SHALL provide a meaningful regression signal for future package changes.

### Requirement: Unit contract signal is restored before dependency upgrades
The project SHALL restore the unit-test contract gate before using it to validate dependency or framework upgrades.

#### Scenario: Unit gate is run on the migration branch
- **WHEN** `npm run test:unit` is executed
- **THEN** existing interactive manifest, module taxonomy, data-governance, lesson-map, and dynamic-route contract drift SHALL be repaired or classified as real blockers
- **AND** the command SHALL provide a meaningful runtime regression signal for future package changes.

### Requirement: React Doctor noise baseline separates fixture noise from product diagnostics
React Doctor release-readiness evidence SHALL distinguish owned product diagnostics from sample repository or evaluation fixture diagnostics.

#### Scenario: Sample repositories contain React-like files
- **WHEN** React Doctor scans the repository for release signal evidence
- **THEN** diagnostics under `evaluate/**/*` and other declared fixture roots SHALL be classified as fixture noise or excluded by the scan boundary
- **AND** those diagnostics SHALL NOT be counted as product blocker totals

#### Scenario: React Doctor warning totals are reported
- **WHEN** warning totals are included in a release noise baseline
- **THEN** the report SHALL state whether the totals are advisory-only, security-blocking, or implementation-blocking
- **AND** the report SHALL include the scan boundary used to produce the counts

### Requirement: Resource-governance typecheck debt is cleared at source
Resource-governance typecheck repair SHALL align helper/source contracts and fixtures to current resource readiness semantics rather than suppressing TypeScript errors.

#### Scenario: Resource governance typecheck cluster is repaired
- **WHEN** the resource-governance cleanup runs
- **THEN** the errors in `scripts/db/generate-resource-field-completion-audit.ts`, `src/lib/__tests__/resource-field-completion-audit.test.ts`, `src/lib/__tests__/textbook-media-grounding.test.ts`, and `src/lib/learning-goal-resource-baseline.ts` SHALL be eliminated
- **AND** review-confirmed fields, evidence contract completeness, literal artifact versions, and null/undefined policies SHALL remain semantically correct.

#### Scenario: Resource data semantics are out of scope
- **WHEN** this change repairs TypeScript types
- **THEN** it SHALL NOT mark resources complete, promote semantic fields, or alter resource readiness data except where required to fix a typed helper contract.

### Requirement: Konling typecheck fixtures match current context contracts
Konling typecheck repair SHALL update test fixtures and assertion helpers to current context contracts without changing model behavior.

#### Scenario: Konling typecheck cluster is repaired
- **WHEN** the Konling cleanup runs
- **THEN** TypeScript errors in `src/lib/__tests__/konling-agent-runtime.test.ts` and `src/lib/__tests__/konling-teaching-assistant-server-context.test.ts` SHALL be eliminated
- **AND** tool outputs, context keys, page types, knowledge types, and learner-state fixtures SHALL remain narrow and contract-valid.

#### Scenario: Konling runtime behavior is out of scope
- **WHEN** this change repairs TypeScript tests
- **THEN** it SHALL NOT change provider configuration, prompt policy, or citation verification behavior unless a production type contract is demonstrably wrong.

### Requirement: Interactive and UI test fixtures match current component contracts
Interactive, classroom, assessment, and AppShell typecheck repair SHALL update stale test fixtures to current component contracts without masking UI regressions.

#### Scenario: Interactive UI fixture cluster is repaired
- **WHEN** the interactive/UI cleanup runs
- **THEN** TypeScript errors in the scoped interactive, classroom, assessment route-state, tracking, and AppShell governance tests SHALL be eliminated
- **AND** manifest option fields, teacher controls, DOM shims, route props, tracking mocks, and user-role literals SHALL remain contract-valid.

#### Scenario: Product UI behavior is out of scope
- **WHEN** this change repairs TypeScript fixtures
- **THEN** it SHALL NOT redesign UI behavior or alter product flows unless a typed component contract is proven incorrect.

### Requirement: Resource media and RAG typecheck debt preserves citation boundaries
ResourceNode, media manifest, Source Pack, and RAG typecheck repair SHALL align fixtures and helper inputs to current citation and planning boundaries.

#### Scenario: Resource media and RAG cluster is repaired
- **WHEN** the ResourceNode/media/RAG cleanup runs
- **THEN** TypeScript errors in ResourceNode registry tests, Source Pack tests, RAG corpus tests, and `src/lib/resource-node-registry.ts` SHALL be eliminated
- **AND** media segments, citation records, source kinds, and graph-node refs SHALL match current contracts.

#### Scenario: Search or citation support is not promoted
- **WHEN** fixtures are updated for TypeScript
- **THEN** the change SHALL NOT promote raw chunks, media anchors, or citation-only records to path-plannable ResourceNodes unless the existing contract already requires it.

### Requirement: Adaptive path and graph fixtures track current planner contracts
Adaptive path and graph typecheck repair SHALL update fixtures to current planner, graph coverage, and LearningGoal contracts without changing planner policy.

#### Scenario: Adaptive path graph cluster is repaired
- **WHEN** the adaptive path/graph cleanup runs
- **THEN** TypeScript errors in adaptive path planner, control-correction path rounds, learner-state, and assessment coverage tests SHALL be eliminated
- **AND** graph coverage, capability target, LearningGoal, and path graph context fixtures SHALL include required current fields.

#### Scenario: Planner behavior is out of scope
- **WHEN** this change repairs TypeScript fixtures
- **THEN** it SHALL NOT change path ranking, resource selection, or low-resource fallback policy unless a typed production contract is demonstrably wrong.
