## Context

Representative findings:

- `nextjs-no-use-search-params-without-suspense`: 36.
- `nextjs-no-client-fetch-for-server-data`: 6.
- `no-fetch-in-effect`: 24, including route data fetches.
- `nextjs-missing-metadata`: 153.
- `server-sequential-independent-await`: 66.

Interactive course student pages share a pattern: the server route resolves session/runtime data, then returns a client student page that calls `useSearchParams()` for `step`. The route page itself is then flagged because the client query boundary is not explicit.

## Decisions

1. Prefer server-parsed query props for student route entry.
   - Server pages should read `searchParams` where possible and pass primitive values into client pages.
   - Suspense wrappers are acceptable only when client-side query reads are intentionally retained.

2. Move route-owned fetches to server pages.
   - Learning entry pages that fetch static route data in effects should become server-data entry pages with client presentation children where feasible.

3. Metadata is route-family governance.
   - Repeated runtime routes may share metadata helpers rather than each page hand-writing strings.

4. Parallel awaits must preserve redirect/auth ordering.
   - Independent content/auth loads may use `Promise.all`.
   - Redirect decisions that depend on previous values must stay sequential.

## Risks

- Moving query parsing across server/client boundaries can change demo step selection if not covered by tests.
- Moving client fetches to server pages can alter loading states; route-level loading UI may need explicit preservation.
