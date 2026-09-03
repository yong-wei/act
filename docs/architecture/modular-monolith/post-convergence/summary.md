# Post-convergence successor capture

- schemaVersion: `act-architecture-post-convergence-successor/v1`
- successorCaptureId: `fa6e618d7a875412e975a14259dfac37c4cfed1bc6ca48095184f72bb0946d02`
- status: `qualified-for-investigation`
- sourceCommit: `698cb2f4cd6d001bcbeee95bca9be58c56c1cca3`
- sourceTree: `41d6b3f5966493911d6ce9c1f299015189778d53`
- commitTime: `2026-09-03T13:07:15+08:00`
- originIntegrationCommit: `698cb2f4cd6d001bcbeee95bca9be58c56c1cca3`
- predecessorBaseline.sourceCommit: `58c77cbf6e0f6cd284e1eea6a39ca4df8854ebac`
- predecessorBaseline.censusCoreSha256: `40549dcad9b03da31abc6ef05c5ede5bff4e04b47268f86450831aa39788c52a`
- predecessorCurrentHead.sourceCommit: `09fa54739c74a5005b7f3131bf3c85dcf79ff01a`
- predecessorCurrentHead.packageSha256: `120ece26720573a906e5196ad5f8ed80594376f2412fb87d5e42727745a211dd`
- successorCoreSha256: `48b7535ba020a40afc9dc5cd15e84114d7d0a9e35515c611c849c7db11d3695a`
- packageDigest: see `baseline.json` (the canonical envelope renders no digest value here, keeping the package digest free of self-reference)
- commandScope: `post-convergence-successor:capture`
- nodeVersion: `v26.0.0`
- npmVersion: `11.12.1`
- typescriptVersion: `5.8.3`
- schemaVersions.censusCore: `act-architecture-census/v1`
- schemaVersions.measurementReceipt: `act-architecture-measurement-receipt/v1`
- schemaVersions.currentHeadDelta: `act-architecture-current-head-delta/v1`
- frozenReceiptIds: `428e888776e52c415a1f6daa029110c029b20e2d790f030d155fbfde3b059c39`, `5fa6bc476c928f27605dc055844244b5ab0d0d3909b5dd467690cadbba1360e9`

This is an immutable A2 successor observation. It never becomes the active baseline:
`captured`, `digest-verified`, and `qualified-for-investigation` are distinct from `active-baseline`,
and only N5 may later atomically activate a baseline after its own recapture or equivalence proof.

## Status evidence

| stage | evidence |
| --- | --- |
| captured | source:698cb2f4cd6d001bcbeee95bca9be58c56c1cca3;core:48b7535ba020;receipts:2 |
| digest-verified | artifacts:10;digest-scope:sha256 over serializeDeterministic(envelope with packageDigest=""); covers the complete artifact index (including the summary.md row), the full handoff contract, and every envelope field. summary.md deliberately renders no packageDigest value so the digest has no self-reference |
| qualified-for-investigation | identity+predecessor-continuity+kind-set+layer-and-slice-denominators+privacy+digest-scope:verified-pre-write |

## Material layers

| layer | discovered | represented | excluded | duplicate | unresolved | bytes |
| --- | --- | --- | --- | --- | --- | --- |
| binary-media-model | 4216 | 4216 | 0 | 0 | 0 | 2825580298 |
| archived-openspec | 4573 | 4573 | 0 | 0 | 0 | 15283948 |
| active-openspec | 600 | 600 | 0 | 0 | 0 | 3872484 |
| generated-runtime-release | 47873 | 47873 | 0 | 0 | 0 | 483418340 |
| authored-course-content | 12962 | 12962 | 0 | 0 | 0 | 2124090031 |
| qa-browser-evidence | 2351 | 2351 | 0 | 0 | 0 | 281813911 |
| tests | 1425 | 1425 | 0 | 0 | 0 | 22417078 |
| tools-scripts | 469 | 469 | 0 | 0 | 0 | 8216919 |
| build-assets | 85 | 85 | 0 | 0 | 0 | 132463106 |
| hand-authored-production | 3940 | 3940 | 0 | 0 | 0 | 69019172 |
- layer reconciliation: tracked=78494 assigned=78494 unassigned=0

## Derived denominator slices

| slice | discovered | represented | excluded | duplicate | unresolved |
| --- | --- | --- | --- | --- | --- |
| compatibility | 109 | 109 | 0 | 0 | 0 |
| core-infrastructure | 936 | 70 | 866 | 0 | 0 |
| deep-import | 216 | 216 | 0 | 0 | 0 |
| delegate-only-wrapper | 109 | 23 | 86 | 0 | 0 |
| duplicate-owner | 1 | 1 | 0 | 0 | 0 |
| feature-to-app-router | 26 | 26 | 0 | 0 | 0 |
| public-entrypoint | 51 | 51 | 0 | 0 | 0 |
| scc | 14 | 14 | 0 | 0 | 0 |
| single-implementation-interface | 90 | 3 | 87 | 0 | 0 |
| src-lib-business | 936 | 866 | 70 | 0 | 0 |
| zero-caller | 2590 | 126 | 2464 | 0 | 0 |
- inventory kind set (18 kinds) matches predecessor: yes

## Aggregate observations

