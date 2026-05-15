## ADDED Requirements

### Requirement: Analysis metrics preserve source semantics
Arena analysis-backed evaluation SHALL distinguish metrics from direct control analysis, response-derived metrics, controller-derived metrics, scenario metrics, and unavailable metrics.

#### Scenario: Direct analysis metric
- **WHEN** `ControlAnalysisResult` contains overshoot, settling time, phase margin, gain margin, or bandwidth
- **THEN** those metrics MUST be marked or handled as control-analysis metrics before scoring

#### Scenario: Derived response metric
- **WHEN** ITAE or steady-state error is computed from step response points
- **THEN** those metrics MUST be marked or handled as derived-from-response metrics before scoring

### Requirement: Unavailable analysis metrics cannot score as zero
Arena analysis-backed evaluation SHALL NOT silently convert unavailable, null, or non-finite required ranking metrics to zero.

#### Scenario: Missing required metric
- **WHEN** a required primary or ranking metric is unavailable from the analysis result
- **THEN** official evaluation MUST fail the submission or mark the metric unavailable with an explanation, rather than ranking it as a zero-valued metric

### Requirement: Derived control effort is labeled as derived
Arena analysis-backed evaluation SHALL NOT present a response-derived control effort proxy as direct actuator energy.

#### Scenario: Control effort proxy
- **WHEN** control effort is derived from response shape because actuator output is unavailable
- **THEN** the evaluator MUST label or explain it as derived and MUST NOT call it direct actuator energy in official explanations
