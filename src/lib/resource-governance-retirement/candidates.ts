/**
 * Frozen candidate and protected-surface inventory for #1592.
 *
 * Capture revision is the R3-merged integration HEAD inspected before this
 * retirement implementation. Source owners and historical readers are listed
 * but are not retireable.
 */

import { KNOWLEDGE_SURFACE_CONTRACT } from '@/lib/knowledge-surface';
import { RESOURCE_ELIGIBILITY_CONTRACT } from '@/features/knowledge/resource-eligibility/public-api';
import { RESOURCE_REGISTRY_INDEX_CONTRACT } from '@/features/knowledge/resource-index/public-api';

import type {
  GraphCaller,
  ProtectedSurface,
  ReplacementIdentity,
  ReplacementParity,
  RetirementCandidate,
} from './contracts';

/** R3 merge on integration; denominator freeze for this change. */
export const FROZEN_CAPTURE_REVISION =
  'fce5b9fc4a4c7dd408297c3d90d2cf407c953b71' as const;

const PASSING_PARITY: ReplacementParity = {
  identity: true,
  sourceOwnership: true,
  role: true,
  authorization: true,
  scope: true,
  revision: true,
  optionalDegradation: true,
  failClosed: true,
  cache: true,
  publicResponse: true,
  facade: false,
};

function r1Replacement(revision: string): ReplacementIdentity {
  return {
    contract: RESOURCE_REGISTRY_INDEX_CONTRACT,
    publicApiPath: 'src/features/knowledge/resource-index/public-api.ts',
    publicSymbol: 'resolveStudentVisibleIndexedResource',
    implemented: true,
    captureRevision: revision,
    parity: PASSING_PARITY,
  };
}

function r2Replacement(revision: string): ReplacementIdentity {
  return {
    contract: RESOURCE_ELIGIBILITY_CONTRACT,
    publicApiPath: 'src/features/knowledge/resource-eligibility/public-api.ts',
    publicSymbol: 'evaluateResourceEligibility',
    implemented: true,
    captureRevision: revision,
    parity: PASSING_PARITY,
  };
}

function r3Replacement(revision: string): ReplacementIdentity {
  return {
    contract: KNOWLEDGE_SURFACE_CONTRACT,
    publicApiPath: 'src/lib/knowledge-surface/read.ts',
    publicSymbol: 'readKnowledgeSurface',
    implemented: true,
    captureRevision: revision,
    parity: PASSING_PARITY,
  };
}

