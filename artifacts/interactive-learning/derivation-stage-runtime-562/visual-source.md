# Derivation Stage Runtime Visual Source

- Change: `add-interactive-derivation-stage`
- Issue: `#562`
- Component: `visual.derivationStage`
- Design contract: `artifacts/product-design-audits/interactive-course-visual-components-2026-06-17/design-contract.md`, section `4.4 visual.derivation-stage`
- Runtime renderer: `src/features/interactive/shared/manifest-runtime/content-renderers.tsx`
- Evidence contract: `src/features/interactive/shared/manifest-runtime/derivation-stage-evidence.ts`
- Fixture: `artifacts/interactive-learning/derivation-stage-runtime-562/derivation-stage-fixture.interactive-manifest.json`

This fixture intentionally places reveal step 1 in the left formula region, step 2 in the upper-right note, and step 3 back in the middle/result formula region. That arrangement verifies the stage is not a vertical card list and that reveal order is driven by explicit target ids.
