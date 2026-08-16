# Unused OSS runtime retirement

Status: **executed 2026-08-16**. Receipt digest `b2017b5339353ffc755f53a7aa4cb353aeb1bf830834b634e40a3f30bfa59024`.

Plan digest: `8fec8dc2b179e6a3b47e9f92d68325d69498ac9d2cfd8dce7ce372f25276630d`  
Machine-readable plan: `unused-oss-runtime-retirement-plan-20260816.json`  
Serving proof: `unused-oss-runtime-retirement-serving-proof-20260816.json`

## Serving fence

- Marker mode: `v2`
- Lifecycle generation: `10`
- Active: `runtime-3dcc71669bdbb68e5304adf7925e49f75b1e747da5e9c7ed03ff689`
- Rollback: `runtime-e47451bf8f94caec207232e16f822f2ee87cd79fdb5f20b9bcf60c6`
- desired / publishing / retained: empty
- `/api/readyz`: 200
- v1 ossfs prefix: unmounted; only blob helper FUSE remains

## Would delete: v1 prefixes only

| Prefix | Objects | Bytes |
| --- | ---: | ---: |
| `runtime/releases/_transport-probes/` | 4 | 460 |
| `runtime/releases/runtime-406e64…/` | 2 | 1,008,977 |
| `runtime/releases/runtime-b2f0b07…/` | 10,223 | 5,928,278,127 |
| `runtime/releases/runtime-e47451…/` | 10,229 | 6,365,106,509 |
| **Total** | **20,458** | **12,294,394,073 (~11.45 GiB)** |

## Would not delete

- `runtime/blob-releases/runtime-3dcc716…/{manifest,receipt}.json`
- `runtime/blob-releases/runtime-e47451…/{manifest,receipt}.json`
- 11,156 blobs / 6,383,561,957 bytes reachable from active + rollback

## Unreachable blobs

Current inventory: **0 objects / 0 bytes**.

Every existing `runtime/blobs/sha256/*` object is referenced by the protected v2 pair. The hybrid increment reused the imported blob set; leftover unique bytes are in the v1 prefix trees, not in orphan blobs.

The adapter still includes unreachable-blob deletion so a later execute or a later increment can collect orphans without a second tool. This dry-run simply found none.

## Execute (completed)

- Deleted 20,458 v1 objects / 0 unreachable blobs.
- Post-check: `runtime/releases/` KeyCount=0.
- Post-check: both v2 blob-releases remain.
- Production marker still `v2`; local and public `/api/readyz` 200.

## Execute command that was used

```bash
/Users/YW/.local/bin/act-runtime-publisher python3 scripts/runtime-release/retire-unused-oss-runtime.py execute \
  --bucket act-course-assets \
  --expected-active-release runtime-3dcc71669bdbb68e5304adf7925e49f75b1e747da5e9c7ed03ff689 \
  --expected-rollback-release runtime-e47451bf8f94caec207232e16f822f2ee87cd79fdb5f20b9bcf60c6 \
  --serving-proof artifacts/runtime-release/unused-oss-runtime-retirement-serving-proof-20260816.json \
  --ossutil-path /Users/YW/.local/opt/act-runtime-publisher/bin/ossutil \
  --plan artifacts/runtime-release/unused-oss-runtime-retirement-plan-20260816.json \
  --authorize-unused-oss-runtime-deletion yes \
  --receipt-output artifacts/runtime-release/unused-oss-runtime-retirement-receipt-20260816.json
```

Execute rebuilds the plan and refuses to delete if the live object set or serving identities drifted.
