# Production-selection and v1-retirement checklist

Status: executed 2026-08-16. Hybrid Git-source v2 is active; imported-equivalent v2 is rollback; unused v1 ossfs prefix is unmounted. OSS v1 bodies were not deleted.

## Already satisfied

- Production serves hybrid Git-source v2 `runtime-3dcc71669bdbb68e5304adf7925e49f75b1e747da5e9c7ed03ff689` (source `0ab2b637`, 11302 files). Rollback is imported-equivalent v2 `runtime-e47451bf8f94caec207232e16f822f2ee87cd79fdb5f20b9bcf60c6`.
- ECS IMDS role is `act-runtime-oss-read`. Put/Delete on `runtime/blob-releases/` return 403 AccessDenied.
- Local publisher is `act-runtime-publisher-local` via keychain launcher. Credentials are not in the repository.
- Local ECS `course-content/runtime` is empty (0 files). App bind uses `data/runtime/blob-views/current`.
- Hybrid index is present at `resources/textbook-hybrid-retrieval/bge-m3/*`. `/api/readyz` 200, course 200, media 307.
- Unused v1 ossfs prefix is unmounted. OSS `runtime/releases/*` bodies were deleted on 2026-08-16 after a reviewed dry-run (`planSha256=8fec8dc2…`).

## Required before v1 unmount

1. Hybrid release published (terminal OSS manifest + receipt). Done.
2. Hybrid view materialized and selected; `/api/readyz` 200; course 200; media 307; helper public path 404; hybrid index files readable inside the app bind. Done.
3. Lifecycle records hybrid as `active` and imported-equivalent `runtime-e47451…` as `rollback`. Done.
4. One real rollback drill: hybrid → e47451 → resume hybrid, with readyz after each switch. Done.
5. Explicit authorization to unmount unused v1 ossfs. Done; prefix unmounted, OSS bodies retained.

## v1 retirement allowed after the above

- Unmount unused v1 prefix `runtime/releases/runtime-e47451…` ossfs unit.
- Optionally unmount leftover candidate mount `blob-candidate-runtime-406e64…`.
- Do **not** OSS-delete `runtime/releases/*` bodies. There is no reviewed delete adapter, and the local publisher must not delete v1.
- Do **not** GC active, rollback, or publishing blobs.
- Keep imported v2 manifest/receipt and the v1/v2 equivalence proof.

## Still not authorized here

- Deleting unused Podman images (optional disk reclaim, separate authorization).
- Building or loading a new application image on the 49G root.
- Deleting protected v2 blob-releases or reachable blobs.
