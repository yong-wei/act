# Next Major Upgrade Readiness

Date: 2026-06-01
Branch: `prepare-next-major-upgrade`
Base branch: `migration/audit-vulnerabilities`
OpenSpec change: `prepare-next-major-upgrade`

## Scope

This readiness pass prepares the repository for later Next 15 and Next 16 validation changes. It does not upgrade the installed Next major version.

Current framework and tooling state:

- `next`: `^14.2.35`
- `eslint-config-next`: `^14.2.35`
- `eslint`: `^8.48.0`
- Build command: `next build` through `npm run build`
- Runtime packaging: `output: 'standalone'`

## Compatible Changes Applied

### Lint Entry

`package.json` now uses the ESLint CLI:

```json
"lint": "eslint . --max-warnings=0"
```

Rationale:

- Next 16 removes `next lint`.
- `next build` must not be treated as an implicit lint gate for the migration.
- The existing `.eslintrc.json` remains the transitional configuration and still extends `next/core-web-vitals`.

### Image Configuration

`next.config.js` now uses `images.remotePatterns` instead of `images.domains` for the existing localhost allowlist:

```js
images: {
  remotePatterns: [
    {
      protocol: 'http',
      hostname: 'localhost',
    },
    {
      protocol: 'https',
      hostname: 'localhost',
    },
  ],
}
```

Rationale:

- This is compatible with the current Next 14 line.
- It preserves the previous localhost allowlist across HTTP and HTTPS.
- It removes a known image-config migration item before the framework upgrade.

## Official Migration Rules Used

- Next 15: App Router `params` and `searchParams` become asynchronous dynamic APIs and should be awaited in server components and route handlers.
- Next 15: `GET` route handlers are no longer cached by default; static handlers should opt in with `dynamic = 'force-static'`, while dynamic handlers should stay explicit.
- Next 16: `next lint` is removed; ESLint should be invoked directly.
- Next 16: `middleware.ts` is renamed toward `proxy.ts`; this repository currently has no `middleware.*` or `proxy.*` file to migrate.

## Route Parameter Inventory

### Already Next 15 Ready

These server pages already type `params` as a Promise and await it:

- `src/app/teacher/classes/[classId]/analytics/page.tsx`
- `src/app/teacher/lesson-plans/[id]/edit/page.tsx`

Client components using `useParams` or `useSearchParams` are not part of the server-prop async migration:

- `src/app/(auth)/login/page.tsx`
- `src/app/(main)/teacher/students/[studentId]/diagnosis/page.tsx`
- `src/app/assessment/adaptive-practice/page.tsx`
- `src/app/classroom/join/page.tsx`
- `src/app/evaluation/prompt-assessment/page.tsx`
- `src/app/interactive-learning/chapter-components/[category]/page.tsx`
- `src/app/interactive-learning/resources/[id]/page.tsx`
- `src/app/teacher/classes/[classId]/analytics-v2/page.tsx`
- `src/app/teacher/classes/[classId]/page.tsx`
- `src/app/teacher/classes/[classId]/students/[studentId]/page.tsx`

### Server Page Props To Migrate In Next 15

These files synchronously read `params` or `searchParams` and should be converted during the Next 15 validation change:

- `src/app/(main)/teacher/students/[studentId]/evidence/page.tsx`
- `src/app/admin/lesson-plans/[id]/edit/page.tsx`
- `src/app/arena/challenges/[taskId]/page.tsx`
- `src/app/classroom/student/[sessionId]/page.tsx`
- `src/app/classroom/teacher/[sessionId]/page.tsx`
- `src/app/classroom/teacher/[sessionId]/review/page.tsx`
- `src/app/interactive-learning/control-workbench/page.tsx`
- `src/app/interactive-learning/lessons/[lessonId]/handout-print/page.tsx`
- `src/app/interactive-learning/multi-representation-linkage/page.tsx`
- `src/app/playlists/[id]/play/page.tsx`
- `src/app/simulations/cruise/page.tsx`
- `src/app/teacher/arena/publications/[publicationId]/page.tsx`
- `src/app/teacher/classes/[classId]/students/[studentId]/evidence/page.tsx`

The interactive course runtime has a repeated `params.sessionId` pattern under:

