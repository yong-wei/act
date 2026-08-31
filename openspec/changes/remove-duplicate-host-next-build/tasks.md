## 1. Contract characterization

- [x] 1.1 Update build-script tests to require the explicit host preflight sequence and reject host `npm run build` or direct Next compilation.
- [x] 1.2 Preserve assertions that the Docker builder executes the complete production build and that immutable revision/provenance/cache publication gates remain unchanged.

## 2. Implementation

- [x] 2.1 Replace the host full build in `scripts/build.sh` with optimized-model, Prisma, and production TypeScript validation that does not create `.next`.
- [x] 2.2 Preserve preflight ordering, clean-worktree checks, Docker memory checks, and container build/export behavior.

## 3. Verification

- [x] 3.1 Run affected build, runtime externalization, optimized-model, runtime-blob, remote-deploy, and cache contract tests.
- [x] 3.2 Run shell syntax, production typecheck, and strict OpenSpec validation.
- [x] 3.3 Run a full app-only release image build and verify revision label, tar digest, provenance, Chromium, and LibreOffice without deployment.
