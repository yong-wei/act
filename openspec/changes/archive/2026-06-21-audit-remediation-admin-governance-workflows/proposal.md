## Why

Administrator audit findings show that data governance, user import, configuration testing, user search/export, and statistics exports are operationally important but still behave like read-only or generic pages. Governance actions must become object-level workflows with audit trails and recovery.

## What Changes

- Turn data governance risks into resolvable, assignable, exportable, auditable objects.
- Add import batch preview, mixed-result handling, failure-row export, notification, batch audit, and explicit rollback-unavailable status until persistent import-batch rollback storage is added.
- Align admin user search/role/page/reset/export with API filters and mobile states.
- Add configuration model/provider test and statistics export states.
- Mark audit findings fixed only after object-level governance evidence is captured.

## Capabilities

### New Capabilities
- `audit-remediation-admin-governance-workflows`: audit remediation contract for administrator risk handling, user import, configuration testing, and export workflows.

### Modified Capabilities
- None. This change builds on existing admin governance and configuration specs.

## Impact

- Affects `/admin/data-governance`, `/admin/users`, `/admin/config`, `/admin/states`, user import APIs, governance export, and configuration model test paths.
- Evidence references include `chapters/51-function-state-flows-batch43.md`, `chapters/53-function-state-flows-batch45.md`, `chapters/54-function-state-flows-batch46.md`, and `chapters/56` through `67`.
