## Why

Learner dashboard, profile, growth, evidence, adaptive practice, and student reports are central to the platform's learning value, but they are not yet unified as one learner record and pathway experience. The redesign needs a learner-record archetype that makes confidence, evidence, next steps, and missing data honest and readable.

## What Changes

- Redesign learner record and pathway surfaces around current path, evidence timeline, confidence, missing sources, next action, and review history.
- Align `/dashboard`, `/profile`, `/profile/growth`, `/profile/evidence`, and `/assessment/adaptive-practice`.
- Define report-like learner views that share evidence/status and privacy language without fabricating unavailable data.
- Verify interactive lesson submissions, Arena official/preview results, simulation/Workbench completions, and adaptive practice submissions can surface in learner record or evidence timeline with confidence, freshness, source scope, and next-action state.
- Preserve role-specific privacy when learner evidence is viewed by student, teacher, or administrator contexts.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `adaptive-learning-center-ui`: adds learner record/pathway visual requirements.
- `evidence-timeline-browser`: adds evidence timeline and mobile review requirements.
- `platform-status-and-evidence-ui`: adds consistent loading/empty/degraded/low-evidence treatment.

## Impact

- Affects learner dashboard/profile/growth/evidence/adaptive practice routes, evidence timeline UI, learner-state presentation, and student report-like surfaces.
