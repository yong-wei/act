## Why

Runtime manifests currently contain 151 `module.kind` values across 27 interactive lesson manifests, and 110 of those values appear in only one lesson. Many names encode presentation, subject semantics, or interaction behavior rather than a real platform module type, which keeps course content coupled to lesson-private runtime code.

## What Changes

- Define a canonical interactive module taxonomy for all manifest-driven lessons.
- Separate module type, presentation variant, semantic role, interaction behavior, response structure, and compute capability binding.
- Define the legacy alias policy that permits old manifests to be migrated without allowing new custom variants.
- Establish naming rules that prevent new module kinds from encoding layout, course-specific semantics, or answer type.

## Capabilities

### New Capabilities
- `interactive-module-taxonomy`: Canonical module classes, allowed axes, alias rules, and lesson-authoring constraints for manifest modules.

### Modified Capabilities
- None.

## Impact

- Affects runtime manifest contracts under `course-content/runtime/lessons/*/interactive-manifest.json`.
- Affects shared manifest runtime registration in `src/features/interactive/shared/manifest-runtime/`.
- Sets the contract foundation for later response standardization, module gates, and full-course migration changes.
