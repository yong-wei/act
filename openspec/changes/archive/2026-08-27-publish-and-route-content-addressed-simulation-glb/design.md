## Context

Seven original GLBs are Git-managed under `public/assets`; seven optimized GLBs
and their current manifest are ignored local outputs synchronized between
worktrees. Components and tests reference `/assets/models-opt/*.glb` with
fallbacks to `/assets/*.glb`. Docker copies `public`, and Nginx has no dedicated
`/assets` location, so production bytes come from the application path.

Runtime v2 is a different authority: it owns immutable course content,
manifests, receipts, active/rollback lifecycle, and private media signing. Public
simulation Delivery must not become a second Runtime release or expose Runtime
objects.

## Goals / Non-Goals

**Goals:**

- Publish one closed, public GLB cohort to immutable Delivery keys.
- Bind generated optimization outputs to captured Git sources and tool identity.
- Give every simulation one resolver and tested ESA-first/local-fallback order.
- Prove publication, browser delivery, visual equivalence, traffic change, and
  rollback without removing existing local bytes.

**Non-Goals:**

- Migrating video, audio, PDF, images outside the approved cohort, WASM,
  textbooks, cards, private resources, or any Runtime v2 namespace.
- Modifying private media authorization, Runtime active/rollback selectors,
  production FUSE, developer OSS access, or application deployment authority.
- Creating a generic asset platform before the first cohort is proven.

## Decisions

### Establish a browser Delivery manifest separate from Runtime v2

`browser-delivery-manifest.v1` binds the captured commit/tree, cohort ID,
logical model IDs, Git blob OID and source SHA-256, optimizer name/version/config
digest, output SHA-256/size/media type, public-eligibility decision, immutable
Delivery key, cache/Range class, same-origin fallbacks, and manifest digest. It
does not contain Runtime Release IDs, object keys, credentials, or signed URLs.
Reusing the Runtime manifest was rejected because these image assets have a
different authority and activation lifecycle.

### Treat optimized GLBs as governed generated outputs

The publisher accepts an optimized file only when the captured Git source,
declared optimizer identity/configuration, output hash, and validator all match
the Delivery manifest. An ignored working-tree file by name alone is not a
source identity. Regeneration drift produces a new content hash and manifest
revision; no existing Delivery object is overwritten.

### Publish conditionally into the Delivery namespace

The publisher accepts only allowlisted `.glb` entries marked public and writes
`assets/<sha256>/<safe-basename>.glb` to `act-course-delivery` with immutable
metadata and no-overwrite semantics. A pre-existing object is reused only after
size, digest metadata, media type, and key identity match. The terminal receipt
is written only after the complete cohort verifies. Arbitrary paths and
Authority Bucket targets are rejected.

### Centralize ESA-first resolution with local fallback

One model registry resolves logical IDs to an ordered candidate set. Qualified
production builds use the immutable ESA URL first, then existing same-origin
optimized and original URLs. Local development remains same-origin by default.
The loader advances to fallback only on a real load/integrity failure and keeps
existing progress/error semantics. This avoids a mutable production selector
while preserving rollback without deleting source assets.

### Require both dependency receipts before production routing

The app may reference Delivery entries only when the static ESA qualification
receipt and traffic baseline receipt match the expected schemas and the
publication receipt matches the exact manifest. Missing or drifted evidence
keeps same-origin resolution. A successful publication alone does not activate
the cohort.

### Verify behavior at asset and scene levels

Asset checks cover full hash, content type, CORS, `206`/`Content-Range`, cache
MISS/HIT, and negative keys. Scene checks cover all seven routes, progress,
fallback, visual equivalence, and no change to the Rust/WASM simulation drive
chain. Before/after observation reports the changed ECS/OSS/ESA traffic classes.

## Risks / Trade-offs

- **Optimized output is not reproducible** → bind the exact output digest and
  optimizer evidence; publish a new hash rather than overwriting.
- **ESA/DNS is unavailable** → ordered same-origin fallback keeps simulations
  usable and the old image assets remain deployed.
- **Manifest and code drift** → generate typed registry data from one validated
  manifest and fail build/tests on hard-coded cohort paths.
- **Public Delivery admits restricted data** → closed `.glb` allowlist and
  public-eligibility gate; no directory projection or Runtime prefix access.
- **Fallback hides prolonged ESA failure** → record fallback telemetry/evidence
  without blocking the learner, then roll routing back in a later deployment.

## Migration Plan

1. Freeze the seven-model source/output denominator and capture optimizer
   provenance at the implementation commit.
2. Generate and validate the Delivery manifest; publish and verify the cohort
   without application references.
3. Require qualified PoC and baseline receipts, then migrate the shared model
   registry and all hard-coded callers/tests.
4. Deploy with ESA first and local fallbacks intact; verify every scene and the
   before/after traffic observation.
5. Roll back by deploying the prior/local-first registry configuration. Do not
   delete immutable Delivery or image-local assets during the observation and
   rollback retention window.

## Open Questions

- The exact optimizer version/configuration and generated-output reproducibility
  are implementation capture facts. Any unresolved model remains excluded from
  the routed cohort rather than silently reducing the denominator.
