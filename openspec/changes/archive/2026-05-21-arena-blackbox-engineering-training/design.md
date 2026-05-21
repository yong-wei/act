## Context

The current black-box preset can run experiments, save nominal models, run virtual previews, and submit official evaluations. The missing layer is engineering interpretation around experiment design, model confidence, and generalization risk.

## Goals / Non-Goals

**Goals:**

- Make experiment budget and dataset coverage visible.
- Show confidence and mismatch evidence for student nominal models.
- Explain why preview performance can differ from official hidden evaluation.

**Non-Goals:**

- Do not reveal hidden plant parameters or hidden scenario order.
- Do not replace the official black-box evaluator.
- Do not implement general leaderboard honors here.

## Decisions

- Use existing `ArenaBlackBoxExperiment` and `ArenaVirtualSimulationRun` records where possible.
- Keep confidence signals aggregated and privacy-preserving.
- Extract black-box panel subcomponents before adding substantial UI.

## Risks / Trade-offs

- The existing black-box panel is large. This change should split components before extending behavior.
- Too much uncertainty messaging can overwhelm students. Use compact evidence summaries and clear action suggestions.

## Migration Plan

1. Add budget and coverage helpers.
2. Add nominal-model confidence and mismatch summaries.
3. Update black-box preset UI and feedback.
4. Add tests for budget, coverage, privacy, and preview/official distinction.
