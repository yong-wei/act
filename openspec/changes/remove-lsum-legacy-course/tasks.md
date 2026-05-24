## 1. Course Deletion

- [ ] 1.1 Delete `/interactive-learning/courses/lsum-design-feasible-domain` route files.
- [ ] 1.2 Delete LSUM feature components and course constants that have no active consumer.
- [ ] 1.3 Remove LSUM AI context, preset, catalog, and session snapshot registrations.

## 2. Test Updates

- [ ] 2.1 Update tests that currently expect LSUM to exist.
- [ ] 2.2 Add or preserve assertions that LSUM is absent from catalog, presets, AI contexts, and route helpers.

## 3. Verification

- [ ] 3.1 Run focused tests matching `lsum-design-feasible-domain`.
- [ ] 3.2 Run `npm run lint`.
