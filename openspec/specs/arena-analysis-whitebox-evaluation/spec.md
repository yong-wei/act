## Purpose
Define the analysis-backed white-box official evaluation path for supported Arena controller submissions.

## Requirements

### Requirement: Supported white-box methods use server-side analysis
Arena official evaluation SHALL use server-side `ControlAnalysisResult` metrics for supported PID and serial-compensator white-box submissions.

#### Scenario: PID analysis evaluation
- **WHEN** a `pid` artifact is submitted to a supported white-box transfer-function task
- **THEN** official evaluation MUST build a `ControlAnalysisRequest`, compute a server-side `ControlAnalysisResult`, and derive ranking metrics from that result

#### Scenario: Serial compensator analysis evaluation
- **WHEN** a `serial-compensator` artifact is submitted to a supported white-box transfer-function task
- **THEN** official evaluation MUST use the analysis-backed provider and MUST store the evaluation under `analysis-whitebox-v1`

### Requirement: Unsupported white-box methods remain template evaluated
Arena official evaluation SHALL keep white-box methods without implemented analysis semantics on `template-whitebox-v1`.

#### Scenario: MPC template remains isolated
- **WHEN** an `mpc` artifact is submitted to a white-box task
- **THEN** official evaluation MUST continue to use the template provider and MUST NOT store the result under `analysis-whitebox-v1`

#### Scenario: Composite compensation remains isolated
- **WHEN** a `composite-compensation` artifact is submitted
- **THEN** official evaluation MUST continue to use template evaluation until a real analysis mapping exists for that method

### Requirement: Analysis evaluation is asynchronous and cache-safe
Arena official evaluation SHALL await analysis-backed computation and SHALL keep cached results isolated by artifact hash and protocol version.

#### Scenario: Repeated analysis submission
- **WHEN** the same supported artifact is submitted twice under `analysis-whitebox-v1`
- **THEN** the second submission MAY reuse the existing `ArenaEvaluationRun` for the same task, artifact hash, and protocol version
