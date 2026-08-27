# Isolated migration/backfill/competition commands

`npm run migration-backfill:check` inventories and fail-closes product imports.
`npm run migration-backfill:apply` only evaluates the approval/plan-hash gate
and never mutates data.
