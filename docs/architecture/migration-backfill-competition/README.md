# Migration, backfill, and competition toolchains

Isolated command boundary for `scripts/migrations`, `scripts/db`, `evaluate`,
and competition baseline helpers. `migration-backfill:dry-run` emits a command
plan with input/plan hash. Apply requires a clean worktree, `ACT_APPLY_APPROVAL`,
`ACT_APPLY_PLAN_HASH` matching the recomputed input hash, and a `fixture:`
target; this change never executes a write. Database scripts default to
apply-gated except explicit parsers, dry-run, report, verify, and compute
helpers.

Product TypeScript modules must not import these writers. Existing `db:*` and
`migrate:*` package scripts remain compatibility entries until callers use
`migration-backfill:check` / `migration-backfill:apply` and the old path can be
archived.

Canonical backfill semantics stay in `course-evidence-backfill-reporting`.
Competition public-material semantics stay in `competition-demo-baseline`.
