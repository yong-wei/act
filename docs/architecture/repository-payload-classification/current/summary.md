# Repository payload classification (current completion run)

- schemaVersion: `act-repository-payload-classification/v2`
- commandScope: `repository-payload-classification:classify`
- status: `package-unqualified`
- reason: `unresolved-members:1770:missing-authority-manifest,unknown-privacy`
- current subject base: `origin/integration`
- current subjectCommit: `38dde29f4a55bc672530af3a925c93dc41401687`
- current subjectTree: `d031bfe43e679d3a60681ebc8fcbcf6f30619d00`
- current subjectIdentity: `cbb59abc7df9cf438bf80309c7eb09f59dd8d687fa1fcc41f16fee2de0977ffc`
- predecessor change: `classify-repository-payload-authority-and-materialization` (#1881)
- predecessor subjectIdentity: `fa6e618d7a875412e975a14259dfac37c4cfed1bc6ca48095184f72bb0946d02`
- predecessor packageDigest: `3dfc0b74d38780a52fe046994cd1354079efb524d19a79eced9cfd5d1a42ad03`
- A successorCaptureId: `fa6e618d7a875412e975a14259dfac37c4cfed1bc6ca48095184f72bb0946d02`
- A packageDigest: `259ce5259694268d25d9b91825f070acf46b78ec0b34d26a0f4bb7686579ab12`
- A sourceCommit: `698cb2f4cd6d001bcbeee95bca9be58c56c1cca3`
- A sourceTree: `41d6b3f5966493911d6ce9c1f299015189778d53`
- toolCommit: `36cb8b54cd1cb17e51da4d61bf26f94950acbe68`
- toolTree: `04a9db41bfb3b8b69b159da22c695d7aae07456a`
- entryBundleDigest: `afa596f79e138a7702e752f4e86343f5a3943ada64f2b5b6ec84e26907b21dae`
- frozenInputDigest: `618a16f4134fd0cd75b74d27392a74f92c9a2e6695e91ebbe759c719c628abda`
- packageDigest: `1d3822f2de02fb0e4f11b9b055c3aba3e0b061776dbffe0fd74a1dcac30eecff`
- full inventory: `artifacts/architecture-census/cbb59abc7df9cf438bf80309c7eb09f59dd8d687fa1fcc41f16fee2de0977ffc/payload-classification-inventory.ndjson` sha256 `a1a30b24a71b5f39a7b830d777ce3d3062078e4bf125c05435f320787672f255`
- inventory verification: `a1a30b24a71b5f39a7b830d777ce3d3062078e4bf125c05435f320787672f255@reconciled=true`

This package is non-active planning evidence. It does not authorize deletion, movement, externalization, materialization, or selector change.

## Counts

| metric | value |
| --- | --- |
| members | 78630 |
| qualified | 76860 |
| unresolved | 1770 |
| justified-excluded | 0 |
| exact-duplicate-groups | 2487 |
| generated-input-observations | 0 |
| A | 24906 |
| B | 4133 |
| C | 1643 |
| D | 29 |
| E | 46114 |
| F | 35 |

## Slices

| slice | discovered | qualified | unresolved | justified-excluded | bytes | dup-groups | dup-refs |
| --- | --- | --- | --- | --- | --- | --- | --- |
| course-content-releases | 1824 | 1643 | 181 | 0 | 1047071323 | 344 | 1538 |
| course-content-runtime | 48152 | 48044 | 108 | 0 | 732542439 | 1586 | 1744 |
| artifacts | 2422 | 2233 | 189 | 0 | 309122347 | 170 | 573 |
| architecture-json | 33 | 28 | 5 | 0 | 30091917 | 1 | 2 |
| archived-openspec-evidence | 124 | 115 | 9 | 0 | 18962938 | 0 | 0 |
| wasm-package-generated | 1 | 1 | 0 | 0 | 929021 | 0 | 0 |
| large-fixture-snapshot | 48 | 48 | 0 | 0 | 3841574 | 14 | 14 |
| infograph | 7208 | 7043 | 165 | 0 | 1633736825 | 175 | 350 |
| pptx | 35 | 35 | 0 | 0 | 342644474 | 5 | 10 |
| ppm | 50 | 50 | 0 | 0 | 314759531 | 0 | 0 |
| emf | 165 | 165 | 0 | 0 | 215864588 | 1 | 2 |
| glb | 13 | 13 | 0 | 0 | 180903796 | 0 | 0 |
| json-family | 1576 | 1406 | 170 | 0 | 459336983 | 92 | 126 |
| other-captured | 16979 | 16036 | 943 | 0 | 727285477 | 1632 | 2481 |

## Compatibility checks

| name | status | detail |
| --- | --- | --- |
| qa-evidence-lifecycle | ok | ok |
| content-knowledge-runtime | unresolved | count-drift:scripts/knowledge-cutover:80 |

## Handoff

| field | value |
| --- | --- |
| current.subjectIdentity | cbb59abc7df9cf438bf80309c7eb09f59dd8d687fa1fcc41f16fee2de0977ffc |
| current.subjectCommit | 38dde29f4a55bc672530af3a925c93dc41401687 |
| current.subjectTree | d031bfe43e679d3a60681ebc8fcbcf6f30619d00 |
| predecessor.subjectIdentity | fa6e618d7a875412e975a14259dfac37c4cfed1bc6ca48095184f72bb0946d02 |
| predecessor.packageDigest | 3dfc0b74d38780a52fe046994cd1354079efb524d19a79eced9cfd5d1a42ad03 |
| A.successorCaptureId | fa6e618d7a875412e975a14259dfac37c4cfed1bc6ca48095184f72bb0946d02 |
| A.packageDigest | 259ce5259694268d25d9b91825f070acf46b78ec0b34d26a0f4bb7686579ab12 |
| C.toolCommit | 36cb8b54cd1cb17e51da4d61bf26f94950acbe68 |
| C.packageDigest | 1d3822f2de02fb0e4f11b9b055c3aba3e0b061776dbffe0fd74a1dcac30eecff |
| fullInventory | artifacts/architecture-census/cbb59abc7df9cf438bf80309c7eb09f59dd8d687fa1fcc41f16fee2de0977ffc/payload-classification-inventory.ndjson@a1a30b24a71b5f39a7b830d777ce3d3062078e4bf125c05435f320787672f255 |

## Predecessor delta

| metric | value |
| --- | --- |
| predecessor tracked | 78494 |
| current tracked | 78630 |
| added | 3442 |
| removed | 3306 |
| modified | 60 |
| unchanged | 75128 |
| added sample | artifacts/model-releases/type055-nanchang-101-v2.0.0/browser-acceptance/decals.json, artifacts/model-releases/type055-nanchang-101-v2.0.0/browser-acceptance/demo-clips.json, artifacts/model-releases/type055-nanchang-101-v2.0.0/browser-acceptance/destroyer-candidate-requests.json, artifacts/model-releases/type055-nanchang-101-v2.0.0/browser-acceptance/payload-lifecycle.json, artifacts/model-releases/type055-nanchang-101-v2.0.0/browser-acceptance/ship-animations.json |

## Evidence adapters

| adapter | candidates | proven | unresolved | drift | inputDigest |
| --- | --- | --- | --- | --- | --- |
| release-manifest | 1667 | 1666 | 1 | none | 4973cc07bd91e9f1 |
| content-compiler-toolchain | 2120 | 2120 | 0 | none | b90356cb33325da2 |
| knowledge-cutover-runtime | 46117 | 46117 | 0 | none | 622e9696b4a66208 |
| qa-evidence-lifecycle | 2422 | 2233 | 189 | none | cd5da3eb22dd5ef9 |
| privacy-content-scan | 579 | 534 | 45 | none | d44fa47dfad9e979 |
| consumer-reference | 0 | 0 | 0 | none | fd3c97463da34165 |
| privacy-content-scan | 70613 | 69298 | 1315 | none | a454907b083f7e8c |
