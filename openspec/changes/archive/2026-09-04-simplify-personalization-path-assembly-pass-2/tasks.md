## 1. Baseline

- [x] 1.1 Confirm no active change owns `assemble-plan.ts`, then record current production size, functions, guards, and public exports.
- [x] 1.2 Run the existing path-assembly characterization tests and keep them unchanged as the behavior baseline.

## 2. Simplification

- [x] 2.1 Simplify repeated identity, candidate, eligibility, ranking, repair, redaction, and explanation work one stage at a time.
- [x] 2.2 Remove redundant state forms and forwarding helpers without adding a planner, registry, or public export.

## 3. Verification

- [x] 3.1 Run path-planning tests, related route tests, `npm run typecheck`, and `git diff --check`.
- [x] 3.2 Report before/after production size, functions, guards, state forms, and unchanged public behavior.
