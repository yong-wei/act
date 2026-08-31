## 1. Timeout Budget

- [x] 1.1 Export provider, task, and lock duration constants with provider < task and lock covering the task window.
- [x] 1.2 Point diagnosis provider generate at the provider window.
- [x] 1.3 Point worker timeout wrapper at the task window and BullMQ lock at the lock duration.

## 2. Fallback Remaining Budget

- [x] 2.1 For `fallbackToTextJson`, spend remaining provider time on the JSON fallback and skip fallback when remaining time is 0.
- [x] 2.2 Leave other structured provider callers on their existing timeout behavior.

## 3. Verification

- [x] 3.1 Add a unit test that provider window is strictly less than task window and lock duration covers the task window.
- [x] 3.2 Add a provider-runtime test that JSON fallback receives remaining timeout rather than a fresh full window.
- [x] 3.3 Re-run diagnosis-generation and provider-runtime unit tests.
