## Context

`establish-modular-monolith-refactor-charter` supplies the owner catalog, bounded-context map, dependency rules, and deprecation ledger. This change turns those decisions into a repository fitness contract. The current graph must be treated as evidence: the two production feature-to-App Router imports in the teacher diagnosis history surface are migration targets, while route imports in tests are a separate observation class and must not be counted as product inversions.

The supplied refactor program requires domain public APIs, application use cases, ports, and adapters; `feature -> app` and cross-domain deep imports are prohibited; domain core code cannot depend on Prisma, Next, or React; and new business code in `src/lib` is frozen. The contract must be strong for new code and monotonic for existing debt, without forcing a repository-wide migration in one change.

## Goals / Non-Goals

**Goals:**

- Require every new domain-crossing dependency to use a stable public API or application use case.
- Separate domain core, application, ports, adapters, route delivery, and UI feature responsibilities.
- Detect production-only violations, cross-domain deep imports, and complete dependency SCCs with a denominator-closed graph.
- Maintain a temporary allowlist whose entries are stable, owned, evidence-backed, and only removable.
- Provide a local architecture fitness test and affected-domain verification path.
- Preserve existing formal safety, rendering, source-boundary, module-hygiene, and dependency-migration contracts.

**Non-Goals:**

- Migrating all existing `src/lib` or legacy feature code.
- Creating npm workspaces, microservices, a second dependency graph, or a second ownership catalog.
- Rewriting routes, authentication, authorization, database schemas, runtime behavior, or public response semantics.
- Treating test/framework-convention imports as production violations without classification evidence.
- Claiming, deploying, activating production, or closing the later deletion work.

## Decisions

### 1. Use the charter and baseline as the only rule inputs

The fitness checker consumes the exact charter identity and the predecessor baseline graph. It must use the baseline's complete declared edge denominator, classifications, reverse edges, and SCC membership. A fresh ad hoc `rg` count or a directory-only rule was rejected because it cannot distinguish tests, dynamic/framework entrypoints, compatibility surfaces, or reverse dependencies.

### 2. Define a narrow module contract

New domain code follows this direction:

```text
App Router route / Server Action
  -> domain public-api or application use case
  -> domain core + ports
  -> adapter implementation
  -> Prisma / Next / external provider
```

`src/features/<domain>/public-api.ts` is the stable cross-domain surface. `application/` owns orchestration and use-case inputs/outputs; `ports/` contain infrastructure-neutral interfaces; `adapters/` implement ports and may depend on delivery or persistence infrastructure. Domain core may use TypeScript and approved pure libraries, but not Prisma, Next, React, route modules, or database clients. UI features may consume their own or another domain's public API, but never an App Router implementation path.

### 3. Enforce forbidden edges by source and target classification

The checker SHALL fail on production `feature -> app`, cross-domain internal/deep imports, and domain-core -> Prisma/Next/React edges. It SHALL not fail merely because a test imports a route handler, a framework convention file is discovered, or an explicitly generated/compatibility edge exists; those are separate evidence classes with their own rules. The existing `frontend-build-source-boundary` and `app-router-rendering-boundary-safety` specifications continue to govern frontend scanning and route rendering.

### 4. Make the allowlist denominator-closed and only decreasing

Each pre-existing violation is represented by a stable edge ID, source/target owner, classification, current consumer, reason, owner, deletion condition, and follow-up change. The allowlist is computed from the full baseline denominator. A later revision may remove entries or replace an edge with a compliant public boundary, but may not add an entry, broaden a pattern, or hide a new violation. Any truly unavoidable new exception blocks qualification until the charter and task scope explicitly change.

### 5. Test cycles as complete strongly connected components

The fitness test recomputes forward and reverse edges and SCCs after applying classification filters. Any new cross-domain cycle fails with all member and edge IDs; an existing allowlisted SCC remains visible with an owner and deletion condition. Reporting only the first cycle edge was rejected because it hides the state that must be dismantled.

### 6. Keep enforcement independent from legacy migration

This change establishes the gate and records debt. It does not claim that all old code is compliant. The first concrete deletion/migration is assigned to `decouple-teacher-diagnosis-route-contract`; subsequent changes must reduce the allowlist or remove a forbidden edge before they can be considered progress.

### 7. Reuse, do not fork, existing formal capabilities

The implementation references `frontend-build-source-boundary` for frontend scan roots, `owned-surface-module-hygiene` for graph-backed deletion proof, `server-action-and-route-safety` for auth and GET side-effect invariants, `app-router-rendering-boundary-safety` for route data/rendering boundaries, and `stable-dependency-chain-migration` for explicit ownership and verification lanes. No requirement delta is introduced for those capabilities.

## Risks / Trade-offs

- [Risk] Dynamic imports or framework conventions are misclassified. → Use the baseline's AST, route-convention, registry, and configuration discovery and keep explicit classification records.
- [Risk] A temporary allowlist becomes permanent. → Require owner, consumer, deletion condition, follow-up change, and a monotonic count/edge gate.
- [Risk] Enforcement blocks a legitimate test or generated path. → Keep production, test, generated, compatibility, and framework classes separate and test each fixture.
- [Risk] SCC analysis reports a large legacy cluster without an immediate migration. → Fail only on newly introduced cycles, but always report the complete existing SCC and ledger identity.
- [Trade-off] A narrow first gate leaves legacy violations visible. → That is intentional: the rule prevents growth while later vertical slices remove debt.

## Migration Plan

1. Verify the charter and baseline identities and characterize current production/test violations.
2. Implement the rule configuration, edge classification, SCC calculation, closed allowlist, and fitness test.
3. Run the checker on the unchanged baseline and record every existing exception with deletion conditions.
4. Migrate one complete route contract in the dependent teacher diagnosis change, removing the old import and reducing the allowlist.
5. Run targeted architecture, affected-domain, typecheck, and OpenSpec validation. No deployment or production rollback is part of this change.

## Open Questions

None for the rule contract. The exact implementation of the repository-local fitness command may follow existing script conventions, but it must emit the declared denominator, classification, SCC, and allowlist evidence.
