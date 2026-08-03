## Series Dependencies

- Depends on: `revise-actkg-authority-boundary`.

## 1. Snapshot materialization

- [ ] 1.1 Reuse the existing Bundle adapter/Repository/ReleaseSet/Delta readers and define the deterministic Authority Snapshot manifest fields and canonical serialization.
- [ ] 1.2 Implement staged snapshot creation preserving all typed engineering objects, exact predicates, endpoints, provenance summaries, and lineage identities.
- [ ] 1.3 Add round-trip, count, endpoint, hash, duplicate-ID, schema, and capture-drift tests.
- [ ] 1.4 Keep import candidate/staged-only and add a separate digest-checked Authority activation transaction with distinct receipts.

## 2. Current pointer and rollback

- [ ] 2.1 Implement atomic `authority/current.json` replacement after staged validation, including fsync/rename or the repository-equivalent atomic primitive.
- [ ] 2.2 Persist the previous pointer as an immutable rollback artifact and implement digest-checked one-pointer rollback.
- [ ] 2.3 Add interrupted-write and mismatched-pointer tests proving readers never observe a partial snapshot.
- [ ] 2.4 Verify failed import/activation cannot change prior Authority, teaching, or Legacy selectors and successful activation advances only explicitly named Engineering consumers.

## 3. Engineering consumers

- [ ] 3.1 Adapt Engineering Graph and Engineering RAG readers to resolve the active Authority Snapshot through the Repository.
- [ ] 3.2 Prove valid Authority activation with an empty/unresolved Teaching Projection and preserve course/KAQ/path selectors.

## 4. Verification

- [ ] 4.1 Run focused Bundle, ingestion, Delta, Repository, deterministic serialization, and rollback tests.
- [ ] 4.2 Run `rtk openspec validate activate-versioned-actkg-engineering-authority --type change --strict` and `rtk openspec validate --changes --strict`.
- [ ] 4.3 Record that no deployment, Prisma migration, or ActKG semantic re-review is part of this change.
