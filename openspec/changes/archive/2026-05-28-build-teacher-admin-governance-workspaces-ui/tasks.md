## 1. Teacher Workspace

- [x] 1.1 Define governance workspace layouts that wrap or link to `teacher-resource-node-management` browse/search, filters, warning summary, detail, edit panel, and eligibility state.
- [x] 1.2 Reference permitted single-node edit fields and immutable fields from `teacher-resource-node-management` instead of redefining them.
- [x] 1.3 Define redaction behavior for hidden evaluation internals, private learner evidence, raw answers, raw traces, and Konling memory.
- [x] 1.4 Document that teacher homepage/dashboard redesign is out of scope for this change.

## 2. Admin/Data Center Workspace

- [x] 2.1 Define evidence source coverage, readiness, missing context, replay confidence, privacy status, and evaluation-event panels.
- [x] 2.2 Distinguish demo/presentation data-center mode from governance/audit mode.
- [x] 2.3 Define drilldown limits and export-safe aggregation behavior.

## 3. Validation

- [x] 3.1 Add tests for role permissions, warning display, redaction, status aggregation, and export-safe summaries.
- [x] 3.2 Validate with `rtk proxy openspec validate build-teacher-admin-governance-workspaces-ui --strict`.
