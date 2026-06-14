## Context

Current warning concentration:

- `resources`: 1,275 warnings.
- `no-unknown-property`: 186, primarily R3F/Three scene JSX.
- Resource state/effect and accessibility warnings remain mixed with scanner-noise candidates.

Representative R3F examples include `<group>`, `<mesh>`, `<boxGeometry>`, `<meshStandardMaterial>`, `<instancedMesh>`, and custom shader materials. These are valid R3F intrinsic elements but are reported as unknown DOM properties by the scanner.

## Decisions

1. Do not rewrite R3F scenes just to satisfy DOM-oriented warnings.
2. Require a classification ledger for R3F/Three findings.
3. Pair any R3F warning allowlist with runtime evidence:
   - scene nonblank check,
   - no console/runtime error for representative pages,
   - preserved simulation metrics where relevant.
4. Remediate genuine resource warnings separately:
   - buttons and labels,
   - event/state synchronization,
   - resource identity resets.

## Risks

- Over-broad allowlists could hide real DOM unknown-property defects in resource UI panels.
- Visual-only validation is insufficient for simulation semantics; targeted numerical or metrics tests remain required when model-facing code is touched.
