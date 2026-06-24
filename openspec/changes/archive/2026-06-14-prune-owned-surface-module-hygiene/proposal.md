## Why

React Doctor reports large mechanical-maintenance warning families: 388 unused exports, 66 unused files, 74 component files exporting non-components, and smaller barrel/import/dependency findings. These warnings can indicate dead code and unstable module boundaries, but they require graph-backed verification before deletion or API reshaping.

## What Changes

- Clean owned-surface module hygiene warnings in graph-verified batches.
- Separate safe dead-code deletion from public API or route-boundary refactors.
- Preserve intentionally exported test helpers, registry entrypoints, and framework-required files.

## Capabilities

### New Capabilities

- `owned-surface-module-hygiene`: define warning-level module hygiene cleanup requirements.

## Impact

- Affects unused exports/files, component-only export boundaries, barrel imports, dynamic imports, and package dependency checks.
- Does not remove route files, registry entries, or exported APIs without graph/test evidence.
