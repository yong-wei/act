## Why

`xlsx@0.18.5` has high-severity advisories and no npm fix in the current package line. The affected import/export endpoints need a maintained spreadsheet library rather than a version bump.

## What Changes

- Replace SheetJS `xlsx` usage with maintained spreadsheet parser/writer packages. The implementation uses `read-excel-file` and `write-excel-file` because the initially preferred `exceljs` candidate still introduces an npm audit moderate finding through its dependency tree.
- Preserve current admin and teacher user import/template behavior.
- Add tests for the supported `.xlsx` file format, required headers, invalid rows, duplicate handling, numeric and blank cells, and generated template shape.
- Remove `xlsx` from dependencies after replacement.

## Capabilities

### New Capabilities
- `dependency-vulnerability-catalog`: Adds the replacement requirement for vulnerable spreadsheet import/export dependencies.

### Modified Capabilities
- None.

## Impact

- Affects `src/app/api/admin/users/import/route.ts`, `src/app/api/admin/users/template/route.ts`, and `src/app/api/teacher/classes/[classId]/students/import/route.ts`.
- Affects package dependencies and spreadsheet-related route tests.
- User-facing behavior should remain compatible for `.xlsx` templates and imports.
