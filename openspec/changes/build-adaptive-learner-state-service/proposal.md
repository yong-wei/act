## Why

XH-202620 needs a server-owned learner state rather than scattered page summaries and client profile hints. This change isolates the learner-state read model and evidence-feature extensions after assessment persistence and upstream simulation/Arena feature materialization are available.

## What Changes

- Add Learner State Service as the canonical adaptive-learning read model.
- Retain the current six primary competency dimensions and add second-level dimensions required by path planning.
- Expose knowledge mastery, resource preference, media absorption, path context, risk state, evidence windows, confidence markers, and privacy scopes.
- Extend student evidence feature cache for learner-state and path consumers while consuming prerequisite simulation/Arena feature groups.

## Capabilities

### New Capabilities
- `adaptive-learner-state-service`: Defines the server-owned learner-state read model.

### Modified Capabilities
- `student-evidence-feature-cache`: Adds adaptive learner-state feature groups and confidence/freshness metadata.

## Governance Contract Dependency

This change consumes `establish-adaptive-learning-governance-contracts` for learner-state privacy classes, server-owned field-family metadata, evaluation-event confidence semantics, feature flag fallback behavior, and downstream handoff artifacts.

## Impact

- Affects learner-state services/APIs, data-governance feature cache, profile/recommendation/Konling consumers.
- Depends on `establish-adaptive-learning-governance-contracts`, `persist-adaptive-assessment-mastery`, and `materialize-simulation-features-for-personalization`.
