# Harden Premium UI Visual Governance

## Goal

Complete OpenSpec change `harden-premium-ui-visual-governance` by turning commercial UI governance into a stricter route-ledger, visual evidence, mobile structure, and report/export gate.

## Implementation

1. Extend `src/lib/commercial-ui-governance.ts` with:
   - primary route ledger metadata and archetype checks;
   - visual QA route inventory drift detection;
   - structured artifact metadata checks;
   - 320px mobile desktop-panel persistence checks;
   - report/export watermark, privacy, source, status, and export evidence checks.
2. Extend `PREMIUM_PLATFORM_VISUAL_QA_ROUTE_MATRIX` to cover learner data, data center, and teacher analytics representative routes.
3. Extend `scripts/tests/test-commercial-ui-governance.ts` so the script derives affected routes from the primary route and report surface inventories, then passes scoped route inventory, visual QA matrix, and report surface inventory into the core evaluator.
4. Migrate `artifacts/commercial-ui/evidence.json` to the structured visual evidence shape required by the gate.
5. Add focused Vitest coverage for the new failure modes.

## Verification

- `rtk npm run test:unit -- src/lib/__tests__/commercial-ui-governance.test.ts`
- `rtk npm run test:commercial-ui-governance`
- `rtk npm run test:theme-coverage`
- `rtk npx tsc --noEmit`
- `rtk openspec validate harden-premium-ui-visual-governance --strict`
