# manifest-content-renderer-simplification Specification

## Purpose

Define a behavior-preserving simplification of the canonical manifest content
renderer after renderer registration has been consolidated.

## ADDED Requirements

### Requirement: Simplification uses the code-simplification workflow

The implementation SHALL first document the renderer's responsibility,
callers, edge/error paths, historical rationale for non-obvious branches, and
before metrics.  It SHALL then apply concrete clarity transformations such as
guard clauses, named predicates, named intermediate values, or deduplicated
pure normalization.  A pure file split, rename, or formatting change SHALL
not satisfy this requirement.

#### Scenario: A simplification is proposed

- **WHEN** a renderer branch or helper is changed
- **THEN** the ledger SHALL identify the original complexity/duplication,
  transformation, expected unchanged behavior, and direct regression test
- **AND** the change SHALL preserve project conventions and error ordering.

#### Scenario: A transformation increases cognitive burden

- **WHEN** a compact expression is harder to understand than the named logic
  it replaces
- **THEN** the transformation SHALL be rejected or reverted
- **AND** fewer lines alone SHALL not be treated as evidence of simplification.

### Requirement: Rendered content and role projections are unchanged

The canonical renderer SHALL preserve content-block and activity-card output,
math formatting, response-prefill behavior, missing-field diagnostics, and
student/teacher role projections.  Student output SHALL continue to exclude
reference answers, teacher-only controls, and internal diagnostics.

#### Scenario: A student renders an activity card

- **WHEN** a normalized manifest activity is rendered for a student
- **THEN** output and accessible markers SHALL match the characterization
- **AND** answer-bearing teacher fields SHALL remain absent.

#### Scenario: A teacher renders the same card

- **WHEN** the card is rendered for an authorized teacher
- **THEN** teacher-only projection and reveal behavior SHALL remain available
  according to the existing manifest contract
- **AND** no new renderer-side persistence SHALL occur.

### Requirement: Dispatch and fallback semantics remain exact

Simplified dispatch SHALL preserve C13's exact plugin lookup, unclaimed,
required-missing, optional-missing, version ambiguity, and invalid-payload
semantics.  It SHALL not infer a capability from a module title or silently
fall through to a retired legacy branch.

#### Scenario: A required plugin is missing

- **WHEN** a declared required capability has no exact registered renderer
- **THEN** the existing missing-renderer marker and limitation SHALL be
  returned
- **AND** no guessed or legacy renderer SHALL be invoked.

#### Scenario: An optional resource is unavailable

- **WHEN** an optional content or media surface cannot be loaded
- **THEN** the base content SHALL remain available with its existing diagnostic
- **AND** lesson identity, bundle hash, and evidence behavior SHALL be unchanged.

### Requirement: Submission and evidence boundaries remain outside rendering

The simplification SHALL keep rendering side-effect free.  Response-producing
activities SHALL continue through the existing submission controller and
durable evidence path; live progress SHALL not become an answer source, and the
renderer SHALL not write Learning Record facts.

#### Scenario: A response-producing activity is displayed

- **WHEN** a student opens a response-producing step
- **THEN** the renderer SHALL only produce the role-safe view and input model
- **AND** durable submission/evidence writes SHALL occur only through the
  existing action path.

#### Scenario: A preview is rendered

- **WHEN** a teacher or guest renders preview content
- **THEN** it SHALL create no student state, submission, interaction log, or
  Learning Record evidence.

### Requirement: Before/after evidence qualifies the simplification

The change SHALL record before and after line count, function/branch or
equivalent complexity, duplicate-pattern inventory, import surface, and
behavior/test results.  The record SHALL identify every accepted, rejected,
and deferred transformation and bind it to one source revision.

#### Scenario: The simplified renderer is reviewed

- **WHEN** the change is proposed for completion
- **THEN** direct renderer, plugin, role, missing-renderer, and evidence tests
  SHALL pass
- **AND** the ledger SHALL demonstrate a net clarity improvement beyond file
  movement.
