## Tasks

- [ ] 1. Define scoped fixture resource-set readiness.
  - Identify the resource ids, graph nodes, path nodes, assessment items, and evidence events required by the Yang Fan fixture tests.
  - Separate fixture-owned blockers from unrelated global resource backlog rows.

- [ ] 2. Update helper policy and diagnostics.
  - Report fixture readiness from the scoped reviewed subset.
  - Preserve global backlog counts as limitations, not as fixture blockers, when they are outside the fixture-owned subset.

- [ ] 3. Add guardrails for limited fixture coverage.
  - Ensure fixture runs cannot cite or materialize evidence for unreviewed resources.
  - Ensure fixture output records limited coverage when global resource completeness is still incomplete.

- [ ] 4. Validate fixture-readiness behavior.
  - Run `rtk openspec validate decouple-yangfan-fixture-from-global-resource-backlog --strict`.
  - Run the data-completeness helper and targeted fixture precondition tests.
