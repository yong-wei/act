## Why

Teacher launch entry points currently create classless temporary sessions unless the teacher starts inside a class, so attendance, evidence, and review can lose the intended class identity. Teachers need one durable default class and one consistent launch dialog that makes every new teacher classroom explicitly class-bound without changing historical attribution.

## What Changes

- Add one teacher-owned global default-class preference that can reference only an active class owned by that teacher.
- Automatically assign the sole active class, initialize existing teachers from their newest active class, and select the newest remaining active class when the current default is deactivated or deleted.
- Show the default class with a top-right diagonal card label and expose an accessible one-click “设为默认” action on other active class cards.
- Route every teacher launch surface through one shared dialog: class-scoped entry preselects the current active class; all other entry points preselect the teacher default; the teacher may choose another active class for that session without changing the default.
- **BREAKING**: Require every new teacher-created classroom to submit and retain an explicit owned active `classId`; classless temporary classrooms remain available only to administrators.
- Preserve existing classless teacher sessions as unattributed history, remove automatic class inference when they finish, and never rebind existing sessions when the default changes.

## Capabilities

### New Capabilities

- `teacher-default-class-management`: Define the teacher-owned default-class invariant, lifecycle replacement rules, class-card management affordances, migration behavior, and launch-option projection.

### Modified Capabilities

- `audit-remediation-teacher-classroom-lifecycle`: Replace teacher temporary launch with mandatory class-bound selection through a shared launch dialog while retaining administrator temporary sessions and existing session identities.

## Impact

- Affects the `User`/`Class` Prisma relationship and migration, teacher class create/update/delete APIs, class list UI, and shared classroom launch UI.
- Affects all current `/api/session` teacher producers, including interactive-course entries, teacher lesson plans, course playlists, and class detail; future teacher launch entry points must reuse the same launcher.
- Changes `/api/session` authorization/validation and finalization attribution for teachers while preserving administrator temporary launch, explicit history-repair actions, and historical `ClassSession.classId = null` records.
- Depends on `publish-smart-courseware-to-classroom`, which is concurrently changing `ClassSession`, generated-courseware launch, and the same classroom lifecycle capability; this change must apply after that change is archived.
