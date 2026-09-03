## 1. Client queue identity reset

- [x] 1.1 In `useInteractiveTracking`, reset the entire in-memory queue to the new identity key's stored state on every `storageKey` change: no stored data means an empty queue; the previous identity's events never carry over.
- [x] 1.2 Keep same-identity restore behavior unchanged (refresh and transient sync failure still recover pending events).

## 2. Server attribution contract

- [x] 2.1 Verify/cover by route tests: unauthenticated POST is rejected with 401.
- [x] 2.2 Verify/cover by route tests: persisted ownership always comes from the authenticated session; client-supplied identity fields are ignored.

## 3. Regression tests

- [x] 3.1 Client hook test: guest→login transition resets the queue and does not submit guest events under the student session.
- [x] 3.2 Client hook test: student A→student B transition keeps A's events under A's key and submits only B's own events.
- [x] 3.3 Client hook test: same-identity remount still restores pending events.

## 4. Delivery

- [ ] 4.1 `openspec validate preserve-interactive-event-attribution --type change --strict`, targeted tests, typecheck; archive in the same PR as the implementation.
