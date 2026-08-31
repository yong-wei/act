# Upstream and coordination

Capture revision: `migrate-one-manifest-course-to-shared-classroom-shell` working tree (filled with commit SHA at archive).

## Qualified dependencies

| Change | Archive | Public capability consumed by the pilot |
| --- | --- | --- |
| `define-course-bundle-classroom-session-contract` | `openspec/changes/archive/2026-08-28-define-course-bundle-classroom-session-contract/` | `loadSessionBoundLessonRuntime`, `resolveSessionRouteSegment` bound to canonical `1-2` |
| `extract-classroom-session-application-service` | `openspec/changes/archive/2026-08-28-extract-classroom-session-application-service/` | `src/features/classroom/session/public-api.ts`, `create-api.ts`, `join-api.ts`, `state-api.ts` |
| `separate-classroom-live-state-from-submission-evidence` | `openspec/changes/archive/2026-08-28-separate-classroom-live-state-from-submission-evidence/` | `useManifestSubmissionController`, `acceptClassroomSubmissionEvidence`, live state via session-framework hooks |
| `introduce-manifest-runtime-plugin-contract` | `openspec/changes/archive/2026-08-28-introduce-manifest-runtime-plugin-contract/` | `createManifestContentModuleRegistry`, student/teacher activity registries, plugin key tuple |

## Concurrent changes not reimplemented here

- `add-default-teacher-class-launch-selection` owns teacher class choice. The pilot keeps `CourseEntryShell` → `useTeacherClassroomLauncher`.
- `unify-interactive-lesson-component-style` owns visual tokens. This change only replaces the private `premium-lesson-topbar` header with `LessonRuntimeShell`; it does not restyle modules.

## Non-goals confirmed

No production selector change, no other course-family migration, no authoring reads on the classroom path, no second session state machine.
