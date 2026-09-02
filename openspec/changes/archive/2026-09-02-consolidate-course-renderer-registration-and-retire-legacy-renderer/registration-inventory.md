# Registration inventory (C13)

Source revision: claim branch HEAD at implementation time.
Scope: reusable manifest module/activity/layout registration. DB/BOPPPS
`src/lib/resource-registry.tsx` and uppercase `ResourceRenderer.tsx` stay
separate and are not migrated.

## Plugin sets (canonical owner)

| Owner | Composite identities | Replacement |
| --- | --- | --- |
| `manifest-runtime/static-surface-3d-module` | `module::compute.panel::static-surface-3d::static-surface-3d.v1` | plugin render |
| `manifest-runtime/control-workbench-module` | `module::compute.panel::<ref>::<ref>.v1` for the six workbench refs | plugin render |
| `manifest-runtime/interactive-figure-module` | `module::compute.panel::interactive-figure::interactive-figure.v1` | plugin render |

Composed only by `defaultManifestPluginRegistry()` in
`content-renderers.tsx`. Duplicate keys still throw at compose time.
Lookup statuses: `rendered` / `missing` / `unclaimed`.

## Central kind branches

- Canonical content/visual/layout kinds remain the unclaimed path until C14.
- `compute.panel` resolves through `lookupModule`; `missing` renders the
  declared marker and does not fall through.
- Deleted: `'interactive-figure'` kind branch (zero `module.kind` callers,
  zero registry-key callers; would have been a SummaryCard fallback for a
  declared plugin identity).
- Transitional: `'interactive-figure-panel'` image helper. Runtime modules
  no longer use it as `module.kind`; course intercepts still call the key
  for `legacyKind` image/course-owned figures. Not a second plugin registry.

## Compatibility exports

Deleted at zero production/test/bundle imports:

- `src/features/interactive/shared/manifest-content-renderers.tsx`
- `src/features/interactive/shared/manifest-activity-renderers.tsx`
- `src/features/interactive/shared/interactive-manifest-renderer.tsx`

Canonical imports remain
`src/features/interactive/shared/manifest-runtime/{content-renderers,activity-renderers,layout-renderer}.tsx`.

## Course-local `InteractiveModuleRegistry`

Retained wrappers in unit `step-panels.tsx` spread
`createManifestContentModuleRegistry` and override `compute.panel` by
`legacyKind` / `panel_id` for course-owned rust/image/training panels.
They do not call `composeManifestPluginRegistry` and do not register a
second composite plugin identity. 1-2 / workbench modules without a local
override keep the plugin path.

## Activity / layout

No production activity or layout `ManifestPluginSet` exists. Activity
dispatch stays `createManifestStudentActivityRegistry`; layout dispatch
stays `INTERACTIVE_TEMPLATE_REGISTRY`. Unclaimed until a reusable plugin
owner exists.

## Behavior comparison

| Case | Pre | Post |
| --- | --- | --- |
| `static-surface-3d` exact version | plugin | plugin |
| unregistered `contractVersion` | missing marker | missing marker |
| undeclared compute payload | SummaryCard | SummaryCard |
| control-workbench refs | plugin | plugin |
| student/teacher surface-3d | identical projection | identical projection |
| course-owned figure intercepts | local panel / image helper | unchanged |
| compatibility shims | unused files | deleted |
