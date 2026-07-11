## Why

The current snapshot worker recalculates learner competency from recent
LearningFacts in a fixed 30-day window. That design makes the portrait behave
like an activity window rather than a stable learner profile: old evidence can
fall out of the window, sparse new evidence can overwrite a richer baseline,
and a student can see apparent regression to zero without negative evidence.

The learner portrait should be a long-term state with incremental correction.
New evidence should update the stable state; missing recent evidence should
lower freshness or confidence, not erase learned capability.

## What Changes

- Replace recent-window overwrite semantics with a stable portrait baseline plus
  incremental evidence update semantics.
- Separate score, confidence, freshness, and evidence recency.
- Treat positive, partial, negative, and stale evidence differently.
- Ensure no-new-evidence or sparse-evidence updates cannot collapse untouched
  dimensions to zero.
- Add regression tests for Yang Fan style seed data, sparse path-selection
  facts, and evidence aging.

## Impact

- Affects data-governance worker portrait materialization, learner-state
  service, profile summary, evidence feature cache, and tests.
- Depends on the primary portrait v2 model contract.
- Does not migrate existing historic data; migration is a follow-up change.
