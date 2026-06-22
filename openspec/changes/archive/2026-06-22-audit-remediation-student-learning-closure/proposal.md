## Why

The audit shows that student feedback, missions, adaptive practice, evidence, growth, portfolio, Arena submissions, and AI-assisted tasks do not form a durable learning loop. Students can see many links, but actions rarely create adopted, completed, written-back, collected, or teacher-visible states.

## What Changes

- Create an assignment-aware student feedback lifecycle for returned, adopted, revising, completed, written-back, and teacher-visible states.
- Carry `assignment`, `criterion`, `returnTo`, and source context through adaptive practice, missions, resources, evidence, growth, and portfolio.
- Convert portfolio and reflection intents into candidate evidence or draft objects.
- Ensure completed actions produce evidence writeback or an explicit unsupported state.
- Update audit findings only after the evidence chain is verified end to end.

## Capabilities

### New Capabilities
- `audit-remediation-student-learning-closure`: audit remediation contract for student report feedback, tasks, evidence, growth, and portfolio writeback.

### Modified Capabilities
- None. This change consumes the action-status and API/UI remediation foundations.

## Impact

- Affects `/assessment/document-feedback`, `/assessment/adaptive-practice`, `/missions`, `/profile/evidence`, `/profile/growth`, `/profile/portfolio`, resource pages with `returnTo`, and relevant student APIs.
- Evidence references include `chapters/55-function-state-flows-batch47.md`, `chapters/56-function-state-flows-batch48.md`, and `chapters/63` through `67`.
