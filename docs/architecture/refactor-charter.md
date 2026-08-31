# Modular monolith refactor charter

- schemaVersion: `act-architecture-charter/v1`
- baseline.sourceCommit: `58c77cbf6e0f6cd284e1eea6a39ca4df8854ebac`
- baseline.sourceTree: `189dfeb5ad35f1d88e8ea5509a48b388424bf88f`
- baseline.schemaVersion: `act-architecture-census/v1`
- baseline.censusCoreSha256: `40549dcad9b03da31abc6ef05c5ede5bff4e04b47268f86450831aa39788c52a`
- frozenReceiptIds: `04f4626cc380f82f428ad0776bfbd55eb718c6577f5ecd1b5e2a38102b96163f`, `0e6d415a23bbd074f3dc6630c43fdfadc176c7cb7d3a060ed0570a42e5aa53d7`

This charter is governance-only. It does not change product routes, authorization, persistence, tests, TypeScript, CI, runtime, or production selectors.

## Owner catalog

| owner | label | owned records |
| --- | --- | --- |
| assessment | Assessment | 151 |
| personalization | Personalization | 97 |
| learning-record | Learning Record | 279 |
| course | Course | 535 |
| classroom | Classroom | 133 |
| assignment | Assignment | 155 |
| practice-lab | Practice Lab | 86 |
| arena | Arena | 144 |
| knowledge | Knowledge/Resource governance | 243 |
| identity | Identity/Authorization | 5 |
| platform | Platform/Delivery infrastructure | 2350 |

- owned records: 4178
- gates: 432
- compatibility: 99
- blocking: 0

Existing `frontend-build-source-boundary`, `owned-surface-module-hygiene`, `server-action-and-route-safety`, `app-router-rendering-boundary-safety`, and `stable-dependency-chain-migration` remain authoritative in their scopes.
