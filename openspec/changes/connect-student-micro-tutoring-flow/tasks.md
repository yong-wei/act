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
- [x] 3.2 Run targeted tests, typecheck, strict OpenSpec validation, relevant browser acceptance, build and diff checks. Browser acceptance is recorded in `artifacts/commercial-ui/issue-1330-student-micro-tutoring-flow/evidence-manifest.json` for code commit `571d2e0c1a81d8e886cbfaf2483054f6389f2ff0`; it covers 1440px and 320px available, fail-closed unavailable, and 503 recovery states with screenshot hashes and no-overflow checks. Capture rejects dirty tracked sources and HEAD/content drift before publishing evidence. After synchronizing the independent build repair from `integration`, targeted tests, typecheck, strict OpenSpec validation, `next build --webpack`, `npm run build`, and diff checks passed without adding unrelated build-repair production changes to this change.
