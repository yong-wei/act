## 1. Continuity Contract

- [ ] 1.1 Inventory the existing authenticated learner-state, unfinished-task, structured-mistake, recommendation, and assessment contracts used by Konling.
- [ ] 1.2 Define the server-owned continuity snapshot contract, stable snapshot identity, evidence cutoff, three-state priority, and user-scope validation.
- [ ] 1.3 Add contract tests for unfinished-task priority, recent-mistake fallback, cold start, stale client hints, and cross-user rejection.

## 2. Server-Owned Continuity Resolution

- [ ] 2.1 Implement the learner-scoped continuity resolver using existing governed readers without changing portrait or path calculations.
- [ ] 2.2 Expose the continuity snapshot through the focused Konling page/tool contract with explicit unavailable reasons.
- [ ] 2.3 Add resolver and authenticated route tests covering stable evidence ordering, missing structured causes, stale tasks, and permission revalidation.

## 3. Konling Continuity Experience

- [ ] 3.1 Render one structured continuity card for unfinished task, recent mistake, or cold start without creating a chat message or learning fact on open.
- [ ] 3.2 Implement per-visit snapshot deduplication so panel reopen and rerender do not repeat the same proactive card.
- [ ] 3.3 Wire continue, re-explain, temporary skip, review, and goal-entry actions to existing authorized navigation and Konling session flows.
- [ ] 3.4 Add component and browser tests for action semantics, keyboard access, mobile presentation, cross-page continuation, and no-repeat behavior.

## 4. Governed Companion Practice

- [ ] 4.1 Extend adaptive assessment attempt metadata to preserve companion-practice origin, snapshot identity, target knowledge identity, and optional structured cause identity.
- [ ] 4.2 Request exactly one eligible check question through the existing assessment selection contract and return an explicit unavailable state when selection fails.
- [ ] 4.3 Verify that submission, grading, retry, concurrency, and learning-fact writeback reuse existing idempotent assessment behavior without duplicate facts.

## 5. Evidence-Triggered Feedback

- [ ] 5.1 Produce continuity feedback only after a new governed result, separating the current result from cumulative stability and offering one next companion-practice action.
- [ ] 5.2 Refresh the continuity snapshot after eligible evidence while keeping companion practice independent of path generation and execution.
- [ ] 5.3 Add tests proving chat-only completion claims, panel views, temporary skips, and missing causes do not mutate learner state or paths.

## 6. Validation

- [ ] 6.1 Run targeted unit and integration tests for the continuity resolver, Konling card, assessment persistence, authorization, and path non-mutation.
- [ ] 6.2 Run TypeScript checking and strict OpenSpec validation, then record final browser evidence for desktop and mobile student flows.
