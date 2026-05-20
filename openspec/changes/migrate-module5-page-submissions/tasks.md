## 1. Inventory

- [x] 1.1 Enumerate response-producing steps in 5-2, 5-3, 5-4, 5-5, and 5-6.
- [x] 1.2 Classify each step as objective, subjective, drag/match/sort, parameter, simulation, or training result.
- [x] 1.3 Identify existing lesson-local submit helpers that should be removed or reduced.

## 2. Migration

- [x] 2.1 Migrate 5-2 student submissions to the shared path.
- [x] 2.2 Migrate 5-3 student submissions to the shared path.
- [x] 2.3 Migrate 5-4 student submissions to the shared path.
- [x] 2.4 Migrate 5-5 student submissions to the shared path.
- [x] 2.5 Migrate 5-6 student submissions to the shared path.
- [x] 2.6 Preserve existing `StudentState.responses` semantics for teacher summaries.

## 3. Coverage

- [x] 3.1 Add a guard that fails when a module 5 response-producing step bypasses the shared submit path.
- [x] 3.2 Add tests for one ordinary quiz page and one custom parameter/simulation/training page.
- [x] 3.3 Verify generated submit payloads include answer evidence or structured extra evidence.

## 4. Verification

- [x] 4.1 Run targeted module 5 interactive tests.
- [x] 4.2 Run `npm run lint`.
- [x] 4.3 Record any unrelated baseline failures separately.
