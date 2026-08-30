# Content, knowledge, and runtime release toolchains

Isolated command boundary for captured `course-content/scripts` (41),
`scripts/knowledge` (7), `scripts/knowledge-cutover` (75),
`scripts/runtime-release` (42), and `scripts/release` (5). Design-time counts
52/32 are historical; the live denominator is `git ls-files`.

Three registry entries own publication:

- `content-compiler` — reviewed authoring export and provenance validation
- `knowledge-release` — locked ReleaseSet/Bundle publication; projection
  publication is handed to `teaching-projection:*`
- `runtime-release` — immutable content-addressed materialization and inspection

Deployment, host activation, rollback, OSS mount, and coordinated selector
transactions remain explicit operator adapters. This CLI never executes a write,
selector change, deploy, or database mutation.

`npm run content-knowledge-runtime:check` freezes the captured-tree inventory.
`dry-run` emits a content-bound plan. `apply` / `run` / `export` only evaluate
the approval gate and never write. Independent verification maps to existing
`typecheck:tools` / focused Vitest.
