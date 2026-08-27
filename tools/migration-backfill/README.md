# Isolated migration/backfill/competition commands

`npm run migration-backfill:check` inventories commands, fail-closes product
imports, and rejects ungated apply-capable npm scripts or a drifted inventory.
`npm run migration-backfill:dry-run -- <path>` emits a content-bound plan hash.
`npm run migration-backfill:apply -- <path>` only evaluates the
approval/plan-hash gate and never mutates data.
