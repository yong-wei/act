## ADDED Requirements

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
