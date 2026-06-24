## ADDED Requirements

### Requirement: Dependency audit governance blocks unowned new risk
The project SHALL enforce a dependency audit governance policy that fails new unallowlisted findings at or above the configured severity threshold.

#### Scenario: New audit finding appears
- **WHEN** the audit governance command processes `npm audit --json`
- **THEN** any new finding at or above the configured threshold SHALL fail unless it is covered by an approved allowlist entry
- **AND** the report SHALL identify the vulnerable package, severity, advisory, dependency path, and owning remediation issue when available.

### Requirement: Audit allowlist entries are explicit and temporary
The project SHALL keep dependency audit allowlist entries explicit, owned, and time-bounded.

#### Scenario: Residual vulnerability is allowed temporarily
- **WHEN** a finding remains after the migration series
- **THEN** the allowlist entry SHALL name the advisory or package, dependency path, reason, owner issue, review date, and removal condition
- **AND** unrelated new findings SHALL NOT be covered by that entry.

### Requirement: Audit governance records runtime relevance
The project SHALL distinguish production runtime dependency findings from dev-only tooling findings in audit reports.

#### Scenario: Audit report is generated
- **WHEN** the report summarizes vulnerabilities
- **THEN** it SHALL identify whether each tracked finding is direct or transitive and whether it affects production runtime dependencies, dev tooling, or both.
