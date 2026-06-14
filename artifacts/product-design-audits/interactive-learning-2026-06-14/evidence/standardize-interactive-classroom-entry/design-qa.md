# standardize-interactive-classroom-entry design QA

## Sources

- Product Design handoff: `artifacts/product-design-audits/interactive-learning-2026-06-14/design-handoff.md`
- Reference concept: `artifacts/product-design-audits/interactive-learning-2026-06-14/concepts/revised/02-teacher-classroom-qr-waiting.png`
- Implementation route: `/interactive-learning/courses/unit-4-1-design-task-expression/teacher/visual-session/waiting`
- Entry continuity route: `/interactive-learning/courses/unit-4-1-design-task-expression`
- Browser capture manifest: `artifacts/product-design-audits/interactive-learning-2026-06-14/evidence/standardize-interactive-classroom-entry/browser-capture.json`

## Implementation Screenshots

- Waiting desktop light 1440: `teacher-waiting-light-1440.png`
- Waiting desktop dark 1440: `teacher-waiting-dark-1440.png`
- Waiting mobile light 320: `teacher-waiting-light-320.png`
- Waiting mobile dark 320: `teacher-waiting-dark-320.png`
- Course entry desktop light 1440: `course-entry-light-1440.png`
- Course entry desktop dark 1440: `course-entry-dark-1440.png`
- Course entry mobile light 320: `course-entry-light-320.png`
- Course entry mobile dark 320: `course-entry-dark-320.png`

## Checks

- QR code: present and rendered from the classroom join URL.
- Classroom code: visible as `384219` in the primary visual hierarchy.
- Joined student count: visible as `32` in the status panel.
- Start action: `开始上课` is the primary action and routes to the teacher runtime.
- Runtime separation: waiting route does not render `data-task-workspace-archetype="lesson-runtime"` before the teacher starts class.
- Shell continuity: AppShell breadcrumbs, collapsible navigation, user/theme controls, and global Konling dock remain present.
- Theme coverage: light and dark screenshots captured for desktop and mobile.
- Text fit: task controls fit on 1440 and 320 widths; mobile breadcrumb truncation is inherited AppShell behavior and does not cover task content.

## Findings

- P0: none.
- P1: none.
- P2: none.
- P3: mobile title initially wrapped awkwardly; fixed by shortening the waiting card title to `扫码加入课堂` and using smaller mobile type.

## Result

final result: passed
