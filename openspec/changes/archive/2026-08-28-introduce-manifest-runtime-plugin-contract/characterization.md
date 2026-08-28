# Characterization and Plugin Migration Ledger

Source revision: `04dd724e47846452684b2081ed8026b3d20d61bb` (`origin/integration`, 2026-08-28)
Dependency inputs: archived `2026-08-26-establish-modular-monolith-refactor-charter`, archived
`2026-08-26-enforce-modular-domain-dependency-contracts` (qualified); canonical
`interactive-module-taxonomy`, response contracts, generated-courseware slide runtime, and UI
governance specs remain authoritative and are consumed, not redefined.

## 1. Frozen denominator (pre-change)

| Surface | Count | Evidence |
| --- | --- | --- |
| `createManifestContentModuleRegistry` consumers | 45 files | 24 course `step-panels.tsx`, `smart-courseware-editor.tsx`, `generated-courseware-resource.tsx`, 8+ `src/app/review/*` clients, tests |
| Central kind registry branches (`content-renderers.tsx`) | ~30 kind keys incl. legacy aliases | `createManifestContentModuleRegistry` returns `Record<moduleKind, renderer>`; `layout-renderer.tsx` resolves `moduleRegistry[module.kind]` (exact lookup, optional chaining) |
| `compute.panel` capability branches at the center | 3 + fallback | `static-surface-3d` (direct import + branch), `isControlWorkbenchComputeCapabilityRef(...)`, `interactive-figure`, generic `SummaryCard` fallback |
| Canonical declared compute capabilities | 12 | `INTERACTIVE_MODULE_COMPUTE_CAPABILITY_DEFINITIONS` in `module-taxonomy.ts` (`interactive-figure`, `static-surface-3d`, `rust-analysis`, `shared-engine-root-locus`, `phase-peak-locator`, `parametric-risk`, `control-workbench`, `control-linked-comparison`, `control-root-locus-design-map`, `control-frequency-reading-workbench`, `nonlinear-analysis-workbench`, `training-workbench`) |
| Direct business-renderer imports at the center | 5 | `ControlFigureWorkspace`, `persistControlWorkbenchRun`, `StaticSurface3DPanel`, `ControlWorkbenchComparisonPanel`, control-workbench comparison helpers (pilot removes `StaticSurface3DPanel` only) |
| Runtime-first manifests using the pilot | 1 course | `course-content/runtime/lessons/1-2/interactive-manifest.json` declares `compute.panel` + `capabilityRef: "static-surface-3d"` (step 9) |
| Runtime-first course families | 32 | identity registry (frozen in `course-bundle-classroom-session-contract` characterization) |

DB `TeachingResource` registry entries are reported separately and are not manifest plugins
(no registry merge; `resource-registry.tsx` / lesson-engine renderers remain distinct public
capabilities).

## 2. Pilot characterization (`compute.panel` / `static-surface-3d`)

- Render path: center branch `compute.panel` → string equality
  `computeCapabilityRef(module.payload) === 'static-surface-3d'` →
  `<StaticSurface3DPanel {...staticSurfacePanelProps(manifest, step, module)} />`.
- Payload schema (`staticSurfacePanelProps`): `data`/`dataSource`/`surfaceData`
  (regularGrid dataset or `url` media path), `axes.{x,y,z}.label`, `colorScale`
  (label/min/max, defaults 幅值), `defaultCamera` (position [3,3,2] / target [0,0,0] / zoom 1),
  `fallback` (image → runtime media path, alt, note), `markers[]` (label + position tuple),
  title via module/block title resolution, caption from payload or block.
- Role projection: the pilot payload carries no reference answers or teacher-only
  diagnostics; student and teacher render the identical projection today. The plugin
  contract must declare this identity projection explicitly and keep it side-effect free.
- Evidence: view/focus only — `InteractionLog` classification; no `StudentStepResponse` /
  LearningFact materialization. WebGL failure degrades to the declared fallback image.
- Optional failure: missing WebGL or missing fallback image leaves the base step
  renderable (soft degradation); a declared-but-unregistered required capability must
  become an explicit missing-renderer marker, never a silent generic card.

## 3. Plugin migration ledger

| # | Category | moduleKind | capabilityRef | Owner (plugin module) | Contract version | Role projection | Evidence | Missing | State | Deletion condition |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P1 | module | `compute.panel` | `static-surface-3d` | `plugins/static-surface-3d-module.tsx` | `static-surface-3d.v1` | identity (no role-sensitive fields) | view/focus `InteractionLog` only | required | migrated this change (central import + branch removed) | n/a — central branch already deleted; plugin deletable only with a replacement renderer registered under the same composite key |
| F1..Fn | module | various | various | still central (`content-renderers.tsx`) | — | per existing branches | per existing contracts | SummaryCard fallback (unchanged) | staged follow-up | each migration records owner/schema/evidence/missing before its central branch is removed |

Central import deletion ledger: `StaticSurface3DPanel` import removed from
`content-renderers.tsx` in the same slice as P1; the remaining business imports belong to
unmigrated capabilities (F1..Fn) and shrink only with their migrations.

## 4. Registry separation proof

- The manifest plugin registry keys are `(category, moduleKind, capabilityRef,
  contractVersion)` tuples owned by plugin modules; Prisma `TeachingResource.registryId`
  and `src/lib/resource-registry.tsx` entries are not consumed as plugin claims.
- The lowercase lesson-engine `resource-renderer.tsx` and legacy uppercase
  `ResourceRenderer.tsx` are untouched by this change.

## 5. Verification evidence

- Unit: `src/features/interactive/__tests__/manifest-runtime-plugin-registry.test.ts`
  (duplicate full key rejected with both owners named; distinct `compute.panel`
  capabilities accepted; unknown category/empty ref/missing version rejected;
  required/optional missing-renderer typed results).
- Pilot behavior: `manifest-runtime-static-surface-plugin.test.tsx` (schema normalization,
  identity role projection, render markers, evidence-free rendering).
- Center shrink proof: import inventory assertion — `content-renderers.tsx` contains no
  `static-surface-3d` string and no `StaticSurface3DPanel` import after the migration.
- Browser: see `artifacts/interactive-learning/manifest-runtime-plugin-contract-1575/`.