- `src/app/interactive-learning/courses/cruise-comfort-boppps/{student,teacher}/[sessionId]/page.tsx`
- `src/app/interactive-learning/courses/unit-2-1-modeling-language/{student,teacher}/[sessionId]/page.tsx`
- `src/app/interactive-learning/courses/unit-2-2-time-domain-response/{student,teacher}/[sessionId]/page.tsx`
- `src/app/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/{student,teacher}/[sessionId]/page.tsx`
- `src/app/interactive-learning/courses/unit-2-4-nyquist-margin-entry/{student,teacher}/[sessionId]/page.tsx`
- `src/app/interactive-learning/courses/unit-3-1-pure-pole-stability-and-dynamics/{student,teacher}/[sessionId]/page.tsx`
- `src/app/interactive-learning/courses/unit-3-2-routh-stability-boundary/{student,teacher}/[sessionId]/page.tsx`
- `src/app/interactive-learning/courses/unit-3-3-root-locus-rules/{student,teacher}/[sessionId]/page.tsx`
- `src/app/interactive-learning/courses/unit-3-4-root-locus-reading-validation/{student,teacher}/[sessionId]/page.tsx`
- `src/app/interactive-learning/courses/unit-3-5-zero-dynamic-improvement/{student,teacher}/[sessionId]/page.tsx`
- `src/app/interactive-learning/courses/unit-3-6-zero-design-workshop/{student,teacher}/[sessionId]/page.tsx`
- `src/app/interactive-learning/courses/unit-3-7-steady-error-low-frequency-compensation/{student,teacher}/[sessionId]/page.tsx`
- `src/app/interactive-learning/courses/unit-3-8-frequency-domain-translation-judgment/{student,teacher}/[sessionId]/page.tsx`
- `src/app/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/{student,teacher}/[sessionId]/page.tsx`
- `src/app/interactive-learning/courses/unit-4-1-design-task-expression/{student,teacher}/[sessionId]/page.tsx`
- `src/app/interactive-learning/courses/unit-4-2-controller-selection-first-start/{student,teacher}/[sessionId]/page.tsx`
- `src/app/interactive-learning/courses/unit-4-3-initial-scheme-practice-first-validation/{student,teacher}/[sessionId]/page.tsx`
- `src/app/interactive-learning/courses/unit-4-4-fixed-structure-optimization-modeling/{student,teacher}/[sessionId]/page.tsx`
- `src/app/interactive-learning/courses/unit-4-5-constraint-aware-parameter-optimization/{student,teacher}/[sessionId]/page.tsx`
- `src/app/interactive-learning/courses/unit-4-6-fixed-structure-boundary-structural-encoding/{student,teacher}/[sessionId]/page.tsx`
- `src/app/interactive-learning/courses/unit-4-7-destroyer-hifi-design-closure/{student,teacher}/[sessionId]/page.tsx`
- `src/app/interactive-learning/courses/unit-5-1-linear-backbone-boundaries/{student,teacher}/[sessionId]/page.tsx`
- `src/app/interactive-learning/courses/unit-5-2-nonlinear-analysis-entry/{student,teacher}/[sessionId]/page.tsx`
- `src/app/interactive-learning/courses/unit-5-3-mass-coordination-chain/{student,teacher}/[sessionId]/page.tsx`
- `src/app/interactive-learning/courses/unit-5-4-data-driven-mpc-transition/{student,teacher}/[sessionId]/page.tsx`
- `src/app/interactive-learning/courses/unit-5-5-policy-learning-entry-risk/{student,teacher}/[sessionId]/page.tsx`
- `src/app/interactive-learning/courses/unit-5-6-method-comparison-cold-chain/{student,teacher}/[sessionId]/page.tsx`

## Route Handler Inventory

Total scanned `GET` route handlers: 58.

Already explicit dynamic handlers: 52.

Handlers with synchronous route params that should be converted in the Next 15 validation change:

- `src/app/api/course-runtime/lessons/[lessonId]/handout-pdf/route.ts`
- `src/app/api/knowledge/nodes/[id]/route.ts`
- `src/app/api/lesson-plans/[id]/route.ts`
- `src/app/api/resources/[id]/route.ts`
- `src/app/api/session/[sessionId]/route.ts`
- `src/app/api/session/[sessionId]/state/route.ts`
- `src/app/api/session/[sessionId]/stream/route.ts`
- `src/app/api/teacher/classes/[classId]/dashboard/route.ts`
- `src/app/api/teacher/classes/[classId]/risk-students/route.ts`
- `src/app/api/teacher/classes/[classId]/sessions/route.ts`
- `src/app/course-runtime/[...assetPath]/route.ts`

