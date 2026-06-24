## 1. Public And Auth Entry

- [x] 1.1 Redesign homepage first viewport with one primary action and one secondary action.
- [x] 1.2 Redesign login, embedded login, callback, and auth error states with route trace and role destination semantics.
- [x] 1.3 Verify `/login?callbackUrl=%2Fprofile` preserves the profile destination visibly and functionally.
- [x] 1.4 Verify public entry routes update the route ledger with owning change, archetype, navigation layers, shell status, mobile behavior, dock behavior, and light/dark evidence.

## 2. Student Entry Surfaces

- [x] 2.1 Redesign `/interactive-learning` as a student learning control page.
- [x] 2.2 Redesign course catalog, simulation entry, Arena entry, and adaptive practice entry to share student intent language.
- [x] 2.3 Move component library and implementation-oriented links below primary learning paths.
- [x] 2.4 Make current class, current lesson/session, active assignment, next practice, Arena task, or experiment path more prominent than generic module directories when that data is available.
- [x] 2.5 Verify the student journey can move from login callback to dashboard or Interactive Learning, then to current course/practice/challenge/experiment, and finally to profile evidence or learner record.

## 3. Verification

- [x] 3.1 Run navigation and student entry tests.
- [x] 3.2 Capture 1440px and 320px screenshots in light and dark themes for affected entry routes.
- [x] 3.3 Verify `/interactive-learning` first viewport presents current path and next action rather than equal-weight feature cards.
- [x] 3.4 Run `rtk openspec validate redesign-public-student-entry-experience --strict`.
