# Caller denominator

Direct importers of the source registries, captured at
`a8af1af1ec02d43cba09f8211e18f0942382a39c`. Reverse callers are the listed tests
and scripts. Compatibility facades are not added by this change.

## Render metadata (`@/lib/resource-registry-metadata`)

Production: `src/app/api/resources/[id]/route.ts` (migrated to public index),
`src/app/api/resources/route.ts` (Prisma `TeachingResource` list only; not a metadata importer),
`src/app/api/teacher/resource-nodes/route.ts`,
`src/app/api/teacher/resource-nodes/[nodeId]/route.ts`,
`src/app/api/teacher/sar-suggested-bindings/review/route.ts`,
`src/app/teacher/resources/resource-nodes/page.tsx`,
`src/features/assessment/{adaptive-persistence,micro-tutoring-teaching-resource-sync,micro-tutoring-resource-registry,remediation-orchestration,micro-intervention-outcomes}.ts`,
`src/lib/{konling-agent-runtime,diagnosis-report-delivery}.ts`,
`src/lib/data-governance/{graph-center-sources,control-workbench-run-context,simulation-task-catalog,new-resource-semantic-completeness-gate}.ts`,
`src/lib/canonical-resource-binding/current-inventory.ts`,
`scripts/knowledge-cutover/build-active-resource-review-pack.ts`,
`scripts/data-governance/{generate-micro-tutoring-resource-projection.ts,check-new-resource-semantic-completeness.ts}`,
`scripts/db/generate-resource-field-completion-audit.ts`.

Tests: `src/features/assessment/__tests__/adaptive-persistence.test.ts`,
`src/lib/data-governance/__tests__/new-resource-semantic-completeness-gate.test.ts`.
Route contract: `src/lib/__tests__/resources-api-route.test.ts` (now mocks the
public index).

## Render registry (`@/lib/resource-registry`)

`src/features/lesson-engine/resource-renderer.tsx`,
`src/resources/simulations/__tests__/course-resource-config.test.ts`.

## ResourceNode registry (`@/lib/resource-node-registry`)

Knowledge: `src/features/knowledge/resource-node-workspace-contracts.ts`.
Teacher UI: `src/features/teacher/resources/teacher-resource-node-management.tsx`.
Assessment: `remediation-orchestration.ts`, `micro-intervention-outcomes.ts`.
Data governance / binding / konling / teacher APIs as listed by import search.
Tests under `src/lib/__tests__/*resource-node*` and data-governance completeness.

## Teacher assembly / audit / readiness

`teacher-resource-node-data.ts`, `resource-field-completion-audit.ts`, and
`full-resource-path-readiness-gate.ts` remain source/audit owners. This change
does not delete them.

## Knowledge routes (not activated)

`src/app/api/knowledge/**` (16 files) continue to use Authority/workspace
readers. They are handed the index identity in `HANDOFF.md` for
`consolidate-versioned-knowledge-surface-read-contracts` and must not assemble
an independent envelope in this change.

## Generated index public API

Owner: `knowledge`.
Path: `src/features/knowledge/resource-index/public-api.ts`.
Callers after this change: `src/app/api/resources/[id]/route.ts`,
`src/features/knowledge/resource-index/__tests__/resource-registry-index.test.ts`,
`src/lib/__tests__/resources-api-route.test.ts`.

Every live render-metadata entry has owner `resource-registry-metadata` and one
availability status. Published-artifact live capture is explicitly empty
(`published-artifact-none-declared`) so generated JSONL output cannot appear
complete by being scanned.
