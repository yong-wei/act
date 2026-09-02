## Context

The current runtime path combines filesystem discovery, runtime lesson
normalization, media resolution, source links, and CourseBundle drift checks in
`src/lib/course-runtime.ts`.  Other consumers also import identity and bundle
helpers directly.  The existing CourseBundle contract already defines the
immutable revision, runtime release locator, complete digest, per-resource
hashes, identity projection, and manifest hash; the existing Classroom
application service already owns session access and lifecycle.

The implementation must provide a stable seam for later route migration without
creating a second CourseBundle or Classroom contract.

## Goals / Non-Goals

**Goals:**

- Make one existing CourseBundle implementation the source of all runtime
  lesson and bound-resource reads.
- Preserve canonical identity, runtime source revision, manifest hash, complete
  bundle digest, optional-resource behavior, and generated-courseware checks.
- Keep runtime reads server-only and session authorization in its current owner.
- Prove consumer migration before deleting the old aggregator or aliases.

**Non-Goals:**

- Changing CourseBundle fields, Classroom session semantics, route URLs, or
  manifest plugin behavior.
- Reading `course-content/authoring/**` from a runtime path.
- Adding a compatibility facade that permanently forwards to the old module.
- Rebinding an existing session to a later runtime release or hash.

## Decisions

### 1. Extend the existing CourseBundle public surface

Add the runtime read operations to the existing `src/lib/course-bundle`
public entry (or its already-owned application/read module), reusing the
current filesystem and bound-blob helpers.  Consumers import this public
surface; they do not import internal readers or assemble a parallel registry.
The old `course-runtime.ts` path is transitional only and is deleted once its
caller denominator is zero.

### 2. Resolve identity before paths

Every request resolves a canonical lesson id through the existing identity
resolver, then resolves the runtime lesson directory and captured bundle
revision.  Mutable plan titles, route labels, or client-provided paths are
aliases/hints only.  A session-bound read checks the captured revision and
manifest hash before returning bytes or normalized content.

### 3. Preserve the authoring-to-runtime boundary

Runtime reads use `course-content/runtime/**`, the active runtime release, or a
session-bound blob locator.  Authoring paths remain inputs to the review and
publication pipeline only.  A missing or malformed runtime artifact produces
the existing explicit unavailable/drift result; it never falls back to an
authoring file or a different revision.

### 4. Keep access and evidence ownership unchanged

The runtime API may accept a server-resolved session binding, but it does not
reimplement Classroom authorization, live state, submission evidence, or
teacher/student projection.  Response-producing steps continue through the
shared submission/evidence contract; draft progress continues through live
state.

### 5. Migrate in measurable slices

Freeze an import and behavior inventory, migrate route/page/resource consumers,
run identity/hash and optional-resource regressions, then remove direct old
imports.  The inventory records replacement, remaining compatibility use, and
deletion proof.  Rollback before deletion restores the previous imports without
changing persisted session identities.

## Risks / Trade-offs

- [A consumer loses a manifest or resource hash] → compare normalized output
  and identity envelopes for every migrated caller.
- [A route bypasses session access] → keep access resolution in the existing
  Classroom service and add unauthorized/wrong-class contract cases.
- [A missing artifact falls back to authoring or a newer release] → fail closed
  on revision/hash drift and test both missing and mismatched resources.
- [The old module remains a hidden authority] → require source-level zero-caller
  proof and delete its exports in the same qualified revision.

## Migration Plan

1. Capture current caller, path, response, and identity/hash behavior.
2. Add the runtime read operations to the existing CourseBundle public entry
   and migrate direct consumers by domain.
3. Migrate route, manifest, media, handout, textbook, and generated-courseware
   reads; retain only a reversible local mapping while tests run.
4. Re-run static and dynamic caller inventories, delete superseded exports, and
   verify no authoring/runtime boundary regression.
5. If rollback is required before deletion proof, restore imports to the last
   qualified implementation; do not alter existing session bindings.

## Open Questions

None.  The implementation may choose the precise internal file split as long
as the existing CourseBundle public entry remains the only runtime authority.
