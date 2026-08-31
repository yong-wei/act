# Protected surfaces

Retirement must keep these reachable. A candidate whose source path is one of these prefixes is retained or split; it is not counted as a failed zero-caller result for the protected artifact.

| id | paths | issue refs |
| --- | --- | --- |
| legacy-knowledge-display | `src/lib/knowledge-graph-source.ts` | |
| historical-authority-runtime-snapshots | `course-content/runtime/knowledge` | |
| crosswalks-and-audits | canonical LearningFact crosswalk; legacy course-coverage audit | |
| rollback-archives | `src/lib/legacy-knowledge-runtime-retirement` | |
| runtime-release-readers | `src/lib/course-runtime.ts`, `src/app/api/course-runtime` | #1498, #1503 |
| teaching-projection-readers | `src/lib/teaching-projection` | #1509, #1515 |
| governed-math-1543 | `src/lib/governed-math` | #1543 |
| source-owned-resource-registry | `src/lib/resource-registry.tsx` | |
| registered-resource-metadata-table | `src/lib/resource-registry-metadata.ts` | |
| resource-node-planning-registry | `src/lib/resource-node-registry.ts` | |
| prisma-teaching-resource | `prisma/schema.prisma` | |
| authoritative-repository | `src/lib/authoritative-knowledge` | |
| authority-domain-shards | `src/lib/authority-domain-shards` | #1375 |
| registry-index-generator | `src/features/knowledge/resource-index` | #1589 |
| knowledge-playlists-route | `src/app/api/knowledge/playlists/route.ts` | R3 non-goal |

Encoded in `PROTECTED_SURFACES` (`src/lib/resource-governance-retirement/candidates.ts`).
