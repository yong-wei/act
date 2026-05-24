## 1. Route Removal

- [x] 1.1 Delete remaining `src/app/interactive-learning/lesson-*` route directories.
- [x] 1.2 Remove route metadata, imports, redirects, and direct links that only serve retired `lesson-*` pages.
- [x] 1.3 Confirm active unit course routes under `/interactive-learning/courses/*` remain addressable.

## 2. Catalog And Tests

- [x] 2.1 Remove retired one-page lessons from catalog groupings and derived lists.
- [x] 2.2 Update tests that expected old one-page routes to use canonical unit course routes or to assert retirement.
- [x] 2.3 Add a guard that fails on `/interactive-learning/lesson-` catalog links or App Router directories.

## 3. Verification

- [x] 3.1 Run the focused interactive catalog/route tests.
- [x] 3.2 Run `npm run lint`.
