## 1. Reproduce the missing response-state context

- [x] 1.1 Add a route/runtime regression showing that persisted partial and submitted responses currently produce the same static tutoring context.
- [x] 1.2 Add hostile request coverage proving browser-authored tools, prompt extensions and answer-visible flags cannot authorize answer checking.

## 2. Build the server-owned tutoring projection

- [x] 2.1 Resolve the authenticated classroom session, resource, step and latest persisted response into a bounded interactive tutoring state.
- [x] 2.2 Distinguish unanswered, partial, complete-submission and teacher-disclosed states without exposing answer packages or other learners' data.
- [x] 2.3 Derive permitted tutoring behavior and tools from that state for both embedded interactive AI and Global AI.

## 3. Verify the learning boundary

- [x] 3.1 Prove pre-submission questions receive hints without complete answers or answer-check authority.
- [x] 3.2 Prove complete submission and teacher disclosure use the current learner's persisted response for bounded checking and explanation.
- [x] 3.3 Prove state changes between turns are reflected without mutating earlier conversation messages or official learning records.
- [x] 3.4 Run focused interactive/Konling route tests, typecheck, strict change and repository OpenSpec validation, and `git diff --check`.

