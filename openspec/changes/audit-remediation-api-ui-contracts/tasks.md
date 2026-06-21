## 1. Contract Inventory

- [ ] 1.1 Build an inventory of audited route parameters and API endpoints from batches 44-59.
- [ ] 1.2 Classify each parameter as supported, unsupported, invalid, or legacy-compatible.
- [ ] 1.3 Define shared no-match, bad-object, unauthorized, and unsupported-method state shapes.

## 2. Implementation

- [ ] 2.1 Align admin user search, role, pagination, reset, and export with API results.
- [ ] 2.2 Align learning path, evidence, assignment, and returnTo states with API results.
- [ ] 2.3 Align teacher report, grading, class-student, and governance deep links with missing-object recovery.

## 3. Verification And Audit Ledger

- [ ] 3.1 Add tests or browser checks for no-match, bad ID, unsupported method, and preserved returnTo context.
- [ ] 3.2 Run `rtk openspec validate audit-remediation-api-ui-contracts --strict`.
- [ ] 3.3 Update only verified audit contract findings with remediation status and evidence links.
