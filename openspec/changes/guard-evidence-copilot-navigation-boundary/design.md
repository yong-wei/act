## Context

Evidence Copilot already resolves a student-safe projection from the authenticated learner state. Its request parser deliberately accepts bounded `source`, `assignment`, and `intent` values as navigation hints, but `buildEvidenceCopilotPrompt()` currently serializes the complete projection, including those client-controlled strings, into the system prompt. Escaping delimiters and instructing the model not to follow the values does not make arbitrary text non-executable.

The change is constrained to this dedicated Evidence Copilot path. The existing server authorization, evidence availability states, advisory-only behavior, and ordinary Copilot fallback must remain intact.

## Goals / Non-Goals

**Goals:**

- Ensure raw client navigation hints cannot enter the model's private factual/system context.
- Preserve useful evidence status, limitations, source coverage, confidence, freshness, weak targets, and next action in the model context.
- Keep control-character rejection and the existing navigation URL behavior.
- Prove the boundary with prompt-construction, route, and browser regressions.

**Non-Goals:**

- Reimplement server authorization or the governed evidence projection from #1563.
- Redesign ordinary AI Chat or the fallback boundary from #1885.
- Add keyword-based prompt filtering, a new evidence store, a model provider, or a database migration.
- Guarantee that a model will never repeat a secret in every unrelated chat surface.

## Decisions

### Exclude raw hints from model context

The prompt builder will construct a model-only projection containing server-owned evidence fields and will omit `navigationHint` entirely. The page can continue to read URL hints for navigation and presentation, but arbitrary client text will not be available in the system prompt. This is preferable to keyword blocking because legitimate learning descriptions can contain words that resemble instructions, while delimiter escaping only protects markup syntax and not model semantics.

### Preserve server-owned entry semantics only when needed

No raw hint is required for the current Evidence Copilot answer contract. If a future response needs to identify the entry mode, it must use a server-owned allowlist or enum derived from the route context; it must not reintroduce the original strings. This keeps the current change small and prevents a later caller from treating a display label as evidence authorization.

### Test the actual model boundary

Unit tests will assert that an instruction-shaped hint is absent from the generated system prompt while the server evidence projection remains present. Route tests will inspect the model invocation before generation and cover malicious descriptors and rejected control characters. A browser regression will verify that an Evidence Copilot URL with a descriptor still reaches the evidence state without presenting the descriptor as factual student data.

## Risks / Trade-offs

- [Risk] Removing hints from the prompt could reduce contextual wording for a future entry flow. -> [Mitigation] Keep hints available to page navigation and require a server-owned enum before adding any model-facing entry label.
- [Risk] Existing tests may encode the old prompt shape. -> [Mitigation] Update only Evidence Copilot prompt assertions and retain the evidence, limitation, and advisory assertions.
- [Risk] The route may still accept untrusted hints for navigation. -> [Mitigation] Keep bounded parsing, treat them as non-authoritative, and verify they cannot affect evidence resolution, authorization, or system prompt contents.
