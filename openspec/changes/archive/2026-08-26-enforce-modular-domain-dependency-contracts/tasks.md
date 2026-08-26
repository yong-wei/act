## 1. Investigation and characterization

- [x] 1.1 Verify the exact qualified charter and `capture-modular-monolith-refactor-baseline` identities before deriving any rule input; stop on drift or incomplete denominators.
- [x] 1.2 Characterize current production, test, generated, compatibility, and framework-convention dependency edges, including the two production `src/features` to `@/app` teacher diagnosis imports and their test-only counterparts.
- [x] 1.3 Characterize current domain/core, Prisma, Next, React, `src/lib`, cross-domain deep-import, reverse-edge, and SCC observations; record why each existing violation remains staged.
- [x] 1.4 Reconfirm the existing formal capability contracts for frontend source boundaries, module hygiene, server/route safety, App Router rendering, and stable dependency migration; use them as inputs rather than creating duplicate rules.

## 2. Implement dependency contracts

- [x] 2.1 Define the public-api/application/ports/adapters layer vocabulary, owner lookup, production/test classification, allowed edge directions, and forbidden edge patterns.
- [x] 2.2 Implement the repository-local architecture fitness checker over the complete declared graph with forward/reverse edge reconciliation, deep-import detection, feature-to-App Router detection, and complete SCC output.
- [x] 2.3 Implement the `src/lib` new-business freeze and explicit exception schema; reject unowned or undated exceptions.
- [x] 2.4 Generate the denominator-closed temporary allowlist with stable edge IDs, owner, consumers, reason, deletion condition, and follow-up change; enforce that entries and forbidden edges only decrease.

## 3. Remove old entry paths and stage deletion

- [x] 3.1 Delete any facade, re-export, broad glob exception, or dependency edge introduced by this change that is not itself the canonical public contract.
- [x] 3.2 For each pre-existing allowlisted entry, create the concrete deletion condition and follow-up migration target; do not hide the old edge or claim repository-wide legacy migration.
- [x] 3.3 Reserve `decouple-teacher-diagnosis-route-contract` as the first deletion slice and record the expected removal of the teacher diagnosis feature-to-App Router imports.
- [x] 3.4 Update the charter's `dependency-rules.md` and `deprecation-ledger.md` projections with the fitness-check identity, allowlist denominator, remaining debt, and every deletion condition; keep the charter and checker inputs aligned.

## 4. Targeted and affected-domain verification

- [x] 4.1 Add fixtures and contract tests for allowed public-api calls, forbidden feature-to-app and deep imports, domain-core infrastructure imports, `src/lib` freeze, test/framework exceptions, allowlist monotonicity, reverse edges, and multi-node SCCs.
- [x] 4.2 Run the architecture fitness test on the unchanged baseline and verify all existing debt is reported with closed denominators and deletion conditions.
- [x] 4.3 Run affected architecture/module-hygiene checks plus `rtk npm run typecheck` and the directly related unit/contract suites; record any pre-existing global failures separately.
- [x] 4.4 Run `rtk openspec validate enforce-modular-domain-dependency-contracts --type change --strict` and `git diff --check`.
- [x] 4.5 Publish the contract and remaining allowlist identity as the input to the teacher diagnosis vertical slice; do not claim, deploy, or activate production.
