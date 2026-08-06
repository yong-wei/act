## 1. Outcome projection contract

- [x] 1.1 Define the outcome state and evidence-limitation types for applied confirmed correction decisions.
- [x] 1.2 Implement a pure evidence-bounded projector using decision time and application node IDs.
- [x] 1.3 Add unit coverage for improved, needs-review, pending-verification, indeterminate, ordinary node completion/failure/abandonment, terminal validation states, ineligible decisions, time boundaries, node filtering, and conflicts.

## 2. Student journey integration

- [x] 2.1 Extend the authorized journey read with the minimum execution and terminal-validation fields required by the projector.
- [x] 2.2 Attach outcome projections to correction history without changing correction decision writes or path application.
- [x] 2.3 Add route/contract tests for authorized output and unauthorized privacy boundaries.

## 3. Teacher aggregate reporting

- [x] 3.1 Derive class-level counts and rates from outcome projections after existing teacher authorization checks.
- [x] 3.2 Ensure aggregates omit user identifiers and raw evidence references and handle empty classes.
- [x] 3.3 Add report tests for each state, mixed evidence, empty samples, and privacy shape.

## 4. UI and verification

- [x] 4.1 Render controlled student-facing outcome labels and evidence limitations without causal wording.
- [x] 4.2 Render teacher aggregate metrics without adding student drilldowns.
- [x] 4.3 Run targeted Vitest and route/report tests, typecheck, necessary ESLint, strict OpenSpec validation, and browser evidence at desktop and 320px widths.
