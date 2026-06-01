## MODIFIED Requirements

### Requirement: Audit allowlist entries are explicit and temporary
The project SHALL keep dependency audit allowlist entries explicit, owned, and time-bounded.

#### Scenario: Residual vulnerability is allowed temporarily
- **WHEN** a finding remains after the migration series
- **THEN** the allowlist entry SHALL name the advisory or package, dependency path, reason, owner issue, review date, and removal condition
- **AND** unrelated new findings SHALL NOT be covered by that entry.

#### Scenario: Audit tool suggests an unsafe fix
- **WHEN** `npm audit fix` suggests a downgrade, unsupported major-line jump, or framework-incompatible version
- **THEN** governance SHALL reject the automatic fix
- **AND** it SHALL record the supported owner lane and follow-up issue for remediation.

### Requirement: Dependency audit governance records runtime relevance
The project SHALL distinguish production runtime dependency findings from dev-only tooling findings in audit reports.

#### Scenario: Audit report is generated
- **WHEN** the report summarizes vulnerabilities
- **THEN** it SHALL identify whether each tracked finding is direct or transitive and whether it affects production runtime dependencies, dev tooling, or both.

#### Scenario: Deprecated install warnings are reviewed
- **WHEN** `npm ci` emits deprecated-package warnings
- **THEN** governance SHALL classify them separately from security audit findings
- **AND** each warning SHALL have a package owner lane, removal condition, and decision on whether it blocks release.
