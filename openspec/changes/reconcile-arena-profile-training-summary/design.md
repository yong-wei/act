# Design

## Invariants

1. Only `projectArenaPortfolioRecentTrainingRun()` success counts as a student-visible preview training.
2. A run must be completed or a historical simulation run without a canonical envelope, have an explicit preview boundary, be officially ineligible, and contain all five finite quality metrics.
3. `total`, `previewCount`, and `recentRuns` derive from the same projected set.
4. The database query remains user-scoped and uses one RepeatableRead transaction.

## Implementation

- Keep the existing database candidate predicate for task/scenario, completion, preview visibility, and official ineligibility.
- Scan candidates in pages of 100 ordered by `createdAt desc, id desc`, using the final id as the cursor and `skip: 1` on subsequent pages.
- Apply the existing projection in application code so canonical/historical boundary precedence and finite metric validation remain identical for counts and rows.
- Accumulate the full eligible count while retaining only the five newest projected rows for the response.
- When the pure portfolio builder is called without a persisted count, derive its count from the same projection rather than raw input rows.

## Compatibility

No official evaluation or learning-state writeback is changed. Existing historical rows with an explicit preview boundary remain eligible when their quality metrics are complete.