export const PROTECTED_SURFACES: readonly ProtectedSurface[] = [
  {
    id: 'legacy-knowledge-display',
    issueRefs: [],
    paths: ['src/lib/knowledge-graph-source.ts'],
    reason: 'Retained Legacy knowledge view and historical graph loader',
  },
  {
    id: 'historical-authority-runtime-snapshots',
    issueRefs: [],
    paths: ['course-content/runtime/knowledge'],
    reason: 'Historical Authority and runtime snapshots remain immutable',
  },
  {
    id: 'crosswalks-and-audits',
    issueRefs: [],
    paths: [
      'src/lib/canonical-learning-fact-identity',
      'src/lib/aggregate-governance/legacy-course-coverage-audit.ts',
    ],
    reason: 'Crosswalk and audit manifests are historical evidence',
  },
  {
    id: 'rollback-archives',
    issueRefs: [],
    paths: ['src/lib/legacy-knowledge-runtime-retirement'],
    reason: 'Digest-verified rollback archives stay reachable',
  },
  {
    id: 'runtime-release-readers',
    issueRefs: ['#1498', '#1503'],
    paths: ['src/lib/course-runtime.ts', 'src/app/api/course-runtime'],
    reason: 'Immutable Runtime Release readers',
  },
  {
    id: 'teaching-projection-readers',
    issueRefs: ['#1509', '#1515'],
    paths: ['src/lib/teaching-projection'],
    reason: 'Immutable Teaching Projection readers',
  },
  {
    id: 'governed-math-1543',
    issueRefs: ['#1543'],
    paths: ['src/lib/governed-math'],
    reason: '#1543 governed rich-text/math presentation owner',
  },
  {
    id: 'source-owned-resource-registry',
    issueRefs: [],
    paths: ['src/lib/resource-registry.tsx'],
    reason: 'Source-owned render registry is not a retirement candidate',
  },
  {
    id: 'registered-resource-metadata-table',
    issueRefs: [],
    paths: ['src/lib/resource-registry-metadata.ts'],
    reason: 'Render-metadata adapter input and source-owned table',
  },
  {
    id: 'resource-node-planning-registry',
    issueRefs: [],
    paths: ['src/lib/resource-node-registry.ts'],
    reason: 'ResourceNode planning registry remains the planning owner',
  },
  {
    id: 'prisma-teaching-resource',
    issueRefs: [],
    paths: ['prisma/schema.prisma'],
    reason: 'Prisma TeachingResource is the DB owner',
  },
  {
    id: 'authoritative-repository',
    issueRefs: [],
    paths: ['src/lib/authoritative-knowledge'],
    reason: 'Authoritative repository remains the projection source',
  },
  {
    id: 'authority-domain-shards',
    issueRefs: ['#1375'],
    paths: ['src/lib/authority-domain-shards'],
    reason: 'Domain shard loaders and #1375 token envelope',
  },
  {
    id: 'registry-index-generator',
    issueRefs: ['#1589'],
    paths: ['src/features/knowledge/resource-index'],
    reason: 'R1 RegistryIndex generator is the replacement owner',
  },
  {
    id: 'knowledge-playlists-route',
    issueRefs: [],
    paths: ['src/app/api/knowledge/playlists/route.ts'],
    reason: 'Playlists remain an explicit R3 non-goal',
  },
];

export const FROZEN_CANDIDATES: readonly RetirementCandidate[] = [
  {
    id: 'registry-read:student-resources-id-metadata-fallback',
    owner: 'knowledge',
    sourcePath: 'src/app/api/resources/[id]/route.ts',
    exportName: null,
    semanticRole: 'registry-read',
    replacement: r1Replacement(FROZEN_CAPTURE_REVISION),
    migrationRevision: FROZEN_CAPTURE_REVISION,
    retireable: false,
    deletionCondition:
      'Old metadata fallback call site already replaced by resolveStudentVisibleIndexedResource; no remaining source entrypoint to unlink',
  },
  {
    id: 'eligibility:full-resource-path-readiness-gate',
    owner: 'resource-governance',
    sourcePath: 'src/lib/full-resource-path-readiness-gate.ts',
    exportName: 'buildFullResourcePathReadinessGate',
    semanticRole: 'eligibility-read',
    replacement: r2Replacement(FROZEN_CAPTURE_REVISION),
    migrationRevision: FROZEN_CAPTURE_REVISION,
    retireable: true,
    deletionCondition:
      'Audit script and resource-field-completion tests still call the planning summary; migrate those callers to evaluateResourceEligibility purpose=path first',
  },
  {
    id: 'eligibility:resource-node-aggregate-ready',
    owner: 'resource-node-registry',
    sourcePath: 'src/lib/resource-node-registry.ts',
    exportName: 'readiness',
    semanticRole: 'eligibility-read',
    replacement: r2Replacement(FROZEN_CAPTURE_REVISION),
    migrationRevision: FROZEN_CAPTURE_REVISION,
    retireable: true,
    deletionCondition:
      'Aggregate planning readiness lives inside the protected ResourceNode registry; split a historical adapter before any file deletion',
  },
  {
    id: 'knowledge-projection:nodes-list-array-dto',
    owner: 'knowledge',
    sourcePath: 'src/app/api/knowledge/nodes/route.ts',
    exportName: 'GET',
    semanticRole: 'knowledge-resource-projection',
    replacement: r3Replacement(FROZEN_CAPTURE_REVISION),
    migrationRevision: FROZEN_CAPTURE_REVISION,
    retireable: true,
    deletionCondition:
      'JSON-array clients remain: playlist-builder, orchestrator-builder, knowledge-cards-data, route/smoke tests, governance scripts, and browser audit captures of GET /api/knowledge/nodes',
  },
  {
    id: 'knowledge-projection:client-url-identity-reconstruction',
    owner: 'knowledge',
    sourcePath: 'src/lib/knowledge-surface/client-identity-from-url.ts',
    exportName: 'identityFromSearchParams',
    semanticRole: 'knowledge-resource-projection',
    replacement: r3Replacement(FROZEN_CAPTURE_REVISION),
    migrationRevision: FROZEN_CAPTURE_REVISION,
    retireable: false,
    deletionCondition:
      'No remaining production helper reconstructs release/snapshot/projection identity from URL; selector rejection is the R3 replacement and must stay',
  },
];

