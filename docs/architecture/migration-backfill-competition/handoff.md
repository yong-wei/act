# Handoff

This change creates the isolated command gate. It does not apply migrations,
backfill user data, or change production selectors.

Canonical semantics remain:
- `course-evidence-backfill-reporting`
- `competition-demo-baseline`

Apply-gated `db:*` / `seed:*` / `migrate:*` package scripts now invoke the
isolated apply CLI and never execute the historical writer. Remaining script
files stay classified with retirement condition
`callers-use-isolated-cli-then-archive-or-delete`. Local `startup` skips
`seed:knowledge` and `seed:fixed-passwords` because those commands are
apply-gated and this change does not write.
