## 1. Rubric data contract

- [x] 1.1 Version the scoring-item and optional evaluation-level schema with stable ids, one-decimal values, and a 1.0 minimum scoring-item maximum.
- [x] 1.2 Implement shared decimal helpers for upward one-decimal rounding, descending sorting, derived ranges, boundary ownership, and score clamping.
- [x] 1.3 Update runtime schemas and API projections for scoring standards, detailed-rubric enablement, level names, maximums, guidelines, and derived minimums.
- [x] 1.4 Version separate evaluator schemas for scoring-standard-only items and detailed-rubric items, selected from the frozen rubric version and enablement flag.

## 2. Level authoring behavior

- [x] 2.1 Implement first-enable and incremental-add behavior with `优秀`, `良好`, `中等`, `及格`, and `不及格` defaulting to 100%, 90%, 80%, 70%, and 60% of the scoring-item maximum.
- [x] 2.2 Implement five-level and two-level shortcuts, including standard percentages for blank rubrics.
- [x] 2.3 Preserve complete teacher-edited records when expanding and require explicit confirmation before deleting trailing levels.
- [x] 2.4 Apply last-two-level ratio extension only to the sixth and later custom levels, including duplicate-value fallback and rejection when no 0.1 interval remains.
- [x] 2.5 Keep the highest level synchronized to the scoring-item maximum and reorder complete records after other maximum edits.

## 3. Publication and grading integration

- [x] 3.1 Enforce scoring-standard publication requirements when detailed rubric is disabled and level-guideline requirements when enabled.
- [x] 3.2 Enforce assignment, question, scoring-item, and level-range consistency without silent rescaling.
- [x] 3.3 For detailed-rubric evaluator output, require a valid level identity and clamp the AI suggestion to that level's legal one-decimal range.
- [x] 3.4 For scoring-standard-only evaluator output, require a one-decimal score within the scoring-item bounds and reject any required or authoritative level field.
- [x] 3.5 Validate teacher revisions only to one decimal and the zero-to-scoring-item-maximum range, preserving any difference from the AI level.
- [x] 3.6 Preserve default names and values as publishable values while making first input replace the default.

## 4. Migration and verification

- [x] 4.1 Implement a dry-run migration report for legacy rubric mapping, two-decimal rounding differences, and unmappable records.
- [x] 4.2 Preserve immutable legacy publication snapshots and route historical rubric versions through compatible evaluator decoders, approval records, and idempotent writeback.
- [x] 4.3 Add table-driven tests for a new scoring item defaulting to detailed rubric disabled, standard incremental percentages, sixth-level ratio extension, sorting, AI clamping, and teacher-bound validation.
- [x] 4.4 Add grading tests for both evaluator schemas, historical rubric versions, teacher overrides outside the AI level, and approved writeback.
- [x] 4.5 Run affected unit/integration tests, typecheck, and publication/grading/writeback regression tests.
