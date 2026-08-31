# Migration, backfill, and competition toolchains

Isolated command boundary for `scripts/migrations`, `scripts/db`, `evaluate`,
and competition baseline helpers. `migration-backfill:dry-run` emits a per-command
plan whose input/plan hash covers command identity, safety mode, and the Git
blob. Apply requires a clean worktree, an explicit command path, `ACT_APPLY_APPROVAL`,
`ACT_APPLY_PLAN_HASH` matching that command hash, and a `fixture:` target; this
change never executes a write. Database scripts default to apply-gated except
explicit parsers, dry-run, report, verify, and compute helpers.

Product TypeScript modules must not import these writers. Apply-gated `db:*`,
`seed:*`, and `migrate:*` package scripts route through `migration-backfill:apply`
and do not execute the historical writers. Local writes use `node` or `npx tsx`
on the `scripts/db/` file after the target identity is confirmed, matching
`.cursor/start.sh`. The committed inventory binds source revision, captured tree,
command set, safety classification, and content hashes; drift fails closed.

Canonical backfill semantics stay in `course-evidence-backfill-reporting`.
Competition public-material semantics stay in `competition-demo-baseline`.
