# Verification Evidence

## Contract and static validation

- `bash -n scripts/build.sh`: passed.
- Docker migration readiness, runtime externalization, local container cache, optimized-model, runtime-blob deployment, remote deploy, and runtime-release remote deploy contracts: passed.
- `openspec validate remove-duplicate-host-next-build --type change --strict`: passed.
- `npm run typecheck`: TypeScript compiler passed for web and worker; worker graph status passed. The web graph retained the pre-existing recorded boundary status `blocked` for documentation/tooling imports, while the command exited successfully under the repository's current receipt contract.

The script contract rejects host `npm run build`, direct host Next compilation, and host `.next` cleanup/generation while retaining Dockerfile `npm run build` as the production compiler.

## Full app-only release image acceptance

- Revision: `3343472cd3a5c2d2ecbe10ea30430bd4aa4f4b31`.
- Output and log root: `/tmp/act-no-host-next-acceptance.JMzwL5`.
- The host phase executed Prisma validate/generate, optimized-model validation, and production TypeScript validation, then proceeded directly to Docker; it did not invoke Next or produce a host `.next` build.
- Image tar SHA-256: `b05cbf426526a327e4717cd2a5698c7ff65f4199f040e17054a3ef0e4b34bd66`.
- Provenance and OCI revision label matched the committed revision and tar digest.
- Container smoke: Chromium 151.0.7922.173, LibreOffice 7.4.7.2, and `/app/.app-revision` matched.
- Deployment: not performed.

Independent review of `05d495e..working tree` found no new P0/P1 issue before the acceptance commit. The reviewer identified this full build as the only remaining blocking verification; it is now complete.
