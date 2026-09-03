## 1. Contract And Regression Coverage

- [x] 1.1 Add a failing API regression proving evidence-backed recommendations include a valid student action URL.
- [x] 1.2 Add a failing diagnosis regression proving generated learning actions do not use `/courses` and remain state-neutral.
- [x] 1.3 Add a component or route regression proving a missing action URL renders an unavailable state instead of `#`.

## 2. Navigation Implementation

- [x] 2.1 Update the competency snapshot recommendation projection to emit the formal interactive course entry when no specific resource is known.
- [x] 2.2 Update cumulative diagnosis next actions to use the same validated student learning entry.
- [x] 2.3 Keep client rendering fail-closed for missing or invalid action destinations.

## 3. End-To-End Verification

- [x] 3.1 Add browser coverage for `/profile/growth` recommendation and diagnosis actions reaching `/interactive-learning/courses` at desktop and 320px widths.
- [x] 3.2 Verify student navigation does not change evidence, score, unlock, path, or learning-record state.
- [x] 3.3 Run focused tests, related adaptive-learning tests, `npm run typecheck`, OpenSpec strict validation, and `git diff --check`.
