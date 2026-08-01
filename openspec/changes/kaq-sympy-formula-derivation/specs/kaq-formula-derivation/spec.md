## ADDED Requirements

### Requirement: Math calculation API returns SymPy results with steps
The system SHALL expose `POST /api/math/calculate` for authenticated users. The endpoint SHALL accept a LaTeX or SymPy-style expression string and return the SymPy calculation result in LaTeX together with ordered intermediate steps.

#### Scenario: Student or tool requests a Laplace transform
- **WHEN** an authenticated caller posts `{ "expression": "1", "operation": "laplace" }`
- **THEN** the API SHALL return `status: "ok"`, a LaTeX result, and a step sequence containing the transform definition and computed result.

#### Scenario: Expression is invalid or rejected
- **WHEN** an expression exceeds the length limit, contains disallowed characters, or cannot be parsed
- **THEN** the API SHALL reject the request with a client error
- **AND** the SymPy subprocess SHALL NOT be invoked with unvalidated input.

#### Scenario: Caller is not authenticated
- **WHEN** an unauthenticated caller posts to the endpoint
- **THEN** the API SHALL return 401
- **AND** no SymPy subprocess SHALL be spawned.

### Requirement: Calculation execution is bounded
The system SHALL bound SymPy subprocess execution with a CPU time limit, a process timeout, and a shared concurrency cap used by both API and KAQ callers.

#### Scenario: Concurrent load exceeds capacity
- **WHEN** more calculation requests arrive than the configured concurrency and queue capacity allow
- **THEN** the API SHALL return 429 without spawning additional subprocesses.
- **AND** the KAQ tool path SHALL reject excess work through its governed tool error boundary without spawning additional subprocesses.

#### Scenario: Subprocess exceeds timeout
- **WHEN** a SymPy calculation exceeds the configured timeout
- **THEN** the API SHALL terminate the subprocess and return a timeout error.

### Requirement: KAQ exposes the calculate tool for formula derivation
The KAQ runtime SHALL register `calculate` in its tool registry and expose it in generic-chat mode so the LLM can call it for formula-derivation answers.

#### Scenario: LLM verifies a derivation step
- **WHEN** the LLM answers a formula-derivation intent and invokes the `calculate` tool with an expression
- **THEN** the tool SHALL return the SymPy result and intermediate steps
- **AND** the response SHALL be authorized only through the KAQ tool permission path.

### Requirement: Production image verifies the calculation backend
The production image SHALL pin SymPy and its LaTeX parser runtime and SHALL fail the build when the Python script cannot compile or a representative LaTeX expression cannot be parsed.

#### Scenario: Production dependency or script is invalid
- **WHEN** the calculation script has invalid Python syntax or the LaTeX parser runtime is unavailable
- **THEN** the production image build SHALL fail before deployment.
