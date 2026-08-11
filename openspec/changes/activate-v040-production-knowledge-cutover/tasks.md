## 1. Transaction tooling

- [x] 1.1 Add a sealed production cutover plan and receipt contract bound to the fixed image, capture, selector identities, and artifact hashes.
- [x] 1.2 Add an operator command that stages Authority artifacts, verifies remote runtime artifacts, and invokes the existing first-activation coordinator in the exact immutable image.
- [x] 1.3 Add identity-constrained rollback/recovery commands and a durable marker that records a committed production cutover.

## 2. Deployment safety

- [x] 2.1 Make the normal Legacy-oriented remote deployment command fail before remote mutation when a committed cutover marker exists.
- [x] 2.2 Add focused unit/fixture coverage for hash drift, all-ABSENT enforcement, consumer-last ordering, rollback identity protection, and the Legacy deployment guard.

## 3. Production activation

- [ ] 3.1 Validate the fixed `v0.4.0` package, remote prestate, disk space, image identity, and full artifact hash closure.
- [ ] 3.2 Execute the locked production transaction, recreate app and worker in explicit cutover mode, and retain the plan, journal, receipt, and command log.
- [ ] 3.3 Verify all four selectors, six READY consumers, read-only graph identity, containers, public health, and the retained recovery path.
