## Why

After the Tailwind 4 and Turbopack upgrade, the development server can fail before rendering application code because Tailwind automatic source detection follows repository-local tool directories and tracked skill symlinks. These directories are system and agent configuration surfaces, not frontend product source, so including them in CSS class detection creates false runtime failures and path-dependent behavior after user-directory migration.

## What Changes

- Define a frontend build source boundary for Tailwind/Turbopack class detection.
- Disable broad automatic Tailwind source detection and register only business frontend source directories and UI class helper modules needed for application styling.
- Exclude agent, Codex, OpenSpec, memory, documentation, generated, evaluation fixture, and local environment directories from frontend CSS source scanning.
- Preserve project-local skill symlink usability for agents while preventing those symlinks from participating in page compilation.
- Require clean-install verification, default tests, unit tests, production build, and browser route smoke checks after source-boundary changes.

## Capabilities

### New Capabilities
- `frontend-build-source-boundary`: Defines which repository surfaces may participate in frontend CSS/content discovery and page compilation.

### Modified Capabilities
- None.

## Impact

- Affects `src/app/globals.css` Tailwind 4 source directives.
- Covers `src/lib` files that are imported by UI code and return Tailwind class strings.
- Affects project-local agent skill symlinks only insofar as they must not break frontend builds after user-directory migration.
- Affects local startup/browser verification for `/login`, `/interactive-learning`, and `/api/readyz`.
- Does not change product UI behavior, dependency versions, authentication, data governance, or deployment topology.
