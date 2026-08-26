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
