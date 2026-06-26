## Why

Admin governance foundations now handle several risk actions, exports, model-test recovery states, and user import previews. The remaining audit findings are about durable operation ledgers, reversible batches, configuration impact summaries, mobile fixed action zones, and completion status across admin operations.

## What Changes

- Add durable admin operation ledger semantics for user import, template download, configuration save/test, governance refresh/export, and statistics export flows.
- Promote import preview results into persistent batch records with failure-row download, notification state, and rollback availability or explicit no-rollback rationale.
- Require configuration save and model/provider changes to show impact scope, diff summary, audit output, success/failure state, and recovery actions.
- Require mobile admin pages to keep primary governance actions available without horizontal overflow.
- Exclude active KAQ/resource governance and Graph Center diagnostics from this change.

## Capabilities

### New Capabilities
- `audit-remediation-admin-operations-ledger`: audit remediation contract for persistent admin operation batches, operation audit feedback, reversible import policy, configuration impact status, and mobile action availability.

### Related Capabilities
- `audit-remediation-admin-governance-workflows`: extend prior representative admin action fixes into durable batch and configuration operation coverage.
- `admin-data-governance-dashboard`: require refresh/export/resolve/assign operations to expose operation ids, completion status, and recovery state.
- `teacher-admin-governance-workspaces-ui`: require admin mobile operation surfaces to preserve fixed key actions and status feedback.

## Impact

- Affects `/admin/users`, `/api/admin/users/import`, `/admin/config`, `/admin/data-governance`, `/admin/states`, related export/download APIs, and mobile admin layouts.
- Evidence sources include findings 6, 113-119, 138-144, 161-164, 263, 265, and 317 from the full-system Product Design audit.
- Acceptance requires operation-ledger artifacts or records, UI status evidence, and mobile width/action-zone checks.
