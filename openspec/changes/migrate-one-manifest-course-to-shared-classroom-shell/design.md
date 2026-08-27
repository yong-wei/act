## Context

`unit-1-2-modeling-from-object-to-system` is a suitable pilot: its canonical
identity is `1-2`, its runtime files live under
`course-content/runtime/lessons/1-2`, and its current App Router entry has
student, teacher, and waiting surfaces under
`src/app/interactive-learning/courses/unit-1-2-modeling-from-object-to-system`.
The corresponding feature implementation is under
`src/features/interactive/unit-1-2-modeling-from-object-to-system` and already
uses manifest-first content, shared session-framework pieces, evidence helpers,
knowledge-card, and media entry points. It therefore exercises ordinary
content, interactive response, compute/visual modules, and teacher projection
without selecting a legacy-only course.

The pilot consumes four upstream contracts: immutable CourseBundle/session
binding, Classroom application use cases, live-state/evidence separation, and
manifest plugins. The existing DB BOPPPS flow, generated-courseware revision
binding, canonical identity resolver, accessibility contract, and UI style
governance remain in force. `add-default-teacher-class-launch-selection` owns
teacher class selection; `unify-interactive-lesson-component-style` owns visual
style. Neither is reimplemented here.

## Goals / Non-Goals

**Goals:**

- Make the pilot's teacher, student, waiting, session, bundle, manifest,
  submission, projection, media, and knowledge-card paths use shared contracts.
- Preserve all characterized behavior, including session identity, current step
  progression, evidence classification, role visibility, and optional fallback.
- Delete pilot-specific route/component authorities after their caller
  denominator reaches zero.
- Produce a qualified behavior matrix and browser receipt that later route
  retirement can consume.

**Non-Goals:**

- Migrating any other course family or retiring all private routes.
- Changing course content, canonical lesson id, response vocabulary, visual
  styling, teacher class-choice UX, or generated-courseware semantics.
- Adding a second classroom shell, fallback route, or private plugin registry.
- Reading `course-content/authoring/**` from runtime/classroom execution.
- Claiming production deployment or selector activation.

## Decisions

### 1. Freeze a pilot behavior matrix before migration

At one source revision, capture route/response shape, session create/join/read,
progress advance, end/finalization, student submit/resubmit, teacher reveal and
projection, waiting/reconnect, media, knowledge-card, accessibility markers,
runtime manifest hash, and bundle/session identity. Record expected behavior for
teacher, student, unauthorized/wrong-class, and preview contexts.

Tests that assert only component snapshots were rejected: they do not prove
session identity, evidence durability, or role policy. Browser-only comparison
was also rejected: it misses durable source-log and manifest binding.

### 2. Use shared shell composition with course-owned configuration

The pilot route entry passes only canonical lesson/bundle identity, session
context, and manifest/plugin configuration into the shared classroom shell. The
shell owns authentication mapping, session lifecycle, live sync, submission
controller, teacher/student projection, finalization, and common loading/error
states. Course-owned code supplies manifest content and explicitly registered
capability plugins; it does not call `/api/session` directly or assemble a
second state machine.

The existing shared session framework and entry/waiting primitives are reused.
If a pilot-specific visual or compute capability is required, it is registered
through the plugin contract and not hard-coded in the shell.

### 3. Bind all runtime reads to the captured bundle

The pilot resolves `1-2` through the CourseBundle/session application boundary.
The page reads `course-content/runtime/lessons/1-2` through the runtime reader
and the session's captured revision/manifest hash. It does not access authoring
content, infer identity from `LessonPlan.title`, or discover a different
manifest after refresh. Generated-courseware sessions retain publication
revision/hash checks.

### 4. Route student and teacher through one session mechanism

Student and teacher pages use the same session id/access policy and bundle
identity. Teacher-only controls are role-projected by the shell/plugin; student
pages cannot receive reference answers or teacher state. Waiting and reconnect
use the same application-service read/stream use cases. Existing class-bound
launch selection remains supplied by the dedicated teacher launch change.

### 5. Delete private authorities, not just rename them

After all pilot callers use the shared shell, remove old pilot route/component
implementations and direct session/evidence calls. A temporary route wrapper is
allowed only during migration and must be removed before pilot qualification;
the ledger records zero private authoritative callers. No permanent redirect or
private facade is accepted as “migration complete”.

## Denominator and Characterization

The pilot denominator is closed over canonical identity `1-2`, its runtime
manifest and lesson/graph/media files, all three App Router route families
(student, teacher, waiting), the corresponding feature files, direct
`/api/session`/state/event/stream callers, plugin registrations, and
knowledge-card/media loaders. Characterization must include ordinary and
compute/visual manifest steps, all response-producing steps, teacher controls,
preview, reconnect, finalization, and generated/runtime hash fields.

## Vertical Migration and Deletion

1. Add characterization fixtures and browser evidence without changing behavior.
2. Wire the pilot entry to the bundle and session use cases while keeping a
   reversible route-level mapping.
3. Move student/teacher/waiting render and event paths to the shared shell and
   plugin registry; migrate evidence and live-state writes separately.
4. Run zero-direct-caller and behavior gates, then delete private route/component
   authorities in the same qualified revision.
5. Publish the pilot qualification receipt for the retirement change.

Rollback is permitted before private deletion evidence is accepted by restoring
the prior route mapping. It must not rebind existing sessions or change their
durable bundle/evidence identity.

## Targeted and Domain Verification

Run `1-2` manifest/module/identity tests, session application and access tests,
live/evidence and submission tests, teacher/student projection tests, media and
knowledge-card fallback tests, generated-courseware binding tests, and private
caller inventory tests. Then run the affected Interactive/Classroom domain
suite, typecheck, lint, build checks required by the implementation, and
`openspec validate migrate-one-manifest-course-to-shared-classroom-shell --type
change --strict`, followed by `git diff --check`.

## Browser Acceptance

With a teacher and student, launch `1-2`, wait, join, refresh, progress through
content and at least one response step, submit and resubmit, and exercise a
teacher reveal/projection. Verify bundle revision/manifest hash, role-safe
content, session stream reconnect, finalization/report state, media and
knowledge-card optional failure, and preview non-write behavior against the
matrix. Capture canonical and private-link behavior for the later retirement
gate.

## Ledger

Record pilot route/component/caller denominator, behavior fingerprint, bundle
and manifest identity, plugin/evidence bindings, role projection, deleted
authorities, browser artifact locations, test commands, rollback boundary, and
qualification decision. The receipt must state that the pilot is qualified but
must not imply that the remaining catalog is migrated.

## Migration Plan

1. Confirm all four upstream changes are qualified/available and that concurrent
   teacher class-launch/style changes are scoped separately.
2. Freeze the pilot inventory and characterization receipt.
3. Implement shared-shell composition and migrate runtime/session/evidence paths
   with no content or policy changes.
4. Run focused, domain, browser, typecheck, lint, and build verification.
5. Delete private authorities after zero-consumer proof and publish the pilot
   receipt consumed by `retire-private-course-session-route-bridges`.

No deployment, production activation, or broad route deletion is part of this
change.

## Open Questions

None blocking. If a pilot-specific renderer cannot satisfy the plugin contract,
the implementation must record the missing capability and stop qualification;
it must not reintroduce a private central switch.
