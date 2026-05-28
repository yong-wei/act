## 1. Registry

- [ ] 1.1 Add a canonical module definition registry for all standard module classes.
- [ ] 1.2 Add a central legacy alias map for current historical module kinds.
- [ ] 1.3 Mark each alias with replacement module class and replacement fields.

## 2. Gates

- [ ] 2.1 Add a manifest scan that reports unregistered module kinds by lesson, step, and module id.
- [ ] 2.2 Add migrated-lesson checks that reject legacy aliases after a lesson is migrated.
- [ ] 2.3 Add checks for activity modules without a valid response contract and compute modules without capability references.

## 3. Verification

- [ ] 3.1 Run the new module registry gate.
- [ ] 3.2 Run `npm run test:course-data-quality-gates`.
- [ ] 3.3 Run `openspec validate implement-interactive-module-registry-gates --strict`.
