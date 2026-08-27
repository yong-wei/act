# Bounded-context map

- schemaVersion: `act-architecture-charter/v1`
- baseline.sourceCommit: `58c77cbf6e0f6cd284e1eea6a39ca4df8854ebac`
- baseline.sourceTree: `189dfeb5ad35f1d88e8ea5509a48b388424bf88f`
- baseline.schemaVersion: `act-architecture-census/v1`
- baseline.censusCoreSha256: `40549dcad9b03da31abc6ef05c5ede5bff4e04b47268f86450831aa39788c52a`
- frozenReceiptIds: `04f4626cc380f82f428ad0776bfbd55eb718c6577f5ecd1b5e2a38102b96163f`, `0e6d415a23bbd074f3dc6630c43fdfadc176c7cb7d3a060ed0570a42e5aa53d7`

This charter is governance-only. It does not change product routes, authorization, persistence, tests, TypeScript, CI, runtime, or production selectors.

Product, toolchain, data, and release surfaces are owned by the platform boundary unless a domain rule matches first.

| context | owner | records |
| --- | --- | --- |
| Assessment | assessment | 151 |
| Personalization | personalization | 97 |
| Learning Record | learning-record | 279 |
| Course | course | 535 |
| Classroom | classroom | 133 |
| Assignment | assignment | 155 |
| Practice Lab | practice-lab | 86 |
| Arena | arena | 144 |
| Knowledge/Resource governance | knowledge | 243 |
| Identity/Authorization | identity | 5 |
| Platform/Delivery infrastructure | platform | 2350 |

Allowed direction: App Router / Server Action -> domain public-api or application use case -> domain core + ports -> adapters -> Prisma/Next/external.
