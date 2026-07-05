## Governance Approach

The final gate should combine source-level and browser-level checks.

Source-level checks:

- Enumerate `src/app/**/page.tsx`.
- Resolve ancestor `layout.tsx` files.
- Detect direct AppShell-compatible wrappers and approved route-group shells.
- Compare unmatched routes against an exception inventory.
- Compare wrapper-covered routes against a governed wrapper registry.
- Check route metadata for desktop navigation, breadcrumbs, and primary nav active mapping.

Browser-level checks:

- Visit representative route matrix.
- Assert left rail exists, uses canonical order, and has stable collapsed/expanded behavior.
- Assert breadcrumbs exist in the shared top bar for non-home routes.
- Assert top-right visible order is exactly theme switch then role-aware Personal Center.
- Assert route-local commands are outside the account/theme slot.

Visual audit:

- Capture primary route matrix screenshots for `/knowledge`, `/interactive-learning`, `/assessment/adaptive-practice`, `/arena`, `/simulations`, `/interactive-learning/control-workbench`, and `/profile`.
- Capture deep workflow screenshots for these fixed representatives, updating only when a route is retired with an equivalent replacement: `/teacher`, `/teacher/classes`, `/admin`, `/admin/users`, `/data-center`, `/graph-center`, `/interactive-learning/courses/unit-1-1-see-the-full-picture`, `/interactive-learning/courses/unit-1-1-see-the-full-picture/student/[sessionId]` or a seeded session equivalent, `/interactive-learning/courses/unit-1-1-see-the-full-picture/teacher/[sessionId]` or a seeded session equivalent, `/classroom/join`, `/ai`, `/playlists`, `/arena/challenges/[taskId]` or a seeded task equivalent, `/simulations/cruise`, `/assessment/document-feedback`, and `/virtual-lab`.
- Capture 1440, 1280, 1024, 768, 390, and 320 viewport widths, with left rail expanded/collapsed, mobile drawer open/closed, local tool panel open/closed when present, breadcrumb truncation, right-action wrapping, no horizontal overflow, and no overlap.
- Record visual audit status as a required implementation evidence item.

Wrapper registry:

- Direct `AppShell` routes count as covered only when route metadata also provides the required breadcrumb and navigation behavior.
- `InteractiveLearningShell`, `CourseEntryShell`, `LessonRuntimeShell`, classroom shell, teacher shell, administrator shell, `ArenaPageShell`, and simulation shell must each have DOM contract tests before their owned routes count as covered.
- Adding a new wrapper requires adding it to the registry and proving the same fixed header action pair and navigation rail behavior.
- Teacher and administrator routes must assert that the Personal Center action target is role-safe and does not route to the student `/profile` unless an explicit teacher-safe or administrator-safe profile mode exists.

## Exception Inventory

Exceptions must be explicit and reviewable. Each record should include:

- route pattern,
- category,
- owner,
- reason,
- violated shell rules,
- removal condition,
- reviewer notes.

The exception inventory should not contain ordinary product, classroom, lesson, graph, path, simulation, AI, profile, teacher, or administrator pages unless there is a documented temporary migration blocker.
