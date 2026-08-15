## ADDED Requirements

### Requirement: The v0.18 rebase freezes the complete active reference denominator

Before mapping, the builder MUST capture every active course/package/resource,
card, infograph, textbook locator, prerequisite, learning-path, Konling, RAG,
and other ACT teaching reference with its source revision and digest. Changed or
uncaptured inputs MUST invalidate the build.

#### Scenario: An active reference changes after capture

- **WHEN** its current bytes or database observation differs from the sealed input
- **THEN** the builder MUST reject the run rather than mix revisions

### Requirement: Successor resolution uses identity evidence only

An unchanged stable ID MAY carry forward. Every changed predecessor MUST use an
explicit reviewed mapping bound to the v0.9 object, v0.18 successor set,
disposition, evidence, and capture. Names, labels, aliases, lexical similarity,
embeddings, and graph distance MUST NOT select a successor.

#### Scenario: One reviewed successor exists

- **WHEN** a mapping record identifies one type-compatible v0.18 successor and
  all pinned evidence matches
- **THEN** the reference SHALL rebase deterministically to that successor

#### Scenario: A split, merge, deletion, or ambiguity remains

- **WHEN** no single reviewed disposition closes the predecessor reference
- **THEN** the item SHALL be `REVIEW_REQUIRED` and no candidate may be activated

### Requirement: Existing references close while new teaching coverage remains incremental

Every captured existing ACT reference MUST resolve or receive an explicit
reviewed non-semantic disposition. New v0.18 nodes are not required to receive
teaching relations for this rebase, and later reviewed relations MAY be added
through a new complete Projection release.

#### Scenario: A new engineering node has no ACT teaching relation

- **WHEN** no captured existing ACT reference targets that node
- **THEN** its absence from the Teaching Projection SHALL NOT block rebase completion

#### Scenario: An existing reference is unresolved

- **WHEN** a captured ACT reference has neither a valid successor nor an
  explicit reviewed non-semantic disposition
- **THEN** rebase readiness MUST remain blocked

### Requirement: Rebase output is complete, deterministic, and inactive

The builder MUST produce complete content-addressed Teaching Projection and
prerequisite releases bound to v0.18, the captured denominator, approved mapping
set, and policy version. Two builds MUST match, and current pointers MUST remain v0.9.

#### Scenario: All mapping work is resolved

- **WHEN** the complete captured denominator closes and both rebuilds match
- **THEN** the new Projection and prerequisite publication SHALL be available as
  inactive candidates without changing any consumer selector

### Requirement: Historical Authority audits remain immutable context

The 34-batch CourseCoverage audit and its 4,880 DEFER outcomes MUST NOT be
reopened, rewritten, or added to the current rebase denominator unless an item
is independently present in the captured active-reference set.

#### Scenario: Historical DEFER evidence is loaded

- **WHEN** the builder uses it as context
- **THEN** it SHALL remain read-only and SHALL NOT create a mapping task by itself
