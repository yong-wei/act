## Prisma 7 Migration Focus

Prisma 7 uses `prisma.config.ts` for CLI configuration such as datasource URL. Environment loading must be explicit when config files are used.

Current repository behavior includes:

- `schema.prisma` datasource URLs using `env("DATABASE_URL")` and `env("SHADOW_DATABASE_URL")`.
- Docker entrypoint running `prisma migrate deploy --schema ./prisma/schema.prisma`.
- Many scripts and workers constructing `new PrismaClient()`.
- Docker environment pinning Prisma query engine library path.

## Validation Focus

The change must validate:

- `prisma generate`.
- `prisma migrate deploy` in the production entrypoint model.
- Local database scripts that use PrismaClient.
- Worker database access.
- Existing fallback behavior when local `DATABASE_URL` is absent in tests that intentionally allow it.
