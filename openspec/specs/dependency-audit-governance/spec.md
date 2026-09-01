# dependency-audit-governance Specification

## Purpose

Define the ongoing dependency audit policy, allowlist rules, and verification gate used after the audit vulnerability migration series.
## Requirements
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

#### Scenario: Audit tool suggests an unsafe fix
- **WHEN** `npm audit fix` suggests a downgrade, unsupported major-line jump, or framework-incompatible version
- **THEN** governance SHALL reject the automatic fix
- **AND** it SHALL record the supported owner lane and follow-up issue for remediation.

### Requirement: Audit governance records runtime relevance
The project SHALL distinguish production runtime dependency findings from dev-only tooling findings in audit reports.

#### Scenario: Audit report is generated
- **WHEN** the report summarizes vulnerabilities
- **THEN** it SHALL identify whether each tracked finding is direct or transitive and whether it affects production runtime dependencies, dev tooling, or both.

#### Scenario: Deprecated install warnings are reviewed
- **WHEN** `npm ci` emits deprecated-package warnings
- **THEN** governance SHALL classify them separately from security audit findings
- **AND** each warning SHALL have a package owner lane, removal condition, and decision on whether it blocks release.

### Requirement: Audit remediation batches reconcile live findings with governance state
The project SHALL bind each dependency security remediation batch to a before-and-after audit record and SHALL reconcile security allowlist and deprecation residual state against the final committed dependency tree.

#### Scenario: Remediation baseline is captured
- **WHEN** implementation begins for a dependency security remediation batch
- **THEN** the baseline SHALL record the commit, package manager and runtime versions, registry and reproducible audit command, audit summary, advisory identifiers, dependency paths, runtime relevance, deprecated-package warnings, and current governance matches
- **AND** each in-scope finding SHALL have a supported remediation lane or an explicit residual decision path.

#### Scenario: Compatible remediation finishes
- **WHEN** a package or lockfile change removes an audited dependency path
- **THEN** the final audit evidence SHALL identify the resolved finding
- **AND** every allowlist entry that no longer matches the final audit SHALL be removed.

#### Scenario: Eligible baseline finding cannot be safely remediated
- **WHEN** a baseline moderate or development-only high finding can only be fixed through an unsupported downgrade, incompatible major migration, or unverified dependency override
- **THEN** the finding SHALL remain visible through an exact package, advisory, and dependency-path entry with a dedicated owner issue, review date, expiry, removal condition, and release-blocking decision
- **AND** a broad package match or forced automatic fix SHALL NOT be used to make the governance gate pass.

#### Scenario: Remediation introduces a new finding
- **WHEN** the final audit contains a moderate-or-higher finding that was not present in the baseline
- **THEN** the audit governance gate SHALL fail
- **AND** the new finding SHALL NOT be allowlisted by the remediation batch
- **AND** the remediation batch SHALL NOT be considered complete.

#### Scenario: Baseline release-blocking finding remains
- **WHEN** the final audit still contains a baseline critical or production-runtime high finding
- **THEN** the audit governance gate SHALL fail
- **AND** the required broader migration or risk decision SHALL be proposed separately instead of weakening this remediation batch.

#### Scenario: Deprecated package warning remains
- **WHEN** the final lockfile still contains a deprecated package warning
- **THEN** the warning SHALL have an exact owner lane, owner issue, review date, expiry, removal condition, and release-blocking decision
- **AND** a stale or unowned deprecation residual SHALL fail the governance gate.

