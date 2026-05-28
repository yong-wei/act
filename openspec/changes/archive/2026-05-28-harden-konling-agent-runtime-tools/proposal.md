## Why

Konling already has scoped runtime context and AI SDK tools, but tool calls are still not durable, approval-aware, idempotent, or fully auditable. The next simulation-agent work needs a hardened runtime contract before Konling can safely run or modify evidence-bearing simulations.

## What Changes

- Add a stateful agent-session contract separate from short chat history so task workflows can pause, resume, and expose phase/status.
- Persist every Konling tool call as an auditable `AgentToolRun` with user scope, approval state, idempotency key, correlation id, input/output summaries, and errors.
- Introduce a Tool Registry contract that classifies tools as read, analyze, run, write, or publish and requires approval for state-changing operations.
- Require long-term Konling memory to be isolated by user, scoped by course/scene/class where applicable, and backed by evidence references instead of raw dialogue reuse.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `konling-agent-runtime`: Hardens Konling from scoped chat tools into a stateful, user-isolated, auditable agent runtime.

## Impact

- Affects `/api/ai/chat`, `/api/ai/sessions/*`, `src/lib/konling-agent-runtime.ts`, future tool execution APIs, Prisma schema, and teacher/admin memory audit surfaces.
- Establishes prerequisites for Konling simulation tools, simulation evidence materialization, and long-term memory audit UI.
