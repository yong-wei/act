## Context

The audit identifies two different AI risks: product task ambiguity and data exposure. Global AI often competes with page inputs, while Copilot or Prompt flows expose implementation context or fail to produce durable objects.

## Goals / Non-Goals

**Goals:**
- Keep AI output aligned with the page task and user role.
- Sanitize internal context before display.
- Create durable task outputs where the page promises practice, feedback, reflection, or portfolio drafts.

**Non-Goals:**
- Do not change model provider selection broadly.
- Do not add new general AI features beyond audited tasks.

## Decisions

- AI surfaces must declare task type, allowed context, output target, and writeback behavior.
- Citation confidence belongs in product status, not as raw diagnostic prose in the main answer.
- Page-local AI inputs should have priority over global AI in task pages.

## Risks / Trade-offs

- Sanitization can hide useful debugging detail. Mitigation: preserve diagnostics for teacher/admin debug views where authorized.
- Durable AI outputs may need persistence. Mitigation: start with draft/candidate objects when final publish is out of scope.
