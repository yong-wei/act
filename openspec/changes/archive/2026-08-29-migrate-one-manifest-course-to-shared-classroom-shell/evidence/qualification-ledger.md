# Pilot qualification ledger

Change: `migrate-one-manifest-course-to-shared-classroom-shell`  
Issue: #1574  
Pilot: canonical `1-2` / `unit-1-2-modeling-from-object-to-system`

This receipt is input to `retire-private-course-session-route-bridges`. It does not claim catalog-wide migration, deployment, or production activation.

## Replacement

| Deleted authority | Replacement |
| --- | --- |
| `unit-1-2-modeling-from-object-to-system/course-header.tsx` | `LessonRuntimeShell` |
| Legacy AppShell exception for this slug | `DEEP_PRODUCT_APP_SHELL_ROUTE_MATRIX` compatible-wrapper rows |

App Router files remain thin identity wrappers (`loadLessonRuntimeEntry` / `loadSessionBoundLessonRuntime` / `TeacherClassroomWaitingRoute`).

## Proof

- `rg UNIT_1_2CourseHeader` → zero
- `existsSync(course-header.tsx)` → false
- Characterization: `src/features/interactive/__tests__/unit-1-2-shared-classroom-shell.test.ts`
- Shell contracts: `platform-ui-contracts`, `platform-appshell-contract`
- Browser: `tests/unit-1-2-shared-classroom-shell.spec.ts`
  - `evidence/browser/student-demo.png`
  - `evidence/browser/teacher-demo.png`
  - `evidence/browser/teacher-waiting.png`
  - `evidence/browser/student-live.png`
  - `evidence/browser/journey.json`

## Rollback boundary

Restore the previous student/teacher header mapping before deleting `course-header.tsx`. Do not rebind existing sessions or change captured bundle identity.
