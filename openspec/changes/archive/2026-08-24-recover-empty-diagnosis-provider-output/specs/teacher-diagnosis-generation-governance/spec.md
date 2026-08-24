## ADDED Requirements

### Requirement: Empty structured provider output has a bounded governed recovery

When a teacher-diagnosis structured provider request finishes without output,
the system SHALL make at most one fallback request for a plain JSON object
using the same frozen governed input and a distinct provider idempotency
identity. The system SHALL parse and validate the fallback result through the
existing diagnosis schema, evidence-provenance, scope, and cutoff checks before
persisting a report.

#### Scenario: Fallback yields a valid diagnosis

- **WHEN** the structured provider request has no output and the plain JSON
  fallback returns a valid diagnosis result
- **THEN** the worker SHALL complete the existing job and atomically persist one
  report
- **AND** it SHALL retain the existing frozen evidence cutoff and governed tool
  audit boundary

#### Scenario: Neither strategy yields a usable result

- **WHEN** the structured provider request has no output and the fallback
  returns no parseable or valid JSON result
- **THEN** the worker SHALL not persist a partial report
- **AND** it SHALL record `diagnosis-provider-empty-output` as a retryable
  generation failure

#### Scenario: Other model calls use their existing behavior

- **WHEN** a provider-runtime consumer does not explicitly opt into diagnosis
  empty-output recovery
- **THEN** it SHALL retain its existing structured-output behavior
