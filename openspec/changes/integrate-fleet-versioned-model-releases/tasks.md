## 1. Receive packages

- [x] 1.1 Add `scripts/models/receive-fleet-model-release.mjs` and compact ACT manifests
- [x] 1.2 Receive lng-changheng v1.0.0, msc-tessa v1.0.0, xue-long-2 v0.1.1, adora-magic-city v0.1.0, hysy-981 v1.0.0
- [x] 1.3 Re-run the Type 055 v2.1.3 receive script as a no-op integrity check
- [x] 1.4 Receive hysy-981 v1.0.2 from GitHub `HYSY981-ACT-v1.0.2.zip`; keep v1.0.0 on disk as an immutable prior package
- [x] 1.5 Receive dredger-tianjing v1.0.1 from `3DModels:models/act-dredger-tianjing/exports/v1.0.1` (LOD0/1/2)

## 2. Descriptors and shared mount

- [x] 2.1 Extend package types for three-LOD roles, `basisYawRad`, live-rotation/live-spin, and attainment clips
- [x] 2.2 Register five merchant descriptors plus the 055 pointer in `fleet-packages.ts`
- [x] 2.3 Activate all seven logicalIds in `versioned-defaults.ts`; dredger points at tianjing v1.0.1
- [x] 2.4 Add `VersionedFleetShip` with DWL anchoring, outer yaw, inner basis, and legacy fallback
- [x] 2.5 Extend `SemanticBindingsRig` for azipod/thruster telemetry and main-ship attainment clips
- [x] 2.6 Extract shared `heading-attainment` helpers including `pickRandomSubset`
- [x] 2.7 Register `dredger-tianjing` 1.0.1 as a three-LOD Meshopt GLB package

## 3. Simulation wiring

- [x] 3.1 Switch LNG and container scenes to `VersionedFleetShip` with rudder/speed bindings
- [x] 3.2 Switch icebreaker to versioned mount, live azipod RPM, and heading attainment
- [x] 3.3 Switch cruise to versioned mount without hull-sink offset; map rudder to pods
- [x] 3.4 Switch drilling to versioned mount, eight thrusters, Y=0 visual, station-keep attainment
- [x] 3.5 Point homepage previews at activated low LOD; resolve posters from the preview URL (versioned prefix or legacy originalUrl)
- [x] 3.6 Switch dredger to `VersionedFleetShip` with Tianjing v1.0.1; replace the homepage/list poster from the package `images/hero.png`

## 4. Verification

- [x] 4.1 Add fleet receipt tests and update rollout / type055-candidate assertions
- [x] 4.2 Run targeted vitest for model-package and simulation-scene rollout files
- [x] 4.3 Run `rtk npm run typecheck` on the changed surface
- [x] 4.4 Validate the OpenSpec change strictly
- [ ] 4.5 Browser-check the six simulation routes and homepage preview
