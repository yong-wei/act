## 1. Shared Contract

- [x] 1.1 Define the action-state model and the list of audited action categories.
- [x] 1.2 Add or adapt shared UI primitives for visible status, recovery action, and accessible announcement.
- [x] 1.3 Add utility tests for pending, success, failure, blocked, unsupported, and download states.

## 2. Adoption Hooks

- [x] 2.1 Provide route/query action adapters for action parameters such as `action=export`, `action=approve`, and `action=test`.
- [x] 2.2 Provide API result mapping for 400/403/404/405/500 and validation failures.
- [x] 2.3 Document how vertical remediation changes must consume the contract.

## 3. Audit Closure

- [x] 3.1 Validate representative pages from batches 41, 42, 43, 46, and 55-59.
- [x] 3.2 Run `rtk openspec validate audit-remediation-action-status-contract --strict`.
- [x] 3.3 Update audit report entries only for status/live findings verified by new evidence.
