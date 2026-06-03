## 1. Runtime Content Path Boundary

- [x] 1.1 Inventory current server-side content reads in course runtime, MDX content API, handout print, and PDF export flows.
- [x] 1.2 Add or extend a server-only resolver for validated `content` and `course-content/runtime` roots.
- [x] 1.3 Route `loadLessonRuntimeEntry()` JSON, markdown, media index, and manifest reads through the resolver.
- [x] 1.4 Route `/api/content/mdx` reads through the resolver and preserve existing allowed `content` and runtime MDX behavior.
- [x] 1.5 Route handout print markdown reads through the resolver without changing public handout URLs.
- [x] 1.6 Add negative tests for path traversal and project-root-relative arbitrary reads.

## 2. Standalone Trace Boundary

- [x] 2.1 Inspect before/after `.nft.json` files for `/api/content/mdx`, representative course routes, and handout print.
- [x] 2.2 Configure targeted `outputFileTracingIncludes` for required app metadata and public content roots without embedding the external runtime resource package.
- [x] 2.3 Configure targeted `outputFileTracingExcludes` for non-runtime directories currently entering standalone output.
- [x] 2.4 Add a build artifact check that fails on Turbopack dynamic filesystem tracing warnings.
- [x] 2.5 Add a standalone output shape check for unexpected top-level directories and excessive trace expansion.

## 3. Validation

- [x] 3.1 Run `rtk npx tsc --noEmit --pretty false`.
- [x] 3.2 Run `rtk npm run lint`.
- [x] 3.3 Run `rtk npm run test`.
- [x] 3.4 Run targeted course runtime and MDX content tests.
- [x] 3.5 Run `rtk npm run build` and confirm no Turbopack dynamic filesystem tracing warnings remain.
- [x] 3.6 Verify `.next/standalone` excludes non-runtime directories and the external `course-content/runtime` resource package while retaining required app metadata.
- [x] 3.7 Browser-check representative interactive course entry, teacher route, student route, knowledge card MDX, and handout print.
- [x] 3.8 Verify PDF export still returns a valid PDF for at least one runtime lesson.
- [x] 3.9 Run `rtk openspec validate reduce-turbopack-runtime-content-tracing-noise --strict`.
