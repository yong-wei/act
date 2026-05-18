## Context

Arena challenge detail pages are now read-only challenge entries. Students can inspect the task, evaluation rules, related knowledge, and a workbench entry, but the current leaderboard area is only a summary. For a challenge-specific page, this is too weak: students need to compare concrete official submissions across the main ranking, method-specific rankings, and metric-specific rankings without opening the submission panel.

## Goals / Non-Goals

**Goals:**

- Add a challenge-scoped leaderboard browser below the existing summary.
- Reuse official leaderboard policy and validity filtering instead of inventing a separate ranking path.
- Support main, method, and metric leaderboard categories with second-level selection where needed.
- Show student identity fields and concrete metrics required for academic comparison.
- Keep the challenge detail page free of official submission controls.

**Non-Goals:**

- No changes to official scoring formulas.
- No new public ranking categories such as Pareto, class, or season leaderboards.
- No submission form or local controller simulator on the challenge detail page.
- No persistence of user leaderboard tab preference across browser sessions.

## Decisions

- Reuse `buildArenaLeaderboard` as the ranking core.
  Rationale: the detail browser must agree with existing official leaderboard rules, legacy-protocol exclusion, validity filtering, and tie-break behavior.

- Add a challenge-detail display row model rather than storing duplicated fields on `ArenaSubmission`.
  Rationale: `ArenaSubmission.studentLabel` already stores a display name, while `StudentProfile.studentNumber` is the authoritative source for student number. A query/assembly layer can expose the joined field without changing persistence.

- Treat method and metric leaderboards as sub-leaderboard groups.
  Rationale: method and metric categories are not single tables. The UI must expose which method or metric is currently selected before the rows are meaningful.

- Keep empty and unsupported states explicit in Chinese.
  Rationale: some challenges may have no submitted rows, no method dimension, or no metric-specific ranking yet. Silent blank tables are indistinguishable from loading failure.

## Risks / Trade-offs

- [Risk] Student number may be unavailable for historical submissions.
  Mitigation: render a Chinese fallback such as `未登记` while preserving row layout and keeping `studentLabel` visible.

- [Risk] Method labels may be inconsistent across controller artifacts.
  Mitigation: derive the method list from normalized leaderboard row metadata where possible, and fall back to known challenge method labels.

- [Risk] Detail pages may become visually dense.
  Mitigation: keep the summary compact, put tab and sub-tab controls directly above the table, and limit the table to challenge-relevant metric columns.
