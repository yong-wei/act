## Context

The runtime-first catalog has canonical identity records, but private course
routes, title aliases, and direct session/rendering consumers still coexist with
the shared classroom/runtime contracts. The baseline observation is 32
runtime-first course families and approximately 96 private route surfaces; the
exact route, alias, producer, and renderer denominator is not assumed from that
approximation. The uppercase `src/features/lesson-engine/ResourceRenderer.tsx`
still has consumers, while lowercase `resource-renderer.tsx` is the current
mainline and must remain available.

This change starts only after the shared-shell pilot is qualified and a complete
catalog inventory exists. It consumes the canonical identity resolver,
CourseBundle/session contract, classroom application service, live/evidence
contract, manifest plugin contract, and legacy-interactive-lesson-retirement
spec. It retires delivery bridges; it does not change unrelated content or
resource governance.

## Goals / Non-Goals

**Goals:**

- Drive private route, title-to-route bridge, direct session producer, and old
  renderer counts monotonically toward zero.
- Process batches only with explicit denominator, replacement, browser, and
  deletion evidence.
- Delete old routes in the same qualified batch once their callers are zero and
  expose no permanent redirect.
- Preserve canonical identity aliases needed for bounded ingress while removing
  title-based classroom identity authority.
- Remove uppercase `ResourceRenderer.tsx` only after a zero-consumer proof and
  the legacy renderer retirement gate.

**Non-Goals:**

- Deleting routes or aliases before the pilot/denominator gates pass.
- Replacing the canonical identity registry, lowercase resource renderer,
  manifest plugin registry, or DB resource registry.
- Keeping a permanent compatibility redirect or silently changing old links to
  another lesson.
- Migrating content, visual style, teacher class choice, or Learning Record
  semantics.

## Decisions

### 1. Freeze one route/consumer/alias denominator

Before the first batch, produce a revision-bound inventory of every runtime-
first course family, entry/student/teacher/waiting route, route segment, plan
title alias, canonical identity alias, direct `/api/session` producer, old
renderer import/call, browser-visible link, and test fixture. Reconcile AST,
filesystem, registry, and browser entry sources. The inventory records private,
canonical, legacy, and compatibility classes separately.

Counting directory names alone was rejected because aliases and dynamic callers
can remain after a route folder is deleted. Counting identity aliases as private
bridges was also rejected when an alias is a bounded ingress key that resolves
to a canonical identity without using a title as authority.

### 2. Require a qualified pilot and batch gate

The pilot receipt from `migrate-one-manifest-course-to-shared-classroom-shell`
must prove shared bundle/session/plugin/evidence behavior, browser acceptance,
and zero private authoritative callers for that pilot. Each subsequent batch
must declare its replacement public API/shell, owner, consumer denominator,
characterization fingerprint, browser cases, and deletion condition before code
changes. A batch is not qualified because its route merely redirects.

### 3. Migrate callers before deleting a route

For a batch, migrate canonical links and dynamic callers to the shared shell and
canonical identity/session use cases. Verify no direct private session producer,
title-based identity lookup, or old renderer authority remains. Then delete the
private App Router route and bridge in the same revision. The old path has the
repository's explicit not-found behavior; no `redirect()` or fallback page is
added to preserve it.

### 4. Separate identity aliases from private route bridges

`interactive-lesson-identity.ts` may retain an alias only when it is an
explicitly inventoried, bounded ingress key with a canonical target and an
expiry/deletion condition. `planTitleAlias` can support a legacy lookup during
migration but cannot determine a new classroom session's bundle or route. Once
all relevant callers use canonical ids, remove the title-to-private-route alias
and record its deletion receipt.

### 5. Retire old renderer only at consumer zero

The lowercase lesson-engine `resource-renderer.tsx` remains the current path.
The uppercase `ResourceRenderer.tsx` is placed in the same ledger as a legacy
consumer class, but it is deleted only when a source/import/runtime inventory and
browser coverage prove zero consumers, including tests and generated-courseware
paths. A failing consumer blocks that deletion; renaming the file or adding a
forwarding export does not count.

### 6. Make removal monotonic and recoverable

Each batch removes entries or replaces them with a compliant public path; it
cannot add a new bridge or broaden an alias. A removal receipt records source
revision, deleted paths, replacement identity, consumer-zero evidence, tests,
and browser artifacts. Recovery uses version control or the documented rollback
procedure, not a live permanent redirect.

## Denominator and Characterization

The exact denominator includes the observed 32 runtime-first families and
approximately 96 route surfaces plus every route alias, title alias, direct
session producer, manifest switch/import consumer, uppercase renderer consumer,
test, and browser-visible entry. Characterization covers canonical and old link
responses, title changes, session refresh/reconnect, role/access behavior,
optional media/knowledge-card failure, and manifest/bundle identity.

## Vertical Migration and Deletion

Run batches in dependency order: qualify the pilot, select a bounded cohort,
migrate entry/callers, verify zero private authoritative consumers, delete routes
and bridges, and write the removal receipt. Repeat until private route and
title-to-private-route counts are zero. Keep only explicitly justified canonical
ingress aliases. The uppercase renderer is a final separate batch gated by
consumer zero.

## Targeted and Domain Verification

After each batch run identity/route drift and no-redirect tests, private session
producer inventory, manifest/module/plugin gates, renderer consumer scans,
route/access tests, and affected browser journeys. At final zero run the full
affected Classroom/Interactive domain suite, typecheck, lint, build checks,
`openspec validate retire-private-course-session-route-bridges --type change
--strict`, and `git diff --check`.

## Browser Acceptance

For each batch, canonical teacher/student links must load through the shared
shell; retired private paths must not be linked, rendered, or redirected; a
changed plan title must not change canonical session identity; refresh/reconnect
must preserve the captured bundle; and optional media/knowledge-card failure
must remain soft. At final zero, exercise representative routes and confirm the
uppercase renderer has no browser-reachable consumer.

## Ledger

Maintain a batch ledger with source revision, family, old route/alias/import,
replacement public path, owner, consumer count, characterization fingerprint,
deletion condition, browser/test evidence, removal receipt, and rollback note.
The final ledger must show zero private route bridges and zero uppercase
renderer consumers; canonical runtime identity and lowercase resource renderer
remain explicit survivors.

## Migration Plan

1. Verify the qualified pilot receipt and freeze the complete route/alias/
   producer/renderer denominator.
2. Publish a batch plan and characterize each selected route and browser entry.
3. Migrate callers to the shared shell, bundle binding, application service, and
   plugin registry; remove title authority.
4. Run zero-consumer and browser gates, delete private routes/bridges without
   redirects, and write a removal receipt.
5. Repeat for all batches, then separately gate uppercase renderer deletion and
   publish the final zero ledger.

Rollback restores a deleted route from the recorded revision only during an
incident response; it does not add a permanent redirect or alter existing
session/evidence records, and any restored path re-enters the ledger as an
explicit temporary exception.

## Open Questions

None blocking. The exact batch partition and concrete route names are selected
from the frozen inventory after pilot qualification; no batch may use an
approximate denominator or inferred title match.
