## 1. Baseline and Selector Audit

- [x] 1.1 Re-run local React Doctor error-only scan and save a filtered baseline for `aria-role` diagnostics.
- [x] 1.2 Search source and tests for JSX `role="student"`, `role="teacher"`, business props named `role`, `getByRole('student')`, and `getByRole('teacher')`.

## 2. Interactive Page Fixes

- [x] 2.1 Replace invalid business-role DOM attributes in Unit 4-1 student and teacher pages.
- [x] 2.2 Replace invalid business-role DOM attributes in Unit 5-1 student and teacher pages.
- [x] 2.3 Replace invalid business-role DOM attributes in Unit 5-2 student and teacher pages.
- [x] 2.4 Replace invalid business-role DOM attributes in Unit 5-3 student and teacher pages.
- [x] 2.5 Update any affected tests or selectors to use renamed business props, `data-role`, accessible names, or stable text.

## 3. Regression Guard

- [x] 3.1 Add or extend a local validation test that rejects `role="student"` and `role="teacher"` in interactive course source files and guards against forwarding business roles into DOM role attributes.
- [x] 3.2 Document the rule near the interactive course implementation guidance if an existing skill or local note currently suggests business role attributes.

## 4. Verification

- [x] 4.1 Run the new invalid-role guard and any affected interactive course tests.
- [x] 4.2 Run `npx --yes react-doctor@0.5.1 --no-score --no-telemetry --no-warnings --json .` and confirm no `aria-role` diagnostics remain.
