# Issue 1140 Phase B Browser Evidence

This directory records governed browser evidence for persisted adaptive-path candidate batches.

- Route: `/assessment/adaptive-practice?goal=control-correction&intent=path-selection&batch=path-candidate-batch_issue1140`
- Viewports: 1440 x 1000 and 320 x 900
- Checkpoint commit: `2e2a0c9`
- Manifest: `candidate-batch-manifest.json`

The run verifies that the active path remains independent, persisted candidates retain planner order, a focused candidate link displays only the requested server-owned identity, compare-all restores the complete batch, and neither viewport has horizontal overflow. The manifest binds both screenshots and the relevant source files to the checkpoint commit using SHA-256 hashes.

The browser run uses the repository's deterministic demo path state and route-level candidate-batch fixtures because this workstation has no local PostgreSQL service. Candidate-batch route tests separately cover learner ownership, teacher class scope, administrator access, latest ordering, and invalid deep links.
