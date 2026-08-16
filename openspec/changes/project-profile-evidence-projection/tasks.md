## 1. Planning and contracts

- [x] 1.1 Add the authenticated portfolio evidence response types and pure source projection helpers.
- [x] 1.2 Add the `student-portfolio-evidence` API contract tests for authentication, ownership, source states, and safe field projection.

## 2. Server implementation

- [x] 2.1 Implement `GET /api/profile/portfolio-evidence` with independent classroom, simulation, and ethics reads bounded to recent source rows.
- [x] 2.2 Ensure the route never returns raw classroom response JSON, simulation trajectory/input payloads, or another user's records.

## 3. Portfolio integration

- [x] 3.1 Replace portfolio placeholder arrays and write-endpoint fetches with the authenticated evidence endpoint.
- [x] 3.2 Render available records and distinguish `empty` from `unavailable` in classroom, simulation, and ethics tabs.
- [x] 3.3 Preserve the existing reflection draft flow and leave prompt history to its separate change.

## 4. Verification

- [x] 4.1 Run focused portfolio evidence tests and related profile/portfolio tests.
- [x] 4.2 Run TypeScript typecheck, strict OpenSpec validation, and `git diff --check`.
- [x] 4.3 Perform authenticated desktop and 320px browser smoke checks for the portfolio tabs and record evidence of the final revision.
