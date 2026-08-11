# Issue #1327 Commercial UI Evidence

- Issue: `#1327`
- PR: `#1340`
- Commit checkpoint: `f4d402bf479fbbf92cf4fa13428941b0e6c556c5`
- Representative route: `/assessment/adaptive-practice?goal=control-correction&intent=contextual-recommendation&batch=path-candidate-batch_issue1327`
- Generator: `tests/adaptive-path-candidate-batches.spec.ts`

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
