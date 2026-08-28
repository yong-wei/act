import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

import { authOptions } from '@/lib/auth';
import {
  buildActiveAuthorityCanvasProjection,
  buildActiveAuthorityNodeDetailProjection,
  type AdminNodeDetailProjection,
  type NodeDetailProjection,
} from '@/lib/authoritative-knowledge/projections';
import {
  resolveActiveEngineeringGraphAuthority,
  resolveConfiguredAuthorityRoot,
} from '@/lib/authoritative-knowledge/engineering-authority-consumers';
import {
  resolveAuthorityStorePaths,
  type AuthorityStorePaths,
} from '@/lib/authoritative-knowledge/authority-store';
import {
  projectActiveNodeMathematics,
  projectGovernedFormulaToActiveMathematics,
  type ActiveAuthorityProvenance,
  type ActiveAuthoritySource,
  type ActiveCanvasResponse,
  type ActiveNodeDetailResponse,
} from '@/features/knowledge/active-authority-graph-contracts';
import type {
  KnowledgeRole,
  ProjectionIdentity,
} from '@/lib/authoritative-knowledge';
import {
  DomainCatalogLoadError,
  loadAuthorityDomainCatalogRuntime,
  loadAuthorityDomainRootPresentation,
  resolveAuthorityDomainCatalogPaths,
  type AuthorityDomainCatalogRuntime,
  type AuthorityDomainRootPresentation,
} from '@/lib/authority-domain-catalog';
import {
  AuthorityShardIdentityError,
  AuthorityShardStoreError,
  loadDomainDefaultShard,
  loadNodeDetailShard,
  loadNodeNeighborhoodShard,
  loadRelationFamilyShard,
  loadRootShard,
  readActiveAuthorityInfograph,
  attachActiveAuthorityLearningContent,
  projectAuthorityLearnerShard,
  type AuthorityLearnerShard,
  type AuthorityDomainDefaultShard,
  type AuthorityNodeDetailShard,
  type PublicAuthorityNodeDetailShard,
  type AuthorityNodeNeighborhoodShard,
  type AuthorityRelationFamilyShard,
  type AuthorityRootShard,
} from '@/lib/authority-domain-shards';
import { attachActiveAuthorityResourceBindings } from '@/lib/authority-domain-shards/resource-bindings';
import { historicalLocaleCapability } from '@/lib/authority-locale-readiness/presentation-state';
import { applyLocaleToLearnerShard, localeBindingForCapability } from '@/lib/authority-locale-readiness/project-shard';
import {
  resolveActiveLocaleQualification,
  resolveActiveLocaleRequest,
} from '@/lib/authority-locale-readiness/request';
import { resolveActiveShardIdentity } from '@/lib/authority-domain-shards/identity';
import { attachGovernedMathToLearnerShard } from '@/lib/governed-math/attach';
import {
  knowledgeSurfaceFromActiveProvenance,
  knowledgeSurfaceFromLearnerShard,
  knowledgeSurfaceSelectorRejection,
  sanitizePublicLaunchHref,
  tryLiveRegistryIndexIdentity,
  withKnowledgeSurface,
} from '@/lib/knowledge-surface';
import type { KnowledgeSurfaceKind } from '@/lib/knowledge-surface';
import type { ActiveNodeResourceBindings } from '@/features/knowledge/active-authority-graph-contracts';

export const ACTIVE_GRAPH_SUPPORT = {
  consumerId: 'engineering-graph',
  supportedObjectTypes: [
    'DomainConcept',
    'Formula',
    'KnowledgeStatement',
    'SystemModel',
    'ModelRepresentation',
  ],
  supportedPredicates: [
    'association',
    'applies_to',
    'derived_from',
    'has_component',
    'has_formula',
    'has_representation',
    'is_a',
    'part_of',
    'used_to_analyze',
  ],
} as const;

export type ActiveAuthorization =
  | { ok: true; role: KnowledgeRole }
  | { ok: false; response: NextResponse };

function roleForSession(role: string | null | undefined): KnowledgeRole | null {
  if (role === 'STUDENT' || role === 'TEACHER' || role === 'ADMIN') return role;
  return null;
}

/** Full-canvas remains an authorized diagnostics path, not a product loader. */
export async function authorizeActiveFullGraphDiagnostics(): Promise<ActiveAuthorization> {
  const authorization = await authorizeActiveGraph();
  if (!authorization.ok) return authorization;
  if (authorization.role !== 'ADMIN') {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: '完整图谱仅供授权诊断使用。',
          code: 'ACTIVE_GRAPH_DIAGNOSTICS_FORBIDDEN',
        },
        { status: 403 },
      ),
    };
  }
  return authorization;
}

