## Why

The graph-path architecture only works if evidence updates are governed. Path execution, simulations, Arena results, grading, exercises, and Konling interventions can all produce useful signals, but they cannot all write the same "mastery" field. Knowledge, capability, and quality evidence have different confidence, authority, privacy, and validation rules.

This change defines the writeback governance layer that materializes evidence into K/A/Q overlays after the first-class LearningGoal, ResourceNode, graph context, and artifact-versioning contracts exist.

## What Changes

- Add a K/A/Q evidence writeback governance contract.
- Define evidence source classes, authority levels, preview/official distinctions, AI-generated flags, and version requirements.
- Require writeback to route knowledge, capability, and quality evidence separately.
- Block or degrade production overlay writeback when required graph/resource/version context is missing.
- Add audit events for graph-aware evidence materialization.

## Capabilities

### New Capabilities

- `kaq-evidence-writeback-governance`: Defines governed evidence writeback into knowledge, capability, and quality overlays.

### Modified Capabilities

- `evidence-driven-personalization`: Personalized claims may consume writeback outputs only after governed materialization.
- `learning-evidence-rag-corpus`: Citation and evidence refs remain input proof, not direct mastery state.
- `adaptive-learning-path-planning`: Path execution and terminal validation outcomes become eligible writeback inputs only through this governance layer.

## Impact

- Affected areas: future `src/lib/data-governance/kaq-evidence-writeback.ts`, graph audit utilities, learner/class overlay materialization, path execution feature cache, Konling intervention outcomes, and data-governance tests.
- Depends on #640, artifact versioning, learner/class overlay contracts, and citation/evidence refs.
- Does not implement KT/BN modeling, teacher dashboards, or prep-pack generation logic.
