# Payload class observations

Payload classes observe tracked bytes and blob identities only — every tracked blob is classified exactly once
(unique runtime/archive/authoring payloads included), with duplicate blobs counted per class. Authority,
materialization, retention, and deletion decisions belong to C and the existing data-governance owners;
nothing here authorizes deletion.

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

- duplicate blobs: 2486
- unresolved classes: 60

| class | blobs | duplicates | paths | bytes |
| --- | --- | --- | --- | --- |
| archive-only | 5958 | 203 | 6724 | 276241474 |
| authoring-only | 11958 | 371 | 13153 | 3129967379 |
| current-runtime-referenced | 48213 | 1767 | 50115 | 1576342287 |
| mixed-unresolved | 60 | 60 | 456 | 99119474 |
| other-tracked | 7959 | 85 | 8046 | 884504673 |
