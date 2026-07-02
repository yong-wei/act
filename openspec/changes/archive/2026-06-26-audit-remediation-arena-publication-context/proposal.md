## Why

Arena remediation already tightened official attempt policy for zero-score, late, invalid, and effective submissions. Remaining audit findings focus on publication context: active/expired visual distinction, report naming, class/assignment ownership, leaderboard source boundaries, and delivery actions.

## What Changes

- Make Arena publications visibly distinguish active, expired, late-only, and report-ready states.
- Replace internal task/class ids in teacher and student publication surfaces with product names, class/assignment context, teacher context, deadline, and source boundaries.
- Add report delivery actions for teacher Arena publication reports: export, send, lock/finalize board, and copy commentary where supported.
- Explain global, class, and assignment leaderboard source boundaries in student and teacher views.
- Preserve the first-batch `attemptPolicy` rules; do not reimplement evaluation scoring, KAQ evidence writeback, or path terminal validation here.

## Capabilities

### New Capabilities
- `audit-remediation-arena-publication-context`: audit remediation contract for Arena publication context, expired-state display, leaderboard source boundaries, and publication report delivery.

### Related Capabilities
- `audit-remediation-arena-classroom-evidence`: extend prior attempt-policy remediation into publication context and delivery states.
- `arena-publication-reporting`: require teacher reports to expose product names, ownership context, delivery actions, and active/expired semantics.
- `arena-student-entry-experience`: require student challenge entries to expose class/assignment/deadline context and leaderboard source boundaries.

## Impact

- Affects Arena publication lists, teacher publication reports, student challenge entries, leaderboard/honors copy, and mobile Arena drawer/status behavior.
- Evidence sources include findings 105-112, 157, 261, and Arena-related follow-up entries from the full-system Product Design audit.
- Acceptance requires browser evidence for active and expired publication states plus unit tests that prior attempt-policy rules remain intact.
