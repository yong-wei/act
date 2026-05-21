## Context

Current feedback identifies ranking status, strongest and weakest metrics, hard-constraint failures, personal-best comparison, and a next-step suggestion. It does not yet provide a full explanation of official scoring and protocol boundaries.

## Goals / Non-Goals

**Goals:**

- Make official evaluation results interpretable.
- Separate local preview, official evaluation, and hidden evaluation clearly.
- Improve next-step guidance from metric and hard-constraint evidence.

**Non-Goals:**

- Do not change scoring formulas.
- Do not expose hidden black-box scenarios.
- Do not build global growth recommendations in this change.

## Decisions

- Build on `arena-feedback-rules.ts` rather than duplicating feedback logic in UI components.
- Treat protocol version and official-only metrics as first-class explanation fields.
- Keep feedback deterministic and regression-tested.

## Risks / Trade-offs

- More explanation can expose too much black-box detail. Use privacy rules for black-box mode.
- Long feedback can crowd the submission panel. Extract display subcomponents if needed.

## Migration Plan

1. Extend feedback data structures.
2. Add protocol and score composition explanations.
3. Update submission panel rendering.
4. Add focused feedback tests for white-box and black-box cases.
