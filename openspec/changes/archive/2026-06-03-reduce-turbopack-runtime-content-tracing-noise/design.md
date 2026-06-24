## Context

Next.js 16 uses Turbopack by default for both development and production builds. The current build succeeds, but Turbopack reports dynamic filesystem tracing warnings for course runtime content reads. The repository also uses `output: 'standalone'`, so tracing warnings affect deployment signal, not only console readability.

The current warning path is concentrated in three modules:

```text
src/app/api/content/mdx/route.ts
  query path -> path.resolve(process.cwd(), sanitizedPath) -> fs.readFile

src/lib/course-runtime.ts
  lesson metadata -> project-relative runtime paths -> path.join(process.cwd(), dynamicPath)

src/app/interactive-learning/lessons/[lessonId]/handout-print/page.tsx
  runtime.handoutSourcePath -> path.join(process.cwd(), dynamicPath) -> fs.readFile
```

The affected surface is broader than those files because `loadLessonRuntimeEntry()` is used by interactive course entry pages, student and teacher routes, tests, handout print, and PDF export. The content footprint is large: `course-content/runtime` contains roughly 1,486 files and about 503 MB locally, while `.next/standalone` currently includes broad project directories and is about 2.6 GB after build.

## Goals / Non-Goals

**Goals:**

- Remove Turbopack dynamic filesystem tracing warnings from the production build.
- Keep Next.js 16 Turbopack as the default build path rather than reverting to webpack.
- Preserve interactive course runtime behavior, knowledge card MDX rendering, handout print, and PDF export.
- Reduce standalone trace expansion by excluding directories that are not production runtime inputs.
- Add regression checks that fail when tracing warnings or unexpected standalone directories return.

**Non-Goals:**

- Do not redesign the course authoring or export pipeline.
- Do not move course content out of the repository.
- Do not change lesson IDs, public course URLs, or runtime JSON schema beyond path normalization needed for traceability.
- Do not suppress warnings with `turbopack.ignoreIssue` as the primary fix.

## Decisions

### Decision 1: Introduce a server-side runtime content path boundary

Create or extend a server-only helper that resolves content paths through named roots:

```text
runtime-root      -> course-content/runtime
runtime-lessons   -> course-content/runtime/lessons
runtime-knowledge -> course-content/runtime/knowledge
content-root      -> content
```

The helper should accept only validated relative paths inside those roots and return absolute paths only after the root has been selected. It should reject path traversal and project-root-relative arbitrary input.

Rationale: Turbopack can reason about fixed roots more reliably than `path.join(process.cwd(), dynamicPath)`. It also makes the security boundary explicit for `/api/content/mdx`.

Alternative considered: keep current code and add `turbopack.ignoreIssue`. That would hide warnings but leave `.next/standalone` over-tracing unresolved.

### Decision 2: Normalize runtime metadata paths at the application boundary

When `lesson.json` supplies `handout_source_path`, `media_index_source_path`, `interactive_manifest_source_path`, or similar fields, normalize them into root-relative runtime paths before reads. Existing project-relative values such as `course-content/runtime/lessons/4-1/4-1-handout.md` can remain accepted during migration, but the read path should flow through the same runtime-root helper.

```text
lesson.json field
   |
   | accept current project-relative form
   v
normalize to runtime relative path
   |
   v
resolve under RUNTIME_ROOT
```

Rationale: This avoids a risky content regeneration requirement while still making runtime reads traceable and enforceable.

### Decision 3: Configure standalone tracing after path narrowing

Use `outputFileTracingIncludes` and `outputFileTracingExcludes` only after runtime path reads are narrowed. Includes should cover required application metadata and public `content/` inputs. Excludes should remove non-runtime directories currently observed in standalone output, such as authoring sources, the external `course-content/runtime` resource package, docs, tests, OpenSpec artifacts, Rust source/build directories, generated image workspaces, and local notes.

Rationale: Next.js output tracing configuration is the right deployment boundary tool, but it should reinforce code-level boundaries rather than compensate for arbitrary project-root reads. Production deployment already supplies `course-content/runtime` through a read-only Podman mount, so the standalone image should not embed that teaching resource package.

### Decision 4: Validate with artifact metrics, not only build success

The change should compare before/after build output:

- `npm run build` exits 0 and has no Turbopack dynamic tracing warnings.
- `.next/standalone` no longer contains unexpected top-level directories.
- representative `.nft.json` files for course routes and `/api/content/mdx` no longer trace thousands of broad project files or the external runtime resource package.
- key content routes still render in browser checks.

Rationale: A passing build can still produce a poor standalone bundle. The issue being solved is build/deployment signal quality.

## Risks / Trade-offs

- Path normalization can reject valid existing lesson content paths. Mitigation: support current project-relative runtime/content prefixes during migration and add tests for representative lesson JSON fields.
- Over-aggressive tracing excludes can break production standalone content reads if the runtime mount is missing. Mitigation: keep deployment checks for the `/app/course-content/runtime:ro` mount and validate representative routes with local runtime content present.
- Removing broad tracing can reveal missing explicit includes. Mitigation: inspect `.nft.json` for required application metadata and add targeted includes without embedding the external runtime resource package.
- Browser-only MDX consumers may depend on `/api/content/mdx` accepting broad paths. Mitigation: keep `content/` and `course-content/runtime/` as allowed roots and add negative traversal tests.
