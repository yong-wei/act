## 1. Publication Context

- [x] 1.1 Define publication display states for active, expired, report-ready, late-only, and unavailable publications.
- [x] 1.2 Replace primary internal ids with task title, class/assignment, teacher/source, deadline, and report context.
- [x] 1.3 Add leaderboard source-boundary explanations for global, class, and assignment contexts.

## 2. Report Delivery And Policy Preservation

- [x] 2.1 Add status-bearing export, send/publish, lock/finalize, and copy-commentary actions where supported.
- [x] 2.2 Preserve existing `attemptPolicy` behavior for effective, late, zero-score, and invalid submissions.
- [x] 2.3 Ensure official report and leaderboard rows use server-side `ArenaSubmission` rather than auxiliary `LearningFact` context.
- [x] 2.4 Add mobile safe-area/action reachability checks for publication report and challenge drawer.
- [x] 2.5 Update audit evidence with publication-context finding ids and note preserved first-batch policy.

## 3. Verification

- [x] 3.1 Add tests for active/expired state rendering, product naming, ArenaSubmission authority, mobile action reachability, and attempt-policy preservation.
- [x] 3.2 Capture browser evidence for teacher and student publication routes.
- [x] 3.3 Run `rtk openspec validate audit-remediation-arena-publication-context --strict`.
