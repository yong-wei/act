# Caller denominator

Captured at `fce5b9fc4a4c7dd408297c3d90d2cf407c953b71`.
Encoded in `src/lib/resource-governance-retirement/frozen-callers.ts` (`FROZEN_CALLERS`).
Scan roots: `src/`, `scripts/`, `tests/`, `artifacts/`, `course-content/`, `openspec/`, `docs/`, `prisma/`, plus root `package.json`.
Extensions: `.ts` `.tsx` `.js` `.jsx` `.mjs` `.cjs` `.md` `.json` `.yaml` `.yml`.
Scan rules: exact path, `@/` alias, same-tree relative import, and API href with no detail/v2/active suffix; long symbols only; production/test/script/route/browser/dynamic/historical/model; tests count; retirement package excluded.
Live coverage is asserted by `scanRetirementCandidatesFromRepo` against `FROZEN_CALLERS` in both directions. The complete caller list is `FROZEN_CALLERS`; this file only summarizes.

## registry-read:student-resources-id-metadata-fallback

Old call site: `getRegisteredResourceMetadata` inside `src/app/api/resources/[id]/route.ts`.
Live replacement: `resolveStudentVisibleIndexedResource`.
Remaining `getRegisteredResourceMetadata` callers belong to the protected `resource-registry-metadata.ts` table, not this candidate. The route file itself stays. Expanded scan still finds historical docs/openspec mentions of the route path plus `src/lib/__tests__/resources-api-route.test.ts`.

## eligibility:full-resource-path-readiness-gate

| path | class |
| --- | --- |
| `src/lib/__tests__/resource-field-completion-audit.test.ts` | test |
| `scripts/db/generate-resource-field-completion-audit.ts` | script |
| docs/openspec historical mentions of the TypeScript path | historical |

`scripts/db/seed-yangfan-diagnostic-learning-state.ts` reads the generated summary JSON, not the TypeScript entrypoint, so it is not a module caller. Complete list: `FROZEN_CALLERS['eligibility:full-resource-path-readiness-gate']` (13).

## eligibility:resource-node-aggregate-ready

The source path is the protected ResourceNode planning registry. Expanded scan found 73 classified importers (teacher APIs, path/planning, data-governance, tests, docs/openspec historical mentions, and `tests/issue-1437-resource-node-destination.spec.ts`). The complete list is `FROZEN_CALLERS['eligibility:resource-node-aggregate-ready']`.

## knowledge-projection:nodes-list-array-dto

Exact `GET /api/knowledge/nodes` list href or `src/app/api/knowledge/nodes/route.ts`. Not `/nodes/[id]`, `/nodes/v2`, or `/nodes/active`.

| path | class |
| --- | --- |
| `src/features/knowledge/playlist-builder.tsx` | browser |
| `src/features/lesson-engine/orchestrator-builder.tsx` | browser |
| `src/resources/interactive-learning/shared/knowledge-cards-data.ts` | production |
| `src/features/knowledge/__tests__/knowledge-nodes-route.test.ts` | test |
| `src/lib/__tests__/knowledge-db-fallback-production.real-smoke.test.ts` | test |
| `src/lib/__tests__/shared-react-state-effect-safety.test.ts` | test |
| `src/app/__tests__/authoring-resource-flow-source.test.ts` | test |
| `src/lib/__tests__/authoritative-knowledge-repository.test.ts` | test |
| `scripts/tests/test-runtime-knowledge-governance.ts` | script |
| `artifacts/.../scripts/capture-batch38.mjs` | browser |
| `artifacts/.../scripts/capture-batch52.mjs` | browser |
| `artifacts/.../scripts/capture-batch53.mjs` | browser |
| `artifacts/.../chapters/46-function-state-flows-batch38.md` | browser |
| `artifacts/.../chapters/60-function-state-flows-batch52.md` | browser |
| `artifacts/.../chapters/61-function-state-flows-batch53.md` | browser |
| `artifacts/.../report.md` | browser |
| `artifacts/.../remediation/.../evidence.md` | browser |
| docs/openspec historical mentions of the route path | historical |
| `docs/proposals/course-knowledge-base-governance-source-registry.yaml` | historical |

Complete list: `FROZEN_CALLERS['knowledge-projection:nodes-list-array-dto']` (34). `GET /api/knowledge/nodes` still returns a JSON array. Object graph/detail routes already carry `knowledgeSurface`.

## knowledge-projection:client-url-identity-reconstruction

No remaining production helper. Knowledge JSON routes reject `KNOWLEDGE_SURFACE_IDENTITY_SELECTOR_KEYS`. Course-runtime `?releaseId=` is a protected Runtime Release reader, not this candidate.

## Replacement owners (not deleted)

R1 public API, R2 evaluator, R3 `readKnowledgeSurface`, live RegistryIndex adapter (`getAllRegisteredResourceMetadata` as source input), authoritative repository, domain shards.
