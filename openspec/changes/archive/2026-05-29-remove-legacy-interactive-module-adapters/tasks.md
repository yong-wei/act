## 1. Preflight

- [x] 1.1 Confirm early, variant-heavy, and stable migration changes are archived.
- [x] 1.2 Confirm every existing runtime-first lesson is listed in the standard-module migration inventory.

## 2. Strict Gates

- [x] 2.1 Remove or disable alias-tolerant validation for migrated and new manifests.
- [x] 2.2 Make unregistered module class, response kind, and compute capability references hard failures.
- [x] 2.3 Remove lesson-private alias-only registry entries.

## 3. Documentation and Verification

- [x] 3.1 Update interactive lesson implementation guidance to require canonical modules for new lessons.
- [x] 3.2 Run strict module, response, submission, and finalization gates.
- [x] 3.3 Run focused interactive lesson tests.
- [x] 3.4 Run `openspec validate remove-legacy-interactive-module-adapters --strict`.
