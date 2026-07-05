## Why

The route scan shows that primary wrappers do not cover the whole application. Many second-level and deeper routes still render without a provable AppShell-compatible frame: course entry pages, lesson runtime pages, teacher/student classroom sessions, AI pages, playlists, legacy student routes, and virtual-lab routes.

If only the main module pages are migrated, users will still lose the navigation rail, breadcrumb orientation, and consistent account/theme actions when they enter real workflows.

## What Changes

- Migrate second-level and deeper product routes to the universal AppShell frame or governed AppShell-compatible wrappers.
- Keep the canonical left navigation rail and active top-level item across nested workflows.
- Add breadcrumb trails for nested course, classroom, simulation, AI, playlist, and account routes.
- Preserve immersive route needs through workspace slots or explicit exceptions rather than shell bypass.
- Add coverage tests that verify deep routes are either wrapped or listed in the exception inventory.

## Impact

- Touches many route wrappers and legacy pages.
- Depends on `define-universal-appshell-frame-contract` and should consume the shared header action API established by the primary route migration rather than creating a second header implementation.
- Should run after or alongside the primary route migration, but it is scoped to deep workflow routes.
