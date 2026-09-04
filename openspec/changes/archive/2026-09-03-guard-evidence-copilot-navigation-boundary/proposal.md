## Why

Evidence Copilot now resolves factual context from the authenticated student's governed evidence, but the client-controlled `source`, `assignment`, and `intent` hints are still serialized into the model's system prompt. A student can place instruction-shaped text in these fields; prompt wording that says the values are not instructions is not a reliable trust boundary and can expose or alter the intended learning-companion behavior.

The existing server-authorized evidence work and the general AI Chat boundary work leave this dedicated Evidence Copilot path with a narrower residual gap. It should be closed before treating the evidence-review experience as a trustworthy learning-companion surface.

## What Changes

- Keep raw client navigation hints out of the model's private factual/system context.
- If the assistant needs entry semantics, derive them from a server-owned allowlist or enum; never use arbitrary URL text as executable prompt content.
- Preserve the server-resolved evidence projection, evidence limitations, advisory-only behavior, and ordinary Copilot compatibility.
- Add route and prompt-construction regressions for instruction-shaped descriptors, control characters, delimiter text, and prompt-exfiltration attempts.
- Add a browser-level regression that the Evidence Copilot entry remains usable while untrusted descriptors cannot change the evidence state or model context.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `student-learning-evidence-copilot`: navigation hints remain navigation metadata and must not cross into the model's private factual/system context as arbitrary client text.

## Impact

- `src/lib/evidence-copilot-context.ts` prompt projection and hint parsing.
- `src/app/api/ai/chat/route.ts` Evidence Copilot context assembly.
- Evidence Copilot unit, route, and browser acceptance tests.
- Existing Evidence Copilot OpenSpec requirement and its server-authorized context boundary; no database migration, model-provider change, or general-chat redesign.
