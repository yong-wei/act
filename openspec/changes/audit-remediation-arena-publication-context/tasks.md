## 1. Publication Context

- [ ] 1.1 Define publication display states for active, expired, report-ready, late-only, and unavailable publications.
- [ ] 1.2 Replace primary internal ids with task title, class/assignment, teacher/source, deadline, and report context.
- [ ] 1.3 Add leaderboard source-boundary explanations for global, class, and assignment contexts.

## 2. Report Delivery And Policy Preservation

- [ ] 2.1 Add status-bearing export, send/publish, lock/finalize, and copy-commentary actions where supported.
- [ ] 2.2 Preserve existing `attemptPolicy` behavior for effective, late, zero-score, and invalid submissions.
- [ ] 2.3 Ensure official report and leaderboard rows use server-side `ArenaSubmission` rather than auxiliary `LearningFact` context.
- [ ] 2.4 Add mobile safe-area/action reachability checks for publication report and challenge drawer.
- [ ] 2.5 Update audit evidence with publication-context finding ids and note preserved first-batch policy.

## 3. Verification

- [ ] 3.1 Add tests for active/expired state rendering, product naming, ArenaSubmission authority, mobile action reachability, and attempt-policy preservation.
- [ ] 3.2 Capture browser evidence for teacher and student publication routes.
- [ ] 3.3 Run `rtk openspec validate audit-remediation-arena-publication-context --strict`.
