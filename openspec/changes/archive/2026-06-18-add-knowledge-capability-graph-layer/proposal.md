## Why

Knowledge graph nodes describe relatively stable disciplinary facts, but adaptive paths and learner diagnosis need explicit target mastery levels. The platform needs a capability layer that maps knowledge nodes to observable ability goals without replacing existing competency dimensions or learner-state slices.

## What Changes

- Add a knowledge-to-capability goal layer on top of the existing knowledge graph.
- Treat Bloom-style verbs as a target language for mastery levels, not as a replacement for existing competency dimensions.
- Require capability targets to map to goal slices, evidence types, success criteria, and learner-state materializations.
- Keep disciplinary prerequisite relations separate from instructional path strategy relations.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `adaptive-goal-slice-registry`: add capability target mapping from knowledge nodes to observable goal-slice requirements.
- `evidence-driven-personalization`: require personalization to distinguish target capability requirements from observed learner evidence.

## Impact

- Affects goal-slice definitions, diagnosis explanations, path planning inputs, and future teacher-facing capability mapping screens.
- Does not change knowledge node factual definitions or existing mastery scoring algorithms by itself.
