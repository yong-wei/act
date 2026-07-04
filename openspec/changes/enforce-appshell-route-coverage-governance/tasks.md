## Tasks

- [ ] 1. Add route shell coverage scanner.
  - Enumerate app routes and ancestor layouts.
  - Detect AppShell-compatible wrappers and report unmatched routes.

- [ ] 2. Add governed exception inventory.
  - Store route exceptions with owner, reason, violated rules, and removal condition.
  - Fail tests on unclassified routes.

- [ ] 3. Add governed wrapper registry and AppShell DOM contract tests.
  - Require every wrapper to be registered before its routes count as covered.
  - Test `InteractiveLearningShell`, `CourseEntryShell`, `LessonRuntimeShell`, classroom shell, teacher shell, admin shell, Arena shell, and simulation shell.
  - Verify canonical left nav order, collapsible behavior, breadcrumbs, and top-right action order.
  - Verify teacher and administrator Personal Center targets are role-safe.
  - Verify local commands do not occupy the theme/account slot.

- [ ] 4. Add representative visual audit matrix.
  - Cover primary modules and fixed deep route families.
  - Use concrete seeded representative routes for teacher, admin, graph, data-center, course, classroom, AI, playlist, Arena child, simulation child, assessment child, and virtual-lab pages.
  - Cover 1440, 1280, 1024, 768, 390, and 320 viewport widths.
  - Require visual audit pass before closing the series.

- [ ] 5. Wire governance into existing test commands.
  - Add focused unit/source tests and documented Playwright checks.
  - Ensure new product routes fail unless shell coverage or exception metadata is added.

- [ ] 6. Validate the change.
  - Run `rtk openspec validate enforce-appshell-route-coverage-governance --strict`.
  - Run route shell governance tests and representative visual checks.
