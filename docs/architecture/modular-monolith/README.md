# Modular monolith architecture census

Command:

```bash
rtk npm run census:architecture
rtk npm run census:architecture -- --measure
```

The census is read-only. It does not change product behavior, CI, TypeScript, tests, database, runtime releases, or production selectors.

Implementation lands first as a clean checkpoint. Qualified baseline artifacts are then generated from that exact commit and stored beside this file under `baseline/`. The baseline records the implementation checkpoint identity; the later artifact commit is repository history, not a field the generator must predict.

`--measure` captures immutable TypeScript and Vitest receipts after the source-derived core is qualified. Independently rerun measurements create new receipt identities. Projections over a frozen receipt set remain byte-identical.

A linked Git worktree is a valid capture root. Mixed-worktree failure is reserved for captures whose Git toplevel or `GIT_WORK_TREE` does not match the repository being scanned.

Proposal investigation SHAs (`e74fd1fc`, `dd5be47f`) remain historical evidence. The qualified baseline identity is the implementation checkpoint that generated it, and that checkpoint remains an ancestor of the artifact commit on this branch. GitHub squash previews are not the capture source.

Current qualified capture:

- sourceCommit: `7837ec0f47859f9a9cbafc843e70ce1abb58a6b3`
- sourceTree: `8531e9f05b7c3ae9e3f609c2ea78aef9427bc5c9`
- schemaVersion: `act-architecture-census/v1`
- typescriptVersion: `5.8.3`
- observations: 27420
- production feature-to-app edges: 2 (teacher diagnosis report-history)
- `tsc --noEmit --incremental false`: exit 0
- `vitest run`: 9826 passed, 93 failed, 37 files failed, 3 unhandled errors; failures are observations, not quarantine decisions
