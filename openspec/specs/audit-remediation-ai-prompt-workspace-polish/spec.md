# audit-remediation-ai-prompt-workspace-polish Specification

## Purpose
Ensure Prompt evaluation, AI workshop, Copilot reflection, and portfolio reflection keep page-local AI tasks, visible context, and candidate-only save boundaries dominant over shared Global AI entry points.

## Requirements
### Requirement: Page-local AI tasks shall remain dominant over Global AI
Prompt evaluation, AI workshop, Copilot reflection, and portfolio reflection surfaces SHALL expose primary task input and output targets that cannot be displaced by the global AI dock.

#### Scenario: Prompt evaluation
- **WHEN** a user opens Prompt evaluation
- **THEN** the page-local prompt input SHALL be the primary task input
- **AND** Global AI controls SHALL remain secondary and shall not capture the page task action.
- **AND** keyboard order SHALL reach the page-local task input and action controls before unrelated Global AI controls.
- **AND** when a page-local AI task panel is active, background/global AI surfaces that are not part of the task SHALL be inert, deprioritized, or outside the active task tab sequence according to the surface state.
- **AND** mobile layouts SHALL reserve safe area so the Global AI dock does not cover the page-local input or primary task action.

### Requirement: AI task surfaces shall preserve local status and context
AI task surfaces SHALL expose stop, retry, clear, loading, degraded, completed, saved-draft, and discarded states where those actions are available.

#### Scenario: Reflection draft
- **WHEN** Copilot or portfolio reflection creates a candidate draft
- **THEN** the draft SHALL preserve assignment, source, intent, and output-target context
- **AND** it SHALL remain a candidate until the user saves or submits it.
- **AND** candidate payloads SHALL exclude raw prompt text not needed for the visible task, raw tool calls, server context, provider diagnostics, private evidence bodies, and hidden evaluation metadata.
- **AND** candidate drafts SHALL NOT become LearningFact, profile evidence, portfolio artifacts, or teacher-visible records until an explicit save, submit, or publish action succeeds.

#### Scenario: Empty or unavailable task action
- **WHEN** quick questions, clear actions, or prompt links have no usable target
- **THEN** the control SHALL be hidden, disabled with a reason, or routed to a valid local task state.
