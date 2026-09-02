## Why

The remaining advanced and simulation-heavy course routes still repeat the
entry, session, teacher, student, and waiting wiring already qualified for the
first route batch.  Their larger manifest and compute surfaces make a second,
explicit batch necessary so the shared Classroom migration can be verified
without mixing denominators.

## What Changes

- Migrate the batch-B route families (`unit-4-1` through `unit-4-7`,
  `unit-5-1` through `unit-5-6`, and `cruise-comfort-boppps`) to the existing
  shared Classroom shell and session application service.
- Consume the canonical CourseBundle runtime API and registered manifest
  plugins for ordinary, compute, visual, and simulation-backed steps.
- Preserve canonical identity/hash, generated-courseware bindings, class
  access, teacher/student projection, live state, submission evidence, and
  preview non-write behavior.
- Delete batch-B private route/session/component authorities after a closed
  caller inventory and browser qualification.

## Capabilities

### New Capabilities

- `course-routes-shared-classroom-shell-batch-b`: Defines the fixed advanced
  route batch and its migration/deletion qualification gates.

### Modified Capabilities

None.  Existing CourseBundle, Classroom, manifest-plugin, simulation, identity,
and submission/evidence contracts remain unchanged.

## Impact

- Affects the catch-all routes under
  `src/app/interactive-learning/courses/[routeSegment]`, feature adapters in
  `src/features/interactive/course-app-routes/`, Cruise entry/session pages,
  manifest loaders, plugin registrations, and affected tests.
- Batch-B membership is canonical lesson ids `4-1`, `4-2`, `4-3`, `4-4`,
  `4-5`, `4-6`, `4-7`, `5-1`, `5-2`, `5-3`, `5-4`, `5-5`, `5-6`, and
  `cruise-comfort-boppps`.
- Depends on the qualified C10 runtime API and C11 Batch-A migration, plus
  the pre-existing shared Classroom and manifest-plugin contracts.  It does
  not reopen or duplicate Batch A.
- No new shell, simulation stepper, session state machine, route family,
  manifest capability, or database schema is introduced.
