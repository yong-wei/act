## Why

The seven simulation GLBs are served from `public/assets` inside the ACT image,
with model paths repeated across components and optimized outputs kept as local
generated files. ACT therefore cannot publish, verify, switch, or roll back the
first ESA asset cohort as one immutable set.

## What Changes

- Define a versioned browser Delivery manifest for the approved simulation GLB
  cohort, binding logical model ID, captured Git source identity, generated
  output provenance, SHA-256, size, media type, immutable object key, public
  eligibility, Range requirement, cache class, and fallback URL.
- Add a Delivery publisher that conditionally copies only allowlisted verified
  GLB bytes to `act-course-delivery` at
  `assets/<sha256>/<safe-basename>.glb`, verifies existing objects without
  overwrite, and emits a portable publication receipt.
- Centralize simulation model URL resolution so production tries the qualified
  ESA content-addressed URL first while local development and failure rollback
  retain the existing optimized and original same-origin URLs.
- Update optimized-model validation, model profiles, loaders, tests, and build
  evidence to consume the same manifest rather than scattered hard-coded
  production paths.
- Verify browser loading, progress and visual equivalence, full-object hash,
  Range/206, cache HIT, CORS, before/after traffic attribution, and automatic
  local fallback before declaring the cohort routed.
- Keep Runtime v2 blobs, manifests, receipts, knowledge resources, private
  media, PDFs, videos, audio, WASM, active/rollback selectors, and the existing
  private media resolver outside this change.

## Capabilities

### New Capabilities

- `content-addressed-browser-asset-delivery`: Immutable publication, projection,
  resolution, verification, and rollback for public browser asset cohorts.

### Modified Capabilities

None.

## Impact

- **Code:** simulation model profiles/components, shared asset resolver,
  optimized-model validator, Delivery publication tooling, browser checks, and
  focused tests.
- **Assets:** the seven Git-managed source GLBs and their verified optimized
  outputs; publication is copy-only and does not remove image-local fallbacks.
- **Dependency:** production routing requires a qualified
  `static.adapt-learn.online` PoC and a captured traffic/cost baseline.
- **Unchanged contracts:** Runtime v2 Authority storage and lifecycle,
  `private-runtime-media-delivery`, production Runtime FUSE, and developer OSS
  access.
- **Verification:** local typecheck, asset validator and simulation tests,
  production build, browser/Range/cache evidence, and strict OpenSpec
  validation; no `pull_request` GitHub Actions workflow is added.
