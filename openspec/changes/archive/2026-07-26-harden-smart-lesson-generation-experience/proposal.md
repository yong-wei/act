## Why

Smart lesson generation currently exposes raw provider states, does not refresh completed stages promptly, and can become permanently stuck on malformed structured output. Teachers need a legible, resumable workflow that preserves valid work and explains what the system is doing.

## What Changes

- Present generation through Chinese teaching-stage and action-state labels with motion and a concise current-state explanation.
- Poll or stream durable job progress so each validated stage appears immediately without a manual page refresh.
- Render stage output as complete teaching content rather than raw JSON.
- Normalize provider output deterministically first, then allow exactly one model-based correction attempt for remaining schema errors.
- Pause after a second invalid result with an actionable Chinese error and resume from the failed stage.
- Distinguish user-requested retry from queue redelivery: a user retry creates a new provider attempt and idempotency key, while redelivery of one attempt remains idempotent.
- Preserve completed stages across failure, cancellation, navigation, and retry.
- Migrate existing jobs so valid outputs render and failed jobs remain resumable.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `smart-lesson-plan-authoring`: strengthens staged generation presentation, persistence, validation, retry, and migration behavior.
- `model-provider-compatibility`: adds the deterministic-normalization and single model-correction contract for smart-lesson structured output.

## Impact

- Affects the smart-lesson generation worker, provider adapter, job and attempt identity, polling or event delivery, stage projections, and teacher UI.
- Reuses the existing durable queue, Provider Registry, schema validators, and stage persistence.
- Does not change the lesson content schema, editor information architecture, or retrieval ranking.
