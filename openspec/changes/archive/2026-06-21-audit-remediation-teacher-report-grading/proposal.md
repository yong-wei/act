## Why

Teachers can see rich class analytics and report API data, but audited report, delivery, grading, student evidence, and reinforcement actions stay trapped in long pages or jump to unrelated routes. Teacher-facing evidence must become deliverable, approvable, and writable back to students.

## What Changes

- Add a teacher report delivery workflow with version, export, send, copy summary, lock, and reinforcement-task creation states.
- Connect grading workbench draft, approve, return, writeback, unsupported method, and missing run states.
- Preserve class, student, report, grading run, and `returnTo` context across teacher deep links.
- Provide mobile-friendly fixed action zones for long reports.
- Update audit entries after verified report delivery and grading writeback evidence.

## Capabilities

### New Capabilities
- `audit-remediation-teacher-report-grading`: audit remediation contract for teacher report delivery, grading approval, student evidence deep links, and writeback.

### Modified Capabilities
- None. This proposal coordinates existing teacher report, grading, and evidence capabilities under the audit remediation series.

## Impact

- Affects teacher class analytics, report ledgers, `/teacher/grading-workbench`, teacher student evidence links, report export APIs, and class/student deep links.
- Evidence references include `chapters/51-function-state-flows-batch43.md`, `chapters/55-function-state-flows-batch47.md`, `chapters/56-function-state-flows-batch48.md`, and `chapters/63` through `67`.
