## Context

Attempt policy is now better governed, but publication context still leaks internal ids and active/expired semantics are unclear. Students and teachers need class/assignment/deadline context and clear leaderboard source boundaries.

## Design

1. Publication state.
   - Publication cards and reports distinguish active, expired, report-ready, late-only, and unavailable states.
   - Expired publications must not share the same primary visual and action treatment as active ones.

2. Product naming.
   - Teacher and student views display task title, class, assignment, teacher, deadline, and report context.
   - Internal task/class ids may remain in debug evidence but not as primary page copy.

3. Leaderboard boundaries.
   - Global, class, and assignment leaderboards declare their source, eligibility, and late/zero/invalid handling.
   - Existing `attemptPolicy` remains the authority for zero-score and late submission exclusion.
   - Server-side `ArenaSubmission` remains the authoritative official source for scores, submission time, hard-constraint pass, late state, and attempt validity; `LearningFact` Arena context is auxiliary only.

4. Delivery actions.
   - Teacher publication reports expose export, send/publish, lock/finalize, and copy commentary states where supported.
   - Mobile publication actions preserve safe-area access and active/expired explanations.

## Out Of Scope

- Arena scoring internals, official evaluator changes, KAQ evidence writeback, path terminal validation, and Rust/control workbench computation.
