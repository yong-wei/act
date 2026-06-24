## ADDED Requirements

### Requirement: React Doctor noise baseline separates fixture noise from product diagnostics
React Doctor release-readiness evidence SHALL distinguish owned product diagnostics from sample repository or evaluation fixture diagnostics.

#### Scenario: Sample repositories contain React-like files
- **WHEN** React Doctor scans the repository for release signal evidence
- **THEN** diagnostics under `evaluate/**/*` and other declared fixture roots SHALL be classified as fixture noise or excluded by the scan boundary
- **AND** those diagnostics SHALL NOT be counted as product blocker totals

#### Scenario: React Doctor warning totals are reported
- **WHEN** warning totals are included in a release noise baseline
- **THEN** the report SHALL state whether the totals are advisory-only, security-blocking, or implementation-blocking
- **AND** the report SHALL include the scan boundary used to produce the counts
