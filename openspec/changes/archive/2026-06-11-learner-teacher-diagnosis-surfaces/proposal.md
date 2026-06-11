## Why

The platform has learner-state, role-based diagnosis, teacher reports, and student data-plane surfaces, but the assistant close-loop needs concrete product surfaces where students and teachers can act on the new diagnosis snapshots. Without these surfaces, the indicator engine remains hidden infrastructure.

## What Changes

- Add student diagnosis surfaces for radar/score views, qualitative insight cards, growth state, evidence drawer, and path choices.
- Add teacher class and teacher-student diagnosis surfaces for cohort distribution, weak-point clusters, root causes, evidence drilldown, and prep-pack entry.
- Use the diagnosis indicator snapshots and role-based diagnosis layer as source of truth.
- Preserve privacy boundaries between student, teacher-class, teacher-student, and service views.

## Capabilities

### Modified Capabilities

- `role-based-learning-diagnosis`
- `adaptive-learning-center-ui`
- `teacher-evidence-governance`
- `platform-status-and-evidence-ui`

## Impact

- Adds or updates student and teacher pages/components.
- Depends on `control-correction-diagnosis-indicator-engine`.
- Does not implement document grading, path planning logic, or prep-pack overlay.
