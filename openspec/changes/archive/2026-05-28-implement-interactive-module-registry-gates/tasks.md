## 1. Registry

- [x] 1.1 Add a canonical module definition registry for all standard module classes.
- [x] 1.2 Add a central legacy alias map for current historical module kinds.
- [x] 1.3 Mark each alias with replacement module class and replacement fields.

## 2. Gates

- [x] 2.1 Add a manifest scan that reports unregistered module kinds by lesson, step, and module id.
- [x] 2.2 Add migrated-lesson checks that reject legacy aliases after a lesson is migrated.
- [x] 2.3 Add checks for activity modules without a valid response contract and compute modules without capability references.

## 3. Verification

- [x] 3.1 Run the new module registry gate.
- [x] 3.2 Run `npm run test:course-data-quality-gates`.
- [x] 3.3 Run `openspec validate implement-interactive-module-registry-gates --strict`.
