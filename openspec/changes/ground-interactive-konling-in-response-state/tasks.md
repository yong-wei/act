## 1. Reproduce the missing response-state context

- [ ] 1.1 Add a route/runtime regression showing that persisted partial and submitted responses currently produce the same static tutoring context.
- [ ] 1.2 Add hostile request coverage proving browser-authored tools, prompt extensions and answer-visible flags cannot authorize answer checking.

## 2. Build the server-owned tutoring projection

- [ ] 2.1 Resolve the authenticated classroom session, resource, step and latest persisted response into a bounded interactive tutoring state.
- [ ] 2.2 Distinguish unanswered, partial, complete-submission and teacher-disclosed states without exposing answer packages or other learners' data.
- [ ] 2.3 Derive permitted tutoring behavior and tools from that state for both embedded interactive AI and Global AI.

## 3. Verify the learning boundary

- [ ] 3.1 Prove pre-submission questions receive hints without complete answers or answer-check authority.
- [ ] 3.2 Prove complete submission and teacher disclosure use the current learner's persisted response for bounded checking and explanation.
- [ ] 3.3 Prove state changes between turns are reflected without mutating earlier conversation messages or official learning records.
- [ ] 3.4 Run focused interactive/Konling route tests, typecheck, strict change and repository OpenSpec validation, and `git diff --check`.

