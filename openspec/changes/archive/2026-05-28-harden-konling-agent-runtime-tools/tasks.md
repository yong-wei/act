## 1. Runtime State

- [x] 1.1 Define the AgentSession data contract, lifecycle statuses, and ownership checks.
- [x] 1.2 Add runtime service boundaries for creating, resuming, pausing, failing, and archiving agent sessions.
- [x] 1.3 Keep KonlingSession as chat history and avoid using it as long-term task state.

## 2. Tool Registry And Audit

- [x] 2.1 Define Tool Registry metadata for read, analyze, run, write, and publish tiers.
- [x] 2.2 Persist AgentToolRun records before side effects with user scope, approval state, idempotency key, and correlation id.
- [x] 2.3 Add redaction rules for tool input, output, and error summaries.
- [x] 2.4 Enforce idempotency for state-changing tools by owner user, tool name, and idempotency key.

## 3. Approval And Memory Isolation

- [x] 3.1 Route write and publish tools into approval-required state.
- [x] 3.2 Enforce owner-user isolation for long-term memory reads and writes.
- [x] 3.3 Add tests for cross-user session, tool-run, and memory access rejection.

## 4. Validation

- [x] 4.1 Add focused runtime, registry, idempotency, approval, and privacy tests.
- [x] 4.2 Run `rtk proxy openspec validate harden-konling-agent-runtime-tools --strict`.
