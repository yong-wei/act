## Investigation

A route scan found many pages without directly provable AppShell coverage after considering page-local imports and ancestor layouts. The migration matrix must explicitly cover these route families:

- `/teacher/**`: teacher dashboard, classes, class details, analytics, resources, lesson plans, prep packs, history, Arena publication routes, and student evidence/diagnosis routes. Target wrapper: teacher role AppShell wrapper with role-aware Personal Center.
- `/admin/**`: administrator dashboard, users, config, states, data governance, lesson plan CRUD, and admin resource surfaces. Target wrapper: admin role AppShell wrapper with role-aware Personal Center.
- `/data-center`: data center product surface. Target wrapper: direct AppShell with canonical rail and data-center breadcrumb.
- `/graph-center`: graph-center route. Target wrapper: direct AppShell with canonical rail and graph-center breadcrumb.
- `/interactive-learning/courses/**`: course entry, student runtime, teacher runtime, and waiting pages. Target wrappers: `CourseEntryShell`, `LessonRuntimeShell`, and teacher waiting/runtime shells registered in the wrapper registry.
- `/interactive-learning/resources/**` and older `/interactive-learning/**` activity pages: resource, exploration, chapter component, and legacy interactive pages. Target wrapper: `InteractiveLearningShell` or a registered route-specific shell.
- `/classroom/**`: join, student session, teacher session, and review routes. Target wrapper: classroom AppShell-compatible wrapper.
- `/ai/**`: assistant pages. Target wrapper: AI AppShell-compatible wrapper or direct AppShell.
- `/playlists/**`: authoring and play routes. Target wrapper: playlist AppShell-compatible wrapper or direct AppShell.
- `/assessment/**`: adaptive practice plus document feedback and future assessment surfaces. Target wrapper: assessment AppShell-compatible wrapper or direct AppShell.
- `/arena/**`: challenge detail and related Arena child routes. Target wrapper: `ArenaPageShell` registered in wrapper registry.
- `/simulations/**`: simulation catalog and simulation detail routes. Target wrappers: simulation AppShell wrappers registered in wrapper registry.
- `/profile/**`, `/dashboard`, `/missions`, and legacy student record routes. Target wrapper: direct AppShell/profile-compatible wrapper with canonical rail.
- `/virtual-lab` and older lab routes. Target wrapper: simulation or lab AppShell-compatible wrapper.

Some of these routes may use feature-level components that eventually render AppShell, but the current governance cannot prove that consistently. The migration must make wrapper ownership explicit through the governed wrapper registry.

## Migration Model

- Course entry pages should use `CourseEntryShell` or another registered AppShell-compatible route wrapper.
- Lesson runtime pages should use `LessonRuntimeShell` with canonical first-level rail retained.
- Classroom runtime pages should use an AppShell-compatible classroom shell, with teaching controls in local toolbars.
- AI, playlist, dashboard, missions, teacher, administrator, data-center, graph-center, and legacy learning pages should use the same top-level rail and header actions.
- Deep routes may use immersive workspace slots, but the shell frame remains present unless a documented exception applies.

Command placement targets:

- Course entry commands: course-local toolbar below breadcrumbs.
- Student runtime navigation and page controls: lesson local tool strip or runtime workspace slots.
- Teacher runtime release/sync controls: teacher local toolbar, not shell account/theme area.
- Classroom review/grading links: review-local command bar.
- Teacher/admin operation tabs: secondary workflow navigation inside content.
- AI session controls: AI local toolbar.
- Playlist play/author commands: playlist local toolbar.

## Exception Model

Allowed exception categories should be narrow:

- auth-only routes,
- print/PDF routes,
- visual review fixture routes,
- embed-only routes,
- full-screen external capture surfaces with explicit return affordance and removal condition,
- live classroom and legacy lesson runtime pages that need a dedicated runtime shell before the universal frame can wrap them safely.

No ordinary teaching, learning, graph, path, simulation, AI, classroom entry, teacher, administrator, data-center, playlist, mission, or profile page should be exempt. Runtime exceptions must be narrower than the product area and must name the follow-up shell condition.
