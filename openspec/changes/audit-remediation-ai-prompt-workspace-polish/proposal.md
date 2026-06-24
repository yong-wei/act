## Why

The first AI task-boundary remediation removed internal JSON exposure and established several task outputs, but Product Design audit records still show task competition between Global AI, Prompt evaluation, Copilot, AI workshop, and portfolio reflection surfaces. This change finishes the UI/task-workspace layer without expanding Graph Center, Konling path generation, or KAQ evidence work.

## What Changes

- Make page-local Prompt, AI workshop, Copilot, and portfolio-reflection tasks visually and semantically dominant over the global AI dock when they own the current task.
- Add consistent stop/retry/clear, loading, degraded, completed, and saved-draft status to AI task surfaces that still lack them.
- Preserve task context through Prompt history, AI workshop practice candidates, Copilot reflection drafts, and portfolio create/review flows.
- Remove empty quick-question groups, unusable clear actions, and 404-linked portfolio prompt actions.
- Exclude adaptive path generation, Graph Center actions, Konling graph context, KAQ writeback, and provider/model configuration governance from this change.

## Capabilities

### New Capabilities
- `audit-remediation-ai-prompt-workspace-polish`: audit remediation contract for AI/Prompt/Copilot task dominance, local task state, context preservation, and global-dock coexistence.

### Related Capabilities
- `audit-remediation-ai-task-boundaries`: extend prior sanitization and task-boundary fixes into remaining AI workspace UX and status states.
- `konling-agent-runtime`: require UI consumers not to expose raw prompt/tool context while preserving task-scoped summaries and output targets.
- `platform-status-and-evidence-ui`: require AI task actions to use visible local status rather than relying on global side effects.

## Impact

- Affects `/ai`, `/ai/copilot`, `/evaluation/prompt-assessment`, AI workshop pages, Global AI coexistence behavior, and portfolio reflection/prompt task entries.
- Evidence sources include findings 172-188, 247-253, 299, 322, 384-386, and 398 from the full-system Product Design audit.
- Acceptance requires targeted UI/source tests and browser evidence that page-local task inputs cannot be displaced by the global AI input.
