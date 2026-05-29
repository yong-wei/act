## Context

The current runtime already builds server-owned page, learner-state, plan, and scoped memory context. It also exposes scoped AI SDK tools. The missing production boundary is not another chat endpoint; it is durable task state, tool-call audit, approval gating, and user-isolated memory semantics.

This change does not define simulation run storage. It prepares Konling so later changes can safely call simulation and Arena tools through persisted tool runs.

## Decisions

### AgentSession Is Task State, Not Chat History

`KonlingSession` can remain the short-lived message-history table. A hardened runtime needs a task-oriented `AgentSession` concept with phase, status, last state, owner user, optional course/class/scene/resource/path scope, and expiration.

Supported statuses should include at least `draft`, `ready`, `running`, `awaiting_approval`, `paused`, `succeeded`, `failed`, and `archived`. The runtime must reject access when the authenticated user is outside the session scope.

### Every Tool Call Is Persisted

Each tool call should produce an `AgentToolRun` before side effects occur. The record should include:

- `agentSessionId`
- `toolName`
- `permissionTier`
- `approvalState`
- `status`
- `inputJson` or redacted input summary
- `outputJson` or redacted output summary
- `errorJson`
- `idempotencyKey`
- `correlationId`
- `actorUserId`
- `targetUserId`

The idempotency rule must be scoped by tool and owner user. Repeating the same state-changing request for the same user must reuse or reject the existing tool run rather than creating duplicate side effects.

### Tool Registry Owns Permission And Approval Policy

Tools should be registered with explicit metadata:

- `read`: safe reads, no approval by default
- `analyze`: deterministic or model-assisted analysis, no direct state change
- `run`: creates compute/run artifacts and needs idempotency
- `write`: changes drafts, memory, session state, or controller drafts; approval required unless a future spec grants a narrow exception
- `publish`: changes student-visible or teacher-visible records; approval required

The registry should be server-owned. Client hints may request tools, but cannot expand permissions.

### Long-Term Memory Is User-Isolated

Long-term memory must never be shared across users by default. Any memory read or write must include owner user scope plus allowed class/course/scene/resource/path filters. Teacher or admin views may see redacted summaries only when role scope permits them.

Memory entries should keep evidence references and privacy/TTL metadata. Raw dialogue text is not required for learner-state, personalization, or teacher-facing payloads.

## Risks

- A generic tool audit table can become a dumping ground for raw private data. Tool run payloads need redaction rules and output summaries.
- Approval gating can block useful read/analyze flows if tiers are too broad. The registry should make read and analyze cheap while strictly gating write and publish.
- User isolation must be enforced at query boundaries, not only in prompt construction.

## Verification

- Unit tests for tool registry permission tiers, approval decisions, and idempotency reuse.
- API tests for cross-user AgentSession, AgentToolRun, and memory rejection.
- Tests proving state-changing tools cannot complete without approval where policy requires it.
- `rtk proxy openspec validate harden-konling-agent-runtime-tools --strict`.
