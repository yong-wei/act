# Test command contract handoff

Inputs for `eliminate-accepted-red-test-baseline`, `split-production-tooling-test-typescript-graphs`, and CI gates.

- discovery sourceCommit: `8dbfa8627fe70b8c5cd90ff9bc087ee93a3424d0`
- discovery sourceTree: `0f29f93fab84b83e1cb492b57b2c7e64bef35988`
- unresolved: 0
- classified: 1226

## Remaining blockers

- Discovery currently closes. Remaining redness is execution, not an accepted failure.

- `test:unit` still observes failing tests and unhandled errors from the frozen census measurement; do not mark them accepted.
- `test:release` has no qualification manifest yet. Missing evidence is a release blocker, not a product-test skip.
- This change does not claim the default gate is green.
