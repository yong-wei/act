## Why

The report shows that existing ResourceNode types are broad enough for a control-correction learning path, but the project does not yet have a small, audited seed graph that maps real resources to the control-correction goal. Path planning cannot be validated strictly until prerequisite, terminal, launch, evidence, and fallback edges exist for the target goal.

## What Changes

- Seed an audited control-correction ResourceNode graph across knowledge cards, handouts, video, quiz, simulation, Arena, reflection, and AI intervention nodes.
- Define prerequisites, alternatives, terminal validation nodes, estimated time, evidence instrumentation, and teacher policy metadata.
- Require a registry audit that blocks path eligibility for nodes with missing launch targets, missing evidence hooks, or invalid privacy policy.
- Provide fixtures that planner tests can consume without inventing ad hoc resource records.

## Capabilities

### Modified Capabilities

- `resource-node-registry`
- `adaptive-learning-path-planning`

## Impact

- Establishes the resource substrate for later persisted path rounds and student UI.
- Does not implement the learning-center UI or run path generation yet.
- Keeps renderable content ownership in existing resource, lesson, and TeachingResource records.
