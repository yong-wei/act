## 1. Specification and domain record

- [x] 1.1 Record the evidence vocabulary, filtering decision, and pagination invariant in scoped Grill context and ADR.
- [x] 1.2 Create the OpenSpec proposal, design, delta specification, and implementation checklist.

## 2. Evidence aggregation

- [x] 2.1 Replace raw persisted-row counting with the existing verified training projection.
- [x] 2.2 Paginate the user-scoped candidate scan in one RepeatableRead transaction and retain only the newest five projected rows.
- [x] 2.3 Make direct portfolio aggregation use the same verified projection when no persisted count is supplied.

## 3. Regression and verification

- [x] 3.1 Cover incomplete, damaged, conflicting-boundary, historical, complete, and cross-user runs.
- [x] 3.2 Cover pagination beyond the first 100 candidates and verify the statistics/list口径一致.
- [x] 3.3 Run focused tests, TypeScript checks, strict OpenSpec validation, and `git diff --check`; perform the available profile browser smoke. Focused tests, strict validation, and diff checks pass; the complete typecheck remains blocked by existing `origin/integration` errors outside the changed files. Profile browser smoke passes at 1440px and 320px with the local PostgreSQL service enabled.
