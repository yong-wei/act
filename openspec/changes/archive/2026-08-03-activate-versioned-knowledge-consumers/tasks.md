## Series Dependencies

- Depends on: `rebase-act-teaching-projection-incrementally`, `adopt-layered-graph-and-course-consumers`, `adopt-teaching-projection-in-konling-and-rag`, `adopt-prerequisites-in-learning-path`.

## 1. Readiness manifest

- [x] 1.1 Define consumer names, status states, Authority/Projection combination fields, artifact hashes, local dependency reasons, and prior pointer.
- [x] 1.2 Implement per-consumer readiness checks for Engineering Graph/RAG, course runtime, Konling, Teaching Resource RAG, and learning path.
- [x] 1.3 Add mixed-capture, missing-artifact, route/resource, card, prerequisite, and identity-drift fixtures.

## 2. Staged activation

- [x] 2.1 Materialize a complete staged manifest and validate all cross-artifact identities and deterministic hashes.
- [x] 2.2 Implement atomic pointer replacement that can update Engineering consumers while pinning affected teaching consumers.
- [x] 2.3 Retain prior manifest and implement digest-checked rollback.

## 3. Shadow validation

- [x] 3.1 Run representative old/new graph, RAG, Konling, course, card, textbook, prerequisite, and path reads in shadow mode.
- [x] 3.2 Prove shadow mode writes no LearningFact, teaching decision, or upstream relation and records discrepancies.

## 4. Verification

- [x] 4.1 Run focused readiness, staging, atomic pointer, shadow, and rollback tests.
- [x] 4.2 Run `rtk openspec validate activate-versioned-knowledge-consumers --type change --strict` and `rtk openspec validate --changes --strict`.
- [x] 4.3 Confirm no remote deployment, migration, or legacy deletion is included.