- owner residue: total=92 observation=56 ambiguous=1 unresolved=35
- hotspots: ranked=50/50 unresolvedMetrics=0
- payload classes: duplicateBlobs=2486 unresolved=60
- frozen receipts: 428e888776e52c415a1f6daa029110c029b20e2d790f030d155fbfde3b059c39, 5fa6bc476c928f27605dc055844244b5ab0d0d3909b5dd467690cadbba1360e9

## Artifact index

| locator | media type | bytes | sha256 |
| --- | --- | --- | --- |
| owner-residue.md | text/markdown | 46904 | faef106510d395af457f92f42dd89139e5612953625422d352fd3fa7f37d5bed |
| hotspots.md | text/markdown | 8473 | 7a94c8014206c89ad80b44d493139dbe0e0b178cd8fc30681be459a31e642e33 |
| payload-classes.md | text/markdown | 1939 | dad33b7865b18c35a6e3363d638125c8ef37960ae164cfc7063f85ca333c273f |
| test-baseline.md | text/markdown | 2715 | f12c71ab23358aab661ba17b267a1eaadf211fe238223efab6b7072d73810348 |
| artifacts/architecture-census/fa6e618d7a875412e975a14259dfac37c4cfed1bc6ca48095184f72bb0946d02/full-inventory.ndjson | application/x-ndjson | 24291767 | 0291c93d41de223f1698ee500cfe3b9024c4af42cfa04e4cc9a06d24b94bfc43 |
| artifacts/architecture-census/fa6e618d7a875412e975a14259dfac37c4cfed1bc6ca48095184f72bb0946d02/denominator-slices.ndjson | application/x-ndjson | 544830 | fdd760dee47b68d21867e25dbce483fbcfa08f9f3c88369af934897212b1be7a |
| artifacts/architecture-census/fa6e618d7a875412e975a14259dfac37c4cfed1bc6ca48095184f72bb0946d02/owner-residue.ndjson | application/x-ndjson | 170543 | fe14e3508282a15d371fb6ee7b42955081aa72e872c091e30417de024150e353 |
| artifacts/architecture-census/fa6e618d7a875412e975a14259dfac37c4cfed1bc6ca48095184f72bb0946d02/census-core.json | application/json | 23688347 | 48b7535ba020a40afc9dc5cd15e84114d7d0a9e35515c611c849c7db11d3695a |
| artifacts/architecture-census/fa6e618d7a875412e975a14259dfac37c4cfed1bc6ca48095184f72bb0946d02/receipts/428e888776e52c415a1f6daa029110c029b20e2d790f030d155fbfde3b059c39.json | application/json | 680 | 0edd9e92182ab1cd0a93b297e8db452dac62ea73b1b7ef797c601f1941d5c933 |
| artifacts/architecture-census/fa6e618d7a875412e975a14259dfac37c4cfed1bc6ca48095184f72bb0946d02/receipts/5fa6bc476c928f27605dc055844244b5ab0d0d3909b5dd467690cadbba1360e9.json | application/json | 10083 | 15d995a7f743e73228f9f1988b8ce79ed638f9e956e884fb29bda56232b0b196 |

## Read-only handoff contract

| consumer | required identity | required digest | locators | fail-closed rule |
| --- | --- | --- | --- | --- |
| B-owner-residue | fa6e618d7a875412e975a14259dfac37c4cfed1bc6ca48095184f72bb0946d02 | baseline.json:packageDigest | owner-residue.md; artifacts/architecture-census/fa6e618d7a875412e975a14259dfac37c4cfed1bc6ca48095184f72bb0946d02/owner-residue.ndjson | require exact successorCaptureId+packageDigest from this envelope; reject missing/stale/mixed/drifted inputs; A adjudicates nothing |
| C-payload-classes | fa6e618d7a875412e975a14259dfac37c4cfed1bc6ca48095184f72bb0946d02 | baseline.json:packageDigest | payload-classes.md; artifacts/architecture-census/fa6e618d7a875412e975a14259dfac37c4cfed1bc6ca48095184f72bb0946d02/full-inventory.ndjson | require exact successorCaptureId+packageDigest from this envelope; authority/materialization/retention decisions stay with C |
| D-test-baseline | fa6e618d7a875412e975a14259dfac37c4cfed1bc6ca48095184f72bb0946d02 | baseline.json:packageDigest | test-baseline.md; artifacts/architecture-census/fa6e618d7a875412e975a14259dfac37c4cfed1bc6ca48095184f72bb0946d02/receipts/428e888776e52c415a1f6daa029110c029b20e2d790f030d155fbfde3b059c39.json; artifacts/architecture-census/fa6e618d7a875412e975a14259dfac37c4cfed1bc6ca48095184f72bb0946d02/receipts/5fa6bc476c928f27605dc055844244b5ab0d0d3909b5dd467690cadbba1360e9.json | require exact successorCaptureId+packageDigest from this envelope; red commands stay observations; test qualification unchanged |
| N5-activation | fa6e618d7a875412e975a14259dfac37c4cfed1bc6ca48095184f72bb0946d02 | baseline.json:packageDigest | baseline.json | only N5 may recapture/prove equivalence and atomically activate baseline+charter+fitness+test qualification; HEAD drift requires N5 recapture |

## Non-adjudication

- Owner residue, payload classes, and test redness are observations only.
- This capture does not update `REQUIRED_BASELINE`, fitness budgets, test qualification, CI/runtime gates, or any active baseline pointer.
- Detail artifacts are reproducible local/CI artifacts addressed by the locators above; a missing or digest-mismatched locator fails closed.
