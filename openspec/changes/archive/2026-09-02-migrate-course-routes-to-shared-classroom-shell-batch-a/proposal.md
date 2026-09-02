## Why

The first course-route batch still carries course-specific entry, student,
teacher, and waiting adapters even though its lessons are published runtime
manifests.  This duplicates session wiring and makes identity, role projection,
and live/evidence separation difficult to verify across the first three course
families.

## What Changes

- Migrate the batch-A route families (`unit-1-1` through `unit-3-9`) to the
  existing shared Classroom shell and session application service.
- Use the canonical CourseBundle runtime read surface from C10 for entry,
  manifest, media, handout, graph, and session-bound content.
- Preserve current DB BOPPPS/generated-courseware behavior, route URL shapes,
  session access, role projection, and optional resource degradation.
- Keep response-producing steps on durable submission evidence and draft
  progress on live state; preview remains non-writing.
- Remove batch-A private route/component authorities after zero-caller proof;
  do not leave permanent redirects or a private shell facade.

## Capabilities

### New Capabilities

- `course-routes-shared-classroom-shell-batch-a`: Defines the fixed batch-A
  route denominator and its migration/deletion qualification gates.

### Modified Capabilities

None.  Existing CourseBundle, Classroom, manifest plugin, identity,
submission/evidence, and accessibility requirements remain authoritative.

## Impact

- Affects the catch-all course routes under
  `src/app/interactive-learning/courses/[routeSegment]`, batch-A modules under
  `src/features/interactive/course-app-routes/`, shared manifest loaders, and
  route/session tests.
- Batch-A membership is canonical lesson ids `1-1`, `1-2`, `1-3`, `1-4`,
  `1-5`, `2-1`, `2-2`, `2-3`, `2-4`, `3-1`, `3-2`, `3-3`, `3-4`, `3-5`,
  `3-6`, `3-7`, `3-8`, and `3-9`.  A previously qualified pilot is consumed,
  not reimplemented.
- Depends on `canonicalize-course-bundle-runtime-api` and the pre-existing
  shared Classroom/session and manifest-plugin contracts.  Batch B is a
  separate follow-up and must not be mixed into this denominator.
- No new route family, shell, session state machine, manifest capability, or
  database schema is introduced.
