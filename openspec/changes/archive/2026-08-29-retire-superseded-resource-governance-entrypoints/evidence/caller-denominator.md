# Caller denominator

Captured at `fce5b9fc4a4c7dd408297c3d90d2cf407c953b71`.
Encoded in `src/lib/resource-governance-retirement/candidates.ts` (`FROZEN_CANDIDATES`, `FROZEN_CALLERS`).
Scan rules: exact path + exact long symbol, production/test/script/route/browser/dynamic/generated, tests count as callers, retirement package itself excluded.

## registry-read:student-resources-id-metadata-fallback

Old call site: `getRegisteredResourceMetadata` inside `src/app/api/resources/[id]/route.ts`.
Live replacement: `resolveStudentVisibleIndexedResource`.
Remaining callers of the **source-owned** metadata table are not this candidate; they stay on `resource-registry-metadata.ts` (protected adapter input).

## eligibility:full-resource-path-readiness-gate

| path | class |
| --- | --- |
| `src/lib/__tests__/resource-field-completion-audit.test.ts` | test |
| `scripts/db/generate-resource-field-completion-audit.ts` | script |
| `scripts/db/seed-yangfan-diagnostic-learning-state.ts` (summary JSON string) | script / generated |

## eligibility:resource-node-aggregate-ready

| path | class |
| --- | --- |
| `src/lib/teacher-resource-node-data.ts` | production |
| `src/lib/resource-field-completion-audit.ts` | production |
| `src/lib/__tests__/resource-node-registry.test.ts` | test |

The file is also the protected ResourceNode planning registry.

## knowledge-projection:nodes-list-array-dto

| path | class |
| --- | --- |
| `src/features/knowledge/playlist-builder.tsx` (`fetch('/api/knowledge/nodes?source=db')`) | browser |
| `src/features/lesson-engine/orchestrator-builder.tsx` (`fetch('/api/knowledge/nodes')`) | browser |
| `src/resources/interactive-learning/shared/knowledge-cards-data.ts` (`fetch('/api/knowledge/nodes?search=...')`) | browser |

`GET /api/knowledge/nodes` still returns a JSON array. Object graph/detail routes already carry `knowledgeSurface`.

## knowledge-projection:client-url-identity-reconstruction

No remaining production helper. Knowledge JSON routes reject `KNOWLEDGE_SURFACE_IDENTITY_SELECTOR_KEYS`. Course-runtime `?releaseId=` is a protected Runtime Release reader, not this candidate.

## Replacement owners (not deleted)

R1 public API, R2 evaluator, R3 `readKnowledgeSurface`, live RegistryIndex adapter (`getAllRegisteredResourceMetadata` as source input), authoritative repository, domain shards.
