## Context

`/api/ai/chat` accepts several context-shaped request fields from the browser.
The runtime branch already resolves a complete course/page identity through
server-owned records, but the fallback branch can still pass client text to
prompt builders. The affected fields are used by student-facing learning
assistance, so the defect is both a security boundary failure and a trust
failure in personalized guidance.

The change must preserve ordinary context-free chat and the existing scoped
runtime path. It must not introduce a second context store or expose private
prompt content as a diagnostic.

## Goals / Non-Goals

**Goals:**

- Establish one explicit trust boundary for page and legacy lesson context.
- Use server-owned page data for verified task prompts.
- Prevent arbitrary client text from becoming system-level instruction.
- Give callers a deterministic invalid-context response or a truthful generic
  fallback.
- Preserve tool scoping and context-free chat compatibility.

**Non-Goals:**

- Redesign the general Copilot or conversation library.
- Add prompt filtering based on model output or attempt to detect every
  possible natural-language attack after it reaches the model.
- Persist raw client context or return the hidden system prompt to clients.

## Decisions

### 1. Verify identity before prompt construction

The route will parse context presence separately from context contents. A
`pageContext` request is context-bearing only when its identifiers can be
resolved to a server-owned page within the authenticated learner's scope. The
prompt builder will receive that resolved context, never the browser's title,
topic, objectives, stage, or knowledge labels.

If a caller supplies a partial, unknown, or unauthorized page context, the
route will return a stable `400 INVALID_AI_CONTEXT` response before model or
tool execution. This makes an integration defect visible and avoids silently
turning a false page description into generic authority.

Alternative: silently downgrade every invalid page hint to generic chat. This
preserves more callers but hides broken context wiring and makes it harder for
the UI to explain why page-aware guidance is unavailable.

### 2. Keep only finite legacy controls

The legacy lesson path may retain known enum controls such as the BOPPPS stage
and assistant persona. Free-text `resourceTitle` and `customPrompt` will be
ignored or rejected at the boundary and will never be interpolated into a
system prompt. A safe base prompt remains available when only bounded legacy
controls are present.

Alternative: escape or quote the free text and keep it in the system message.
Rejected because quoting is not a security boundary for instructions and still
lets a client-authored string influence system-level behavior.

### 3. Keep authorization independent from prompt data

Client context may select a route entry point, but it cannot expand target
user, course, page, class, resource, tool, or privacy scope. The existing
server authorization and runtime resolver remain the source of truth. Invalid
context is handled before model and tool setup.

### 4. Test the boundary at the route and builder levels

Regression tests will assert both observable HTTP behavior and the internal
model-call input. They will cover hostile multiline/instruction-like values,
partial identifiers, unauthorized identifiers, valid server-resolved context,
bounded legacy controls, and context-free chat. Tests must prove that a
prompt-disclosure request does not become system authority.

## Risks / Trade-offs

- [Risk] Legacy callers may rely on arbitrary `customPrompt` behavior -> keep
  enum-only compatibility and document the rejected fields for migration.
- [Risk] Client and server page registries may temporarily disagree -> return a
  stable unavailable/invalid response and expose a recoverable UI action rather
  than constructing a false prompt.
- [Risk] Tests could inspect only source strings -> include route-level mocks
  that capture model messages and verify the actual system content.

## Migration Plan

1. Add strict context parsing and server-resolution guards.
2. Update prompt construction to accept only the resolved page context and
   bounded legacy controls.
3. Update affected client callers to stop sending free-text system hints.
4. Run focused route/builder regressions, related AI tests, typecheck, and
   strict OpenSpec validation.

Rollback consists of disabling the page-aware entry point while retaining the
context-free assistant; no database migration is required.

## Open Questions

None. The issue proposal uses the recommended product decision: false or
unverifiable page context is an error, while ordinary context-free chat stays
available.

