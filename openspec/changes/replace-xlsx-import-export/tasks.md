## 1. Replacement

- [ ] 1.1 Add the replacement spreadsheet dependency and remove `xlsx`.
- [ ] 1.2 Replace admin template generation while preserving workbook columns and headers.
- [ ] 1.3 Replace admin user import parsing while preserving authorization and validation behavior.
- [ ] 1.4 Replace teacher class student import parsing while preserving authorization and validation behavior.

## 2. Tests

- [ ] 2.1 Add valid workbook tests for all affected endpoints.
- [ ] 2.2 Add invalid workbook/header/row tests for import endpoints.
- [ ] 2.3 Verify generated templates can be read by the new parser.

## 3. Validation

- [ ] 3.1 Run targeted route tests.
- [ ] 3.2 Run `rtk npm audit --json` and confirm `xlsx` findings are gone.
- [ ] 3.3 Validate with `rtk openspec validate replace-xlsx-import-export --strict`.
