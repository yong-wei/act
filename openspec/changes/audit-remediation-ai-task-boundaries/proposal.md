## Why

AI, Prompt, and Copilot audit findings show task confusion, focus competition, internal JSON exposure, citation diagnostics shown as answer text, and no durable learning-task output. AI surfaces need product boundaries before they can safely support feedback, reflection, and governance workflows.

## What Changes

- Separate Global AI, page-local AI, Prompt evaluation, AI workshop, and Copilot task responsibilities.
- Prevent internal server context, raw evidence diagnostics, and hidden validation metadata from being displayed to students.
- Add task-scoped AI outputs for feedback practice, portfolio reflection drafts, prompt evaluation, and governance assistance.
- Apply focus, status/live, stop/retry/clear, and citation-confidence states consistently.
- Update audit findings after AI task evidence and sanitization checks pass.

## Capabilities

### New Capabilities
- `audit-remediation-ai-task-boundaries`: audit remediation contract for AI task boundaries, context sanitization, focus order, and durable AI-assisted learning outputs.

### Modified Capabilities
- None. Existing Konling and AI provider capabilities remain the runtime base.

## Impact

- Affects `/ai`, `/copilot`, `/assessment/prompt-evaluation`, AI workshop, Global AI sidebars, report-feedback AI actions, and portfolio reflection flows.
- Evidence references include `chapters/50-function-state-flows-batch42.md`, `chapters/55-function-state-flows-batch47.md`, `chapters/62-function-state-flows-batch54.md`, and `chapters/63-function-state-flows-batch55.md`.
