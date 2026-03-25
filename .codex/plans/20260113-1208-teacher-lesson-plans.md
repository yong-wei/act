# Teacher lesson plans view + presets behavior

## Goal
- Ensure the teacher "我的教案" page only lists teacher-created plans while presets remain in the preset page, then run seed/tests and commit/push related changes.

## Scope
- In-scope: adjust teacher lesson plan query, align preset behavior, include lesson-10 assets/registry, clean untracked files, ignore docs/courses, run seed/tests, update docs.
- Out-of-scope: redesign preset UX beyond requested changes, schema migrations.

## Steps
1) Update teacher lesson plan query to exclude presets and keep preset-only listing on preset page.
2) Include lesson-10 resources/registry changes and cleanup untracked files (codex), add ignore for docs/courses.
3) Update docs/ProjectDescription.md if needed, run seed script and required tests.
4) Commit and push all requested changes.

## Tests
- npx ts-node scripts/seed-interactive-resources.ts
- npm run lint
- npm run test
- npm run build
- npm run test:integration

## Acceptance
- Teacher "我的教案" shows only teacher-created plans; presets stay on preset page.
- Lesson-10 resources are registered; lesson-09 changes remain intact.
- docs/courses ignored; codex file removed.
- Seed/tests executed; changes committed and pushed.
