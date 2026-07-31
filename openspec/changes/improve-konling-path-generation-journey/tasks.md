## 1. Request Lifecycle

- [x] 1.1 Add a synchronous admission guard that freezes one generation request ID before rerender.
- [x] 1.2 Preserve the same ID for active and unknown-result retries while issuing a new ID after definitive terminal results.
- [x] 1.3 Make the route distinguish definitive runtime failures from unexpected exceptions whose side-effect outcome is unknown.

## 2. Student Status Experience

- [x] 2.1 Open Konling and submit generation from the primary action while locking the target during active work.
- [x] 2.2 Render pending, running, succeeded, and failed status in the Konling sidebar without sending model chat requests.
- [x] 2.3 Refresh successful generated paths in place so status and comparison remain visible.

## 3. Verification

- [x] 3.1 Add behavior tests for duplicate activation, repeated callback, unknown-result retry, and explicit regeneration identity changes.
- [x] 3.2 Run focused route and UI tests, lint, typecheck, and diff validation at the final head.
- [x] 3.3 Capture 1440px and 320px browser evidence with commit, timestamp, request observations, and screenshot hashes.
