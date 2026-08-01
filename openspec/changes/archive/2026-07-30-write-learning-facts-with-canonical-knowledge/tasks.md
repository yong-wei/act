## 1. Define Canonical fact identity

- [x] 1.1 Add required Canonical ID, aggregate ReleaseSet/Release, projection/knowledge revision fields or normalized binding to the governed fact schema.
- [x] 1.2 Add a fixed-identity Canonical writer adapter and active-authority selector.
- [x] 1.3 Enforce current aggregate CourseCoverage, aggregate resource binding, KAQ support, and source identity before writes.
- [x] 1.4 Reject candidate ReleaseSets and incomplete Canonical version identity at every producer boundary.

## 2. Preserve historical truth

- [x] 2.1 Keep historical facts and derived records bound to their Legacy revision without sidecar backfill.
- [x] 2.2 Update serving and audit projections to retain identity namespace and version when historical and Canonical eras coexist.
- [x] 2.3 Prohibit dual Legacy/Canonical identity writes for post-cutover facts.

## 3. Inventory and verify producers

- [x] 3.1 Inventory every governed knowledge-scoped fact producer and map it to the correct fixed adapter.
- [x] 3.2 Add static and runtime gates proving no producer can write candidate or incomplete Canonical facts.
- [x] 3.3 Run shadow validation before activation and prove it creates no formal Canonical facts.
- [x] 3.4 Run learner-state, data-governance, migration, typecheck, and strict OpenSpec validation.
