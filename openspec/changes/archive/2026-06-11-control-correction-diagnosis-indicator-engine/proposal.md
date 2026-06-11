## Why

The assistant close-loop report identifies diagnosis as the main credibility gap in the current teaching-assistant architecture. The repository already exposes a control-correction learner-state slice and role-based diagnosis claims, but it does not yet have a first-class indicator engine that defines how each score, confidence value, percentile, growth percentile, and qualitative judgment is calculated.

Without this layer, document grading, Arena outcomes, simulations, adaptive assessment, Konling interventions, and path execution can all produce evidence, but the platform cannot prove that student and teacher diagnosis reports are derived from stable metric definitions rather than ad hoc page logic.

## What Changes

- Add a first-class control-correction diagnosis profile capability with indicator definitions, indicator snapshots, and diagnosis report snapshots.
- Define the nine control-correction dimensions as governed metric groups: time-domain analysis, root-locus reasoning, frequency-domain margin analysis, method selection, constraint tradeoff, simulation validation, Arena transfer, reflection, and AI collaboration.
- Require every indicator to declare query specification, normalization policy, confidence policy, source families, privacy visibility, and fallback behavior.
- Materialize student and class report snapshots from governed evidence without replacing the existing learner-state service or role-based diagnosis layer.

## Capabilities

### New Capabilities

- `control-correction-diagnosis-profile`: Defines the governed indicator engine and snapshot contract for control-correction diagnosis.

### Modified Capabilities

- `adaptive-learner-state-service`
- `role-based-learning-diagnosis`
- `student-evidence-feature-cache`

## Impact

- Adds Prisma models or equivalent persisted storage for indicator definitions, indicator snapshots, and report snapshots.
- Affects learner-state, role-based diagnosis, teacher report, path recommendation, grading writeback, and Konling diagnosis surfaces.
- Does not implement document grading, UI rendering, path selection, or teacher prep-pack insertion; those are separate changes in this series.
