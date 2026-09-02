## Why

Runtime lesson reads are still split between `src/lib/course-runtime.ts`,
identity aliases, route loaders, and CourseBundle helpers.  Each consumer can
therefore resolve a different path or silently lose the captured manifest
identity, which makes the M3 route and renderer migrations needlessly risky.

## What Changes

- Establish one consumer-facing runtime read surface on the existing
  `src/lib/course-bundle` implementation.
- Move runtime lesson, manifest, handout, graph, media, and bound-resource
  consumers to that surface without changing their response or URL shapes.
- Derive every read from canonical lesson identity and the immutable runtime
  bundle revision; preserve manifest, source, and per-resource hashes.
- Keep authoring content out of runtime reads and keep session access checks in
  the existing Classroom application boundary.
- Remove the superseded runtime entrypoint and duplicate identity/path helpers
  only after the caller inventory proves zero required consumers.

## Capabilities

### New Capabilities

- `course-bundle-runtime-api-canonicalization`: Defines the single runtime
  bundle read surface and its migration/deletion gates.

### Modified Capabilities

None.  `course-bundle-classroom-session-contract`,
`interactive-lesson-identity-resolution`, and the Classroom contracts remain
authoritative; this change only canonicalizes their consumption.

## Impact

- Affects `src/lib/course-runtime.ts`, `src/lib/course-bundle/**`,
  `src/lib/interactive-lesson-identity.ts`, runtime route handlers, lesson
  entry pages, manifest route loaders, textbook/media readers, and their tests.
- The migration must account for server-only runtime access, session-bound
  reads, generated-courseware revision/hash checks, and optional media or
  knowledge-card degradation.
- Depends on the already-established CourseBundle and Classroom contracts and
  is a prerequisite for `migrate-course-routes-to-shared-classroom-shell-batch-a`
  and `consolidate-course-renderer-registration-and-retire-legacy-renderer`.
- It adds no database model, public URL, CourseBundle field, classroom state,
  manifest plugin, or Assignment lifecycle API.
