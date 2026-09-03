# Test baseline observations

Each observation references an immutable measurement receipt. A red command remains an observation:
A does not label it stale, accepted, quarantined, or implementation debt, and does not change test-command qualification.

## Capture identity

- successorCaptureId: `fa6e618d7a875412e975a14259dfac37c4cfed1bc6ca48095184f72bb0946d02`
- sourceCommit: `698cb2f4cd6d001bcbeee95bca9be58c56c1cca3`
- sourceTree: `41d6b3f5966493911d6ce9c1f299015189778d53`
- commitTime: `2026-09-03T13:07:15+08:00`
- schemaVersion: `act-architecture-post-convergence-successor/v1`
- schemaVersions.censusCore: `act-architecture-census/v1`
- schemaVersions.measurementReceipt: `act-architecture-measurement-receipt/v1`
- schemaVersions.currentHeadDelta: `act-architecture-current-head-delta/v1`
- nodeVersion: `v26.0.0`
- npmVersion: `11.12.1`
- typescriptVersion: `5.8.3`
- predecessorBaseline.sourceCommit: `58c77cbf6e0f6cd284e1eea6a39ca4df8854ebac`
- predecessorBaseline.censusCoreSha256: `40549dcad9b03da31abc6ef05c5ede5bff4e04b47268f86450831aa39788c52a`
- predecessorCurrentHead.sourceCommit: `09fa54739c74a5005b7f3131bf3c85dcf79ff01a`
- predecessorCurrentHead.packageSha256: `120ece26720573a906e5196ad5f8ed80594376f2412fb87d5e42727745a211dd`
- frozenReceiptIds: `428e888776e52c415a1f6daa029110c029b20e2d790f030d155fbfde3b059c39`, `5fa6bc476c928f27605dc055844244b5ab0d0d3909b5dd467690cadbba1360e9`

| receiptId | command | scope | exit | aggregate |
| --- | --- | --- | --- | --- |
| 428e888776e52c415a1f6daa029110c029b20e2d790f030d155fbfde3b059c39 | npx tsc --noEmit --incremental false --pretty false | tsconfig.json | 2 | durationMs=28801; errorCount=2 |
| 5fa6bc476c928f27605dc055844244b5ab0d0d3909b5dd467690cadbba1360e9 | npx vitest run --reporter=json --outputFile=<tmpdir>/vitest.json --reporter=./src/lib/architecture-census/vitest-unhandled-reporter.ts | vitest unit | 1 | durationMs=64208; passed=11042; failed=69; filesFailed=48; unhandledErrors=0 |

## Limitations

- Receipts are environment-sensitive: platform, cache mode, and captured time are recorded per receipt.
- Re-running a measurement creates a new receipt identity; re-projection from the same frozen receipt set is byte-identical.
- Bounded fingerprints and aggregates are committed here; the full receipt JSON artifacts are local/CI-only per the design compact-package boundary and cannot be byte-regenerated from a different environment. A reader without the local detail directory fails closed by contract.
- Source-derived detail artifacts (full-inventory, denominator-slices, owner-residue, census-core) are byte-reproducible from the recorded source commit with the committed generator; digest mismatch still fails closed.
