## Why

The portfolio-reflection Copilot currently builds a reflection draft and task contract in the browser, but sends neither as an effective task context to `/api/ai/chat`. The server therefore cannot distinguish reflection work from general chat or enforce the candidate-draft boundary, which weakens the project's learning-process companion goal and makes the response semantics non-traceable.

## What Changes

- Add a bounded, discriminated client request descriptor for portfolio-reflection Copilot turns.
- Validate and normalize the descriptor on the server before model execution.
- Preserve source, assignment, intent, output target, and explicit-save/writeback boundary in the server-owned runtime contract.
- Keep internal runtime context and authorization fields server-only and excluded from visible assistant output.
- Keep portfolio-reflection output as a candidate draft until the existing explicit save flow is used; do not write to official learning facts, portraits, or scores.
- Preserve existing evidence-Copilot and general-chat behavior.
- Add unit, route, and browser-level regression coverage for reflection versus ordinary chat and malformed or unauthorized task descriptors.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `audit-remediation-ai-task-boundaries`: portfolio-reflection requests must carry validated task semantics to the server and retain the explicit candidate-draft writeback boundary.

## Impact

- Client: `src/app/ai/copilot/page.tsx` and the legacy chat request body contract.
- Server: `src/app/api/ai/chat/route.ts` plus a small task-context validation/runtime helper.
- Tests: AI task boundary and chat route tests, with a focused browser request assertion if the local browser harness is available.
- No database schema, official learning-record, score, or portrait writeback changes are required.
