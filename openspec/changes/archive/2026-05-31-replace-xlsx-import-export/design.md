## Context

The audit reports high-severity `xlsx` findings with `fixAvailable: false`. Since the package cannot be patched through npm, the correct remediation is replacement plus route-level regression tests.

## Replacement Strategy

- Use a maintained library with active npm releases and server-side workbook read/write support.
- Use `read-excel-file` for server-side workbook parsing and `write-excel-file` for template generation. `exceljs` was evaluated but avoided because `npm audit` reports a moderate `uuid` finding through `exceljs@4.4.0`.
- Keep generated template columns and response headers compatible with existing clients.
- Keep validation messages in Chinese and aligned with existing route behavior.
- Avoid broad import workflow redesign; this change is a security replacement, not a new roster-management feature.
- Treat `.xlsx` as the supported workbook format. The old teacher-side `.xls` extension gate is removed because the replacement libraries intentionally cover OOXML `.xlsx` workflows, not legacy BIFF `.xls` content.

## Affected Surfaces

- Admin user template export.
- Admin user import.
- Teacher class student import.
- Package manifest and lockfile.

## Test Strategy

- Route-level tests or focused integration checks for valid workbooks.
- Negative tests for wrong extension, missing required fields, malformed workbook content, and duplicate rows where current behavior already handles them.
- Audit check confirming `xlsx` no longer appears in `package.json` or lockfile dependency tree.

## Risks

- Excel libraries differ in date, blank-cell, and sheet-range behavior. Tests must cover the exact columns consumed by existing routes.
- Import endpoints are data mutation surfaces. Keep validation and authorization behavior unchanged while replacing parsing internals.

## Verification

- Run targeted tests for the three routes.
- Run `rtk npm audit --json` to confirm the `xlsx` advisory is removed.
- Validate with `rtk openspec validate replace-xlsx-import-export --strict`.
