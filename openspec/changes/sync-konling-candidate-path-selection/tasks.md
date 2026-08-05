## 1. Candidate Resolution

- [x] 1.1 Add a closed selection-resolution contract over persisted candidate batch identities.
- [x] 1.2 Implement owner-, goal-, and path-scoped batch resolution with unique, ambiguous, unresolved, and unavailable outcomes.
- [x] 1.3 Cover explicit identity, natural-language matching, immutable ordering, and fail-closed authorization with unit tests.

## 2. Governed Konling Selection

- [x] 2.1 Expose the candidate-selection operation through the existing path-advisor tool/runtime contract.
- [x] 2.2 Route uniquely resolved candidates through the existing path-choice mutation with audit and idempotency.
- [x] 2.3 Return structured clarification alternatives without selection or execution side effects.

## 3. Path Center Synchronization

- [x] 3.1 Emit the verified batch and candidate identities in the successful structured action result.
- [x] 3.2 Refresh and focus the adaptive path center from those identities using authorized server data.
- [x] 3.3 Verify that selection does not invoke path execution or advance node state.

## 4. Verification

- [x] 4.1 Add route and runtime tests spanning conversation action, choice persistence, authorization, ambiguity, and idempotency.
- [x] 4.2 Add client tests for same-batch refresh, selected-candidate presentation, and no-auto-start behavior.
- [x] 4.3 Run focused tests, type checking, linting, and OpenSpec validation.
