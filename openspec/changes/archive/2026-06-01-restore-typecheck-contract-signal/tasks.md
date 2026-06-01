## 1. Typecheck Restoration

- [x] 1.1 Repair Next route/page param test fixtures to match current promise-shaped signatures.
- [x] 1.2 Repair Arena and control-workbench fixtures to include required runtime fields.
- [x] 1.3 Repair adaptive assessment transaction mock typing without weakening persistence contracts.
- [x] 1.4 Repair teacher auth, Konling, and data-governance type fixture drift.
- [x] 1.5 Adjust TypeScript target/lib only if the supported runtime contract requires modern APIs.

## 2. Validation

- [x] 2.1 Run `rtk npx tsc --noEmit --pretty false`.
- [x] 2.2 Run targeted unit tests for any source helper changed.
- [x] 2.3 Validate with `rtk openspec validate restore-typecheck-contract-signal --strict`.
