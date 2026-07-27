## Context

The governed agent runtime already defines tool permissions and persisted tool runs, while some UI paths still use provider-specific chat streams and separate smart-preparation suggestion controls. The observed DSML markup proves that provider normalization and message rendering are not yet one closed contract.

## Goals / Non-Goals

**Goals:**

- Keep structured calls out of user-visible prose.
- Persist and replay structured actions with their assistant turn.
- Make smart-preparation proposals directly actionable in the conversation.

**Non-Goals:**

- Expose every platform tool on every page.
- Replace current page-context injection.
- Create a second task proposal store.

## Decisions

### 1. Normalize before any text reaches the renderer

Provider adapters convert streamed and final text/tool events into one internal event sequence. Deterministic parsing strips recognized DSML envelopes and reconstructs tool calls. If deterministic parsing cannot classify a malformed call, one correction request may use the shared provisional-message revision primitive from `integrate-konling-textbook-rag`; raw syntax never renders and this change does not create another wait or replacement state machine.

### 2. Bind actions to messages and tool runs

An assistant turn references its persisted tool runs and structured outputs. Reloading the conversation reconstructs the same action card and terminal state from server records.

### 3. Apply proposals through the task service

The smart-preparation action card submits the proposed structured diff with task revision and tool-run identity. The existing task service performs authorization and optimistic concurrency. Success updates and highlights the affected accordion stage; conflict offers refresh or reapply.

### 4. Keep tool exposure contextual

Each page or mode supplies its focused permitted tool set. This change preserves project context injection and only adds durable context transitions from the conversation-library contract.

## Risks / Trade-offs

- [Markup parser mistakes ordinary text for a tool call] → Parse only complete recognized envelopes and cover adversarial fixtures.
- [Action replay applies twice] → Reuse persisted tool-run and idempotency identities.
- [Correction ownership diverges from textbook RAG] → Consume its shared provisional-message revision contract and keep only tool-call parsing, persistence, and action semantics in this change.

## Migration Plan

Normalize new turns first, then adapt readable historical tool-run records into action cards. Remove the separate suggestion panel only after the in-message action path is verified.

## Open Questions

None.
