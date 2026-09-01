## 1. Scope and source identity

- [ ] 1.1 Read the existing architecture baseline, charter, deprecation ledger, dependency rules, and current non-archived OpenSpec inventory; record their identities and explicit exclusions.
- [ ] 1.2 Verify a clean worktree at HEAD `957f367026d6d247ef79df2be081debe5c40a617` and tree `4156faab0b73ea1deaaba9e37dff0c67291e50df`; bind the predecessor baseline `58c77cbf6e0f6cd284e1eea6a39ca4df8854ebac` / `189dfeb5ad35f1d88e8ea5509a48b388424bf88f` without rewriting it.
- [ ] 1.3 Define the bounded current-head schema, stable record identity, evidence classes, and privacy exclusions before collecting observations.

## 2. Consolidated delta evidence

- [ ] 2.1 Reconcile current top-level Assessment/Adaptive/Personalization owners and all production/test/tooling consumers using import, dynamic-load, re-export, route, worker, script, and registry evidence.
- [ ] 2.2 Build owner-conflict records that preserve ambiguity, candidate owners, trust boundaries, deletion conditions, rollback references, and evidence paths.
- [ ] 2.3 Build retirement candidates from current consumers and the existing deprecation ledger; classify no-consumer, test-only, production-consumer, and rollback-constrained cases without inferring activity from directory presence.
- [ ] 2.4 Measure and rank current hotspots, including `assemble-plan.ts`, learner-state `internal.ts`, the 10-file adaptive UI surface, the 14-file adaptive-assessment surface, and the 19-file `src/lib/adaptive-*`/`adaptive-planning` surface; treat size as prioritization evidence only.
- [ ] 2.5 Produce the active OpenSpec conflict matrix and dependency/order notes, excluding archived changes from the active denominator.
- [ ] 2.6 Write the summary, owner-conflict, retirement, hotspot, and compact JSON projections under one current-head evidence directory with stable ordering and bounded detail.

## 3. Qualification and handoff

- [ ] 3.1 Validate source identity, denominator reconciliation, deterministic serialization, privacy restrictions, and governance-only scope.
- [ ] 3.2 Run focused architecture census/fitness and relevant unit/contract checks without changing product code or historical baseline artifacts.
- [ ] 3.3 Run `rtk openspec validate capture-current-head-consolidation-delta --type change --strict` and record the exact result.
- [ ] 3.4 Record unresolved ownership conflicts and non-blocking adjacent candidates as handoff evidence for C1; do not resolve them implicitly in this change.
