## Why

Arena already returns official scores and basic personal feedback. Arena Pro requires students to understand why a submission ranked or failed, which metric limited the score, and how the result compares with their personal best.

## What Changes

- Expand submission feedback into an official result explainer.
- Show hard-constraint failures, score composition, metric satisfaction, personal-best comparison, and next-step advice.
- Clarify preview versus official evaluation, hidden metrics, and protocol version.

## Capabilities

### New Capabilities

- `arena-result-feedback-explainer`

### Modified Capabilities

- None.

## Impact

- `src/features/arena/submissions/arena-submission-panel.tsx`
- `src/features/arena/student/arena-feedback-rules.ts`
- `src/features/arena/evaluation/protocol.ts`
- `src/features/arena/evaluation/protocol-versions.ts`
- Feedback and submission tests
