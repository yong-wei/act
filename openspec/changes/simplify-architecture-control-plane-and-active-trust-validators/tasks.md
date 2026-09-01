## 1. Freeze and characterize the control plane

- [ ] 1.1 Consume C34 inventory and map census, charter/deprecation, dependency/fitness, quality/toolchain, QA and release trust validators, callers, inputs, outputs and authority.
- [ ] 1.2 Run the code-simplification process and record before/after validator branches, wrappers, aliases, receipts, failure codes and deletion reasons.
- [ ] 1.3 Add failing/replay fixtures for clean, dirty/mixed, tree drift, stale/duplicate receipts, denominator/privacy conflict and qualified/blocked/unresolved states.

## 2. Simplify without weakening trust

- [ ] 2.1 Consolidate equivalent identity, denominator, scope, schema, owner, status and privacy validation inside the existing authority owners.
- [ ] 2.2 Migrate C34 canonical commands and consumers; remove duplicate normalization, wrappers and aliases only after replay behavior is identical.
- [ ] 2.3 Prove release/rollback unique security validator remains the sole selector/deployment safety authority and all other checks remain evidence-only.
- [ ] 2.4 Preserve `verify:commit`, `verify:push`, `typecheck`, graph boundaries, portable receipts, PlatformSetting, AppShell/role/SSR/R3F and business owner contracts.

## 3. Verify and hand off

- [ ] 3.1 Add static no-second-gate/no-selector-write/no-private-output tests and consumer uniqueness checks.
- [ ] 3.2 Run architecture/fitness/quality/toolchain/release suites, typecheck, lint, `verify:commit`, `verify:push`, diff checks and strict OpenSpec validation.
- [ ] 3.3 Record before/after control-plane map, deleted paths, retained compatibility aliases and rollback mapping.
- [ ] 3.4 Run `openspec validate simplify-architecture-control-plane-and-active-trust-validators --type change --strict` before completion.
