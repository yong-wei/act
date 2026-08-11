# Issue #1327 Commercial UI Evidence

- Issue: `#1327`
- PR: `#1340`
- Commit checkpoint: `065b1d130b3c7393a6a15e2cbbf5733bb7001619`
- Representative route: `/assessment/adaptive-practice?goal=control-correction&intent=contextual-recommendation&batch=path-candidate-batch_issue1327`
- Generator: `tests/adaptive-path-candidate-batches.spec.ts`

The capture manifest records the raw source hashes observed in the working tree and
the Git blob identities after checkout filters. The generator fails closed if HEAD,
tracked runtime inputs, or those source identities drift before or after a screenshot
or manifest replacement.

## Covered scenarios

- `no-batch`: generation workspace keeps the active path and hides candidate comparison before a batch exists.
- `loaded`: generation workspace shows the loading state, then renders generated candidate comparison while preserving the active path.
- `missing`: an unavailable batch fails closed into candidate-batch recovery with regeneration and evidence links.
- `failed`: a failed batch read also fails closed into candidate-batch recovery.

## Viewports

- `desktop-1440`
- `mobile-320`

## Files

- Manifest: `candidate-batch-manifest.json`
- Screenshots:
  - `no-batch-desktop-1440.png`
  - `loaded-desktop-1440.png`
  - `missing-desktop-1440.png`
  - `failed-desktop-1440.png`
  - `no-batch-mobile-320.png`
  - `loaded-mobile-320.png`
  - `missing-mobile-320.png`
  - `failed-mobile-320.png`
