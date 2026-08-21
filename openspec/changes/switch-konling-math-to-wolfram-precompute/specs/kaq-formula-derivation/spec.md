## ADDED Requirements

### Requirement: Math calculation API returns Wolfram results with steps
The system SHALL expose `POST /api/math/calculate` for authenticated users. The endpoint SHALL accept a LaTeX or governed plain expression string and return the Wolfram calculation result in LaTeX together with ordered intermediate steps. Each step SHALL contain `step`, `description`, `operation`, `input`, and `output` fields.

#### Scenario: Student or server precompute requests a Laplace transform
- **WHEN** an authenticated caller posts `{ "expression": "1", "operation": "laplace" }`
- **THEN** the API SHALL return `status: "ok"`, a LaTeX result, and a step sequence containing the transform definition and computed result.

#### Scenario: Expression is invalid or rejected
- **WHEN** an expression exceeds the length limit, contains disallowed characters, cannot be parsed, or contains a non-mathematical Wolfram expression
- **THEN** the API SHALL reject the request with a client error
- **AND** the calculator SHALL NOT evaluate the rejected expression.

#### Scenario: LaTeX and plain expressions use deterministic parsers
- **WHEN** an expression contains explicit LaTeX markers such as a backslash or braces
- **THEN** the calculator SHALL parse it as TeX only and SHALL NOT fall back to plain parsing
- **WHEN** an expression has no explicit LaTeX markers
- **THEN** the calculator SHALL parse it as a governed plain mathematical expression and SHALL reject malformed input such as `x -`.

#### Scenario: Caller is not authenticated
- **WHEN** an unauthenticated caller posts to the endpoint
- **THEN** the API SHALL return 401
- **AND** no Wolfram subprocess SHALL be spawned.

### Requirement: Wolfram calculation execution is bounded
The system SHALL bound Wolfram subprocess execution with a 30-second process timeout and a shared concurrency cap used by both API and server precompute callers of 1 active calculation and 8 queued calculations.

#### Scenario: Concurrent load exceeds capacity
- **WHEN** more calculation requests arrive than the configured concurrency and queue capacity allow
- **THEN** the API SHALL return 429 without spawning additional subprocesses
- **AND** server precomputation SHALL fail safely without exposing the calculator to the language model.

#### Scenario: Subprocess exceeds timeout
- **WHEN** a Wolfram calculation exceeds the configured timeout
- **THEN** the shared executor SHALL terminate the subprocess and return a timeout error.

#### Scenario: Calculator exits unexpectedly
- **WHEN** the calculator process exits with a non-zero status without a valid structured calculator error
- **THEN** the shared executor SHALL return a stable unavailable-runtime error without exposing stderr contents.

#### Scenario: Calculator reports a structured expression error
- **WHEN** the calculator process exits with a valid structured error for an expression or operation failure
- **THEN** the shared executor SHALL preserve the calculator error so the API can return a client error
- **AND** stderr contents SHALL NOT be exposed.

### Requirement: Deployment verifies the Wolfram runtime
The deployed application environment SHALL provide an activated `wolframscript` runtime compatible with the calculation script, and operational verification SHALL fail when the command or activation is unavailable.

#### Scenario: Wolfram runtime is unavailable
- **WHEN** `wolframscript` is missing, unactivated, or cannot execute the calculation script
- **THEN** the shared executor SHALL return a stable unavailable-runtime error
- **AND** deployment verification SHALL report the missing prerequisite before user acceptance.

## REMOVED Requirements

### Requirement: Math calculation API returns SymPy results with steps
**Reason**: The calculation engine is being replaced by Wolfram Engine while preserving the API response contract.
**Migration**: Install and activate Wolfram Engine or Mathematica, then use the unchanged `/api/math/calculate` contract.

### Requirement: Calculation execution is bounded
**Reason**: The previous limits and CPU controls were specific to the lighter Python/SymPy process model.
**Migration**: Use the new Wolfram execution boundary of 1 active calculation, 8 queued requests, and a 30-second timeout.

### Requirement: KAQ exposes the calculate tool for formula derivation
**Reason**: Qwen3.5 can hang on this model tool-call path; calculation now runs before model generation.
**Migration**: Use the `konling-math-precompute` capability. The model receives trusted results but no `calculate` tool.

### Requirement: Production image verifies the calculation backend
**Reason**: The Python/SymPy image dependency and parser probes no longer describe the selected engine.
**Migration**: Provision and activate Wolfram Engine in the deployment environment and run the Wolfram script smoke tests.
