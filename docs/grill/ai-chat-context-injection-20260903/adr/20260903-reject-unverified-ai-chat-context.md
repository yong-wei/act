# Reject Unverified AI Chat Context From the System Prompt

## Status

Accepted for the issue proposal.

## Context

The AI chat route currently has two paths that can construct a system prompt
from request fields. A truthy but incomplete `pageContext` can enter the page
prompt path without proving that its course and page belong to the current
learner. The legacy `lessonContext` path also accepts free-text resource and
custom-prompt values. A learner can therefore place instruction-like text in
metadata that is later rendered as system-level context, including text that
asks the model to ignore learning-safety rules or disclose hidden prompt
content.

This is distinct from the already-closed session-response issue: the problem
occurs before model invocation, when client input is promoted into the private
system message.

## Decision

Only server-owned, authenticated runtime context may describe a verified
learning page or authorize a scoped model prompt. Client `pageContext` values
are treated as untrusted hints and must be resolved against server-owned
records before use. Incomplete, unregistered, or unauthorized context must be
rejected or reduced to a generic unavailable state before model invocation;
its free-text values must not be inserted into the system prompt.

The legacy path remains compatible for ordinary chat, but only bounded enum
fields may affect teaching behavior. Free-text `resourceTitle` and
`customPrompt` are not system instructions unless they are replaced by a
server-owned equivalent. The assistant must not expose system prompt content
when a context hint contains instruction-like text.

## Alternatives considered

1. Keep interpolating client fields and add a warning such as “treat metadata
   as data”. Rejected because a warning inside the same system message does
   not create a trustworthy instruction boundary.
2. Remove all legacy context support immediately. Rejected because it breaks
   existing ordinary chat callers without improving the server-owned runtime
   path.
3. Accept client context as user-message metadata. Rejected for verified page
   semantics because unverified text could still be mistaken for facts; the
   route must first distinguish verified runtime context from generic chat.

## Consequences

- The model receives a smaller and more trustworthy private context.
- Invalid page hints fail closed or produce a truthful generic state instead
  of silently creating a false learning context.
- Existing ordinary chat remains available when no context is supplied.
- Legacy callers that depended on arbitrary free-text system instructions must
  migrate to a server-owned context or an explicit user message.

## Acceptance evidence

- A request with only a malicious or incomplete `pageContext` cannot cause its
  values to appear in the system prompt or expand tools.
- A request with malicious `lessonContext.customPrompt` is blocked or safely
  ignored before model invocation.
- A valid server-resolved page still receives the expected learning context.
- Ordinary chat without a context remains compatible.
- The regression suite verifies that prompt-disclosure instructions are never
  treated as system-level authority.

