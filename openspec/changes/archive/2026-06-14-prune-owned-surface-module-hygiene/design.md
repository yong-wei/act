## Context

Representative warnings:

- `unused-export`: 388.
- `unused-file`: 66.
- `only-export-components`: 74.
- `no-barrel-import`: 7.
- `prefer-dynamic-import`: 7.
- `circular-dependency`: 3.
- `unused-dependency`: 2.

These warnings are not all safe to fix mechanically. App Router files, registries, test fixtures, generated-style entrypoints, and public helper exports can appear unused to static tools while still being required by conventions.

## Decisions

1. Use graph-backed verification before deletion.
   - Check import graph, tests, route conventions, registries, and dynamic references.

2. Split by risk:
   - Safe unused local exports.
   - Component-only export splits.
   - Dead files and dependency removal.
   - Circular dependencies and heavy dynamic imports.

3. Preserve public contracts.
   - Do not remove exports from documented registries or capability boundaries without updating tests and docs.

## Risks

- Static unused-file reports can misclassify App Router convention files or dynamic registry entrypoints.
- Removing exports can break downstream imports in worktrees not represented by simple grep.
