## Why

Manifest rendering currently has a typed plugin registry alongside older
central kind branches and compatibility re-export entrypoints.  The duplicate
registration paths make it unclear which renderer owns a capability and can
let a declared module bypass its role, evidence, or missing-renderer policy.

## What Changes

- Make the existing `ManifestPluginSet`/`composeManifestPluginRegistry` path
  the canonical registration path for reusable module, activity, and layout
  capabilities.
- Migrate central manifest consumers and course registrations to exact plugin
  identities while keeping genuinely course-owned local registries narrow and
  explicit.
- Ensure declared capabilities cannot fall through to the legacy central
  renderer, and preserve explicit missing/optional renderer results.
- Remove legacy renderer branches and compatibility entrypoints after a
  zero-caller inventory; keep public behavior and role/evidence projections.
- Leave DB/BOPPPS resource registration and the CourseBundle/Classroom
  contracts unchanged.

## Capabilities

### New Capabilities

- `course-renderer-registration-retirement`: Defines one canonical manifest
  registration owner and legacy-renderer deletion gates.

### Modified Capabilities

None.  `manifest-runtime-plugin-contract`, `interactive-course-standard-module-
migration`, and existing resource-registry behavior remain authoritative.

## Impact

- Affects `src/features/interactive/shared/manifest-runtime/content-renderers.tsx`,
  `layout-renderer.tsx`, `activity-renderers.tsx`, plugin sets under
  `manifest-runtime/plugins/`, one-line compatibility exports, per-course
  `step-panels.tsx` registries, and registry/route tests.
- The global manifest registry remains distinct from
  `src/lib/resource-registry.tsx` for DB/BOPPPS resources; this change does not
  merge those domains.
- Depends on `canonicalize-course-bundle-runtime-api` and the existing
  manifest plugin contract; it is a prerequisite for
  `simplify-manifest-content-renderers`.
- No new renderer contract, capability, database schema, route, physics logic,
  or student-visible answer authority is introduced.
