## Why

Arena and classroom audit findings show that official submissions, multiple attempts, late entries, zero scores, classroom submissions, ending sessions, and evidence writeback are not explained or connected to student/teacher follow-up. The platform needs a clear evaluation-to-evidence remediation contract.

## What Changes

- Clarify Arena active/expired, late, zero-score, official/effective, and multiple-submission rules for students and teachers.
- Ensure Arena and classroom submissions write to student evidence or show an explicit non-writeback state.
- Fix classroom code errors, release/submit/end state feedback, and post-class review entry points.
- Preserve class/session/task context across teacher and student routes.
- Update audit findings after Arena/classroom evidence flows are verified.

## Capabilities

### New Capabilities
- `audit-remediation-arena-classroom-evidence`: audit remediation contract for Arena/classroom result explanation, submission rules, and evidence writeback.

### Modified Capabilities
- None. Existing Arena and interactive classroom specs remain the implementation base.

## Impact

- Affects `/arena`, challenge details, control workbench Arena mode, Arena teacher publication/reporting, classroom join, student runtime, teacher runtime, session ending, evidence pages, and review routes.
- Evidence references include `chapters/10-function-state-flows-batch2.md`, `chapters/34-function-state-flows-batch26.md`, `chapters/54-function-state-flows-batch46.md`, and classroom/Arena findings in batches 17-29 and 49-59.
