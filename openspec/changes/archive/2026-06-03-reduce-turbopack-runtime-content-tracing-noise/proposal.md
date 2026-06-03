## Why

Next.js 16 now uses Turbopack by default for `next dev` and `next build`, and the current production build still reports dynamic filesystem tracing warnings around course runtime content. The warnings are not only cosmetic: `.next/standalone` currently traces broad project content and produces an oversized standalone bundle, which weakens deployment signal after the dependency-chain migration.

## What Changes

- Constrain server-side course runtime content reads to explicit static roots instead of joining arbitrary runtime strings from `process.cwd()`.
- Replace project-root-relative runtime content paths with a validated runtime/content path resolution boundary for MDX, handouts, media indexes, and interactive manifests.
- Add targeted standalone output tracing include/exclude configuration only after the runtime path boundary is explicit.
- Add build artifact checks that detect Turbopack tracing warnings, unexpected standalone directories, and excessive trace expansion.
- Preserve existing course entry, knowledge card MDX, handout print, and PDF export behavior while reducing build noise.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `stable-dependency-chain-migration`: Adds a deployment-quality follow-up requirement for Next 16/Turbopack runtime content tracing and standalone bundle boundaries.

## Impact

- Affects `next.config.js`, `src/lib/course-runtime.ts`, `src/app/api/content/mdx/route.ts`, `src/app/interactive-learning/lessons/[lessonId]/handout-print/page.tsx`, and tests around build/runtime content.
- Affects production standalone output shape and Docker image inputs.
- Requires browser checks for representative interactive course routes, knowledge card MDX rendering, handout print, and PDF export.
