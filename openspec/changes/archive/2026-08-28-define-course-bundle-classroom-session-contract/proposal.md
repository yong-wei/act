## Why

`ClassSession` currently points at a mutable `LessonPlan`, while runtime loading still depends on an authoring `lesson-id-map.json` and some ordinary-course paths can fall back to a plan title. That permits an active classroom to resolve a different lesson after a plan or alias changes. Generated courseware already has stronger immutable revision and manifest binding; the same identity boundary is needed for every classroom session.

## What Changes

- Define an immutable `CourseBundle` identity containing canonical lesson identity, bundle revision, exact runtime release/tree/object locator, complete bundle digest, required per-resource hashes, and manifest hash.
- Bind every new `ClassroomSession` to one captured bundle identity/revision/release locator/digest; retain the existing DB BOPPPS relationship and generated-courseware publication revision contract.
- Make the runtime bundle contain a self-sufficient lesson identity projection. Every session-bound runtime reader must use the captured binding, never the active release, authoring content, or a title-derived identity.
- Classify legacy sessions with incomplete identity explicitly and provide a monotonic migration path; never rebind historical sessions silently.
- Keep media, knowledge-card, and generated-courseware references attached to the same captured bundle identity, with optional surfaces allowed to degrade without changing the lesson identity.

## Capabilities

### New Capabilities

- `course-bundle-classroom-session-contract`: Defines immutable course-bundle identity, runtime identity projection, session binding, compatibility handling, and drift failure behavior.

### Modified Capabilities

None. `interactive-lesson-identity-resolution`, `generated-courseware-slide-runtime`, `smart-courseware-publication`, `formal-runtime-atomic-resource-binding`, and existing classroom/session capabilities remain authoritative and are consumed rather than duplicated.

## Impact

- Affects `prisma/schema.prisma` `ClassSession`/`LessonPlan`/generated-courseware relations, session creation and snapshot code, `src/lib/course-runtime.ts`, `src/lib/interactive-lesson-identity.ts`, runtime manifests, and lesson entry readers.
- The implementation denominator is every `ClassSession` producer and reader, every runtime-first lesson identity surface, every active-release lookup, every generated-courseware launch path, and every lesson/manifest/handout/graph-overlay/knowledge-card/media lookup that currently accepts a lesson or plan identity. The frozen baseline records 32 runtime-first course families and approximately 96 private route surfaces; the exact producer/consumer counts must be captured at implementation HEAD.
- Depends on the qualified `enforce-modular-domain-dependency-contracts` contract (and its charter input); it does not create a second identity registry or change the DB BOPPPS model.

## Scope and Evidence

- **Characterization:** record current runtime-vs-authoring reads, active-release lookups, title fallback callers, plan mutation behavior, generated publication bindings, legacy rows, session response payloads, release/tree/object locators, bundle digests, and per-resource hashes before changing the schema or writers.
- **Migration and deletion:** use expand/dual-read only where required, then switch all writers to the immutable binding, remove authoring/title fallback from classroom reads, and ledger every compatibility reader with a deletion condition. No historical session rebinding.
- **Verification:** run bundle/schema, identity-drift, active-release-switch, session-snapshot, generated-courseware, media/knowledge-card, database concurrency, affected-domain, typecheck, and strict OpenSpec checks.
- **Browser acceptance:** launch and refresh a representative ordinary and generated course as teacher and student; switch the active runtime release/tree/object locator after creation and prove both paths still render the captured bundle digest, release locator, manifest hash, and required resource hashes. Prove optional media/card failure does not alter the base lesson.
- **Ledger:** keep a denominator-closed record of producers, identity aliases, fallback readers, legacy session classes, migration status, and deletion evidence. This proposal does not claim, deploy, or activate anything.
