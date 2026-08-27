# Migration, backfill, and competition toolchains

Isolated command boundary for `scripts/migrations`, `scripts/db`, `evaluate`,
and competition baseline helpers. Dry-run is the default. Apply requires a
fixture approval token, matching plan/input hash, and a `fixture:` target; this
change never executes a write.

Product TypeScript modules must not import these writers. Existing `db:*` and
`migrate:*` package scripts remain compatibility entries until callers use
`migration-backfill:check` / `migration-backfill:apply` and the old path can be
archived.

Canonical backfill semantics stay in `course-evidence-backfill-reporting`.
Competition public-material semantics stay in `competition-demo-baseline`.
