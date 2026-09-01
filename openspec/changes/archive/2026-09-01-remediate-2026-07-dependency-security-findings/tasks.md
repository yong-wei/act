## 1. Freeze the remediation baseline

- [x] 1.1 Record the base commit, Node/npm versions, configured registry, reproducible official-registry audit command, direct dependency ranges, lockfile state, raw audit summary, advisory identifiers, runtime relevance, deprecated-package warnings, and current governance matches.
- [x] 1.2 Record `npm ls` ownership paths for every in-scope direct and transitive finding and assign each path to the framework/auth, Prisma, image-processing, or tooling lane.
- [x] 1.3 Verify candidate versions from the registry and document which findings have a supported current-major fix versus a separate-change residual.

## 2. Apply compatible dependency updates

- [x] 2.1 Update the Next 16 and NextAuth v4 lanes only to supported compatible releases, preserving the existing framework and credentials/JWT contracts.
- [x] 2.2 Update Prisma CLI/client on the Prisma 7 line and use a transitive override only if parent compatibility, narrow dependency-tree impact, registry availability, and a removal condition are all proven.
- [x] 2.3 Update Sharp and other directly owned compatible dependency paths needed to remove current image-processing or tooling findings without crossing package major lines.
- [x] 2.4 Regenerate the lockfile through npm, verify `npm ci`, and confirm `npm ls` contains no invalid, extraneous, or unintended overridden production path.

## 3. Verify affected contracts

- [x] 3.1 Run targeted NextAuth tests for credentials success/failure, JWT encode/decode, custom session fields, server session retrieval, and protected-route authorization.
- [x] 3.2 Build a disposable PostgreSQL database from the existing migration history, run the documented `prisma migrate deploy --config ./prisma.config.ts` and `prisma migrate status` commands from the candidate image, and verify zero schema drift without touching shared/production databases or adding migration files.
- [x] 3.3 Run representative image-processing and smart-courseware/PDF rendering checks for the updated Sharp dependency path.
- [x] 3.4 Run `npm run test:docker-migration-readiness`, `node scripts/tests/test-remote-deploy-script.mjs`, typecheck, lint, default tests, and unit tests on the final intended revision.
  Residual: `test-remote-deploy-script.mjs` still expects `npm run seed:knowledge`; that mismatch already exists on `origin/integration`. `test-docker-migration-readiness` covers the current `seed-all-knowledge.mjs` command.
- [x] 3.5 Build the Linux/amd64 release image through `bash scripts/build.sh`, record its immutable image ID/digest and artifact SHA256, then use that exact image with disposable PostgreSQL/Redis to start the app, data-governance worker, and scheduler and verify Prisma, Sharp/PDF, public, authenticated, and protected browser paths.

## 4. Reconcile audit governance

- [x] 4.1 Capture the final raw audit and dependency-tree evidence, listing resolved, remaining, and newly introduced findings against the frozen baseline.
- [x] 4.2 Remove all stale or resolved allowlist entries and update the audit governance documentation to match the final committed lockfile.
- [x] 4.3 For an irreducible baseline moderate or development-only high finding, create a dedicated owner issue and add only an exact, time-bounded package/advisory/path exception with a review date, removal condition, and release-blocking decision.
- [x] 4.4 Reject the revision if any newly introduced moderate-or-higher finding or any unresolved baseline critical or production-runtime high finding remains; neither category may be allowlisted by this batch.
- [x] 4.5 Remove or govern every deprecated-package warning with the existing exact owner-lane, review/expiry, removal-condition, and release-blocking fields.
- [x] 4.6 Run the dependency audit governance tests, including the new-finding and release-blocking severity cases, and `npm run audit:governance`; reject the revision if either fails.
- [ ] 4.7 Close #291 only after both `npm ls` and `npm audit` prove that the Prisma-owned Hono advisory path is absent.

## 5. Final release evidence

- [x] 5.1 Record the selected versions, per-lane verification results, final audit/deprecation state, residual owner links, candidate image digest, retained previous image digest, and production compatibility conclusion.
- [x] 5.2 Confirm the implementation created no Prisma schema migration, data backfill, authentication contract change, package major migration, or unrelated dependency refresh.
- [x] 5.3 Produce a deployment handoff that preserves the existing PostgreSQL/Redis containers and volumes and rolls app, worker, and scheduler together between immutable images; do not execute production deployment as part of this change.
