# Repository payload classification (current completion run)

- schemaVersion: `act-repository-payload-classification/v2`
- commandScope: `repository-payload-classification:classify`
- status: `package-unqualified`
- reason: `unresolved-members:612:missing-authority-manifest,unknown-privacy`
- current subject base: `origin/integration`
- current subjectCommit: `2b7e67a6b3417c0e562771541d8d2ef1586e8766`
- current subjectTree: `a8b08125f2f6aef2b0ffdc91011e0313aa3179b7`
- current subjectIdentity: `571cec2b60938395c7a64155121fd47347b8d70f9d9fb9a3c891d3fa3507a836`
- predecessor change: `classify-repository-payload-authority-and-materialization` (#1881)
- predecessor subjectIdentity: `fa6e618d7a875412e975a14259dfac37c4cfed1bc6ca48095184f72bb0946d02`
- predecessor packageDigest: `3dfc0b74d38780a52fe046994cd1354079efb524d19a79eced9cfd5d1a42ad03`
- A successorCaptureId: `fa6e618d7a875412e975a14259dfac37c4cfed1bc6ca48095184f72bb0946d02`
- A packageDigest: `259ce5259694268d25d9b91825f070acf46b78ec0b34d26a0f4bb7686579ab12`
- A sourceCommit: `698cb2f4cd6d001bcbeee95bca9be58c56c1cca3`
- A sourceTree: `41d6b3f5966493911d6ce9c1f299015189778d53`
- toolCommit: `f82df8936d3b9f925fdf2d1b442cb2bc6fd9cf21`
- toolTree: `efc9cad19815be3e170782878d06a51764ad361d`
- entryBundleDigest: `e10bbbeede89b3a8d1ce419ae600cce9ee233906ed3b85d1e1ec5851fcf2997d`
- frozenInputDigest: `93e745c37cedcd846bb1bd5bb06169cb532e65207542a76de1a5bf5d72e6aaef`
- packageDigest: `3c40b888f84d720c1dfd4455e06e71051ae59c2b1ed0e7fb8d20569f2353af08`
- full inventory: `artifacts/architecture-census/571cec2b60938395c7a64155121fd47347b8d70f9d9fb9a3c891d3fa3507a836/payload-classification-inventory.ndjson` sha256 `25a0d73d86b2a09057f2e611e2076008027c53c4a1fccec990ed23f3cb14a447`
- inventory verification: `25a0d73d86b2a09057f2e611e2076008027c53c4a1fccec990ed23f3cb14a447@reconciled=true`

This package is non-active planning evidence. It does not authorize deletion, movement, externalization, materialization, or selector change.

## Counts

| metric | value |
| --- | --- |
| members | 78619 |
| qualified | 78007 |
| unresolved | 612 |
| justified-excluded | 0 |
| exact-duplicate-groups | 2487 |
| generated-input-observations | 0 |
| A | 25953 |
| B | 4102 |
| C | 1666 |
| D | 29 |
| E | 46222 |
| F | 35 |

## Slices

| slice | discovered | qualified | unresolved | justified-excluded | dup-groups | dup-refs |
| --- | --- | --- | --- | --- | --- | --- |
| course-content-releases | 1824 | 1666 | 158 | 0 | 344 | 1538 |
| course-content-runtime | 48152 | 48152 | 0 | 0 | 1586 | 1744 |
| artifacts | 2422 | 2171 | 251 | 0 | 170 | 573 |
| architecture-json | 33 | 33 | 0 | 0 | 1 | 2 |
| archived-openspec-evidence | 124 | 117 | 7 | 0 | 0 | 0 |
| wasm-package-generated | 1 | 1 | 0 | 0 | 0 | 0 |
| large-fixture-snapshot | 48 | 48 | 0 | 0 | 14 | 14 |
| infograph | 7208 | 7208 | 0 | 0 | 175 | 350 |
| pptx | 35 | 35 | 0 | 0 | 5 | 10 |
| ppm | 50 | 50 | 0 | 0 | 0 | 0 |
| emf | 165 | 165 | 0 | 0 | 1 | 2 |
| glb | 13 | 13 | 0 | 0 | 0 | 0 |
| json-family | 1576 | 1576 | 0 | 0 | 92 | 126 |
| other-captured | 16968 | 16772 | 196 | 0 | 1632 | 2481 |

## Compatibility checks

| name | status | detail |
| --- | --- | --- |
| qa-evidence-lifecycle | ok | ok |
| content-knowledge-runtime | unresolved | count-drift:scripts/knowledge-cutover:80 |

## Handoff

| field | value |
| --- | --- |
| current.subjectIdentity | 571cec2b60938395c7a64155121fd47347b8d70f9d9fb9a3c891d3fa3507a836 |
| current.subjectCommit | 2b7e67a6b3417c0e562771541d8d2ef1586e8766 |
| current.subjectTree | a8b08125f2f6aef2b0ffdc91011e0313aa3179b7 |
| predecessor.subjectIdentity | fa6e618d7a875412e975a14259dfac37c4cfed1bc6ca48095184f72bb0946d02 |
| predecessor.packageDigest | 3dfc0b74d38780a52fe046994cd1354079efb524d19a79eced9cfd5d1a42ad03 |
| A.successorCaptureId | fa6e618d7a875412e975a14259dfac37c4cfed1bc6ca48095184f72bb0946d02 |
| A.packageDigest | 259ce5259694268d25d9b91825f070acf46b78ec0b34d26a0f4bb7686579ab12 |
| C.toolCommit | f82df8936d3b9f925fdf2d1b442cb2bc6fd9cf21 |
| C.packageDigest | 3c40b888f84d720c1dfd4455e06e71051ae59c2b1ed0e7fb8d20569f2353af08 |
| fullInventory | artifacts/architecture-census/571cec2b60938395c7a64155121fd47347b8d70f9d9fb9a3c891d3fa3507a836/payload-classification-inventory.ndjson@25a0d73d86b2a09057f2e611e2076008027c53c4a1fccec990ed23f3cb14a447 |

## Predecessor delta

| metric | value |
| --- | --- |
| predecessor tracked | 78494 |
| current tracked | 78619 |
| added | 3431 |
| removed | 3306 |
| modified | 45 |
| unchanged | 75143 |
| added sample | artifacts/model-releases/type055-nanchang-101-v2.0.0/browser-acceptance/decals.json, artifacts/model-releases/type055-nanchang-101-v2.0.0/browser-acceptance/demo-clips.json, artifacts/model-releases/type055-nanchang-101-v2.0.0/browser-acceptance/destroyer-candidate-requests.json, artifacts/model-releases/type055-nanchang-101-v2.0.0/browser-acceptance/payload-lifecycle.json, artifacts/model-releases/type055-nanchang-101-v2.0.0/browser-acceptance/ship-animations.json |

## Evidence adapters

| adapter | candidates | proven | unresolved | drift | inputDigest |
| --- | --- | --- | --- | --- | --- |
| release-manifest | 1667 | 1666 | 1 | none | 4973cc07bd91e9f1 |
| content-compiler-toolchain | 2120 | 2120 | 0 | none | aad171f72722fe9e |
| knowledge-cutover-runtime | 46222 | 46222 | 0 | none | 102f82e124e84e59 |
| qa-evidence-lifecycle | 2422 | 2171 | 251 | none | cd5da3eb22dd5ef9 |
| privacy-content-scan | 577 | 381 | 196 | none | ac573b777b0bec7a |
