## Why

Prisma is the database runtime and migration tool for the application, workers, seeds, and deployment entrypoints. Prisma 7 changes configuration expectations and must be handled independently from UI/framework package upgrades.

## What Changes

- Upgrade `prisma` and `@prisma/client` to the selected latest stable Prisma 7 line.
- Introduce or update Prisma configuration required by Prisma 7.
- Preserve PostgreSQL datasource behavior, migration deployment, generated client output, Docker runtime assumptions, and local database scripts.
- Keep Next, React, Tailwind, and visualization package upgrades out of scope.

## Capabilities

### Modified Capabilities
- `stable-dependency-chain-migration`: Requires database runtime upgrades to validate local, script, worker, and production migration behavior.

## Impact

- Affects Prisma schema/config, generated client behavior, Docker entrypoint migration commands, database scripts, workers, and tests using PrismaClient.
- Requires database-backed validation in addition to normal build and test checks.
