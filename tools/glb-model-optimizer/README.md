# GLB model optimizer

This directory is an independent npm project for producing ignored, deployable
GLB assets. Its glTF Transform dependency path and direct meshoptimizer
declaration are intentionally isolated from the application package and build.

Run it from the repository root:

```bash
npm run models:produce
```

The command installs this tool's isolated dependency tree, reads
`public/assets/*.glb`, writes meshopt-compressed files to
`public/assets/models-opt/`, and records per-file status in
`public/assets/models-opt/manifest.json`. Files are produced in a temporary
directory and replace the published output directory only after every model
succeeds. The manifest binds every output to the SHA-256 of its source GLB.
Production writes a sibling `models-opt.in-progress.json` marker before work
begins. A failed model is recorded as `fallback-original` in the sibling
`public/assets/models-opt.failed-manifest.json`; the command exits unsuccessfully
and preserves the previous complete output set. A successful atomic publication
removes both markers.

The application build does not install or invoke this tool. Produce the assets
separately in the primary worktree, then use
`scripts/dev/sync-local-worktree-config.sh` to copy them as real files into an
isolated worktree. The synchronization command rejects a missing, incomplete,
or failed optimized-model manifest.
