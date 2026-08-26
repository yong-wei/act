# Test receipts

Deterministic discovery cores are byte-identical for the same revision and declared inputs.
Duration, RSS, Node/OS, and service state belong in a measurement receipt. A new measurement creates a new receipt identity.

- discovery schema: `act-test-command-contracts/v1`
- measurement schema: `act-test-command-measurement-receipt/v1`
- release manifest schema: `act-release-qualification-manifest/v1`
- baseline census: `40549dcad9b03da31abc6ef05c5ede5bff4e04b47268f86450831aa39788c52a`
- charter: `76850de671d65e821dd2acebe070ab23d6a3f26a3a7d9f9527e32af75c957396`

Qualified receipts must not contain credentials, raw event payloads, learner identifiers, or machine-local absolute paths.

Do not encode a current pass/fail count as a permanent constant. Read the receipt bound to the source revision.

## TypeScript graph receipts

The graph contract uses `act-typescript-graph-manifest/v1` for deterministic
scope and file identity, and
`act-typescript-graph-measurement-receipt/v1` for runtime observations. A
manifest records graph/config/source commit and tree, include/exclude roots,
compiler policy, entrypoints, project references, file hashes and shared
contract owners. A receipt adds command, manifest hash, toolchain, platform,
cache mode, capture time, duration, peak RSS, file count, tsc status, fixture
probe state and failure codes.

Manifest hashes must not depend on duration, RSS, capture time or other machine
state. Cold and warm measurements are separate receipts. Receipts are written
by identity and are not overwritten; a receipt with `dirty: true`, a stale
source identity, a non-passing status or a non-zero exit status is not
qualification evidence. Main/release consumers must also require current
`typecheck:tools` and `typecheck:test` receipts.
