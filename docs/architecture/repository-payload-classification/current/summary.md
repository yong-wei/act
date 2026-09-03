# Repository payload classification (current completion run)

- schemaVersion: `act-repository-payload-classification/v2`
- commandScope: `repository-payload-classification:classify`
- status: `package-unqualified`
- reason: `unresolved-members:531:missing-authority-manifest,unknown-privacy`
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
- toolCommit: `fc1486733240068d026be869e8e8f0ef24821a96`
- toolTree: `95c26fa9fd157126857cacbf561098acf03f8fd6`
- entryBundleDigest: `d5815b438e3c6d52781b49fb1ae70ca001b5f504f754fa6a5c43464f27ea56e7`
- frozenInputDigest: `5a428249d02217d926cc7844e476ddaab562b9761cb438cb247acb6bcb2a5b52`
- packageDigest: `6f4fc1cd2c24956a4070183ba7b18e67ae88c79c11dd4b123b5d67ac1f80b1f3`
- full inventory: `artifacts/architecture-census/cbb59abc7df9cf438bf80309c7eb09f59dd8d687fa1fcc41f16fee2de0977ffc/payload-classification-inventory.ndjson` sha256 `ec2de62b017ef868cc0771657cfb13ade867caa26292db6a2855a9c0bd664a62`
- inventory verification: `ec2de62b017ef868cc0771657cfb13ade867caa26292db6a2855a9c0bd664a62@reconciled=true`

This package is non-active planning evidence. It does not authorize deletion, movement, externalization, materialization, or selector change.

## Counts

| metric | value |
| --- | --- |
| members | 78630 |
| qualified | 78099 |
| unresolved | 531 |
| justified-excluded | 0 |
| exact-duplicate-groups | 2487 |
| generated-input-observations | 0 |
| A | 26145 |
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
| architecture-json | 33 | 33 | 0 | 0 | 30091917 | 1 | 2 |
| archived-openspec-evidence | 124 | 122 | 2 | 0 | 18962938 | 0 | 0 |
| wasm-package-generated | 1 | 1 | 0 | 0 | 929021 | 0 | 0 |
| large-fixture-snapshot | 48 | 48 | 0 | 0 | 3841574 | 14 | 14 |
| infograph | 7208 | 7207 | 1 | 0 | 1633736825 | 175 | 350 |
| pptx | 35 | 35 | 0 | 0 | 342644474 | 5 | 10 |
| ppm | 50 | 50 | 0 | 0 | 314759531 | 0 | 0 |
| emf | 165 | 165 | 0 | 0 | 215864588 | 1 | 2 |
| glb | 13 | 13 | 0 | 0 | 180903796 | 0 | 0 |
| json-family | 1576 | 1576 | 0 | 0 | 459336983 | 92 | 126 |
| other-captured | 16979 | 16929 | 50 | 0 | 727285477 | 1632 | 2481 |

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
| C.toolCommit | fc1486733240068d026be869e8e8f0ef24821a96 |
| C.packageDigest | 6f4fc1cd2c24956a4070183ba7b18e67ae88c79c11dd4b123b5d67ac1f80b1f3 |
| fullInventory | artifacts/architecture-census/cbb59abc7df9cf438bf80309c7eb09f59dd8d687fa1fcc41f16fee2de0977ffc/payload-classification-inventory.ndjson@ec2de62b017ef868cc0771657cfb13ade867caa26292db6a2855a9c0bd664a62 |

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
| consumer-reference | 1496 | 1496 | 0 | none | fd3c97463da34165 |
| privacy-content-scan | 70613 | 69298 | 1315 | none | a454907b083f7e8c |
