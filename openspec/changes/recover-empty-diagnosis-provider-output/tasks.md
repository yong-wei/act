## 1. Provider recovery

- [x] 1.1 Add an opt-in structured-output fallback that requests plain JSON
  text with an independent provider idempotency key.
- [x] 1.2 Enable the fallback only for the governed teacher-diagnosis adapter.
- [x] 1.3 Preserve normal output validation and classify exhausted empty output
  as retryable.

## 2. Regression coverage

- [x] 2.1 Cover empty structured output followed by valid JSON fallback.
- [x] 2.2 Cover the durable job and attempt error classification.
- [x] 2.3 Run focused test suites and workspace diff validation.
