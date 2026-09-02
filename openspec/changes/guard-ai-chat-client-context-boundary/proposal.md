## Why

The `/api/ai/chat` route can promote unverified browser-supplied page and
legacy lesson context into the model's system prompt. An authenticated learner
can send an incomplete `pageContext` or instruction-like `lessonContext` text
that is rendered as authoritative learning context, which can distort
guidance or solicit disclosure of hidden prompt content. This contradicts the
project's server-owned context and learning-companion safety boundaries.

## What Changes

- Treat `pageContext` and legacy `lessonContext` values as untrusted request
  hints at the AI chat boundary.
- Require server resolution and authenticated scope before page context can
  enter the private system prompt or authorize scoped tools.
- Prevent arbitrary `resourceTitle` and `customPrompt` text from becoming
  system-level instructions.
- Fail closed or expose a truthful generic/unavailable state for incomplete,
  unregistered, or unauthorized context.
- Preserve ordinary chat behavior when no context is supplied.
- Add route and prompt-builder regressions for malicious, incomplete, valid,
  and context-free requests.

## Capabilities

### New Capabilities

- `ai-chat-context-boundary`: Defines the trust boundary and fail-closed
  behavior for page and legacy lesson context entering AI chat.

### Modified Capabilities

- None. The new capability makes the existing server-owned context invariant
  executable without rewriting the broader Konling runtime specification.

## Impact

- Affected request boundary: `src/app/api/ai/chat/route.ts`.
- Affected prompt construction: `src/lib/ai-prompt-builder.ts` and
  `src/lib/ai/lesson-prompts.ts`.
- Affected tests: AI chat route and prompt-construction regression suites.
- No database migration, new provider, or change to ordinary context-free chat
  is required.

