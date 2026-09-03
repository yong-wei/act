# Repository payload classification (current completion run)

- schemaVersion: `act-repository-payload-classification/v2`
- commandScope: `repository-payload-classification:classify`
- status: `package-unqualified`
- reason: `unresolved-members:175:missing-authority-manifest,unknown-privacy`
- current subject base: `origin/integration`
- current subjectCommit: `da0a360ba82e2fd966c8002bc87fff0c0cde3f88`
- current subjectTree: `d238c0f8680c3672b6ca595e281d43d8e185d7d3`
- current subjectIdentity: `0ff01632a3bdc2ef1f2ab6fb7926628b16ac67cd1c25dcf624c683018ac0ea37`
- predecessor change: `classify-repository-payload-authority-and-materialization` (#1881)
- predecessor subjectIdentity: `fa6e618d7a875412e975a14259dfac37c4cfed1bc6ca48095184f72bb0946d02`
- predecessor packageDigest: `3dfc0b74d38780a52fe046994cd1354079efb524d19a79eced9cfd5d1a42ad03`
- A successorCaptureId: `fa6e618d7a875412e975a14259dfac37c4cfed1bc6ca48095184f72bb0946d02`
- A packageDigest: `259ce5259694268d25d9b91825f070acf46b78ec0b34d26a0f4bb7686579ab12`
- A sourceCommit: `698cb2f4cd6d001bcbeee95bca9be58c56c1cca3`
- A sourceTree: `41d6b3f5966493911d6ce9c1f299015189778d53`
- toolCommit: `c8db95b124d7208ca198feafc0443d9e201a205d`
- toolTree: `7a08136e7816980aad1829f0846bd83ef9acafab`
- entryBundleDigest: `564f3a7d53eab7b96d2478ca4627950bae7804465f7de3c9fa101159f59226e5`
- frozenInputDigest: `c9963f22533ae736052178e2f43d48a0c810d57e481a77649aa2cc5247766bdc`
- packageDigest: `11833edb38beef8d33ba2a88884f085adb947caec42cf1d30b250f797a649990`
- full inventory: `artifacts/architecture-census/0ff01632a3bdc2ef1f2ab6fb7926628b16ac67cd1c25dcf624c683018ac0ea37/payload-classification-inventory.ndjson` sha256 `e33abf9b26326acbaaaa770346f1b1db7e8caed4a503a1bf5f78fab22fd04d3c`
- inventory verification: `e33abf9b26326acbaaaa770346f1b1db7e8caed4a503a1bf5f78fab22fd04d3c@reconciled=true`

This package is non-active planning evidence. It does not authorize deletion, movement, externalization, materialization, or selector change.

## Counts

| metric | value |
| --- | --- |
| members | 78605 |
| qualified | 78430 |
| unresolved | 175 |
| justified-excluded | 0 |
| exact-duplicate-groups | 2487 |
| generated-input-observations | 0 |
| A | 27164 |
| B | 49536 |
| C | 1666 |
| D | 29 |
| E | 0 |
| F | 35 |

## Slices

| slice | discovered | qualified | unresolved | justified-excluded | dup-groups | dup-refs |
| --- | --- | --- | --- | --- | --- | --- |
| course-content-releases | 1824 | 1666 | 158 | 0 | 344 | 1538 |
| course-content-runtime | 47314 | 47314 | 0 | 0 | 748 | 906 |
| artifacts | 2422 | 2422 | 0 | 0 | 170 | 573 |
| architecture-json | 33 | 33 | 0 | 0 | 1 | 2 |
| archived-openspec-evidence | 124 | 122 | 2 | 0 | 0 | 0 |
| wasm-package-generated | 1 | 1 | 0 | 0 | 0 | 0 |
| large-fixture-snapshot | 48 | 48 | 0 | 0 | 14 | 14 |
| infograph | 7208 | 7208 | 0 | 0 | 175 | 350 |
| pptx | 0 | 0 | 0 | 0 | 0 | 0 |
| ppm | 50 | 50 | 0 | 0 | 0 | 0 |
| emf | 165 | 165 | 0 | 0 | 1 | 2 |
| glb | 13 | 13 | 0 | 0 | 0 | 0 |
| json-family | 1574 | 1574 | 0 | 0 | 92 | 126 |
| other-captured | 17829 | 17814 | 15 | 0 | 1637 | 3328 |

## Compatibility checks

| name | status | detail |
| --- | --- | --- |
| qa-evidence-lifecycle | ok | ok |
| content-knowledge-runtime | unresolved | count-drift:scripts/knowledge-cutover:80 |

## Handoff

| field | value |
| --- | --- |
| current.subjectIdentity | 0ff01632a3bdc2ef1f2ab6fb7926628b16ac67cd1c25dcf624c683018ac0ea37 |
| current.subjectCommit | da0a360ba82e2fd966c8002bc87fff0c0cde3f88 |
| current.subjectTree | d238c0f8680c3672b6ca595e281d43d8e185d7d3 |
| predecessor.subjectIdentity | fa6e618d7a875412e975a14259dfac37c4cfed1bc6ca48095184f72bb0946d02 |
| predecessor.packageDigest | 3dfc0b74d38780a52fe046994cd1354079efb524d19a79eced9cfd5d1a42ad03 |
| A.successorCaptureId | fa6e618d7a875412e975a14259dfac37c4cfed1bc6ca48095184f72bb0946d02 |
| A.packageDigest | 259ce5259694268d25d9b91825f070acf46b78ec0b34d26a0f4bb7686579ab12 |
| C.toolCommit | c8db95b124d7208ca198feafc0443d9e201a205d |
| C.packageDigest | 11833edb38beef8d33ba2a88884f085adb947caec42cf1d30b250f797a649990 |
| fullInventory | artifacts/architecture-census/0ff01632a3bdc2ef1f2ab6fb7926628b16ac67cd1c25dcf624c683018ac0ea37/payload-classification-inventory.ndjson@e33abf9b26326acbaaaa770346f1b1db7e8caed4a503a1bf5f78fab22fd04d3c |

## Predecessor delta

| metric | value |
| --- | --- |
| predecessor tracked | 78494 |
| current tracked | 78605 |
| added | 139 |
| removed | 28 |
| unchanged | 78466 |
| added sample | artifacts/model-releases/type055-nanchang-101-v2.0.0/browser-acceptance/decals.json, artifacts/model-releases/type055-nanchang-101-v2.0.0/browser-acceptance/demo-clips.json, artifacts/model-releases/type055-nanchang-101-v2.0.0/browser-acceptance/destroyer-candidate-requests.json, artifacts/model-releases/type055-nanchang-101-v2.0.0/browser-acceptance/payload-lifecycle.json, artifacts/model-releases/type055-nanchang-101-v2.0.0/browser-acceptance/ship-animations.json |

## Evidence adapters

| adapter | candidates | proven | unresolved | drift | inputDigest |
| --- | --- | --- | --- | --- | --- |
| release-manifest | 1667 | 1666 | 1 | none | 4973cc07bd91e9f1 |
| content-compiler-toolchain | 47343 | 47343 | 0 | none | aad171f72722fe9e |
| qa-evidence-lifecycle | 2422 | 2422 | 0 | none | cd5da3eb22dd5ef9 |
| privacy-content-scan | 577 | 567 | 10 | none | 2037f8b7aa69eef9 |
