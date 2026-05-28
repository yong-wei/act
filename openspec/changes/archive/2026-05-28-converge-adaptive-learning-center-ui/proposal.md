## Why

The report identifies the biggest product fracture in adaptive learning: `/ai`, `/ai/copilot`, `/assessment/adaptive-practice`, and `/profile` expose related concepts through separate surfaces. The newly split adaptive series makes the target clearer: persistent assessment, Learner State, ResourceNodes, rules+graph paths, path map/timeline/evidence views, and state-aware Konling should converge into one adaptive learning center.

## What Changes

- Define an adaptive learning center with overview, learner state, mastery, current path, map, timeline, evidence explanation, practice, and Konling panels.
- Keep old routes as compatibility surfaces or aliases while the new center is introduced behind feature flags.
- Require low-confidence, privacy, source coverage, and fallback states to be visible for every path or intervention claim.

## Capabilities

### New Capabilities
- `adaptive-learning-center-ui`: Defines the unified student-facing adaptive learning center and compatibility behavior.

## Impact

- Affects `/ai`, `/ai/copilot`, `/assessment/adaptive-practice`, `/profile` adaptive cards, AI sidebars, and future path visualization routes.
- Depends on learner-state, assessment, ResourceNode, path MVP, Konling runtime, and shared UI foundation changes.
