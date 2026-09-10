# September 2026 dependency remediation handoff

Issue: [#1032](https://github.com/yong-wei/act/issues/1032)
Change: `remediate-2026-07-dependency-security-findings`
Candidate revision: `8c8758e4ad5b879166283be645c2439725ec918b`

This batch does not deploy production. Roll app, worker, and scheduler
together onto the candidate image. Keep the existing PostgreSQL and Redis
containers and volumes. Do not `runtime:activate`, and do not restore the
database unless a later incident proves data corruption.

## Selected versions

| Lane | Resolution |
|---|---|
| next / eslint-config-next | `16.3.4` |
| NextAuth | `4.24.15` (unchanged) |
| prisma / `@prisma/client` / `@prisma/adapter-pg` | `7.10.0` |
| sharp | `0.35.4` |
| postcss | `8.5.23` |

Nested override: `@prisma/config` → `deepmerge-ts@8.0.2`. Remove when a
Prisma 7 release depends on `deepmerge-ts>=8`. Do not take Prisma 8.

## Candidate image

- Tag: `localhost/act-obe-platform:1032-next163-prisma710`
- Platform: `linux/amd64`
- Image ID: `sha256:acab1212a5a32b0a26d47f734c155d429f0a42bb45d9b437877ad60c8eb4e296`
- Tar: `deploy/images/act-obe-1032.tar`
- Tar SHA-256: `56423d7d73f23eb8be114e16518986f53475023b364037a4a4310012c7e48254`
- Provenance: `deploymentScope=app-only`
- Build: `BUILD_SCOPE=app-only bash scripts/build.sh`

Retained previous production application: `v0.6.1` (`93a70aed…`). Rollback is
the previous immutable app/worker/scheduler image on the same database and
Redis volumes.

## Disposable runtime evidence

Disposable PostgreSQL 16 and Redis 7 on Docker network `act-1032-net`. The
shared `act_obe` database was not used.

- `prisma migrate deploy --config ./prisma.config.ts` from the candidate
  image applied the existing 132 migrations and created none.
- `prisma migrate status` from the same image: database schema is up to date.
- App: Next.js `16.3.4` Ready; `/login` 200; unauthenticated `/teacher`
  redirects to `/login`; teacher and student credentials sessions succeed;
  authenticated `/teacher` and `/teacher/classes` render the teacher workbench.
- Worker: `tsx scripts/workers/data-governance-worker.ts` starts after the
  image packages `tsconfig.base.json` and `tsconfig.worker.json`. Disposable
  verification used `MATH_DOCUMENT_GRADING_WORKER_REQUIRED=false` because
  grading object-store secrets are production-only.
- Scheduler: `tsx scripts/workers/scheduler.ts` refreshed recurring jobs.
- Sharp `0.35.4` created an 8×8 PNG in the image. `pdf-lib` created a PDF.

## Audit and residuals

Official-registry `npm audit` on the committed lockfile: 0 findings.
`npm run audit:governance` passes. Allowlist security entries are empty.
Remaining owned deprecation: jsdom `whatwg-encoding@3.1.1` (#1033). Do not
close #1033.

Hono / `@hono/node-server` are absent from `npm ls`. Close #291 after merge.
Close #1035 with this batch (Next PostCSS / Sharp).

`node scripts/tests/test-remote-deploy-script.mjs` still asserts
`npm run seed:knowledge`. `origin/integration` already uses
`node scripts/db/seed-all-knowledge.mjs`; `test-docker-migration-readiness`
covers the current command. Do not change `remote-deploy.sh` in this batch.

Full Vitest has pre-existing failures unrelated to this lockfile (missing
gitignored infograph PNG, model-string fixtures, grade-route `force-dynamic`).
They are not residuals of this remediation.

## Production compatibility

Compatible on the current major lines. No Prisma schema migration, no
NextAuth v5, no jsdom major, no `npm audit fix --force`. Next 16.3 requires
`/*turbopackIgnore: true*/` on intentional runtime filesystem reads; keep
`scripts/build-next-with-trace-check.mjs` enabled.
