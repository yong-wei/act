# kaq-formula-derivation Specification

## Purpose
TBD - created by archiving change kaq-sympy-formula-derivation. Update Purpose after archive.
## Requirements
### Requirement: Math calculation API returns SymPy results with steps
The system SHALL expose `POST /api/math/calculate` for authenticated users. The endpoint SHALL accept a LaTeX or SymPy-style expression string and return the SymPy calculation result in LaTeX together with ordered intermediate steps. Each step SHALL contain `step`, `description`, `operation`, `input`, and `output` fields.

#### Scenario: Student or tool requests a Laplace transform
- **WHEN** an authenticated caller posts `{ "expression": "1", "operation": "laplace" }`
- **THEN** the API SHALL return `status: "ok"`, a LaTeX result, and a step sequence containing the transform definition and computed result.

#### Scenario: Expression is invalid or rejected
- **WHEN** an expression exceeds the length limit, contains disallowed characters, or cannot be parsed
- **THEN** the API SHALL reject the request with a client error
- **AND** the SymPy subprocess SHALL NOT be invoked with unvalidated input.

#### Scenario: LaTeX and SymPy expressions use deterministic parsers
- **WHEN** an expression contains explicit LaTeX markers such as a backslash or braces
- **THEN** the calculator SHALL use `parse_latex(strict=True)` only and SHALL NOT fall back to SymPy parsing
- **WHEN** an expression has no explicit LaTeX markers
- **THEN** the calculator SHALL use the restricted SymPy parser only and SHALL reject malformed input such as `x -`

#### Scenario: Caller is not authenticated
- **WHEN** an unauthenticated caller posts to the endpoint
- **THEN** the API SHALL return 401
- **AND** no SymPy subprocess SHALL be spawned.

### Requirement: Calculation execution is bounded
The system SHALL bound SymPy subprocess execution with a CPU time limit, a process timeout, and a concurrency cap.

#### Scenario: Concurrent load exceeds capacity
- **WHEN** more calculation requests arrive than the configured concurrency and queue capacity allow
- **THEN** the API SHALL return 429 without spawning additional subprocesses.

#### Scenario: Subprocess exceeds timeout
- **WHEN** a SymPy calculation exceeds the configured timeout
- **THEN** the API SHALL terminate the subprocess and return a timeout error.

#### Scenario: Calculator exits unexpectedly
- **WHEN** the calculator process exits with a non-zero status
- **THEN** the shared executor SHALL return a stable unavailable-runtime error without exposing stderr contents

### Requirement: KAQ exposes the calculate tool for formula derivation
The KAQ runtime SHALL register `calculate` in its tool registry and expose it in generic-chat mode so the LLM can call it for formula-derivation answers.

#### Scenario: LLM verifies a derivation step
- **WHEN** the LLM answers a formula-derivation intent and invokes the `calculate` tool with an expression
- **THEN** the tool SHALL return the SymPy result and intermediate steps
- **AND** the response SHALL be authorized only through the KAQ tool permission path.
