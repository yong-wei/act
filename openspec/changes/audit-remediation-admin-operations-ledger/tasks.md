## 1. Operation Ledger

- [ ] 1.1 Define admin operation ledger payloads for import, template download, config save/test, governance refresh/export, and statistics export.
- [ ] 1.2 Persist or expose operation ids, actor, scope, timestamps, outcome, artifact refs, rollback availability, idempotency key, retention policy, and audit summary.
- [ ] 1.3 Add PII-minimized failed-row artifacts with role-scoped authorization and expiry or revocation policy.
- [ ] 1.4 Align existing admin action status panels with ledger states.

## 2. Imports, Configuration, And Mobile Operations

- [ ] 2.1 Promote import preview/confirm results into durable batch state with failure-row download and notification.
- [ ] 2.2 Implement rollback or explicit no-rollback rationale for import batches.
- [ ] 2.3 Fix upload controls so file inputs expose import-specific accessible names.
- [ ] 2.4 Add configuration diff, impact scope, audit output, duplicate-operation dedupe, and recovery state for saves/tests.
- [ ] 2.5 Ensure admin mobile pages keep primary actions and status feedback reachable without horizontal overflow.
- [ ] 2.6 Update audit evidence with only remaining admin-operation finding ids.

## 3. Verification

- [ ] 3.1 Add tests for import batch states, PII-minimized artifacts, role-scoped downloads, config impact status, governance refresh/export, upload accessible naming, and mobile action availability.
- [ ] 3.2 Run `rtk openspec validate audit-remediation-admin-operations-ledger --strict`.
