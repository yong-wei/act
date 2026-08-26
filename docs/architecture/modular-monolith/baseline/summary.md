# Modular monolith architecture census

- schemaVersion: `act-architecture-census/v1`
- sourceCommit: `0a80fdeaaafece36c4a957d997dff19feb4e5692`
- sourceTree: `0dc2667af95cdd0321abb9227246465aca4743c5`
- commitTime: `2026-08-26T21:36:19+08:00`
- observations: 27526

This baseline does not activate architecture rules or change product, CI, database, runtime, or production selectors.

## Inventory denominators

| kind | discovered | represented | excluded | duplicate | unresolved |
| --- | --- | --- | --- | --- | --- |
| entrypoint | 246 | 246 | 0 | 0 | 0 |
| route | 465 | 465 | 0 | 0 | 0 |
| api | 224 | 224 | 0 | 0 | 0 |
| prisma-model | 226 | 226 | 0 | 0 | 0 |
| prisma-access | 532 | 532 | 0 | 0 | 0 |
| event-contract | 112 | 112 | 0 | 0 | 0 |
| worker | 9 | 9 | 0 | 0 | 0 |
| script | 782 | 782 | 0 | 0 | 0 |
| test | 1233 | 1233 | 0 | 0 | 0 |
| registry | 20 | 20 | 0 | 0 | 0 |
| openspec-capability | 329 | 329 | 0 | 0 | 0 |
| dependency-edge | 11281 | 11281 | 0 | 0 | 0 |
| reverse-edge | 11281 | 11281 | 0 | 0 | 0 |
| deep-import | 205 | 205 | 0 | 0 | 0 |
| scc | 15 | 15 | 0 | 0 | 0 |
| compatibility-surface | 97 | 97 | 0 | 0 | 0 |
| gate | 432 | 432 | 0 | 0 | 0 |
| change-center | 37 | 37 | 0 | 0 | 0 |
