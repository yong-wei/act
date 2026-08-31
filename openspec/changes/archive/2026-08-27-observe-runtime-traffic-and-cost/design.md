## Context

At the captured `integration` baseline, browser GLBs travel through Nginx and
Next from image-local `public/assets`; `/course-runtime/*` reads an entire file
into a Node buffer; `/api/course-runtime/assets/*` verifies the active manifest
and redirects to a 300-second OSS URL; production Runtime uses an internal OSS
FUSE Blob view; developer workstations use the public OSS endpoint; and the
Publisher has distinct upload, metadata-reuse, and legacy readback operations.

These paths produce different server, OSS, and ESA accounting records. Vendor
reports can also arrive at different times and count the same client transfer
at different network boundaries. A single summed number would therefore be
misleading.

## Goals / Non-Goals

**Goals:**

- Freeze the complete route and operation-class denominator at one Git commit.
- Normalize each evidence source without merging incompatible billing scopes.
- Attribute observed bytes where evidence supports it and preserve every
  unresolved byte in the denominator.
- Produce a portable, privacy-safe baseline and comparable later observations.

**Non-Goals:**

- Changing application routes, DNS, Buckets, IAM, cache rules, publication,
  Runtime selection, deployment, or production state.
- Claiming that OSS `CdnOut`, ESA edge traffic, and ECS egress are equivalent or
  free.
- Reconstructing missing production data from repository assumptions.

## Decisions

### Use source-specific ledgers inside one observation envelope

`runtime-traffic-cost-observation.v1` binds the captured commit/tree,
observation window, environment, source type, source export hash, exporter/tool
version, collection time, declared reporting delay, and normalized rows. OSS,
ESA, Nginx, Publisher, and developer-mount totals remain separately balanced.
This avoids double counting a browser transfer once at ESA and again at OSS
origin fetch. A single cross-vendor total was rejected because the accounting
boundaries are not additive.

### Freeze a complete route and operation taxonomy

The inventory includes browser `public-assets`, direct `course-runtime`,
manifest-bound `runtime-media-redirect`, production `runtime-blob-view`,
developer `runtime-blob-public-read`, Publisher `public-upload`, Publisher
`metadata-check`, and Publisher `legacy-body-readback`. Every observed record
names network direction, endpoint class, route class, object-prefix class, byte
count, and confidence/evidence identity. Unknown rows remain `unattributed`.

### Separate normalized evidence from protected raw exports

Raw vendor exports and access logs remain in an operator-controlled location.
The repository artifact carries only aggregate rows, hashed input identity, and
bounded examples with signed query strings, credentials, user identifiers,
client IP addresses, and local absolute paths removed. A sanitizer rejection is
a failed observation, not permission to publish raw evidence.

### Qualify completeness instead of guessing

Each source records `observed`, `excluded`, `duplicate`, `delayed`, and
`unattributed` byte/count totals with a denominator hash. Missing windows,
mixed revisions, unknown timezone, unsupported schema, or an unbalanced total
produce `incomplete` or `blocked`; they do not silently disappear. Comparison
requires compatible route taxonomy and windows, while vendor billing delay is
reported explicitly.

### Keep observation read-only

Collectors inspect files, command output, exported records, and existing
metrics only. Tests use fixtures. No collector is allowed to create cloud
resources, publish objects, change DNS, send synthetic production traffic, or
activate a release.

## Risks / Trade-offs

- **Billing records arrive late** → retain the source's reporting delay and
  publish a later observation revision instead of rewriting prior evidence.
- **Nginx or ESA logs are unavailable** → preserve that source and its expected
  window as missing; do not infer bytes from application routes.
- **One request appears at multiple boundaries** → balance each source ledger
  separately and correlate only through bounded route/object/time classes.
- **Sensitive data leaks through exports** → require schema allowlists,
  sanitization tests, and repository diff scanning before an artifact is kept.

## Migration Plan

1. Freeze the route denominator and observation schemas at the implementation
   commit.
2. Build fixture-backed importers and sanitizers before handling operator data.
3. Capture a baseline without changing live traffic.
4. Use new immutable observation revisions for later comparisons; never edit a
   historical observation in place.

## Open Questions

- Actual production log retention and OSS/ESA billing latency are deployment
  facts to record during capture, not defaults to infer in code.
- If one evidence source cannot export the required denominator, the first
  result remains incomplete until an approved alternative source is identified.
