## 1. Report Delivery

- [x] 1.1 Define report version, export, send, lock, summary, and reinforcement task states.
- [x] 1.2 Connect existing report/export API data to teacher UI actions.
- [x] 1.3 Add missing-student and unauthorized-student recovery states.

## 2. Grading And Evidence

- [x] 2.1 Preserve classId, studentId, reportId, gradingRunId, source, and returnTo across teacher links.
- [x] 2.2 Implement grading draft, approve, return, writeback, missing-run, and unsupported-method UI states.
- [x] 2.3 Restore teacher student evidence deep links without losing grading context.

## 3. Mobile And Verification

- [x] 3.1 Add fixed mobile action zones for long class/report pages.
- [x] 3.2 Verify report download/send and grading approval paths from batches 55-59.
- [x] 3.3 Run `rtk openspec validate audit-remediation-teacher-report-grading --strict`.
- [x] 3.4 Update audit report findings only after verified teacher evidence exists.
