## Context

Observed unit-test failure clusters:

- `interactive-manifest-runtime.test.tsx` expects legacy module names or missing renderer behavior while current manifests use canonical module classes.
- `interactive-module-taxonomy.test.ts` expects old response-kind names such as `singleChoice` while current taxonomy uses names such as `choice.single`.
- `profile-route.test.ts` and admin data-governance status tests expect older evidence readiness and feature-cache payload semantics.
- `lesson-entry-knowledge-map.test.ts` asserts a stale ordering rule against current authored runtime data.
- `nextjs-dynamic-error.test.ts` finds an API route lacking explicit dynamic rendering and dynamic-probe rethrow behavior, or a stale test entry.

## Approach

- Treat failing assertions as real until mapped to an archived spec decision or current runtime contract.
- Update assertions when tests are behind current specs.
- Update source only where tests expose a behavior that current specs still require.
- Keep this change independent from dependency upgrades, TypeScript-only fixture repair, and commercial UI governance.

## Verification

- `rtk npm run test:unit`
- Targeted Vitest commands for each repaired cluster while iterating.
- `rtk openspec validate restore-unit-contract-signal --strict`
