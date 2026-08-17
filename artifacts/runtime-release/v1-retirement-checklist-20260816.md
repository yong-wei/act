# Production-selection and v1-retirement checklist

Status: **executed 2026-08-16**. Hybrid Git-source v2 is active; imported-equivalent v2 is rollback; unused v1 ossfs prefix is unmounted; OSS `runtime/releases/*` bodies were deleted (`planSha256=8fec8dc2…`, `receiptSha256=b2017b53…`, 20,458 objects). Protected v2 blob-releases and 11,156 reachable blobs were retained.

## Already satisfied

- Production serves hybrid Git-source v2 `runtime-3dcc71669bdbb68e5304adf7925e49f75b1e747da5e9c7ed03ff689` (source `0ab2b637`, 11302 files). Rollback is imported-equivalent v2 `runtime-e47451bf8f94caec207232e16f822f2ee87cd79fdb5f20b9bcf60c6`.
- ECS IMDS role is `act-runtime-oss-read`. Put/Delete on `runtime/blob-releases/` return 403 AccessDenied. AbortMultipartUpload against a non-existent upload id returned 404 NoSuchUpload and is not a completed abort-denial proof.
- Local publisher is `act-runtime-publisher-local` via keychain launcher. Credentials are not in the repository.
- Local ECS `course-content/runtime` is empty (0 files). App bind uses `data/runtime/blob-views/current`.
- Hybrid index is present at `resources/textbook-hybrid-retrieval/bge-m3/*`. `/api/readyz` 200, course 200, media 307.
- Unused v1 ossfs prefix is unmounted. OSS `runtime/releases/` KeyCount=0 after the reviewed deletion.

## Completed before the executed deletion

1. Hybrid release published (terminal OSS manifest + receipt).
2. Hybrid view materialized and selected; `/api/readyz` 200; course 200; media 307; helper public path 404; hybrid index files readable inside the app bind.
3. Lifecycle records hybrid as `active` and imported-equivalent `runtime-e47451…` as `rollback`.
4. One real rollback drill: hybrid → e47451 → resume hybrid, with readyz after each switch.
5. Explicit authorization to unmount unused v1 ossfs, then to delete unused v1 OSS prefixes.

## Executed retirement

- Unmounted unused v1 prefix `runtime/releases/runtime-e47451…` ossfs unit.
- Deleted 20,458 unused `runtime/releases/*` objects / 0 unreachable blobs. See `unused-oss-runtime-retirement-receipt-20260816.json` and `unused-oss-runtime-retirement-attestation-20260816.json`.
- Did not delete `runtime/blob-releases/` manifests or receipts.
- Did not GC active, rollback, or publishing blobs.

## 4.4 closeout verification (2026-08-17)

Recorded on `origin/integration` at `f122c02e7` after PR #1434.

- Typecheck: `NODE_OPTIONS=--max-old-space-size=8192 npm run typecheck` passed.
- Runtime Python suites: 66 tests passed (lifecycle, materialization, GC, activation, host-state, unused retirement).
- Runtime/deploy Node suites passed: remote-deploy, blob-view/runtime-only/externalized deploy contracts, release CLI/activation/legacy retirement, OSS publisher bridge, server-ops, docker readiness, cutover-aware refresh, cutover app-only.
- Build: `NODE_MAX_OLD_SPACE_SIZE=12288 npm run build` passed (wasm reuse, prisma generate, Next production compile).
- Lint on current integration: 0 errors, 4 pre-existing `react-hooks/exhaustive-deps` warnings in `profile/portfolio` and `active-authority-graph` (outside this change).
- `npm test` smoke/arena/smart-courseware passed; commercial-ui-governance failed on unrelated knowledge/adaptive-path visual-evidence drift.

Production-selection and v1-retirement authorization already executed 2026-08-16. This file is that checklist.

## Still not authorized

- Deleting unused Podman images (optional disk reclaim, separate authorization).
- Building or loading a new application image on the 49G root.
- Deleting protected v2 blob-releases or reachable blobs.
