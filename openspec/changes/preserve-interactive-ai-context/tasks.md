## 1. Define the governed interactive AI context

- [ ] 1.1 Add a typed request/response contract for interactive AI session identity, resource identity, course step, progress, completion state, and recovery status.
- [ ] 1.2 Reuse the existing user-scoped conversation authorization and persistence boundary; document the resource transition rule without creating a parallel conversation store.
- [ ] 1.3 Add server-side validation tests proving forged resource, step, progress, and completion fields cannot expand the authorized context.

## 2. Preserve and recover multi-turn context

- [ ] 2.1 Update `useInteractiveAI` to send the bounded ordered conversation history and governed session identity instead of only the current question.
- [ ] 2.2 Update `/api/ai/chat` to resolve interactive session history and append current page context without overwriting prior messages or treating page metadata as a user message.
- [ ] 2.3 Persist successful interactive AI turns through the existing conversation path and return an explicit recovery/unavailable result when history cannot be read.
- [ ] 2.4 Add regressions for follow-up questions, refresh/reopen recovery, incompatible resource isolation, history ordering, and bounded model input.

## 3. Keep progress context current and safe

- [ ] 3.1 Resolve the latest authorized resource, course step, progress, and completion state on the server for each interactive AI request.
- [ ] 3.2 Update the interactive provider and panel to refresh context after progress changes while preserving the conversation and showing loading/recovery states.
- [ ] 3.3 Add regressions proving progress is learning context only, prior messages remain immutable, and no official grade, LearningFact, leaderboard, or learner-profile writeback occurs.

## 4. End-to-end acceptance

- [ ] 4.1 Add authenticated browser coverage for a first question, contextual follow-up, progress change, refresh/reopen, and cross-resource isolation.
- [ ] 4.2 Verify the supported legacy/development no-session path remains one-turn compatible and is not advertised as persisted.
- [ ] 4.3 Run focused tests, affected interactive-course tests, typecheck, strict OpenSpec validation, and `git diff --check` on the final revision.