Handlers already using async route params:

- `src/app/api/teacher/classes/[classId]/analytics/route.ts`
- `src/app/api/teacher/classes/[classId]/heatmap/route.ts`
- `src/app/api/teacher/classes/[classId]/insights/route.ts`
- `src/app/api/teacher/classes/[classId]/route.ts`
- `src/app/api/teacher/classes/[classId]/students/[studentId]/evidence/route.ts`
- `src/app/api/teacher/classes/[classId]/students/[studentId]/insights/route.ts`
- `src/app/api/teacher/classes/[classId]/students/route.ts`
- `src/app/api/teacher/students/[studentId]/evidence/route.ts`

## GET Cache Behavior

Most authenticated, database-backed, or request-sensitive GET handlers already declare `dynamic = 'force-dynamic'`.

Routes without explicit `dynamic`, `revalidate`, or response cache headers that need a decision in the Next 15 validation change:

- `src/app/api/admin/overview/route.ts`: admin dashboard summary; should be explicit dynamic.
- `src/app/api/admin/system-usage/route.ts`: admin usage aggregate; should be explicit dynamic.
- `src/app/api/admin/users/route.ts`: query-filtered admin user list; should be explicit dynamic.
- `src/app/api/admin/users/template/route.ts`: generated import template; choose `Cache-Control` if the template is intentionally cacheable, otherwise dynamic.
- `src/app/api/evaluation/prompt-history/[userId]/route.ts`: user-specific prompt history; should be explicit dynamic and async route params.

Routes with intentional response cache headers:

- `src/app/api/course-runtime/lessons/[lessonId]/handout-pdf/route.ts`
- `src/app/api/session/[sessionId]/stream/route.ts`
- `src/app/api/teacher/classes/[classId]/heatmap/route.ts`
- `src/app/course-runtime/[...assetPath]/route.ts`

## Middleware And Proxy

No `middleware.ts`, `middleware.js`, `proxy.ts`, or `proxy.js` file exists in this repository. No rename is required in this preparation change.

The Next 16 validation change should re-check this before upgrade, because new middleware/proxy files may be added before that point.

## Standalone Build And Deployment Assumptions

The repository currently relies on standalone output:

- `next.config.js`: `output: 'standalone'`
- `Dockerfile`: copies `.next/standalone` and starts `node server.js`
- `scripts/build.sh`: runs local `npm run build` before image export
- `docker-compose.yml` and Nginx config assume app port `3000`
- Podman deployment scripts set `PORT=3000` and `HOSTNAME=0.0.0.0`

The Next 15 validation change should keep these assumptions unchanged unless the framework upgrade changes standalone output structure.

## Validation Matrix For Next 15

Before merging the Next 15 upgrade:

- `rtk npm run lint`
- `rtk npm run build`
- `rtk npm run test:unit`
- `rtk npm run test`
- `rtk npm run test:integration` if the build passes and local browser dependencies are available
- Smoke GET handlers that cover admin dynamic data, course runtime cached assets, authenticated teacher class dashboards, and SSE session stream behavior

## Validation Matrix For Next 16

Before deciding whether Next 16 is required:

- Re-check `next lint` absence by running `rtk npm run lint`
- Re-check whether any `middleware.*` or `proxy.*` file exists
- Re-run the Next audit after Next 15 validation
- Re-run the standalone Docker image build path with `rtk bash scripts/build.sh`
- Confirm no new `images.domains` configuration has been reintroduced

## Deferred Work

The following work belongs to #243 `upgrade-next15-validation`:

- Convert server page `params` and `searchParams` to Promise-based props where needed.
- Convert route handler `params` to async segment data where needed.
- Add explicit dynamic/static/cache declarations for the listed undecided GET handlers.
- Validate runtime behavior under the actual Next 15 package.

The following work belongs to #244 `upgrade-next16-validation`:

- Decide whether Next 16 is required after the Next 15 audit.
- Re-check middleware/proxy naming if a middleware file exists then.
- Confirm the ESLint CLI entry remains the lint gate after `next lint` removal.

## Next 16 Validation Result

#244 evaluated Next 16 from the validated `next@15.5.18` baseline and closed with a not-required decision.

