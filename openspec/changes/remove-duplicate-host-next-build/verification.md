# Verification Evidence

## Contract and static validation

- `bash -n scripts/build.sh`: passed.
- Docker migration readiness, runtime externalization, local container cache, optimized-model, runtime-blob deployment, remote deploy, and runtime-release remote deploy contracts: passed.
- `openspec validate remove-duplicate-host-next-build --type change --strict`: passed.
- `npm run typecheck`: TypeScript compiler passed for web and worker; worker graph status passed. The web graph retained the pre-existing recorded boundary status `blocked` for documentation/tooling imports, while the command exited successfully under the repository's current receipt contract.

The script contract rejects host `npm run build`, direct host Next compilation, and host `.next` cleanup/generation while retaining Dockerfile `npm run build` as the production compiler.