export const FROZEN_CALLERS: Readonly<Record<string, readonly GraphCaller[]>> = {
  'registry-read:student-resources-id-metadata-fallback': [
    { path: 'src/lib/__tests__/resources-api-route.test.ts', symbol: 'src/app/api/resources/[id]/route.ts', callerClass: 'test', kind: 'test' },
  ],
  'eligibility:full-resource-path-readiness-gate': [
    { path: 'scripts/db/generate-resource-field-completion-audit.ts', symbol: 'buildFullResourcePathReadinessGate', callerClass: 'script', kind: 'import' },
    { path: 'src/lib/__tests__/resource-field-completion-audit.test.ts', symbol: 'buildFullResourcePathReadinessGate', callerClass: 'test', kind: 'test' },
  ],
  'eligibility:resource-node-aggregate-ready': [
    { path: 'scripts/db/generate-resource-field-completion-audit.ts', symbol: 'src/lib/resource-node-registry.ts', callerClass: 'script', kind: 'import' },
    { path: 'scripts/tests/test-new-resource-semantic-completeness-command.mjs', symbol: 'src/lib/resource-node-registry.ts', callerClass: 'script', kind: 'import' },
    { path: 'src/app/api/teacher/resource-nodes/[nodeId]/route.ts', symbol: 'src/lib/resource-node-registry.ts', callerClass: 'route-api', kind: 'import' },
    { path: 'src/app/api/teacher/resource-nodes/route.ts', symbol: 'src/lib/resource-node-registry.ts', callerClass: 'route-api', kind: 'import' },
    { path: 'src/app/api/teacher/sar-suggested-bindings/review/route.ts', symbol: 'src/lib/resource-node-registry.ts', callerClass: 'route-api', kind: 'import' },
    { path: 'src/app/teacher/resources/resource-nodes/page.tsx', symbol: 'src/lib/resource-node-registry.ts', callerClass: 'browser', kind: 'import' },
    { path: 'src/features/assessment/micro-intervention-outcomes.ts', symbol: 'src/lib/resource-node-registry.ts', callerClass: 'production', kind: 'import' },
    { path: 'src/features/assessment/remediation-orchestration.ts', symbol: 'src/lib/resource-node-registry.ts', callerClass: 'production', kind: 'import' },
    { path: 'src/features/knowledge/resource-node-workspace-contracts.ts', symbol: 'src/lib/resource-node-registry.ts', callerClass: 'production', kind: 'import' },
    { path: 'src/features/teacher/resources/teacher-resource-node-management.tsx', symbol: 'src/lib/resource-node-registry.ts', callerClass: 'browser', kind: 'import' },
    { path: 'src/lib/__tests__/adaptive-learning-center-ui.test.ts', symbol: 'src/lib/resource-node-registry.ts', callerClass: 'test', kind: 'test' },
    { path: 'src/lib/__tests__/adaptive-learning-optimization-experiments.test.ts', symbol: 'src/lib/resource-node-registry.ts', callerClass: 'test', kind: 'test' },
    { path: 'src/lib/__tests__/adaptive-learning-path-planner.test.ts', symbol: 'src/lib/resource-node-registry.ts', callerClass: 'test', kind: 'test' },
    { path: 'src/lib/__tests__/adaptive-path-journey-control.test.ts', symbol: 'src/lib/resource-node-registry.ts', callerClass: 'test', kind: 'test' },
    { path: 'src/lib/__tests__/adaptive-path-timeline.client.test.ts', symbol: 'src/lib/resource-node-registry.ts', callerClass: 'test', kind: 'test' },
    { path: 'src/lib/__tests__/canonical-learning-path-transition.test.ts', symbol: 'src/lib/resource-node-registry.ts', callerClass: 'test', kind: 'test' },
    { path: 'src/lib/__tests__/control-correction-path-rounds.test.ts', symbol: 'src/lib/resource-node-registry.ts', callerClass: 'test', kind: 'test' },
    { path: 'src/lib/__tests__/konling-agent-runtime.test.ts', symbol: 'src/lib/resource-node-registry.ts', callerClass: 'test', kind: 'test' },
    { path: 'src/lib/__tests__/resource-field-completion-audit.test.ts', symbol: 'src/lib/resource-node-registry.ts', callerClass: 'test', kind: 'test' },
    { path: 'src/lib/__tests__/resource-node-knowledge-workspace-ui.test.ts', symbol: 'src/lib/resource-node-registry.ts', callerClass: 'test', kind: 'test' },
    { path: 'src/lib/__tests__/resource-node-registry.test.ts', symbol: 'src/lib/resource-node-registry.ts', callerClass: 'test', kind: 'test' },
    { path: 'src/lib/__tests__/runtime-resource-projections.test.ts', symbol: 'src/lib/resource-node-registry.ts', callerClass: 'test', kind: 'test' },
    { path: 'src/lib/__tests__/teacher-resource-node-management.test.ts', symbol: 'src/lib/resource-node-registry.ts', callerClass: 'test', kind: 'test' },
    { path: 'src/lib/adaptive-learning-path-planner.ts', symbol: 'src/lib/resource-node-registry.ts', callerClass: 'production', kind: 'import' },
    { path: 'src/lib/adaptive-planning/resource-ranker.ts', symbol: 'src/lib/resource-node-registry.ts', callerClass: 'production', kind: 'import' },
    { path: 'src/lib/canonical-resource-binding/runtime-projection.ts', symbol: 'src/lib/resource-node-registry.ts', callerClass: 'production', kind: 'import' },
    { path: 'src/lib/control-correction-resource-seed.ts', symbol: 'src/lib/resource-node-registry.ts', callerClass: 'production', kind: 'import' },
    { path: 'src/lib/data-governance/__tests__/data-completeness-audit.test.ts', symbol: 'src/lib/resource-node-registry.ts', callerClass: 'test', kind: 'test' },
    { path: 'src/lib/data-governance/__tests__/graph-center-client-rendering.test.ts', symbol: 'src/lib/resource-node-registry.ts', callerClass: 'test', kind: 'test' },
    { path: 'src/lib/data-governance/__tests__/graph-center.test.ts', symbol: 'src/lib/resource-node-registry.ts', callerClass: 'test', kind: 'test' },
    { path: 'src/lib/data-governance/__tests__/new-resource-semantic-completeness-gate.test.ts', symbol: 'src/lib/resource-node-registry.ts', callerClass: 'test', kind: 'test' },
    { path: 'src/lib/data-governance/__tests__/sar-projection.test.ts', symbol: 'src/lib/resource-node-registry.ts', callerClass: 'test', kind: 'test' },
    { path: 'src/lib/data-governance/__tests__/teacher-prep-pack-generation.test.ts', symbol: 'src/lib/resource-node-registry.ts', callerClass: 'test', kind: 'test' },
    { path: 'src/lib/data-governance/control-correction-demo-package.ts', symbol: 'src/lib/resource-node-registry.ts', callerClass: 'production', kind: 'import' },
    { path: 'src/lib/data-governance/data-completeness-audit.ts', symbol: 'src/lib/resource-node-registry.ts', callerClass: 'production', kind: 'import' },
    { path: 'src/lib/data-governance/graph-center-sources.ts', symbol: 'src/lib/resource-node-registry.ts', callerClass: 'production', kind: 'import' },
    { path: 'src/lib/data-governance/graph-center.ts', symbol: 'src/lib/resource-node-registry.ts', callerClass: 'production', kind: 'import' },
    { path: 'src/lib/data-governance/new-resource-semantic-completeness-gate.ts', symbol: 'src/lib/resource-node-registry.ts', callerClass: 'production', kind: 'import' },
    { path: 'src/lib/data-governance/resource-coverage-matching.ts', symbol: 'src/lib/resource-node-registry.ts', callerClass: 'production', kind: 'import' },
    { path: 'src/lib/data-governance/sar-projection.ts', symbol: 'src/lib/resource-node-registry.ts', callerClass: 'production', kind: 'import' },
    { path: 'src/lib/data-governance/teacher-prep-pack-generation.ts', symbol: 'src/lib/resource-node-registry.ts', callerClass: 'production', kind: 'import' },
    { path: 'src/lib/frequency-response-resource-seed.ts', symbol: 'src/lib/resource-node-registry.ts', callerClass: 'production', kind: 'import' },
    { path: 'src/lib/full-resource-path-readiness-gate.ts', symbol: 'src/lib/resource-node-registry.ts', callerClass: 'production', kind: 'import' },
    { path: 'src/lib/konling-agent-runtime.ts', symbol: 'src/lib/resource-node-registry.ts', callerClass: 'production', kind: 'dynamic' },
    { path: 'src/lib/resource-field-completion-audit.ts', symbol: 'src/lib/resource-node-registry.ts', callerClass: 'production', kind: 'import' },
    { path: 'src/lib/resource-node-path-readiness-review-batch.ts', symbol: 'src/lib/resource-node-registry.ts', callerClass: 'production', kind: 'import' },
    { path: 'src/lib/resource-registry-metadata.ts', symbol: 'src/lib/resource-node-registry.ts', callerClass: 'production', kind: 'import' },
    { path: 'src/lib/runtime-resource-projections.ts', symbol: 'src/lib/resource-node-registry.ts', callerClass: 'production', kind: 'import' },
    { path: 'src/lib/structured-textbook-runtime.ts', symbol: 'src/lib/resource-node-registry.ts', callerClass: 'production', kind: 'import' },
    { path: 'src/lib/teacher-resource-node-data.ts', symbol: 'src/lib/resource-node-registry.ts', callerClass: 'production', kind: 'import' },
    { path: 'src/lib/teacher-resource-node-management.ts', symbol: 'src/lib/resource-node-registry.ts', callerClass: 'production', kind: 'import' },
    { path: 'src/lib/textbook-media-grounding.ts', symbol: 'src/lib/resource-node-registry.ts', callerClass: 'production', kind: 'import' },
    { path: 'tests/issue-1437-resource-node-destination.spec.ts', symbol: 'src/lib/resource-node-registry.ts', callerClass: 'test', kind: 'test' },
  ],
  'knowledge-projection:nodes-list-array-dto': [
    { path: 'artifacts/product-design-audits/full-system-page-function-audit-2026-06-20/chapters/46-function-state-flows-batch38.md', symbol: 'src/app/api/knowledge/nodes/route.ts', callerClass: 'browser', kind: 'import' },
    { path: 'artifacts/product-design-audits/full-system-page-function-audit-2026-06-20/chapters/60-function-state-flows-batch52.md', symbol: 'src/app/api/knowledge/nodes/route.ts', callerClass: 'browser', kind: 'import' },
    { path: 'artifacts/product-design-audits/full-system-page-function-audit-2026-06-20/chapters/61-function-state-flows-batch53.md', symbol: 'src/app/api/knowledge/nodes/route.ts', callerClass: 'browser', kind: 'import' },
    { path: 'artifacts/product-design-audits/full-system-page-function-audit-2026-06-20/remediation/audit-remediation-authoring-api-task-consumption-closure/evidence.md', symbol: 'src/app/api/knowledge/nodes/route.ts', callerClass: 'browser', kind: 'import' },
    { path: 'artifacts/product-design-audits/full-system-page-function-audit-2026-06-20/report.md', symbol: 'src/app/api/knowledge/nodes/route.ts', callerClass: 'browser', kind: 'import' },
    { path: 'artifacts/product-design-audits/full-system-page-function-audit-2026-06-20/scripts/capture-batch38.mjs', symbol: 'src/app/api/knowledge/nodes/route.ts', callerClass: 'browser', kind: 'import' },
    { path: 'artifacts/product-design-audits/full-system-page-function-audit-2026-06-20/scripts/capture-batch52.mjs', symbol: 'src/app/api/knowledge/nodes/route.ts', callerClass: 'browser', kind: 'import' },
    { path: 'artifacts/product-design-audits/full-system-page-function-audit-2026-06-20/scripts/capture-batch53.mjs', symbol: 'src/app/api/knowledge/nodes/route.ts', callerClass: 'browser', kind: 'import' },
    { path: 'scripts/tests/test-runtime-knowledge-governance.ts', symbol: 'src/app/api/knowledge/nodes/route.ts', callerClass: 'script', kind: 'import' },
    { path: 'src/app/__tests__/authoring-resource-flow-source.test.ts', symbol: 'src/app/api/knowledge/nodes/route.ts', callerClass: 'test', kind: 'test' },
    { path: 'src/features/knowledge/__tests__/knowledge-nodes-route.test.ts', symbol: 'src/app/api/knowledge/nodes/route.ts', callerClass: 'test', kind: 'test' },
    { path: 'src/features/knowledge/playlist-builder.tsx', symbol: 'src/app/api/knowledge/nodes/route.ts', callerClass: 'browser', kind: 'import' },
    { path: 'src/features/lesson-engine/orchestrator-builder.tsx', symbol: 'src/app/api/knowledge/nodes/route.ts', callerClass: 'browser', kind: 'import' },
    { path: 'src/lib/__tests__/authoritative-knowledge-repository.test.ts', symbol: 'src/app/api/knowledge/nodes/route.ts', callerClass: 'test', kind: 'test' },
    { path: 'src/lib/__tests__/knowledge-db-fallback-production.real-smoke.test.ts', symbol: 'src/app/api/knowledge/nodes/route.ts', callerClass: 'test', kind: 'test' },
    { path: 'src/lib/__tests__/shared-react-state-effect-safety.test.ts', symbol: 'src/app/api/knowledge/nodes/route.ts', callerClass: 'test', kind: 'test' },
    { path: 'src/resources/interactive-learning/shared/knowledge-cards-data.ts', symbol: 'src/app/api/knowledge/nodes/route.ts', callerClass: 'production', kind: 'import' },
  ],
  'knowledge-projection:client-url-identity-reconstruction': [],
};

export function classifyCallerPath(path: string): GraphCaller['callerClass'] {
  const normalized = path.replace(/\\/gu, '/');
  if (
    normalized.includes('/__tests__/')
    || normalized.startsWith('tests/')
    || /\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(normalized)
  ) {
    return 'test';
  }
  if (normalized.startsWith('scripts/')) return 'script';
  if (normalized.startsWith('artifacts/')) return 'browser';
  if (normalized.includes('/api/')) return 'route-api';
  if (normalized.endsWith('.tsx') || normalized.endsWith('.mjs')) return 'browser';
  return 'production';
}
