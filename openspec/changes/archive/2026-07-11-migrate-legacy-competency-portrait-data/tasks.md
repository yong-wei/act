## Tasks

- [x] Task 1: Add legacy-to-portrait-v2 migration mapping and dry-run report.
  Covers: AC-1
  Acceptance: The report lists eligible, migrated, skipped, conflicting, and unmigrated records with privacy-minimized ids.
  Evidence: Migration dry-run tests.
  Reviewer Check: Confirm mapping confidence and limitations are explicit.

- [x] Task 2: Implement idempotent migration apply path.
  Covers: AC-2
  Acceptance: Applying migration creates or updates portrait v2 records without duplicating rows or erasing lineage.
  Evidence: Idempotency tests.
  Reviewer Check: Confirm repeat runs are stable and reversible enough for operational review.

- [x] Task 3: Update Yang Fan fixture data for portrait v2.
  Covers: AC-3
  Acceptance: Yang Fan canonical account generates governed evidence or native portrait v2 rows covering all seven dimensions and survives worker recomputation.
  Evidence: Fixture and worker recomputation tests.
  Reviewer Check: Confirm duplicate accounts are not merged by name alone.

- [x] Task 4: Extend data completeness helper for portrait migration state.
  Covers: AC-4
  Acceptance: Helper reports native, migrated, stale, and unmigrated portrait states and highlights fixture blockers.
  Evidence: Helper output tests.
  Reviewer Check: Confirm helper is read-only and privacy-minimized.

- [x] Task 5: Run validation.
  Covers: AC-5
  Acceptance: OpenSpec validation and issue-body validation pass.
  Evidence: Validation command output.
  Reviewer Check: Confirm all AC ids map to implementation evidence.

## Validation

- [x] Run `rtk openspec validate migrate-legacy-competency-portrait-data --strict`.
- [x] Run focused migration, fixture, worker recomputation, and helper tests.
- [x] Run Buddy issue-body validation before GitHub issue creation.
