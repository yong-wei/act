## Why

The manifest runtime has a useful shared protocol, but `content-renderers.tsx` has grown into a large central switch that directly imports control charts, simulations, activities, and other business components. The manifest runtime plugin boundary must become explicit so a new course can register a renderer without expanding that center. The DB `TeachingResource` registry is a different protocol and must not be merged into this change.

## What Changes

- Define typed plugin contracts whose stable identity is at least the composite of `module.kind` and `capabilityRef` (with an explicit contract version), alongside activity behavior, layout/template behavior, role projection, schema validation, evidence extraction, and missing-renderer behavior.
- Allow one `compute.panel` module kind to register distinct capabilities such as `static-surface-3d`, `control-workbench`, and `interactive-figure` without collapsing them into one kind-level branch.
- Make the center responsible only for manifest validation, plugin lookup, submission context, standard evidence collection, and an observable missing-renderer result.
- Move at least one real renderer to an owned plugin registration (pilot: the existing `compute.panel` `static-surface-3d` renderer), and remove its direct import from the central renderer rather than adding a facade.
- Preserve canonical module taxonomy, response contracts, role-safe reference-answer projection, media/knowledge-card soft degradation, and generated-courseware compatibility.
- Keep the manifest plugin registry separate from the DB `TeachingResource` registry and from the lowercase lesson-engine `resource-renderer`/uppercase legacy `ResourceRenderer` protocols.

## Capabilities

### New Capabilities

- `manifest-runtime-plugin-contract`: Defines typed manifest module/activity/layout plugins, registry ownership, role projection, missing-renderer behavior, and migration/deletion evidence.

### Modified Capabilities

None. `interactive-module-taxonomy`, `interactive-response-contracts`, `interactive-governance-evidence`, `course-data-quality-gates`, `generated-courseware-slide-runtime`, and existing resource-registry capabilities remain authoritative.

## Impact

- Affects `src/features/interactive/shared/manifest-runtime/content-renderers.tsx`, `activity-renderers.tsx`, `layout-renderer.tsx`, `module-registry-gate.ts`, manifest runtime types/tests, and the selected plugin owner.
- Denominator: every canonical and legacy `module.kind`/`capabilityRef` pair, capability version, activity response renderer, layout/template registry, role projection, central direct import, missing-renderer path, and runtime-first manifest in the frozen inventory. It must include all 32 runtime-first course families and generated-courseware manifests without counting DB `TeachingResource` entries as manifest plugins.
- Depends on the qualified charter/dependency contracts. It coordinates with `unify-interactive-lesson-component-style` only for existing visual governance and does not repeat UI style work.

## Scope and Evidence

- **Characterization:** inventory module-kind/capability pairs, direct imports, registry lookups, fallback/error markers, activity evidence paths, role visibility, generated-slide adapters, and the selected pilot's browser behavior.
- **Migration and deletion:** implement the typed registry and pilot, remove the pilot's central import and dead switch branch, then migrate additional plugins only when their owner, schema, evidence, and deletion condition are recorded. No DB registry merge and no permanent facade.
- **Verification:** run module taxonomy/gate, manifest render, role-projection, missing-renderer, evidence, generated-slide, typecheck, lint, and affected browser tests; prove central import counts decrease.
- **Browser acceptance:** render the pilot in student and teacher projections, verify hidden reference answers and visible fallback/error states, test optional media/card failure, exercise the duplicate capability-key negative and distinct `compute.panel` capability registrations, and confirm no new course-specific switch branch or capability parser is needed.
- **Ledger:** maintain a plugin registry/owner map, module-kind denominator, direct-import deletion ledger, legacy alias disposition, role/evidence contract, and browser evidence references. The proposal does not claim implementation or deployment.
