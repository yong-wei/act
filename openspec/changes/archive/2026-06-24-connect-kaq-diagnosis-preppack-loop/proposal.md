## Why

Role-based diagnosis and teacher prep packs already exist as governed surfaces, but the graph-path plan requires them to share K/A/Q graph semantics. After LearningGoals, overlays, ResourceCoverage, Konling graph context, and evidence writeback are in place, teacher-facing diagnosis should be able to identify weak graph nodes and create reviewable prep-pack interventions that target those nodes and resource gaps.

This change connects diagnosis, graph overlays, resource coverage, and prep-pack generation into a single K/A/Q loop.

## What Changes

- Add a K/A/Q diagnosis-to-prep-pack loop contract.
- Let class diagnosis reference graph nodes, LearningGoals, overlay distributions, evidence refs, and resource coverage gaps.
- Let prep-pack generation create draft interventions tied to graph nodes, affected population, ResourceNode/resource gaps, citations, and expected impact.
- Make Graph Center, diagnosis, and prep-pack entry points consistent.
- Preserve teacher review gates and runtime overlay non-mutation semantics.

## Capabilities

### New Capabilities

- `kaq-diagnosis-preppack-loop`: Defines the graph-aware diagnosis and prep-pack handoff.

### Modified Capabilities

- `role-based-learning-diagnosis`: Class diagnosis can expose graph-node weak points and resource gap actions.
- `teacher-prep-pack-generation`: Prep packs can target K/A/Q graph nodes and resource coverage gaps while remaining draft until teacher approval.
- `graph-center-action-surface`: Teacher graph actions can route into diagnosis and prep-pack flows.

## Impact

- Affected areas: role-based diagnosis services, prep-pack generation/review, graph-center action payloads, teacher reports, and Playwright demo flow.
- Depends on #640, learner/class overlays, resource coverage, evidence writeback governance, GraphCenter actions, Konling graph context, and artifact versioning.
- Does not auto-publish prep items, mutate base runtime content, or expose raw private evidence.