/** Reuse the normal `/knowledge` session boundary; no candidate flag applies. */
export async function authorizeActiveGraph(): Promise<ActiveAuthorization> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Unauthorized', code: 'ACTIVE_GRAPH_UNAUTHORIZED' },
        { status: 401 },
      ),
    };
  }
  const role = roleForSession(session.user.role);
  if (!role) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Forbidden', code: 'ACTIVE_GRAPH_FORBIDDEN' },
        { status: 403 },
      ),
    };
  }
  return { ok: true, role };
}

export function activeAuthorityStorePaths(): AuthorityStorePaths {
  return resolveAuthorityStorePaths(resolveConfiguredAuthorityRoot());
}

function safeFailureCode(reason: string | undefined): string {
  if (!reason) return 'ACTIVE_GRAPH_UNAVAILABLE';
  if (reason.includes('absent')) return 'ACTIVE_GRAPH_ACTIVATION_ABSENT';
  if (reason.includes('not-ready')) return 'ACTIVE_GRAPH_CONSUMER_NOT_READY';
  if (reason.includes('identity-mismatch')) return 'ACTIVE_GRAPH_IDENTITY_MISMATCH';
  if (reason.includes('projection-must-be-null')) return 'ACTIVE_GRAPH_PROJECTION_NOT_APPLICABLE';
  if (reason.includes('identity-missing')) return 'ACTIVE_GRAPH_IDENTITY_MISSING';
  return 'ACTIVE_GRAPH_UNAVAILABLE';
}

function safeFailureMessage(reason: string | undefined): string {
  switch (safeFailureCode(reason)) {
    case 'ACTIVE_GRAPH_ACTIVATION_ABSENT':
      return '当前 Authority 激活证据不可用。';
    case 'ACTIVE_GRAPH_CONSUMER_NOT_READY':
      return '当前 Engineering 图谱尚未达到可用状态。';
    case 'ACTIVE_GRAPH_IDENTITY_MISMATCH':
      return '当前 Authority 身份校验失败，已停止显示。';
    case 'ACTIVE_GRAPH_PROJECTION_NOT_APPLICABLE':
      return 'Engineering 图谱的投影边界不符合当前契约。';
    case 'ACTIVE_GRAPH_IDENTITY_MISSING':
      return '当前 Authority 身份不完整，已停止显示。';
    default:
      return '当前 Authority 图谱暂时无法加载。';
  }
}

export function activeUnavailableResponse(
  reason: string | undefined,
  status = 503,
): NextResponse {
  return NextResponse.json(
    {
      error: safeFailureMessage(reason),
      code: safeFailureCode(reason),
    },
    { status },
  );
}

function activeSource(
  source: ProjectionIdentity,
): ActiveAuthoritySource {
  if (source.authorityState !== 'active') {
    throw new Error('active Authority projection resolved a non-active source');
  }
  return {
    authorityState: 'active',
    releaseSetId: source.releaseSetId,
    releaseId: source.releaseId,
    productionAuthoritative: false,
    historical: false,
    releaseHash: source.releaseHash ?? null,
    schemaVersion: source.schemaVersion ?? null,
    // A null value is deliberate: Engineering Graph has no Teaching
    // Projection selector and therefore does not expose a projection digest.
    projectionDigest: null,
    sourceDatasetHash: source.sourceDatasetHash ?? null,
  };
}

function provenance(
  resolved: NonNullable<ReturnType<typeof resolveActiveEngineeringGraphAuthority>>,
): ActiveAuthorityProvenance {
  if (
    resolved.status !== 'ready'
    || !resolved.snapshotId
    || !resolved.snapshotHash
    || !resolved.releaseId
    || !resolved.releaseSetId
    || !resolved.activationId
    || !resolved.activationHash
  ) {
    throw new Error('active Authority provenance is incomplete');
  }
  return {
    authority: {
      consumerId: 'engineering-graph',
      snapshotId: resolved.snapshotId,
      snapshotHash: resolved.snapshotHash,
      releaseId: resolved.releaseId,
      releaseSetId: resolved.releaseSetId,
    },
    activation: {
      mode: 'use-combination',
      status: 'READY',
      activationId: resolved.activationId,
      activationHash: resolved.activationHash,
    },
    projection: {
      status: 'not-applicable',
      projectionId: null,
      projectionHash: null,
    },
  };
}

function resolveActiveSnapshot(paths = activeAuthorityStorePaths()) {
  return resolveActiveEngineeringGraphAuthority(paths);
}

