## 1. Proposal and contract

- [x] 1.1 Complete isolated `use-grill-me` context and ADR for server-authorized Evidence Copilot context.
- [x] 1.2 Record the learning-process accompaniment boundary and non-goals.
- [x] 1.3 Validate the OpenSpec proposal and specification strictly.

## 2. Server evidence boundary

- [x] 2.1 Identify the existing governed learner-state/evidence projection and add a server-only Evidence Copilot resolver.
- [x] 2.2 Parse bounded navigation hints without treating them as evidence or authorization.
- [x] 2.3 Inject only the student-safe projection and limitation metadata into the private model context.
- [x] 2.4 Preserve advisory-only writeback boundaries.

## 3. Student experience

- [x] 3.1 Render available, missing, partial, stale, and unavailable evidence states truthfully.
- [x] 3.2 Provide a real evidence-gathering or practice action for empty/unavailable states.
- [x] 3.3 Keep ordinary Copilot behavior unchanged when Evidence context is absent.

## 4. Verification

- [x] 4.1 Add resolver/projection tests for owner scope, source coverage, freshness, and limitations.
- [x] 4.2 Add route tests for tampered hints, missing evidence, unavailable service, and ordinary chat compatibility.
- [x] 4.3 Add desktop and 320px browser acceptance for the Evidence Copilot state and next action.
- [x] 4.4 Run focused tests, typecheck, strict OpenSpec validation, and `git diff --check`.
- [x] 4.5 Capture revision-bound evidence for the affected student surface.
