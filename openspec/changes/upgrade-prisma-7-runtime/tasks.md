## 1. Prisma Upgrade

- [ ] 1.1 Upgrade `prisma` and `@prisma/client` to the selected latest stable Prisma 7 line.
- [ ] 1.2 Add or update `prisma.config.ts` and explicit environment loading.
- [ ] 1.3 Update Docker entrypoint migration commands for Prisma 7 configuration.
- [ ] 1.4 Verify generated client output and query engine configuration for the deployed Alpine/musl runtime.

## 2. Database Validation

- [ ] 2.1 Run `rtk npx prisma generate`.
- [ ] 2.2 Run `rtk npx tsc --noEmit --pretty false`.
- [ ] 2.3 Run `rtk npm run test`.
- [ ] 2.4 Run `rtk npm run test:unit`.
- [ ] 2.5 Run database governance scripts such as `rtk npm run db:session-data-quality` and `rtk npm run db:evidence-source-coverage` when local database prerequisites are available.
- [ ] 2.6 Validate production migration behavior through Docker/Podman entrypoint checks or document unavailable prerequisites.

## 3. OpenSpec Validation

- [ ] 3.1 Run `rtk openspec validate upgrade-prisma-7-runtime --strict`.
