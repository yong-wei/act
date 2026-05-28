## 1. Inventory

- [ ] 1.1 Enumerate current module kinds and course-local registry overrides for 4-1 through 5-6 and cruise-comfort.
- [ ] 1.2 Identify compute panels that require capability references or explicit migration exceptions.

## 2. Migration

- [ ] 2.1 Migrate module 4 lessons to canonical module classes.
- [ ] 2.2 Migrate module 5 lessons to canonical module classes.
- [ ] 2.3 Migrate cruise-comfort to canonical module classes.
- [ ] 2.4 Remove course-local alias-only registry overrides while preserving real capability renderers.

## 3. Verification

- [ ] 3.1 Run focused tests for module 4, module 5, and cruise-comfort lessons.
- [ ] 3.2 Run module registry and response gates.
- [ ] 3.3 Run `npm run test:course-data-quality-gates`.
- [ ] 3.4 Run `openspec validate migrate-stable-lessons-to-standard-modules --strict`.
