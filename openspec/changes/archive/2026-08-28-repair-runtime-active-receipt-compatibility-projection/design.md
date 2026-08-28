## Context

The host-state writer already places a canonical compatibility projection in a v2 active receipt when the activation transaction receives an exact proof digest. The Next.js reader accepts only the older receipt keys, and the daily same-identity path does not invoke the transaction with the newly captured digest.

## Goals / Non-Goals

**Goals:**

- Keep the application reader and host receipt schema aligned while retaining the fail-closed active identity fence.
- Treat same-identity requalification as an atomic proof-projection update, not as a no-op.
- Preserve the existing journaled transaction, rollback behavior, and minimal public readiness response.

**Non-Goals:**

- Change the Runtime Release identity or increment a lifecycle generation solely to refresh proof evidence.
- Expose proof, revision, image, migration, or consumer fields through public readiness.
- Alter the one-time coordinated legacy cutover path.

## Decisions

1. The application reader validates `compatibility` only when it is present, requiring the exact host-projected field set and formats. This accepts historical proof-less receipts while rejecting malformed evidence.
2. The daily same-identity path calls the existing activation transaction with the newly captured proof digest. The transaction retains the current Release identity and selection generation while atomically overwriting the active receipt projection with that exact verified proof.
3. Tests cover the application reader's valid and invalid compatibility receipts, and assert that the same-identity branch carries the proof digest into the transaction.

## Risks / Trade-offs

- [Older proof-less receipts] → The optional projection remains accepted for legacy recovery; new daily qualification still requires an exact proof before activation.
- [Same Runtime identity under changed application state] → The existing transaction is reused so journaling and receipt writes remain atomic instead of introducing a separate mutable proof file.
