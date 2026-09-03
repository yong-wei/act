# Repository payload classification (current completion run)

- schemaVersion: `act-repository-payload-classification/v2`
- commandScope: `repository-payload-classification:classify`
- status: `package-unqualified`
- reason: `unresolved-members:459:missing-authority-manifest,unknown-privacy`
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
- toolCommit: `0593c0fa13df9b8cb6eff585fdeda0a0d3d468c9`
- toolTree: `b4746598fa9b75c906b4a77ffa38a4e54f94b04f`
- entryBundleDigest: `41565bcc6aa27f0f0f8623546d903cd43c25c301788036f37a61dc7bb23f2f5b`
- frozenInputDigest: `230e4084cc20344d35dfe1fa231670a5a1d71d7edfd17768a929dd2eedad5f4f`
- packageDigest: `94d0a346a4f1388e0c9942a2ff975a82cf230f8557bef7cea7aa23cbdaba6892`
- full inventory: `artifacts/architecture-census/cbb59abc7df9cf438bf80309c7eb09f59dd8d687fa1fcc41f16fee2de0977ffc/payload-classification-inventory.ndjson` sha256 `ccbd14f5a439e8f823a6c2080213e92e8014fceefe6aa0d16c3efdfa39b5b809`
- inventory verification: `ccbd14f5a439e8f823a6c2080213e92e8014fceefe6aa0d16c3efdfa39b5b809@reconciled=true`

This package is non-active planning evidence. It does not authorize deletion, movement, externalization, materialization, or selector change.

## Counts

| metric | value |
| --- | --- |
| members | 78630 |
| qualified | 78171 |
| unresolved | 459 |
| justified-excluded | 0 |
| exact-duplicate-groups | 2487 |
| generated-input-observations | 0 |
| A | 26188 |
| B | 4136 |
| C | 1666 |
| D | 29 |
| E | 46117 |
| F | 35 |

## Slices

| slice | discovered | qualified | unresolved | justified-excluded | bytes | dup-groups | dup-refs |
| --- | --- | --- | --- | --- | --- | --- | --- |
| course-content-releases | 1824 | 1666 | 158 | 0 | 1047071323 | 344 | 1538 |
| course-content-runtime | 48152 | 48048 | 104 | 0 | 732542439 | 1586 | 1744 |
| artifacts | 2422 | 2235 | 187 | 0 | 309122347 | 170 | 573 |
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
| other-captured | 16979 | 16972 | 7 | 0 | 727285477 | 1632 | 2481 |

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
| C.toolCommit | 0593c0fa13df9b8cb6eff585fdeda0a0d3d468c9 |
| C.packageDigest | 94d0a346a4f1388e0c9942a2ff975a82cf230f8557bef7cea7aa23cbdaba6892 |
| fullInventory | artifacts/architecture-census/cbb59abc7df9cf438bf80309c7eb09f59dd8d687fa1fcc41f16fee2de0977ffc/payload-classification-inventory.ndjson@ccbd14f5a439e8f823a6c2080213e92e8014fceefe6aa0d16c3efdfa39b5b809 |

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
| content-compiler-toolchain | 2120 | 2120 | 0 | none | aad171f72722fe9e |
| knowledge-cutover-runtime | 46117 | 46117 | 0 | none | 102f82e124e84e59 |
| qa-evidence-lifecycle | 2422 | 2235 | 187 | none | cd5da3eb22dd5ef9 |
| privacy-content-scan | 579 | 567 | 12 | none | d44fa47dfad9e979 |
| privacy-content-scan | 70613 | 70438 | 175 | none | a454907b083f7e8c |
