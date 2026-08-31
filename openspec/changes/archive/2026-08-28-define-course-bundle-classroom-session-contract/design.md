## Context

The current runtime reader in `src/lib/course-runtime.ts` reads runtime lesson
files, but its `LESSON_ID_MAP_PATH` still points to
`course-content/authoring/shared/lesson-id-map.json`. `resolveLessonRuntimeFragment`
also accepts the shared identity registry and an index fallback. The registry in
`src/lib/interactive-lesson-identity.ts` carries plan-title aliases for ordinary
course entry. In the database, `ClassSession.planId` points to mutable
`LessonPlan`; `ClassSession` has nullable `lessonVersion` and `manifestHash`,
whereas generated-courseware publication revisions already bind a manifest hash
and revision. This leaves ordinary classroom sessions without one immutable
course identity. The session reader also needs an exact runtime release/tree/
object locator and a complete bundle digest, not only a manifest hash, so an
active-release switch cannot change the content behind a bound session.

The change is a Course-owned identity contract consumed by Classroom. It must
preserve the existing BOPPPS `LessonPlan`/`LessonItem` model, generated
courseware publication revisions, runtime release integrity, and the existing
canonical lesson identity capability. It must not make authoring content a
runtime dependency or turn a title alias into identity.

## Goals / Non-Goals

**Goals:**

- Persist one immutable bundle revision identity containing canonical lesson id,
  bundle id/revision, exact runtime release/tree/object locator, complete bundle
  digest, required per-resource hashes, runtime source revision,
  identity-projection digest, and manifest hash.
- Bind every newly created `ClassSession` to that revision in the same
  authorization/creation boundary as its plan and generated-courseware fields.
- Make the runtime projection self-contained and prove that every
  session-bound runtime reader uses the captured identity after plans, aliases,
  titles, or the active runtime release changes.
- Keep optional media and knowledge-card references hash/identity aligned while
  allowing their presentation to degrade without changing the base course.
- Give incomplete legacy rows an explicit status and deletion/migration record.

**Non-Goals:**

- Replacing the DB BOPPPS model or rewriting all `LessonPlan` data.
- Rebinding existing sessions from a title, mutable plan, or current default.
- Rebuilding authoring content in runtime or changing runtime release
  publication/activation semantics.
- Merging this identity with the DB `TeachingResource` registry or with the
  manifest plugin registry.
- Claiming, deploying, or activating a production bundle.

## Decisions

### 1. Store an immutable bundle-revision record

Introduce a Course-owned immutable revision record (logical name
`CourseBundleRevision`) with a stable bundle identity and fields for
`canonicalLessonId`, `bundleRevision`, exact `runtimeReleaseRef`,
`runtimeTreeObjectLocator`, `runtimeSourceRevision`, complete `bundleDigest`,
`identityProjectionHash`, `manifestHash`, and required per-resource hashes for
lesson, manifest, handout, graph-overlay, knowledge-card, and media content.
The digest is computed over the canonical bytes of all formal bundle content,
not only the manifest. A revision is append-only; a new content or runtime
release gets a new revision. `ClassSession` stores a required binding for new
rows and keeps `planId` for BOPPPS orchestration and compatibility. A
denormalized manifest hash may be retained for indexed reads, but it must be
checked against the immutable revision and complete digest/resource hashes.

An embedded JSON snapshot alone was rejected: it would duplicate identity
validation and make it difficult to prove that generated courseware and
runtime readers use the same revision. Making `LessonPlan` itself immutable was
also rejected because existing teacher editing and BOPPPS behavior rely on its
mutable lifecycle.

### 2. Generate a self-sufficient runtime identity projection

The runtime export must include the canonical lesson id, bundle identity,
revision, exact runtime release/tree/object locator, complete bundle digest,
manifest hash, required per-resource hashes, and alias-family metadata needed by
runtime consumers. `course-runtime.ts` may discover runtime directories from the
captured runtime projection, but it must not read the active release,
`course-content/authoring/**`, or a mutable title during a bound classroom
read. `interactive-lesson-identity.ts` remains the canonical resolver for
bounded ingress aliases; its plan-title aliases are never persisted as the
session identity.

Reconstructing the map from titles at request time was rejected because a title
is mutable and can be ambiguous. Keeping the old authoring map as a hidden
fallback was rejected because it would preserve the two-authority failure mode.

### 3. Capture and verify identity during session creation

The session application use case resolves one canonical bundle revision before
writing the session. It verifies that the requested plan and, when present,
generated-courseware publication revision project to the same canonical lesson,
runtime release/tree/object locator, source revision, complete bundle digest,
required resource hashes, and manifest hash. The transaction writes the bundle
binding, plan id, lesson snapshot, and generated publication fields together.
Every session response exposes the captured identity needed by classroom pages;
subsequent reads use only that binding rather than resolving the active release,
current plan title, or authoring map.

