## Context

The Copilot page already derives a portfolio-reflection candidate and a task contract for display, while `useLegacyChat` forwards a caller-supplied body to `/api/ai/chat`. The chat route currently destructures page and learner context but has no task-context field, so portfolio-reflection requests fall through to the generic prompt path. The repository already uses Zod for server boundary validation and already defines the task output contract in `src/lib/ai-task-boundary-contracts.ts`.

The change crosses the Copilot client, the chat route, the shared task-contract module, and their source/unit tests. It does not change persistence or official learning-state ownership.

## Goals / Non-Goals

**Goals:**

- Send a minimal portfolio-reflection task descriptor with every reflection Copilot request.
- Validate the descriptor at the API boundary and resolve output/writeback semantics from the server-side task type.
- Add the resolved contract to the model's private system context while retaining the existing page context and evidence summary.
- Make malformed or unsupported task descriptors fail closed with a safe 400 response.
- Preserve candidate-only output and explicit-save semantics.

**Non-Goals:**

- Persisting reflection drafts or changing the portfolio save endpoint.
- Accepting client authorization, internal runtime identifiers, or arbitrary prompt instructions as task context.
- Changing evidence-Copilot semantics or general chat behavior.
- Adding a database migration or AI provider dependency.

## Decisions

1. **Use a separate `auditTaskContext` request field.** The existing `taskContext` field is used by the evidence Copilot for a user-safe evidence summary. A discriminated `auditTaskContext` keeps task governance separate from evidence content and avoids changing the existing evidence payload shape.

2. **Resolve the contract from `taskType`, not client output fields.** The client sends `taskType`, `source`, `assignment`, and `intent`. The server maps `taskType` through `getAiAuditTaskContract`, so `outputTarget`, `writebackBehavior`, and promotion rules cannot be escalated by a modified browser request. An optional client `outputTarget` is rejected when it conflicts with the server mapping.

3. **Keep the contract in the existing task-boundary module.** The module already owns the vocabulary and candidate-only contract. A parser and prompt formatter there make the boundary reusable and keep the route focused on request orchestration.

4. **Fail closed only when the field is present.** Requests without `auditTaskContext` remain compatible with general chat and evidence Copilot. A present but malformed descriptor returns a generic 400 error without echoing internal fields.

5. **Inject bounded structured task data.** The route appends a server-generated task section to the system prompt. Client descriptor values are rejected when they contain Unicode `Cc` control characters, including C0/C1 controls, DEL, newlines, and tabs, plus Unicode line and paragraph separators, before trimming. The accepted descriptor is serialized as JSON inside explicit `<ai-task-descriptor>` delimiters, so values are represented as data rather than interpolated as prompt syntax; fixed candidate-only rules remain separate server-authored instructions.

6. **Trace the resolved contract with a redacted server event.** A valid reflection request emits a single JSON audit record with a request correlation id and only the server-resolved task fields. Raw messages, auth/session data, provider configuration, and runtime context remain excluded from both the event and the model-visible response.

## Risks / Trade-offs

- [Risk] A stale or malformed URL-derived source may prevent a reflection chat from starting. -> Mitigation: constrain lengths, return a safe validation error, and keep the normal Copilot entrypoint available without a task descriptor.
- [Risk] The model may claim that a candidate was saved. -> Mitigation: the server-generated instruction explicitly requires candidate language and the existing visible-content sanitization and portfolio save flow remain unchanged.
- [Risk] A client-controlled descriptor value could be interpreted as a system instruction. -> Mitigation: reject control characters at the API boundary before normalization and encode accepted values as delimited JSON data in the private prompt.
- [Risk] Static source tests can pass while the browser request is wrong. -> Mitigation: add a focused client source assertion for the descriptor shape and an API-boundary helper test; run the browser route smoke when the local environment is available.

## Migration Plan

No data migration is required. Deploy the server parser and prompt injection together with the client field. Rollback is a code revert; requests without the new field continue to use the prior behavior.
