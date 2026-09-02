## 1. Inventory and characterize

- [x] 1.1 Map existing platform composition helpers, AppShell/role shell callers, route projections, cache/refresh paths and legacy bridges.
- [x] 1.2 Bind every consumed field to the C9/C16/C30 canonical owner, source/revision identity, role/privacy classification and failure state.
- [x] 1.3 Run the code-simplification process and record before/after output, error, SSR/hydration, R3F and cache behavior.
- [x] 1.4 Add failing tests for duplicate read models, cross-role leakage, revision drift, missing owner projection and accidental writes.

## 2. Consolidate read-only composition

- [x] 2.1 Select the established platform composition owners (platform UI contracts, role navigation, AppShell, role workspace shell) as the composition surfaces of record; no parallel composition authority introduced.
- [x] 2.2 Keep AppShell, role workspace and navigation surfaces on their established C9/C16 owners; the unified multi-domain composition contract for knowledge/resource, teaching and AI presentation surfaces is explicitly out of this change's delivered scope (recorded in retirement-receipt.md as a follow-up, not a delivered capability).
- [ ] 2.3 Preserve source/release/manifest/revision provenance, role filtering, privacy, cache/refresh, SSR and R3F dynamic boundaries.
- [x] 2.4 Delete duplicate mappers, aliases, fallback bridges and route-local read models only after before/after tests pass.

## 3. Verify no authority expansion

- [x] 3.1 Add no-write and no-AI-fact-store contracts; prove composition results do not mutate domain, knowledge, LearningFact or production state.
- [x] 3.2 Run desktop/mobile component and route/browser tests plus dependency/fitness checks.
- [x] 3.3 Run typecheck, lint, `verify:commit`, `verify:push`, diff checks and strict OpenSpec validation.

## 4. Handoff

- [x] 4.1 Record before/after read-model map, deleted bridges and retained ingress adapters with deletion conditions.
- [ ] 4.2 Run `openspec validate consolidate-platform-composition-read-models-and-retire-legacy-bridges --type change --strict` before C34.
