## Context

The route tree exposes one dynamic entry route plus student, teacher, and
teacher-waiting paths.  Course-specific modules under
`src/features/interactive/course-app-routes/` still adapt individual lessons,
while `manifest-course-app-loaders.ts`, the shared Classroom shell, and the
session framework already provide the common runtime path.  Course modules may
retain content configuration and registered capability selection, but may not
own session lifecycle or role authorization.

## Goals / Non-Goals

**Goals:**

- Close the batch-A route denominator against one shared shell and one session
  application path.
- Preserve canonical lesson/bundle identity, manifest hash, generated
  courseware binding, access policy, and route-visible behavior.
- Delete obsolete private route authorities once migration evidence is closed.

**Non-Goals:**

- Changing course content, lesson IDs, URL contracts, Classroom semantics, or
  manifest plugin contracts.
- Migrating units 4 or 5, Cruise, or unrelated legacy routes.
- Adding route redirects, a second shell, client-side session authority, or
  direct Prisma access from route components.

## Decisions

### 1. The batch is fixed by canonical lesson identity

The implementation uses the explicit ordered membership in the proposal.  A
route alias or plan title cannot add a lesson to the batch.  `unit-1-2` uses
the qualified predecessor result where present; its identity and behavior are
checked as a regression, not copied into another implementation.

### 2. Generic routes select a shared shell configuration

The App Router remains responsible for params, authentication handoff, and
response mapping.  It resolves canonical identity and passes bundle/session
context to the existing shell.  Course modules provide manifest configuration
and registered plugins; the shell owns join, waiting, reconnect, progression,
finalization, role projection, and common errors.

### 3. Content and persistence boundaries remain unchanged

Pages read only the C10 runtime surface.  Submission-producing steps use the
existing durable evidence path, and draft/progress updates use live state.  The
route migration does not move evidence into live state, recover answers from a
mutable snapshot, or permit preview writes.

### 4. Migrate vertically, then delete

For each lesson, characterize entry, join, waiting, student, teacher,
submission, refresh, reconnect, finish, optional resources, and unauthorized
responses; then switch all route variants and tests to the shared shell.  A
private authority is deleted only after static, dynamic, and browser caller
inventories agree.

## Risks / Trade-offs

- [A lesson-specific module is omitted from the shared loader] → enumerate all
  batch members and all four route variants before changing imports.
- [Role projection or class access changes] → replay teacher, student,
  wrong-class, unauthenticated, and preview cases against the characterization.
- [A response step loses durable evidence] → assert distinct attempt identity,
  live-state isolation, and refresh/reconnect behavior.
- [Deleting a route breaks a deep link] → retain the existing public URL
  mapping during migration and remove only private implementation authority.

## Migration Plan

1. Freeze batch-A route/module/caller inventory and behavior fingerprints.
2. Switch each batch member's entry, student, teacher, and waiting adapters to
   the shared shell using C10 identity and runtime reads.
3. Verify manifest plugins, generated-courseware bindings, access, live/evidence
   writes, media/knowledge-card fallback, and route error mapping.
4. Re-run caller and route inventories, delete private authorities, and record
   qualification evidence.
5. Roll back only before deletion proof by restoring the last qualified route
   adapter; never rebind an existing session.

## Open Questions

None.  The exact per-lesson adapter shape may vary only where the existing
manifest declares a registered capability; it must not change the shell or
session contract.
