## Context

Konling has both legacy page-scoped session APIs and a governed agent runtime with persisted messages and tool runs. The target model is one user-owned conversation library that can continue across pages while retaining the provenance of each context change.

## Goals / Non-Goals

**Goals:**

- Persist, organize, search, rename, pin, and delete conversations.
- Append page transitions without rewriting history.
- Migrate readable existing sessions and their tool records.

**Non-Goals:**

- Add full-text message search.
- Change tool authorization or global retention governance.
- Redesign the side panel.

## Decisions

### 1. Make conversation ownership independent of page identity

`ownerUserId` controls access. Course and page identifiers become contextual records, not the unique lookup key. New conversations capture the initiating page context once.

### 2. Append controlled context records

On message submission, the server compares the active page context identity with the last recorded context. If it changed, it appends one server-authored context event immediately before the user message. Existing messages and system prefix remain immutable.

### 3. Store library metadata separately from message content

Title, manual-title flag, pinned state, and activity timestamps support title search and ordering. Automatic naming runs after the first complete exchange and never changes a manual title.

### 4. Delete the conversation, not independent artifacts

Deletion requires confirmation and removes the session and owned message/tool-run records according to existing retention rules. Structured artifacts already applied to platform domains remain in those domains. The UI then opens a blank conversation.

### 5. Migrate only usable sessions

Readable sessions retain chronological messages, tool records, and timestamps. Expired, empty, and failed-initialization-only sessions are omitted.

## Risks / Trade-offs

- [Cross-page continuation leaks unauthorized context] → Build each appended record from the current server-authorized page scope.
- [Legacy session forms duplicate conversations] → Use stable source identities and an idempotent migration.
- [Automatic titles expose sensitive text] → Apply existing redaction and length limits.

## Migration Plan

Add library metadata and context-event support, run an idempotent migration, verify ownership counts and excluded-state counts, then switch session lookup from page-keyed to user-library behavior.

## Open Questions

None.
