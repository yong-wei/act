# Test command contract handoff

Inputs for `eliminate-accepted-red-test-baseline`, `split-production-tooling-test-typescript-graphs`, and CI gates.

- discovery sourceCommit: `1f265fc97f7d3aa13a23009fe52a68d40e39917f`
- discovery sourceTree: `4b9e41513f7fd719dd6ee38f66ed2222dadfad2a`
- unresolved: 0
- classified: 1226

## Remaining blockers

- Discovery currently closes. Remaining redness is execution, not an accepted failure.

- `test:unit` still observes failing tests and unhandled errors from the frozen census measurement; do not mark them accepted.
- `test:release` has no qualification manifest yet. Missing evidence is a release blocker, not a product-test skip.
- This change does not claim the default gate is green.
