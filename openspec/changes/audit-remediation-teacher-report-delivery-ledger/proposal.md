## Why

Teacher report and post-class audit findings show that real classroom review data exists but delivery, export, send, copy-summary, and lesson-level ledger states remain disconnected. The first batch improved representative report/grading flows; this change closes the broader teacher report delivery surface without touching active KAQ/path/prep-pack generation internals.

## What Changes

- Add a teacher report delivery ledger that can be reached from class review, teacher home, class analytics, history, and report book surfaces.
- Surface report states such as draft, ready, exported, sent, copied, blocked, and missing-context with visible recovery actions.
- Connect post-class review actions to report delivery, summary copy, export/download, student-facing handoff, and optional reinforcement-path request entry points.
- Ensure external/internal review routes are not used as teacher delivery exits.
- Exclude KAQ diagnosis, prep-pack candidate generation, path repair, and resource baseline completion from this change.

## Capabilities

### New Capabilities
- `audit-remediation-teacher-report-delivery-ledger`: audit remediation contract for teacher post-class report delivery, report ledger status, export/send/copy actions, and review handoff.

### Related Capabilities
- `audit-remediation-teacher-report-grading`: extend representative teacher report fixes into discoverable delivery-ledger coverage.
- `teacher-evidence-governance`: require teacher-visible report handoff states to include evidence scope and student-safe delivery status.
- `platform-status-and-evidence-ui`: require report actions to use product status panels and auditable completion feedback.

## Impact

- Affects teacher dashboard report slots, class analytics, classroom review, history/review links, report export/send controls, and delivery status UI.
- Evidence sources include findings 96-104, 155-160, 254-264, and 301-315 from the full-system Product Design audit.
- Acceptance requires route-level or browser evidence that report actions are visible, status-bearing, and tied to the originating class/session.
