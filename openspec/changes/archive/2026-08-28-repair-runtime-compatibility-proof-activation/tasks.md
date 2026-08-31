## 1. Proof identity and projection

- [x] 1.1 Use the canonical proof SHA-256 as an immutable proof filename and retain multiple proofs for one Runtime identity.
- [x] 1.2 Carry the selected proof digest through the activation journal and project exactly that proof into the active receipt, including crash recovery.

## 2. Coordinated migration compatibility

- [x] 2.1 Restore the established stopped-service coordinated activation branch behind explicit migration intent and the existing coordination gates.
- [x] 2.2 Keep the normal activation entrypoint fail-closed when no compatibility proof is supplied.

## 3. Verification

- [x] 3.1 Add behavior tests for multiple proof records and exact active receipt selection.
- [x] 3.2 Run focused Runtime, host-state, activation and cutover contract verification.