/**
 * Read-only domain display catalog bound to the active Authority selection.
 * Fail closed on absence, schema errors, or Authority identity drift.
 * Does not mutate snapshot bytes, counts, or ActKG facts.
 */
export function readActiveDomainCatalog():
  | { status: 'available'; catalog: AuthorityDomainCatalogRuntime }
  | { status: 'unavailable'; reason: string; code: string } {
  const resolved = resolveActiveSnapshot();
  if (
    resolved.status !== 'ready'
    || !resolved.snapshotId
    || !resolved.snapshotHash
    || !resolved.releaseId
  ) {
    return {
      status: 'unavailable',
      reason: resolved.reason ?? 'active-authority-unavailable',
      code: 'ACTIVE_DOMAIN_CATALOG_AUTHORITY_UNAVAILABLE',
    };
  }
  try {
    const catalog = loadAuthorityDomainCatalogRuntime(
      resolveAuthorityDomainCatalogPaths(),
      {
        snapshotId: resolved.snapshotId,
        snapshotHash: resolved.snapshotHash,
        releaseId: resolved.releaseId,
        releaseSetId: resolved.releaseSetId,
      },
    );
    return { status: 'available', catalog };
  } catch (error) {
    if (error instanceof DomainCatalogLoadError) {
      return {
        status: 'unavailable',
        reason: error.message,
        code: `ACTIVE_DOMAIN_CATALOG_${error.code.toUpperCase().replace(/-/g, '_')}`,
      };
    }
    return {
      status: 'unavailable',
      reason: error instanceof Error ? error.message : 'domain-catalog-load-failed',
      code: 'ACTIVE_DOMAIN_CATALOG_UNAVAILABLE',
    };
  }
}

/**
 * Presentation-only root summaries for the active Authority workspace.
 * Excludes canonical IDs and Authority topology counts.
 */
export function readActiveDomainRootPresentation():
  | { status: 'available'; root: AuthorityDomainRootPresentation }
  | { status: 'unavailable'; reason: string; code: string } {
  const resolved = resolveActiveSnapshot();
  if (
    resolved.status !== 'ready'
    || !resolved.snapshotId
    || !resolved.snapshotHash
    || !resolved.releaseId
  ) {
    return {
      status: 'unavailable',
      reason: resolved.reason ?? 'active-authority-unavailable',
      code: 'ACTIVE_DOMAIN_ROOT_AUTHORITY_UNAVAILABLE',
    };
  }
  try {
    const root = loadAuthorityDomainRootPresentation(
      resolveAuthorityDomainCatalogPaths(),
      {
        snapshotId: resolved.snapshotId,
        snapshotHash: resolved.snapshotHash,
        releaseId: resolved.releaseId,
        releaseSetId: resolved.releaseSetId,
      },
    );
    return { status: 'available', root };
  } catch (error) {
    if (error instanceof DomainCatalogLoadError) {
      return {
        status: 'unavailable',
        reason: error.message,
        code: `ACTIVE_DOMAIN_ROOT_${error.code.toUpperCase().replace(/-/g, '_')}`,
      };
    }
    return {
      status: 'unavailable',
      reason: error instanceof Error ? error.message : 'domain-root-load-failed',
      code: 'ACTIVE_DOMAIN_ROOT_UNAVAILABLE',
    };
  }
}

export function readActiveCanvas():
  | { status: 'available'; projection: ActiveCanvasResponse }
  | { status: 'unavailable'; reason?: string } {
  const resolved = resolveActiveSnapshot();
  if (resolved.status !== 'ready' || !resolved.snapshot) {
    return { status: 'unavailable', reason: resolved.reason };
  }
  try {
    const projection = buildActiveAuthorityCanvasProjection(
      resolved.snapshot,
      ACTIVE_GRAPH_SUPPORT,
    );
    return {
      status: 'available',
      projection: {
        ...projection,
        source: activeSource(projection.source),
        provenance: provenance(resolved),
      },
    };
  } catch (error) {
    return {
      status: 'unavailable',
      reason: error instanceof Error ? `active-projection-failed:${error.message}` : 'active-projection-failed',
    };
  }
}

