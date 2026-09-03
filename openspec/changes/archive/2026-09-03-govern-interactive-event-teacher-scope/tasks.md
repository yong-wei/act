## 1. Authorization and projection contracts

- [x] 1.1 Add route-level regression tests for teacher class ownership, enrolled-student scope, explicit cross-class target rejection, and no event query before authorization failure.
- [x] 1.2 Define the allowlisted normal event projection and regression tests proving direct identifiers, raw `eventData`, private AI questions, prompts, answers, and implementation fields are excluded.
- [x] 1.3 Add diagnostic contract tests proving control-workbench and annotated-media branches use the same server-derived scope.

## 2. Interactive event read implementation

- [x] 2.1 Implement or reuse a server-side teacher scope resolver from `Class.teacherId`, `ClassSession.classId`, and `StudentProfile.classId`.
- [x] 2.2 Apply the resolved scope before normal `InteractionLog` and `StudentStepResponse` reads; keep request selectors as narrowing filters only.
- [x] 2.3 Return role-minimized event summaries and safe aggregates from the normal GET route.
- [x] 2.4 Exclude private AI-query payloads from ordinary teacher results and keep any future raw drilldown as a separate purpose-bound operation.

## 3. Verification and delivery evidence

- [x] 3.1 Run focused interactive-event route, projection, and diagnostic tests, then the affected learning-record governance suite.
- [x] 3.2 Run `npm run typecheck`, strict change and repository OpenSpec validation, and `git diff --check`.
- [ ] 3.3 Record the authorized and rejected scope cases, safe response shape, and raw-access boundary in the PR verification notes.
