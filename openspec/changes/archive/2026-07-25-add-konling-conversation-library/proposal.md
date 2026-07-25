## Why

Konling conversations are currently tied to the page that created them and lack a usable persistent library. A user-owned conversation must survive navigation and support deliberate organization without rewriting its existing context.

## What Changes

- Make readable Konling conversations user-owned and persistent until the user deletes them, subject to existing global retention governance.
- Add a conversation library with title search, pinning, rename, new conversation, and confirmed deletion.
- Auto-name a conversation after its first complete question-and-answer exchange, with the first user prompt as fallback; never overwrite a manual title.
- When the current conversation is deleted, open a new blank conversation while preserving any separately stored structured artifacts.
- Preserve the initial page context and append one controlled current-page-context record immediately before the next user question when a conversation continues on another page.
- Never rewrite prior messages, the original system prefix, or previous context records.
- Migrate existing readable sessions with messages, tool records, and timestamps; exclude expired, empty, and failed-initialization-only sessions.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `konling-agent-runtime`: adds user-scoped conversation ownership, library metadata, cross-page context append semantics, deletion behavior, and existing-session migration.

## Impact

- Affects Konling session models and APIs, message submission, page-context envelopes, conversation list queries, naming, pinning, search, deletion, and migration.
- Reuses existing role and privacy scopes, tool-run records, and page context extraction.
- Does not change the default side-panel geometry or smart-preparation action-card behavior.