function safeNodeDetail(
  detail: NodeDetailProjection,
  resolved: NonNullable<ReturnType<typeof resolveActiveEngineeringGraphAuthority>>,
): ActiveNodeDetailResponse {
  const source = activeSource(detail.source);
  if (detail.role === 'STUDENT') {
    return { ...detail, source, provenance: provenance(resolved) };
  }

  if (detail.role === 'TEACHER') {
    return { ...detail, source, provenance: provenance(resolved) };
  }

  // Admins retain the teacher-safe governance projection, but active API
  // responses never expose filesystem paths, raw payloads, or store receipts.
  const admin = detail as AdminNodeDetailProjection;
  const {
    payload: _payload,
    sourceMappings: _sourceMappings,
    sourceStubs: _sourceStubs,
    evidence: _evidence,
    ...safeNode
  } = admin.node;
  const {
    receipt: _receipt,
    diagnostics: _diagnostics,
    activeConsumerRebinding: _activeConsumerRebinding,
    ...safeDetail
  } = admin;
  const hiddenAdminFields = new Set([
    'source.controlledPath',
    'node.payload',
    'node.sourceMappings',
    'node.sourceStubs',
    'node.evidence',
    'receipt',
    'diagnostics',
  ]);
  return {
    ...safeDetail,
    source,
    node: safeNode,
    fields: {
      ...admin.fields,
      included: admin.fields.included.filter((field) => !hiddenAdminFields.has(field)),
      hidden: [
        ...admin.fields.hidden,
        ...hiddenAdminFields,
      ],
    },
    provenance: provenance(resolved),
  };
}

export function readActiveNode(
  role: KnowledgeRole,
  nodeId: string,
):
  | { status: 'available'; projection: ActiveNodeDetailResponse }
  | { status: 'unavailable'; reason?: string } {
  const resolved = resolveActiveSnapshot();
  if (resolved.status !== 'ready' || !resolved.snapshot) {
    return { status: 'unavailable', reason: resolved.reason };
  }
  try {
    const detail = buildActiveAuthorityNodeDetailProjection(
      resolved.snapshot,
      role,
      nodeId,
      ACTIVE_GRAPH_SUPPORT,
    );
    if (!detail) return { status: 'unavailable', reason: 'node-not-found' };
    return {
      status: 'available',
      projection: safeNodeDetail(detail, resolved),
    };
  } catch (error) {
    return {
      status: 'unavailable',
      reason: error instanceof Error ? `active-projection-failed:${error.message}` : 'active-projection-failed',
    };
  }
}

export function activeProjectionResponse<T extends { provenance?: Parameters<typeof knowledgeSurfaceFromActiveProvenance>[0]['provenance'] }>(
  result:
    | { status: 'available'; projection: T }
    | { status: 'unavailable'; reason?: string },
  context: { kind: KnowledgeSurfaceKind; role: KnowledgeRole; surfaceKey: string },
): NextResponse {
  if (result.status === 'available') {
    const projection = result.projection;
    if (projection.provenance) {
      const surface = knowledgeSurfaceFromActiveProvenance({
        provenance: projection.provenance,
        kind: context.kind,
        role: context.role,
        surfaceKey: context.surfaceKey,
      });
      if (surface.status === 'ok') {
        return NextResponse.json(withKnowledgeSurface(
          projection,
          surface.knowledgeSurface,
        ));
      }
    }
    return NextResponse.json(projection);
  }
  if (result.reason === 'node-not-found') {
    return NextResponse.json(
      { error: 'Active Authority node not found.', code: 'ACTIVE_GRAPH_NODE_NOT_FOUND' },
      { status: 404 },
    );
  }
  return activeUnavailableResponse(result.reason);
}

function shardFailureStatus(code: string): number {
  if (code === 'node-id-invalid' || code === 'domain-unknown' || code === 'family-unknown') {
    return 400;
  }
  if (code === 'shard-absent') return 404;
  if (
    code.includes('mismatch')
    || code.includes('tamper')
    || code === 'projection-must-be-null'
  ) {
    return 409;
  }
  return 503;
}

function shardFailureCode(error: unknown): { code: string; message: string; status: number } {
  if (error instanceof AuthorityShardStoreError || error instanceof AuthorityShardIdentityError) {
    return {
      code: `ACTIVE_SHARD_${error.code.toUpperCase().replace(/-/g, '_')}`,
      message: '当前 Authority 分片暂时无法加载。',
      status: shardFailureStatus(error.code),
    };
  }
  return {
    code: 'ACTIVE_SHARD_UNAVAILABLE',
    message: '当前 Authority 分片暂时无法加载。',
    status: 503,
  };
}

export function activeShardResponse<T extends AuthorityLearnerShard>(
  read: () => T,
  role?: KnowledgeRole,
  request?: Request,
): NextResponse {
  return activeShardResponseForRole(read, role, request);
}

