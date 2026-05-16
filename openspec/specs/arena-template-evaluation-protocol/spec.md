## Purpose
Define template-based white-box evaluation protocol selection for Arena methods not yet backed by server-side analysis.

## Requirements

### Requirement: White-box template evaluation uses the selected metric provider
The system SHALL obtain official white-box template metrics through a synchronous Arena metric provider selected by controller method.

#### Scenario: PID template evaluation
- **WHEN** a `pid` artifact is submitted to a white-box Arena task before analysis evaluation is enabled
- **THEN** the official evaluator MUST call the selected template metric provider and MUST NOT call the heuristic estimator directly from the evaluator body

#### Scenario: Unsupported white-box template family
- **WHEN** a supported white-box template method such as `composite-compensation`, `optimized-pid`, or `mpc` is submitted
- **THEN** the selected provider MUST still return template metrics under the template white-box protocol

### Requirement: Protocol version matches provider truth
The system SHALL derive white-box protocol version from the same provider selector used by official white-box evaluation.

#### Scenario: Template protocol methods
- **WHEN** protocol version is requested for `pid`, `serial-compensator`, `composite-compensation`, `optimized-pid`, or `mpc`
- **THEN** the returned protocol MUST be `template-whitebox-v1`

#### Scenario: Reserved analysis protocol
- **WHEN** `analysis-whitebox-v1` is present in protocol constants
- **THEN** documentation and code comments MUST state that it is reserved for a future server-side `ControlAnalysisResult` evaluator and MUST NOT use it for current template submissions

### Requirement: Non-white-box methods keep isolated protocols
The system SHALL keep black-box and code-controller protocol versions isolated from white-box template evaluation.

#### Scenario: Black-box method
- **WHEN** protocol version is requested for a task whose object visibility is `black-box`
- **THEN** the returned protocol MUST be `blackbox-v1`

#### Scenario: Disabled code-controller method
- **WHEN** protocol version is requested for `code-controller`
- **THEN** the returned protocol MUST be `code-sandbox-disabled-v1`
