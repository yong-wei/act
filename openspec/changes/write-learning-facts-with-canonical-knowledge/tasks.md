## 1. Define Canonical fact identity

- [ ] 1.1 Add required Canonical ID, aggregate ReleaseSet/Release, projection/knowledge revision fields or normalized binding to the governed fact schema.
- [ ] 1.2 Add a fixed-identity Canonical writer adapter and active-authority selector.
- [ ] 1.3 Enforce current aggregate CourseCoverage, aggregate resource binding, KAQ support, and source identity before writes.
- [ ] 1.4 Reject candidate ReleaseSets and incomplete Canonical version identity at every producer boundary.

## 2. Preserve historical truth

- [ ] 2.1 Keep historical facts and derived records bound to their Legacy revision without sidecar backfill.
- [ ] 2.2 Update serving and audit projections to retain identity namespace and version when historical and Canonical eras coexist.
- [ ] 2.3 Prohibit dual Legacy/Canonical identity writes for post-cutover facts.

## 3. Inventory and verify producers

- [ ] 3.1 Inventory every governed knowledge-scoped fact producer and map it to the correct fixed adapter.
- [ ] 3.2 Add static and runtime gates proving no producer can write candidate or incomplete Canonical facts.
- [ ] 3.3 Run shadow validation before activation and prove it creates no formal Canonical facts.
- [ ] 3.4 Run learner-state, data-governance, migration, typecheck, and strict OpenSpec validation.
