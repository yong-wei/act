/**
 * Frozen candidate and protected-surface inventory for #1592.
 *
 * Capture revision is the Git tree whose frozen caller paths exist as blobs.
 * Source owners and historical readers are listed but are not retireable.
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

/** Denominator freeze for this change; callers were recaptured from this tree. */
export const FROZEN_CAPTURE_REVISION =
    'c253a4bdee893ae877dca8ab8f1d2468548e6615' as const;

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

export { FROZEN_CALLERS, RETIRED_GENERATED_CALLER_PATHS } from './frozen-callers';

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
  if (normalized === 'package.json') return 'script';
  if (normalized.startsWith('prisma/')) return 'model';
  if (normalized.startsWith('course-content/')) return 'historical';
  if (normalized.startsWith('openspec/')) return 'historical';
  if (normalized.startsWith('docs/')) return 'historical';
  if (normalized.startsWith('artifacts/')) return 'browser';
  if (normalized.includes('/api/')) return 'route-api';
  if (normalized.endsWith('.tsx') || normalized.endsWith('.mjs')) return 'browser';
  return 'production';
}
