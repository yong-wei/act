## Context

`/profile` already contains ability dimensions and recommendation cards. `/profile/growth` contains a growth-center idea but has empty chart areas and repeated low-value timeline events. `/assessment/adaptive-practice` needs better action and empty states. These should be one product family.

## Goals / Non-Goals

**Goals:**

- Provide a learner data shell for dashboard, profile, growth, evidence, adaptive practice, and path recommendations.
- Use consistent ability dimensions, evidence status, recommendation priority, and next-action components.
- Improve empty, stale, low-confidence, and no-data states.

**Non-Goals:**

- Creating new scoring models.
- Changing evidence privacy or teacher/admin authorization.
- Building every future recommendation policy.

## Decisions

### Decision 1: Use learner data as the organizing object

The page family should organize around ability profile, current path, evidence timeline, and next action rather than separate pages with unrelated cards.

### Decision 2: Recommendations are path nodes, not generic cards

Recommended learning paths should render as stages and nodes with confidence, source, estimated effort, and action state.

### Decision 3: Evidence timeline must be curated

Repeated low-signal events should be grouped or suppressed so the timeline supports learning interpretation.

## Validation

- `rtk openspec validate unify-learner-profile-pathway-surfaces --strict`
- Visual QA for student dashboard, profile, growth, evidence, and adaptive practice in light and dark themes.
- Tests for route reachability, empty states, and ability/evidence status rendering.