function sanitizeResourceBindings(
  bindings: ActiveNodeResourceBindings,
  nodeId: string,
): ActiveNodeResourceBindings {
  if (bindings.state !== 'available') return bindings;
  if (!tryLiveRegistryIndexIdentity()) {
    return { state: 'unavailable', message: '当前系统资源暂时不可用。' };
  }
  return {
    state: 'available',
    items: bindings.items.map((item) => {
      const href = sanitizePublicLaunchHref(item.launch.href, nodeId);
      return {
        ...item,
        availability: href ? 'available' : 'unavailable',
        launch: { ...item.launch, href },
      };
    }),
  };
}

/**
 * Project the immutable shard source at the authenticated API boundary.
 * Student node-detail responses must not carry the teaching-only field even
 * though the sealed immutable artifact retains it for teacher/admin readers.
 */
export function activeShardResponseForRole<T extends AuthorityLearnerShard>(
  read: () => T,
  role: KnowledgeRole | undefined,
  request?: Request,
): NextResponse {
  try {
    if (request) {
      const rejected = knowledgeSurfaceSelectorRejection(request);
      if (rejected) return rejected;
    }
    const qualification = request ? resolveActiveLocaleQualification() : null;
    const capability = qualification?.capability ?? historicalLocaleCapability();
    const resolved = request
      ? resolveActiveLocaleRequest(request, capability)
      : { ok: true as const, locale: 'zh-CN' as const, capability };
    if (!resolved.ok) return resolved.response;
    const raw = read();
    const activeIdentity = resolveActiveShardIdentity();
    const receipt = capability.mode === 'complete-locale' && qualification?.qualification
      ? (resolved.locale === 'en' ? qualification.qualification.en : qualification.qualification.zhCN)
      : null;
    const localized = applyLocaleToLearnerShard(
      raw,
      resolved.locale,
      capability.mode === 'complete-locale' ? qualification?.manifest ?? null : null,
      receipt,
    );
    const withMath = attachGovernedMathToLearnerShard(localized, resolved.locale);
    const shard = projectAuthorityLearnerShard(withMath, {
      localeBinding: localeBindingForCapability(
        resolved.locale,
        capability,
        `acv-${activeIdentity.envelope.authority.snapshotHash}`,
      ),
      localeCapability: capability,
    });
    const surfaceRole = role ?? 'NONE';
    if (shard.shardClass === 'node-detail') {
      const detail = shard as unknown as PublicAuthorityNodeDetailShard;
      const mathematics = projectGovernedFormulaToActiveMathematics(detail.node.mathematics)
        ?? projectActiveNodeMathematics(detail.node.teachingFields);
      const resourceBindings = sanitizeResourceBindings(
        attachActiveAuthorityResourceBindings(raw as AuthorityNodeDetailShard, role),
        (raw as AuthorityNodeDetailShard).node.id,
      );
      const { teachingFields: _teachingFields, ...studentNode } = detail.node;
      const payload = {
        ...detail,
        node: role === 'STUDENT'
          ? { ...studentNode, mathematics, resourceBindings }
          : { ...detail.node, mathematics, resourceBindings },
      };
      const surface = knowledgeSurfaceFromLearnerShard({
        shard: withMath,
        role: surfaceRole,
        locale: resolved.locale,
        resourceBindings,
      });
      return NextResponse.json(
        surface.status === 'ok' ? withKnowledgeSurface(payload, surface.knowledgeSurface) : payload,
      );
    }
    const surface = knowledgeSurfaceFromLearnerShard({
      shard: withMath,
      role: surfaceRole,
      locale: resolved.locale,
    });
    return NextResponse.json(
      surface.status === 'ok' ? withKnowledgeSurface(shard, surface.knowledgeSurface) : shard,
    );
  } catch (error) {
    const failure = shardFailureCode(error);
    return NextResponse.json(
      { error: failure.message, code: failure.code },
      { status: failure.status },
    );
  }
}

export function readActiveRootShard(): AuthorityRootShard {
  return loadRootShard();
}

export function readActiveDomainDefaultShard(domainKey: string): AuthorityDomainDefaultShard {
  return loadDomainDefaultShard(domainKey);
}

export function readActiveRelationFamilyShard(
  domainKey: string,
  familyKey: string,
): AuthorityRelationFamilyShard {
  return loadRelationFamilyShard(domainKey, familyKey);
}

export function readActiveNeighborhoodShard(nodeId: string): AuthorityNodeNeighborhoodShard {
  return loadNodeNeighborhoodShard(nodeId);
}

export function readActiveDetailShard(nodeId: string): AuthorityNodeDetailShard {
  return attachActiveAuthorityLearningContent(loadNodeDetailShard(nodeId));
}

export function readActiveDetailInfograph(nodeId: string): Buffer | null {
  const shard = loadNodeDetailShard(nodeId);
  return readActiveAuthorityInfograph(shard);
}
