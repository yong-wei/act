## 1. Transaction tooling

- [x] 1.1 Add a sealed production cutover plan and receipt contract bound to the fixed image, capture, selector identities, and artifact hashes.
- [x] 1.2 Add an operator command that stages Authority artifacts, verifies remote runtime artifacts, and invokes the existing first-activation coordinator in the exact immutable image.
- [x] 1.3 Add identity-constrained rollback/recovery commands and a durable marker that records a committed production cutover.

## 2. Deployment safety

- [x] 2.1 Make the normal Legacy-oriented remote deployment command fail before remote mutation when a committed cutover marker exists.
- [x] 2.2 Add focused unit/fixture coverage for hash drift, all-ABSENT enforcement, consumer-last ordering, rollback identity protection, and the Legacy deployment guard.

## 3. Production activation

- [x] 3.1 Validate the fixed `v0.4.0` package, remote prestate, disk space, image identity, and full artifact hash closure.
  - Evidence: `production-v040-58f70df-20260811T083732Z`, plan `1e378c63b221f8784998828ab8ad5f6eec7b82e166002db86b68c607bb3673e1`.
- [x] 3.2 Execute the locked production transaction, recreate app and worker in explicit cutover mode, and retain the plan, journal, receipt, and command log.
  - Evidence: committed production receipt, current marker, first-activation journal, and staged command log retained on the target host.
- [x] 3.3 Verify all four selectors, six READY consumers, read-only graph identity, containers, public health, and the retained recovery path.
  - Evidence: all four selectors match the frozen package; the read-only verifier reports 4,891 Authority objects, 2,409 relations, and all six consumers READY; app/worker run the pinned image in `cutover` mode; local and public `readyz` passed.
