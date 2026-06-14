# App Router Boundary Evidence

Change: `stabilize-app-router-query-boundaries`

## Representative Student Route Pattern

The repeated interactive student route pattern was represented by:

- `src/app/interactive-learning/courses/unit-1-1-see-the-full-picture/student/[sessionId]/page.tsx`
- `src/app/interactive-learning/courses/unit-2-1-modeling-language/student/[sessionId]/page.tsx`

Both routes now own `searchParams` at the App Router boundary, resolve the `step` query through
`src/features/interactive/shared/student-route-query.ts`, and pass `demoStepId` into the client student page as a stable primitive prop.

The corresponding client pages no longer import `useSearchParams`:

- `src/features/interactive/unit-1-1-see-the-full-picture/student-page.tsx`
- `src/features/interactive/unit-2-1-modeling-language/student-page.tsx`

Redirect ordering remains before auth/runtime loading. After the inactive-session redirect check, `getServerSession(authOptions)` and `loadLessonRuntimeEntry(...)` are loaded with `Promise.all`.

## Metadata Scope

The two remediated representative student routes now expose explicit route metadata:

- `看见控制全貌 - 学生互动课`
- `建模语言 - 学生互动课`

The remaining metadata warnings are outside this representative route patch and are left for later route-family sweeps.

## Client Fetch Scope

This change moved the route-owned chapter component catalog data load out of client effects for:

- `src/app/interactive-learning/chapter-components/page.tsx`
- `src/app/interactive-learning/chapter-components/[category]/page.tsx`

Both pages now load resource data server-side through `src/features/interactive/chapter-component-resources.ts` and pass initial data to client presentation children.

After evidence still contains route/client fetch warnings outside this representative migration:

- `src/app/assessment/adaptive-practice/page.tsx`
- `src/app/page.tsx`
- `src/app/interactive-learning/resources/[id]/page.tsx`
- `src/app/interactive-learning/cross-domain-exploration/page.tsx`

The remaining pages require separate route-family loading-state review and are not broadened into this patch.

## React Doctor Warning Delta

See `app-router-boundary-delta.json`.

- Target warning total: 285 -> 271.
- `nextjs-no-use-search-params-without-suspense`: 36 -> 32.
- `nextjs-no-client-fetch-for-server-data`: 6 -> 4.
- `nextjs-missing-metadata`: 153 -> 149.
- `server-sequential-independent-await`: 66 -> 64.
- `no-fetch-in-effect`: 24 -> 22.
