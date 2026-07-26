## 1. Generation contract

- [ ] 1.1 Define the authorized, bounded generation request with draft revision, question id, scoring-item id, current level ids, and selected generation basis.
- [ ] 1.2 Define and validate complete generated output keyed by the exact current level identities.
- [ ] 1.3 Add rate limits, safe failure states, and audit metadata without storing unnecessary prompt or rubric content.

## 2. Teacher interaction

- [ ] 2.1 Add the emphasized AI-fill action to enabled detailed rubrics.
- [ ] 2.2 Add the missing-scoring-standard dialog with save-before-generation and explicit ignore paths.
- [ ] 2.3 Reject generation when both scoring standard and scoring-item name are empty and focus the relevant field.
- [ ] 2.4 Add the full-set overwrite warning whenever any current level guideline is non-empty.
- [ ] 2.5 Apply valid output atomically as ordinary editable draft fields without changing names, values, count, order, scoring standard, or publication state.

## 3. Verification

- [ ] 3.1 Add tests for standard-based generation, name fallback, missing basis, overwrite cancellation, and successful replacement.
- [ ] 3.2 Add stale-revision, missing/duplicate/unknown-level, malformed-output, and rate-limit tests proving no partial write.
- [ ] 3.3 Run affected unit/integration tests, typecheck, and keyboard/dialog accessibility checks.

