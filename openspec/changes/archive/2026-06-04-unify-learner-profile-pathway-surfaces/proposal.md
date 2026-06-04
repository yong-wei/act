## Why

Student dashboard, profile, growth center, evidence, adaptive practice, and future recommendation paths all describe the same learner state, but they currently render as separate card pages with inconsistent hierarchy and weak empty states.

This change turns them into one learner data and pathway product family.

## What Changes

- Unify student dashboard, profile, growth center, evidence browser, adaptive practice, and future recommended path surfaces.
- Establish shared learner data shell: ability profile, current path, evidence timeline, recommendations, practice, and next action.
- Use the same ability dimension and evidence-status vocabulary across adaptive learning, profile, and recommendations.
- Preserve existing route behavior and future adaptive/control-correction capabilities as assumed baseline inputs.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `adaptive-learning-center-ui`: add learner profile/pathway shell requirements.
- `evidence-timeline-browser`: add grouped evidence and learner-data timeline requirements.

## Impact

- Affects `/dashboard`, `/profile`, `/profile/growth`, `/profile/evidence`, `/assessment/adaptive-practice`, and future recommended path surfaces.
- Depends on `define-premium-platform-ui-foundation`.
- Does not implement new learner-state algorithms or evidence materialization.
