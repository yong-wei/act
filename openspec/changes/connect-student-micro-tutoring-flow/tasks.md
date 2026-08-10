## 1. Server boundaries

- [x] 1.1 Add an answer-bound learner remediation entry that derives owned wrong-answer attribution server-side and returns a controlled unavailable result when no safe attribution exists.
- [x] 1.2 Add a started-intervention validation-question read boundary with ownership, current-task and safe question projection checks.
- [x] 1.3 Add route-level regression coverage for learner authorization, answer eligibility, unavailable states and validation-question redaction.

## 2. Student micro-tutoring experience

- [x] 2.1 Create a focused client panel and contract for orchestration, intervention progress, retry identities, validation and recommendation states.
- [x] 2.2 Integrate the explicit entry into persisted incorrect adaptive-practice feedback without changing existing Konling explanation behavior.
- [x] 2.3 Implement governed resource launch, hint, completion and validation controls with accessible pending, unavailable and recoverable-error states.

## 3. Verification

- [x] 3.1 Add component and integration regressions for the complete available, unavailable, retry and terminal-validation journeys.
- [x] 3.2 Run targeted tests, typecheck, strict OpenSpec validation, relevant browser acceptance, build and diff checks.（全量构建已执行，但被既有互动课客户端引入 `node:fs` 的两处 Turbopack 错误阻断。）
