## 1. Baseline characterization and input contract

- [x] 1.1 Re-read the qualified `capture-modular-monolith-refactor-baseline` artifacts, source identity, denominator reconciliations, unresolved records, and active OpenSpec capability inventory; stop if the declared baseline input is absent or drifted.
- [x] 1.2 Characterize current owners and callers for routes, APIs, Prisma models/access sites, events, workers, scripts, registries, tests, compatibility surfaces, and hard gates; preserve production/test/generated/framework distinctions and add a baseline fixture with multiple candidate owners.
- [x] 1.3 Characterize existing hard-gate behavior and evidence from `frontend-build-source-boundary`, `owned-surface-module-hygiene`, `server-action-and-route-safety`, `app-router-rendering-boundary-safety`, and `stable-dependency-chain-migration` without duplicating or weakening their requirements.

## 2. Charter implementation

- [x] 2.1 Define the stable domain-owner catalog, ownership record schema, boundary vocabulary, gate classes, and compatibility/deprecation record schema.
- [x] 2.2 Adjudicate every capability and inventory record to exactly one accountable target owner; fail qualification for missing or multiple candidates, while retaining any unresolved conflict only as a non-qualified blocking record with accountable owner, evidence, and resolution condition.
- [x] 2.3 Define the bounded-context map and dependency directions from the owner records; identify cycles, deep imports, and shared infrastructure without claiming that migration is complete.
- [x] 2.4 Define the trust-boundary matrix with threat, protected fact, failure consequence, sole validator, consumers, and hard/contract/soft/removable classification for every discovered gate.
- [x] 2.5 Build the deprecation ledger and give every facade, alias, re-export, old route, flag, and migration exception a deletion condition and a named follow-up change; prepare the later deletion of each old entry without deleting product code in this governance change.

## 3. Projection and retirement validation

- [x] 3.1 Generate `refactor-charter.md`, `bounded-context-map.md`, `dependency-rules.md`, `trust-boundary-matrix.md`, and `deprecation-ledger.md` from one normalized charter record set with stable ordering and source identity.
- [x] 3.2 Verify unique ownership, cross-document IDs/counts, complete gate coverage, complete compatibility coverage, and repository-relative/privacy-safe evidence; the multi-owner baseline fixture must fail qualification and its blocking record must not count as a qualified exception.
- [x] 3.3 Add characterization checks proving the charter does not alter routes, authorization, persistence, test selection, TypeScript scope, CI, release, or production behavior.

## 4. Targeted and affected-domain verification

- [x] 4.1 Run the charter schema/projection contract tests and deterministic regeneration check from the same baseline and receipt identities.
- [x] 4.2 Run affected architecture/documentation validation and the predecessor baseline validation; record any pre-existing global failures separately.
- [x] 4.3 Run `rtk openspec validate establish-modular-monolith-refactor-charter --type change --strict` and `git diff --check`.
- [x] 4.4 Record the qualified charter identity as the explicit dependency input for `enforce-modular-domain-dependency-contracts`; do not claim, deploy, or activate production.
