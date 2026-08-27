# Handoff

This change creates the isolated command gate. It does not apply migrations,
backfill user data, or change production selectors.

Canonical semantics remain:
- `course-evidence-backfill-reporting`
- `competition-demo-baseline`

Old `db:*` / `migrate:*` scripts are compatibility entries with retirement
condition `callers-use-isolated-cli-then-archive-or-delete`.