Evidence:

- The remaining audit state after #241 contains only 2 moderate findings: `next` and bundled `next/node_modules/postcss`.
- `npm audit` reports the `next` vulnerable range as `9.3.4-canary.0 - 16.3.0-canary.5`.
- `npm view next version dist-tags --json` reports stable `latest` as `16.2.6` and `backport` as `15.5.18`.
- `npm view next@16.2.6 dependencies.postcss --json` reports `8.4.31`, still below the advisory fixed range `>=8.5.10`.

Decision:

- Do not upgrade to Next 16 in this migration series, because stable Next 16.2.6 does not clear the remaining bundled PostCSS audit finding.
- Keep `next@15.5.18` and `eslint-config-next@15.5.18` as the validated deployment baseline.
- Let #245 own the temporary governance exception and removal trigger.

Reopen trigger:

- Re-evaluate Next 16 when a stable release outside the audit range is available, when the Next 15 backport line updates bundled PostCSS to a fixed version, or when npm audit points to a safe forward fix rather than the invalid `next@9.3.3` downgrade path.

## Next 15 Validation Result

OpenSpec change: `upgrade-next15-validation`

Selected framework line:

- `next`: `15.5.18`
- `eslint-config-next`: `15.5.18`
- `react`: `18.3.1`
- `react-dom`: `18.3.1`

Compatibility work completed:

- Converted App Router server `params` and `searchParams` usage to the Next 15 async request API with the official `@next/codemod` `next-async-request-api` transform, followed by manual fixes where build or tests exposed expectations.
- Converted route handler segment params to async segment data.
- Moved simulation route `next/dynamic({ ssr: false })` calls into `src/app/simulations/_components/simulation-loaders.tsx`, a client component boundary required by Next 15.
- Split client component resource registry usage from server metadata reads by adding `src/lib/resource-registry-metadata.ts`; API routes now read metadata without importing client-only dynamic components.
- Adjusted the commercial UI governance smoke gate so route type-only migrations check newly added visual-sensitive lines rather than re-failing unchanged page-local visual debt.
- Kept Next 16-only work out of scope. There is still no `middleware.*` or `proxy.*` file to rename.

Validation results:

- `rtk npm ls next eslint-config-next react react-dom --depth=0`: passed; confirmed `next@15.5.18`, `eslint-config-next@15.5.18`, `react@18.3.1`, `react-dom@18.3.1`.
- `rtk npm run lint`: passed.
- `rtk npm run build`: passed under Next `15.5.18`.
- `rtk npm run test`: passed; smoke, Arena route checks, and commercial UI governance gate are green.
- `rtk npm run test:unit`: failed with 13 existing interactive/data-governance assertions. No Next 15 migration-specific unit failure remains after updating the Arena publication page source assertion.
- Targeted auth/AI smoke checks: not separately run because no auth or AI route behavior was intentionally changed; async route-prop migration touched request segment handling and is covered by build plus route smoke tests.
- `rtk npm audit --json`: 17 remaining vulnerabilities, summarized in the audit baseline.

Known residual test debt from `rtk npm run test:unit`:

- Interactive manifest runtime expectations for 4-3, 4-4, 4-6, and 4-7.
- Interactive module taxonomy legacy alias expectations.
- Lesson entry knowledge-map ordering expectation.
- Dynamic-error guard expectation for `src/app/api/ai/intervention/check/route.ts`.
- Data-governance feature-cache status expectations.

These failures predate the Next 15 compatibility work and are not caused by dependency, route-param, or resource-registry changes in this validation change.

## Validation Results In This Change

- `rtk npx eslint . --max-warnings=0`: passed before changing the npm script.
- `rtk npm run lint`: passed with the new `eslint . --max-warnings=0` script.
- `rtk openspec validate prepare-next-major-upgrade --strict`: passed before task completion.
- `rtk npm run build`: failed after successful WASM build, Prisma generation, and Next compilation during type checking.

Current build blocker:

- `src/app/(main)/dashboard/page.tsx`: `dashboardEntryIntentGroups.flatMap(...)` can return an entry with `entry: null`, but the inferred array type expects `entry: PlatformRoleNavigationItem`.

This build blocker is not caused by the lint-script or image-config changes in this preparation pass. It should be fixed before or during the Next 15 validation change because Next major validation needs a green build baseline.
