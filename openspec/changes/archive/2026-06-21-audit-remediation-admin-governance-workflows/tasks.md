## 1. Governance Risks

- [x] 1.1 Define risk detail, assign, resolve, export, rollback-availability, and audit states.
- [x] 1.2 Implement missing-risk and missing-assignee recovery states.
- [x] 1.3 Add governance export with download/failure status and audit record.

## 2. Users And Imports

- [x] 2.1 Align user q, role, page, reset, and export with API filters.
- [x] 2.2 Add import preview, batch result, failed-row export, notification, and audit record; record automatic rollback as deferred pending persistent import-batch storage.
- [x] 2.3 Fix hidden file input naming and file chooser/previews from the audit findings.

## 3. Configuration And Statistics

- [x] 3.1 Add provider/model test states for success, missing provider, missing model, failure, and audit output.
- [x] 3.2 Add statistics export download/failure states.
- [x] 3.3 Run `rtk openspec validate audit-remediation-admin-governance-workflows --strict`.
- [x] 3.4 Update only verified admin findings in the audit report.
