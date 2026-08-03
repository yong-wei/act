## Series Dependencies

- Depends on: `activate-versioned-actkg-engineering-authority`, `introduce-versioned-act-teaching-projection`.

## 1. Delta and impact calculator

- [x] 1.1 Inventory ReleaseSet Delta categories/identity and define the ACT impact-set schema for resources, cards, prerequisites, and textbook locators.
- [x] 1.2 Implement deterministic impact calculation with zero review for unbound additions and direct dependency expansion only.
- [x] 1.3 Add fixtures for label/alias, metadata/type, relation, deprecation, successor, split, merge, no-successor, and source-anchor changes.

## 2. Rebase and decisions

- [x] 2.1 Implement compatible single-successor auto-rebase with auditable decision records.
- [x] 2.2 Mark split/merge/ambiguous and dependent card/prerequisite cases `REVIEW_REQUIRED` per consumer package.
- [x] 2.3 Reuse persisted author decisions and fail closed on decision/Authority/Delta drift.

## 3. Complete projection rebuild

- [x] 3.1 Rebuild all projection artifacts from unchanged, rebased, and authored records in a staged immutable directory.
- [x] 3.2 Emit impact report, carried-forward digest map, deterministic hash, and rollback-ready manifest.
- [x] 3.3 Prove prior projection and current consumers remain readable during staged failure or delayed activation.

## 4. Verification

- [x] 4.1 Run focused Delta, impact, rebase, determinism, and fail-closed tests.
- [x] 4.2 Run `rtk openspec validate rebase-act-teaching-projection-incrementally --type change --strict` and `rtk openspec validate --changes --strict`.
