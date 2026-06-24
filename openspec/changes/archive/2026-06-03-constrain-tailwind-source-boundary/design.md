## Context

Tailwind 4 performs automatic source detection from CSS entrypoints. In this repository the CSS entrypoint is `src/app/globals.css`, while the repository also contains agent/tooling directories such as `.agents`, `.codex`, `.wolf`, `openspec`, `docs`, `evaluate`, and generated assets. Some of these directories contain symlinks to machine-local paths, for example OpenSpec Buddy skills under `Documents/Project/OpenSpec-buddy`.

When these system surfaces are included in automatic source detection, Turbopack may attempt to resolve external symlink targets while compiling page CSS. After the local account path changed from `/Users/yw` to `/Users/YW`, the dev server reproduced a Turbopack panic while rendering `/login`:

```text
Failed to write app endpoint /(auth)/login/page
Caused by:
- [project]/src/app/globals.css [app-client] (css)
- FileSystemPath("").join("../../Project/OpenSpec-buddy/skills/openspec-buddy") leaves the filesystem root
```

This is a tooling boundary bug, not a page-level application bug. The build system should only scan surfaces that can contain runtime UI class names.

## Approach

Use Tailwind 4's CSS-first source configuration:

```css
@import "tailwindcss" source(none);
@source ".";
@source "../components";
@source "../features";
@source "../lib";
@source "../resources";
```

The paths are relative to `src/app/globals.css`, so this registers:

- `src/app`
- `src/components`
- `src/features`
- `src/lib`
- `src/resources`

These directories cover App Router pages, shared UI components, feature modules, UI class helper modules, and reusable frontend resources. `src/lib` is included because existing UI imports class-string factories such as homepage theme gradients and AI theme styles from that boundary.

They intentionally exclude repository system surfaces:

- `.agents`, `.codex`, `.wolf`, `.codegraph`, `.code-review-graph`
- `openspec`, `docs`, `notes`, `course-content` authoring/review docs
- `evaluate`, sample repositories, generated files, scripts, local logs, and build outputs

Project-local agent skill symlinks may still exist for agent workflows, but they are outside Tailwind source detection and must not affect page compilation.

## Tradeoffs

- This is stricter than automatic detection. If future UI class names are introduced outside the registered business source directories and UI class helper modules, they will not be generated until the source boundary is intentionally extended.
- That strictness is desirable: adding a new frontend source root should be a conscious code review decision, not an accidental result of repository scanning.
- The current source list does not include `course-content` because runtime content is not expected to define Tailwind utility classes for page rendering. If that assumption changes, a separate change should add a narrow runtime content source path and tests.

## Verification

The implementation should verify:

- clean dependency install with `npm ci`
- `npm run test`
- `npm run test:unit`
- `npm run build`
- local startup on port `3001`
- HTTP/browser checks for `/login`, `/interactive-learning`, and `/api/readyz`
- CSS output includes representative utilities produced from `src/lib` UI helpers, including homepage light gradient and AI theme classes

The startup check must confirm that Turbopack no longer resolves `.agents` symlinks or OpenSpec Buddy paths during page CSS compilation.
