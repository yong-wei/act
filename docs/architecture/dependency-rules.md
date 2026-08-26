# Dependency rules

- schemaVersion: `act-architecture-charter/v1`
- baseline.sourceCommit: `58c77cbf6e0f6cd284e1eea6a39ca4df8854ebac`
- baseline.sourceTree: `189dfeb5ad35f1d88e8ea5509a48b388424bf88f`
- baseline.schemaVersion: `act-architecture-census/v1`
- baseline.censusCoreSha256: `40549dcad9b03da31abc6ef05c5ede5bff4e04b47268f86450831aa39788c52a`
- frozenReceiptIds: `04f4626cc380f82f428ad0776bfbd55eb718c6577f5ecd1b5e2a38102b96163f`, `0e6d415a23bbd074f3dc6630c43fdfadc176c7cb7d3a060ed0570a42e5aa53d7`

This charter is governance-only. It does not change product routes, authorization, persistence, tests, TypeScript, CI, runtime, or production selectors.

Later enforcement consumes this charter and the predecessor baseline graph. This document does not activate a lint or CI gate.

- New cross-domain calls use a stable public API or application use case.
- Production `feature -> app` imports are forbidden except allowlisted historical edges.
- Cross-domain deep imports are forbidden except allowlisted historical edges.
- Domain core must not import Prisma, Next, React, route modules, or database clients.
- New business code in `src/lib` is frozen unless a chartered platform exception exists.
- Test and framework-convention imports stay classified separately from production inversions.

Owned records feeding these rules: 4178.

The first deletion slice is `decouple-teacher-diagnosis-route-contract`. Remaining edges are staged by `enforce-modular-domain-dependency-contracts`.

Fitness allowlist identity: `64a7434d6d0568e88dc98b79c1371adde21176381ca179ca849b602b01c33718`. Remaining staged entries: 1490.
