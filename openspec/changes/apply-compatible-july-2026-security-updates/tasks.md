## 1. Reconstruct the verified dependency checkpoint

- [x] 1.1 Apply the verified Next 16.2.11, NextAuth 4.24.15, eslint-config-next 16.2.11, and compatible transitive tooling resolutions without refreshing unrelated packages.
- [x] 1.2 Pin live audit governance to the official npm registry, remove stale finding exceptions, and preserve exact ownership for the remaining deprecation and Prisma residuals.
- [x] 1.3 Record the frozen baseline, selected versions, rejected incompatible candidates, and the final official-registry audit delta.

## 2. Isolate GLB resource production

- [x] 2.1 Move the GLB compressor and its dependency lockfile into an independent resource-production project.
- [x] 2.2 Remove compression dependencies and execution from the application manifest, application build, and Docker build context.
- [x] 2.3 Keep runtime references on the compressed model URLs and synchronize ignored optimized resources from the primary worktree as real files.

## 3. Verify the mergeable subset

- [x] 3.1 Run clean root and producer installs and verify both dependency trees contain no unintended invalid path.
- [x] 3.2 Run focused NextAuth contract tests, simulation asset tests, typecheck, dependency governance tests, and OpenSpec strict validation.
- [x] 3.3 Run the independent producer for all seven GLB resources and confirm a failed production run exits nonzero.
- [x] 3.4 Capture the final audit result showing no new finding and only the linked Next/PostCSS/Sharp production blockers plus owned moderate residuals.
- [ ] 3.5 Complete final changed-scope review and the repository commit/push gates without claiming that the blocked parent remediation is complete.
