## 1. Conversation model and APIs

- [x] 1.1 Add user-scoped conversation library metadata, manual-title identity, pinned state, and activity ordering.
- [x] 1.2 Replace page-keyed session lookup with owner-scoped list, create, select, rename, pin, title search, and confirmed delete APIs.
- [x] 1.3 Add automatic naming after the first complete exchange with bounded first-prompt fallback.
- [x] 1.4 Add server-authored current-page context events immediately before cross-page user messages.

## 2. Migration and library UI

- [x] 2.1 Implement an idempotent migration that preserves usable session messages, tool runs, and timestamps and excludes expired, empty, and initialization-only failures.
- [x] 2.2 Build conversation list interactions for new, search, rename, pin, select, and delete.
- [x] 2.3 Open a blank conversation after deleting the active one without deleting independently applied platform artifacts.

## 3. Verification

- [x] 3.1 Test owner isolation, manual-title protection, title-only search, pin ordering, deletion, and retention interaction.
- [x] 3.2 Test same-page and cross-page context ordering, authorization, and immutability of prior context and messages.
- [x] 3.3 Verify migration counts, exclusions, idempotency, chronological messages, and tool-run preservation.
- [x] 3.4 Run typecheck, Konling runtime tests, API tests, and cross-page browser acceptance.
