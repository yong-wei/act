# Handoff: retire-adaptive-business-ownership-and-lib-entrypoints

- Rollback revision: `b8c2cce5f6ebaecae76f9945fc58aa5dd6ae7be2`.
- Mapping: 10 `src/features/adaptive` files → `src/features/personalization/experience/`; 18 path lib files → `src/features/personalization/path-planning/`; `item-type-terminal-validation.ts` → Assessment.
- Old `src/features/adaptive/` and `src/lib/adaptive-*` / `src/lib/adaptive-planning/` production paths are deleted. Production imports of `@/features/adaptive/` and `@/lib/adaptive-` are banned by `legacy-adaptive-entrypoint-retirement` tests.
- Retained: Prisma tables, LearningFact, outbox, path history. No schema, selector, or deploy.
- Unresolved non-blocking: C0 census still inventories the old prefixes as historical current-head categories; architecture fitness remains globally red on this baseline; C3/C4 must not be done here.
- C3/C4 prerequisite: Personalization owns path/learner helpers; do not simplify `assemble-plan` or the learner-state reducer in this change.
