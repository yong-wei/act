## Context

`Class` is owned by one teacher and has an `isActive` lifecycle flag, while `ClassSession.classId` remains nullable for legacy and administrator temporary sessions. Today, class-detail launch supplies a `classId`, but lesson-plan, interactive-course, and playlist launchers omit it and create teacher temporary classrooms. Launch logic is duplicated across those surfaces.

The change crosses Prisma schema and migration, class mutations, session authorization, shared client launch state, and two OpenSpec capabilities. `publish-smart-courseware-to-classroom` is already changing generated-courseware session creation and immutable revision binding, so this change must consume its final session contract instead of racing it.

## Goals / Non-Goals

**Goals:**

- Maintain one global default active class for every teacher who owns at least one active class.
- Preserve that invariant across class creation, activation, deactivation, deletion, explicit default changes, migration, and concurrent requests.
- Require an explicit owned active class for every new teacher classroom.
- Give all teacher launch surfaces one accessible dialog and one selection precedence contract.
- Keep legacy classless teacher sessions unattributed when they finish unless a teacher later uses an explicit history-repair action.
- Preserve administrator temporary classrooms and the historical meaning of existing sessions.

**Non-Goals:**

- Per-course, per-year, or per-semester defaults.
- Rebinding existing active, finished, or classless historical sessions.
- Giving administrators a default class.
- Changing classroom waiting, projection, evidence, duplicate-session, or finalization semantics beyond removing automatic class inference for legacy classless teacher sessions.
- Resuming a pending launch automatically after a teacher leaves the dialog to create a class.

## Decisions

### 1. Store the preference on the teacher

Add a nullable `defaultTeachingClassId` relation on `User`, with a uniqueness constraint on the referenced class and `onDelete: SetNull`. The preference belongs to the teacher; `Class.isDefault` would model it as an intrinsic class property and would require a PostgreSQL-only partial unique index to prevent multiple `true` rows without also restricting `false` rows.

The foreign key proves that the class exists. Ownership and active status are cross-row invariants and remain service-validated. A data-quality assertion verifies that a teacher has a default exactly when at least one owned active class exists.

### 2. Centralize every invariant-changing class mutation

Create one teacher default-class domain service used by class creation, explicit default selection, activation, deactivation, and deletion. Each operation runs in a PostgreSQL `Serializable` transaction with the repository's bounded `P2034` retry pattern.

The transaction locks the logical teacher preference through its read/write set, rechecks ownership and active status, and applies one deterministic rule:

- if a replacement is required, select the owned active class with the greatest `createdAt` value;
- use stable class identity only to break an exact timestamp tie, without introducing a second product rule.

Creating or reactivating a class assigns it only when the teacher currently has no valid default. It never replaces an existing valid default.

### 3. Publish dedicated default and launch-option APIs

Keep the preference API aligned with its owner:

- `PUT /api/teacher/classes/default` accepts a class id and atomically sets the teacher preference after ownership and activity checks.
- `GET /api/teacher/classes` includes default state for class-management cards.
- `GET /api/teacher/classes/launch-options` returns owned active classes and the current default id for the shared launch dialog.

Inactive classes are absent from launch options. Explicit default selection has no confirmation step; success updates the card state, while failure retains the previous default and exposes an announced error.

### 4. Use one teacher launch controller and dialog

Introduce one shared teacher classroom launcher that owns launch-option loading, preselection, class selection, empty/error states, duplicate-session recovery, and the final `/api/session` request. Existing entry points pass only their lesson source and optional current class context.

Selection precedence is:

1. an owned active class supplied by the current class route;
2. the teacher's valid default class;
3. no selection when no active class exists.

The dialog always opens, including when only one active class exists. A class-scoped entry still permits an explicit different active class for that one session. Choosing it does not update the default preference. With no active class, the dialog disables launch and links to class creation without persisting or automatically resuming the pending launch.

### 5. Make teacher class binding a server invariant

`POST /api/session` rejects a teacher request that omits `classId`, references another teacher's class, or references an inactive class. The API does not silently substitute the default; the submitted id is the class the teacher reviewed in the dialog.

Class validation and session creation participate in a serializable transaction compatible with the class lifecycle service, closing the validation/deactivation race. Administrator requests may omit `classId` to create a temporary classroom or submit an explicit active class for class-bound operation.

The shared launcher must replace every current teacher producer, including interactive-course entry shells, teacher lesson-plan cards, playlist launch, and class detail. Future teacher start actions use this launcher instead of calling `/api/session` directly.

Session finalization stops inferring `classId` from participant profiles for legacy classless teacher sessions. An `ACTIVE` legacy session that finishes remains classless; an existing explicit history-repair action may still attribute it later when a teacher deliberately selects a class.

### 6. Keep class-card actions accessible and structurally valid

The default card displays a top-right diagonal label. Non-default active cards expose “设为默认” on pointer hover and keyboard focus; touch layouts keep a compact action visible. Because the current card is a navigation link, the implementation separates the navigation hit area from the button rather than nesting an interactive control inside a link.

The shared launch dialog has a stable accessible name, initially focuses its class selector or empty-state action, supports keyboard selection, submission, cancellation, and Escape dismissal, and restores focus to its opening control. Loading, validation, stale-option refresh, success, and failure states are announced without dismissing the teacher's selection unexpectedly.

### 7. Backfill preferences without rewriting session history

The schema migration only adds the nullable relation so it remains compatible with the old application version. After all class-mutation writers run the new dual-compatible service and old instances are drained, an idempotent reconciliation assigns each existing teacher the newest owned active class and leaves teachers with no active class unset. A final invariant gate runs before mandatory teacher class binding is enabled. Existing `ClassSession.classId = null` rows remain unchanged because current preference state is not evidence of historical class attribution. Changing the default never updates existing sessions.

## Risks / Trade-offs

- [Concurrent class mutation leaves an invalid preference] → Use serializable transactions, bounded retries, and concurrency tests covering default switch versus deactivate/delete/create.
- [A class is deactivated between dialog load and launch] → Revalidate inside session creation, keep the dialog open, refresh launch options, and require the teacher to submit again.
- [A duplicated launcher retains temporary teacher behavior] → Add a source inventory test and route/component tests proving all teacher producers use the shared launcher and that teacher requests without `classId` fail.
- [The smart-courseware publication branch changes the session seam] → Keep the native dependency on `publish-smart-courseware-to-classroom` and implement against its archived final contract.
- [Old writers mutate classes during rollout] → Add the relation as an expand step, drain old writers after the dual-compatible service deploys, run final idempotent reconciliation, and gate launch enforcement on a zero-violation audit.
- [Migration selects an unexpected class] → Use the same visible newest-active replacement rule during final reconciliation before enabling teacher launch enforcement.

## Migration Plan

1. After `publish-smart-courseware-to-classroom` is archived, expand the schema with the nullable teacher preference relation without enabling new launch behavior.
2. Deploy the dual-compatible default-class service and route all class lifecycle mutations through it, then drain old application instances.
3. Run the idempotent newest-active reconciliation under an advisory lock, including rows changed between schema expansion and service takeover.
4. Require a zero-violation ownership/activity/exactly-one audit before enabling the feature.
5. Deploy launch-option/default APIs and migrate every teacher launcher to the shared dialog.
6. Enable mandatory teacher `classId` validation only after the launcher inventory and invariant gates pass.
7. Verify that finishing historical classless sessions does not infer a class, explicit history repair still works, and administrator temporary launch remains available.

Rollback first restores the prior teacher launch behavior, then removes the preference relation if necessary. Rollback does not modify sessions created while the feature was active; their explicit class identity remains valid.

## Open Questions

None.
