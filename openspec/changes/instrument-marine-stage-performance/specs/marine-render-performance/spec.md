## ADDED Requirements

### Requirement: Performance compares executed cost beyond presentation cadence
Performance comparison SHALL distinguish presentation intervals, CPU work, GPU elapsed time and complete-pipeline throughput.

#### Scenario: Both routes saturate display refresh
- **WHEN** Both routes report sixty frames per second
- **THEN** The report does not infer equal cost and uses stage or completed-work measurements.

### Requirement: Missing timers use a labeled automatic fallback
A missing timing extension SHALL trigger an automatic completed-work method without labeling its wall-clock duration as GPU elapsed time.

#### Scenario: A timer is unavailable
- **WHEN** The instrument cannot obtain valid GPU timestamps
- **THEN** The benchmark continues with recorded method and uncertainty while raw GPU time remains unavailable.

### Requirement: Worker measurements include end to end response
Worker query reports SHALL distinguish compute duration, queuing, transfer and result age from a main-thread reference-call microbenchmark.

#### Scenario: Vessel queries are asynchronous
- **WHEN** A worker batch is sent and consumed
- **THEN** Latency and sampled visual time are recorded and full-spectrum initialization is not charged ambiguously per query.
