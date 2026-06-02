## 1. Runtime Boundary

- [ ] 1.1 Audit production entrypoints for direct development-tool usage.
- [ ] 1.2 Decide whether worker/scheduler should run compiled JavaScript or keep `tsx` as a production dependency.
- [ ] 1.3 Update Docker and Podman startup paths to match the selected contract.
- [ ] 1.4 Reclassify dependencies only when runtime evidence supports the move.

## 2. Production Validation

- [ ] 2.1 Run `rtk npm run test`.
- [ ] 2.2 Run `rtk npx tsc --noEmit --pretty false`.
- [ ] 2.3 Run the production build path, including `rtk npm run build` or the repository Docker build wrapper.
- [ ] 2.4 Validate worker and scheduler startup through the available local Podman/Docker readiness checks.
- [ ] 2.5 If production-only install is supported, verify the selected `npm ci --omit=dev` path; otherwise document the blocker.

## 3. OpenSpec Validation

- [ ] 3.1 Run `rtk openspec validate separate-production-runtime-dependencies --strict`.
