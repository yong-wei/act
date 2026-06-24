## Why

React Doctor reports App Router boundary warnings that map to real rendering risks: `useSearchParams` without Suspense, client fetches for server-owned route data, missing route metadata, and sequential independent awaits. These findings are concentrated in interactive course student routes, assessment pages, and migrated learning entry pages.

## What Changes

- Standardize query parameter handling for App Router pages that render client student/runtime components.
- Move server-owned route data loading out of client effects where route data is available on the server.
- Add route metadata or metadata conventions for owned pages covered by this change.
- Parallelize independent server awaits where auth and content loading are independent.

## Capabilities

### New Capabilities

- `app-router-rendering-boundary-safety`: define App Router query, server data, metadata, and async rendering boundary contracts.

## Impact

- Affects App Router pages under interactive learning, assessment, evaluation, and selected migrated secondary routes.
- Does not change lesson content, scoring semantics, or runtime module contracts.
