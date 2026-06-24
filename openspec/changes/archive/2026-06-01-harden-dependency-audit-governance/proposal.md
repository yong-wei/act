## Why

After the migration series removes current audit debt, the repository needs a repeatable dependency-audit gate. Without governance, the same class of vulnerabilities can re-enter through lockfile refreshes or unrelated feature work.

## What Changes

- Add dependency audit governance that records accepted residual risks, severity thresholds, and remediation ownership.
- Define a repeatable audit command and reporting format for local and CI use.
- Add allowlist rules only for documented, time-bounded exceptions tied to issues.
- Require migration evidence before closing the audit vulnerability series.

## Capabilities

### New Capabilities
- `dependency-audit-governance`: Defines ongoing audit policy, allowlist, and verification requirements after vulnerability remediation.

### Modified Capabilities
- None.

## Impact

- Affects package scripts, CI or local verification scripts, documentation, and review expectations.
- Should run after remediation changes so governance reflects the final dependency state.
- Does not introduce new application features.