Generated-courseware sessions continue to require the existing publication
revision/hash equality. Ordinary lessons receive the same immutable contract
from their runtime bundle. No caller is allowed to silently choose a newer
revision after creation.

### 4. Fail closed for drift and classify legacy rows

Missing bundle records, release/tree/object locator mismatches, incomplete
bundle/resource digests, hash mismatches, canonical-id mismatches, or runtime
projection drift are explicit errors at creation and read boundaries. Existing
sessions lacking a complete binding are classified as legacy/incomplete for
reporting and can continue only through a documented compatibility reader. No
bulk title-based backfill or historical session rebinding is allowed. A later
qualified migration may add an exact, independently evidenced binding to a
newly created record, but it must not alter the historical session's identity.

### 5. Treat media and knowledge cards as bound optional projections

Media and knowledge-card references carry the bundle revision/hash (or an
exactly matching runtime release identity) and their required per-resource
hashes. A missing optional projection emits an observable soft-degradation
reason and leaves the base lesson available. Identity or per-resource hash
mismatch is a hard drift error, not a soft 404, because showing a resource from
another course revision would corrupt classroom meaning.

## Denominator and Characterization

Before schema changes, freeze an inventory of all `ClassSession` writers and
readers, plan/runtime binding helpers, active-release selectors, generated-
courseware launchers, identity aliases/maps, lesson/manifest/handout/graph-
overlay/knowledge-card/media readers, and reports. Include the observed 32
runtime-first course families and approximately 96 private route surfaces, but
derive the exact denominator from the captured source revision rather than
assuming the approximate count is complete. Record current authoring reads,
title fallbacks, release/tree/object locators, complete bundle digests,
per-resource hashes, hash/revision fields, and legacy rows as separate classes.

## Vertical Migration and Deletion

Use an expand step for the immutable bundle revision and nullable legacy binding,
write both old-compatible and new identity data during the controlled takeover,
then switch every new-session writer to the immutable binding. After all
consumers use the captured release/tree/object locator and complete digest,
delete active-release, authoring, and title fallback from classroom reads and
remove only the compatibility helpers whose ledger conditions are proven.
Rollback can stop new binding enforcement while preserving captured bindings;
it must not rewrite sessions already created with a valid revision.

## Targeted and Domain Verification

Run bundle identity unit/schema tests, runtime projection, active-release-switch,
and drift tests, session creation/read tests, generated-courseware binding
tests, complete digest/per-resource hash tests, media and knowledge-card
soft-degradation tests, and real-PostgreSQL concurrent creation tests. Then run
the affected Course/Classroom domain suites, typecheck, and
`openspec validate define-course-bundle-classroom-session-contract --type change
--strict`. A final `git diff --check` is required.

## Browser Acceptance

For one ordinary runtime-first course and one generated-courseware course,
launch as teacher, join as student, refresh both pages, then switch the active
runtime release/tree/object locator. Verify the rendered bundle revision,
captured locator, complete bundle digest, manifest hash, and required resource
hashes remain unchanged on both paths. Change the plan title or alias in a
controlled fixture and prove the active session does not switch identity.
Remove an optional media/card projection and verify only that surface degrades;
introduce a bundle or per-resource hash mismatch and verify the session fails
closed.

## Ledger

Maintain a revision-bound ledger containing each producer/reader, bundle and
plan identity, runtime release/tree/object locator, complete bundle digest,
per-resource hashes, authoring/title fallback, active-release lookup, legacy
class, generated publication binding, optional projection, owner, migration
status, deletion condition, and test/browser evidence. The ledger is the source
for later route-bridge and fallback retirement; it is not a release or
activation receipt.

## Migration Plan

1. Verify the qualified charter/dependency-contract inputs and freeze the
   denominator and source identity.
2. Add the immutable Course-owned revision, exact runtime release/tree/object
   locator, complete bundle digest, per-resource hashes, and compatibility read
   path without changing existing session behavior.
3. Generate self-sufficient runtime identity projections and migrate all new
   session writers to capture the full binding.
4. Gate reads, reports, media, and knowledge cards on the captured identity;
   classify unresolved legacy rows rather than guessing, and verify active
   release switches cannot alter a bound session.
5. Remove active-release/authoring/title fallback readers after zero-consumer
   evidence and hand the qualified contract to the classroom application-service
   change.

Rollback is limited to disabling new binding enforcement and restoring the
previous reader for rows explicitly classified as legacy. It never deletes the
immutable revision records or mutates historical session attribution.

## Open Questions

None blocking proposal creation. The implementation must choose the concrete
Prisma relation/table names and object-locator representation while preserving
the exact release binding, complete digest, per-resource hashes, and invariants
above; any choice that makes the bundle mutable, active-release-authoritative,
or title-authoritative is out of contract.
