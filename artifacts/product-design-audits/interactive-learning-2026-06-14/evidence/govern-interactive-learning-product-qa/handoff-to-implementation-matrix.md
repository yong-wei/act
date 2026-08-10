# Interactive Learning Product QA Matrix

Change: `govern-interactive-learning-product-qa`

Design source: `artifacts/product-design-audits/interactive-learning-2026-06-14/design-handoff.md`

## Child Design QA

| Change | Report | Result |
| --- | --- | --- |
| `unify-interactive-learning-atlas-shell` | `artifacts/interactive-learning-atlas-shell-502/design-qa.md` | passed |
| `migrate-interactive-course-entry-shell` | `artifacts/product-design-audits/interactive-learning-2026-06-14/evidence/migrate-interactive-course-entry-shell/design-qa.md` | passed |
| `standardize-interactive-classroom-entry` | `artifacts/product-design-audits/interactive-learning-2026-06-14/evidence/standardize-interactive-classroom-entry/design-qa.md` | passed |
| `standardize-lesson-runtime-shell` | `artifacts/product-design-audits/interactive-learning-2026-06-14/evidence/standardize-lesson-runtime-shell/design-qa.md` | passed |
| `define-interactive-module-visual-standards` | `artifacts/product-design-audits/interactive-learning-2026-06-14/module-visual-standards-504/design-qa.md` | passed |

## Route And State Matrix

| ID | Route | Role | Viewport | Theme | State | Source concept | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `atlas-desktop-light` | `/interactive-learning` | student | desktop | light | atlas workspace | `concepts/01-learning-atlas-course-catalog.png` | passed |
| `course-catalog-mobile-dark` | `/interactive-learning/courses` | student | mobile | dark | theory/practice catalog | `concepts/revised/01-course-catalog-theory-practice.png` | passed |
| `chapter-components-desktop-light` | `/interactive-learning/chapter-components` | student | desktop | light | chapter component list | `concepts/01-learning-atlas-course-catalog.png` | passed |
| `cross-domain-list-mobile-light` | `/interactive-learning/cross-domain-exploration` | student | mobile | light | cross-domain list | `concepts/01-learning-atlas-course-catalog.png` | passed |
| `course-entry-desktop-light` | `/interactive-learning/courses/unit-1-1-see-the-full-picture` | student | desktop | light | course entry shell | `concepts/02-course-entry-shell.png` | passed |
| `teacher-waiting-desktop-light` | `/interactive-learning/courses/[courseId]/teacher/[sessionId]/waiting` | teacher | desktop | light | QR waiting state | `concepts/revised/02-teacher-classroom-qr-waiting.png` | passed |
| `student-runtime-desktop-light` | `/interactive-learning/courses/unit-1-1-see-the-full-picture/student/[sessionId]` | student | desktop | light | student runtime | `concepts/revised/03-student-guest-runtime.png` | passed |
| `guest-runtime-mobile-dark` | `/interactive-learning/courses/unit-1-1-see-the-full-picture/student/demo` | guest | mobile | dark | guest demo runtime | `concepts/revised/03-student-guest-runtime.png` | passed |
| `teacher-projection-desktop-dark` | `/interactive-learning/courses/unit-4-1-design-task-expression/teacher/[sessionId]` | teacher | desktop | dark | teacher projection | `concepts/revised/06-teacher-projection-runtime-compact-navigation.png` | passed |
| `invalid-session-desktop-light` | `/interactive-learning/courses/unit-1-1-see-the-full-picture/student/[sessionId]` | student | desktop | light | invalid session fallback | `concepts/revised/03-student-guest-runtime.png` | passed |
| `module-chrome-student-choice-mobile` | `/interactive-learning/courses/unit-4-1-design-task-expression/student/[sessionId]` | student | mobile | light | standard student choice module | `concepts/revised/03-student-guest-runtime.png` | passed |
| `konling-dock-collapsed-desktop` | `/interactive-learning/courses/unit-1-1-see-the-full-picture/student/[sessionId]` | student | desktop | light | shared right-bottom dock | `concepts/revised/03-student-guest-runtime.png` | passed |
| `focus-management-keyboard` | `/interactive-learning/courses/unit-4-1-design-task-expression/teacher/[sessionId]` | teacher | desktop | light | keyboard and page jump | `concepts/revised/06-teacher-projection-runtime-compact-navigation.png` | passed |

## Regression Checks

- Shared AppShell navigation and dock contracts are required across atlas, catalog, entry, waiting and runtime routes.
- Teacher projection pages must not render student answer inputs, a permanent right drawer, a top duplicate next action or an oversized bottom navigation.
- Teacher bottom navigation must include a page-jump dropdown and page count state.
- Konling must remain the shared right-bottom dock and must not be embedded into course right rails, local tool columns or module panels.
- Student and guest pages must not show teacher statistics, evidence status or class analytics.
- Course entry and runtime pages must not reintroduce `premium-lesson-*` as their primary shell.
- Standard module chrome must be registered for representative module states.

## Source Refresh

### 2026-07-01: Classroom lifecycle dialog closure

- Change: `audit-remediation-classroom-lifecycle-dialog-closure`
- Scope: shared course entry conflict handling, lesson-plan active-class feedback, class-bound classroom actions, and interactive teacher runtime end-session confirmation.
- Product QA impact: the change replaces native browser confirm/alert surfaces with the shared classroom lifecycle dialog and inline status messaging. It does not change student runtime module layout, teacher projection chrome, course navigation, Konling dock placement, or compact spacing geometry.
- Teacher runtime bulk pattern: each changed `src/features/interactive/unit-*/teacher-page.tsx` file only imports `requestClassroomEndConfirmation` and replaces the existing native end-session confirmation with `await requestClassroomEndConfirmation()`.
- Evidence: `src/features/interactive/__tests__/classroom-join-entry.test.ts` asserts the lifecycle dialog API contract, in-scope source usage, and absence of native confirm/alert calls for the covered classroom lifecycle paths.

## Temporary Exceptions

None.

## Current-revision annotated-media refresh

On 2026-07-21, the annotation label typography in `src/features/interactive/shared/manifest-runtime/content-renderers.tsx` was refreshed under `unify-interactive-lesson-component-style` at SHA-256 `d1f089cd2ab727927b05122934d9b762d681b2ab56d6bb0b8ca52be72db0ccde`. Fresh browser evidence was captured from the current working revision, including the real lesson 1-2 student demo at step 11 and the representative released, selected, submitted, teacher reveal, answer reveal, and diagnostics states. Provenance is recorded in `artifacts/interactive-learning/unified-courseware-style-final-2026-07-21/implementation-acceptance.json`; no earlier acceptance artifact is reused as current-revision evidence.
