import { attachActiveAuthorityResourcePresence } from '@/lib/authority-domain-shards/resource-presence';
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
  loadDomainSearchIndexShard,
  loadNodeDetailShard,
  loadNodeNeighborhoodShard,
  loadRelationFamilyShard,
  loadRootShardWithCoverage,
  readActiveAuthorityInfograph,
  attachActiveAuthorityLearningContent,
  projectAuthorityLearnerShard,
  publicAuthorityShardEnvelope,
  AUTHORITY_DOMAIN_SEARCH_CONTRACT,
  AUTHORITY_DOMAIN_SEARCH_MIN_QUERY_CHARS,
  AUTHORITY_DOMAIN_SEARCH_PAGE_LIMIT,
  type AuthorityLearnerShard,
  type AuthorityDomainDefaultShard,
  type AuthorityDomainSearchResponse,
  type AuthorityNodeDetailShard,
  type PublicAuthorityNodeDetailShard,
  type AuthorityNodeNeighborhoodShard,
  type AuthorityRelationFamilyShard,
  type AuthorityRootShard,
} from '@/lib/authority-domain-shards';
import { attachActiveAuthorityResourceBindings, readActiveTeachingCaptureRevision } from '@/lib/authority-domain-shards/resource-bindings';
import { historicalLocaleCapability } from '@/lib/authority-locale-readiness/presentation-state';
import {
  applyLocaleToLearnerShard,
  applyLocaleToSearchHits,
  localeBindingForCapability,
  localeProjectedObjectLabel,
} from '@/lib/authority-locale-readiness/project-shard';
import {
  resolveActiveLocaleQualification,
  resolveActiveLocaleRequest,
} from '@/lib/authority-locale-readiness/request';
import { resolveActiveShardIdentity } from '@/lib/authority-domain-shards/identity';
import { attachGovernedMathToLearnerShard, attachGovernedMathToSearchHits, governedFormulaSearchTerms } from '@/lib/governed-math/attach';
import {
  closeResourceBlockWithLiveRegistryIndex,
  knowledgeSurfaceFromActiveProvenance,
  knowledgeSurfaceFromLearnerShard,
  knowledgeSurfaceSelectorRejection,
  sanitizePublicResourceBindingLaunches,
  withKnowledgeSurface,
} from '@/lib/knowledge-surface';
import { readLiveLatestKnowledgeCutover } from '@/lib/knowledge-surface/latest-cutover-live';
import type { KnowledgeSurfaceKind, KnowledgeSurfaceRegistryIndexIdentity } from '@/lib/knowledge-surface';
import type { ActiveNodeResourceBindings } from '@/features/knowledge/active-authority-graph-contracts';
import { publishedNodeResourceFailure, publishedResourceEnvelopeKey, readPublishedNodeResources, type PublishedNodeResources } from '@/lib/authority-domain-shards/published-resource-bindings';

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
        latestCutover: readLiveLatestKnowledgeCutover(),
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

export async function activePublishedDetailResponse(
  read: () => AuthorityNodeDetailShard,
  role: KnowledgeRole,
  request: Request,
): Promise<NextResponse> {
  const rejected = knowledgeSurfaceSelectorRejection(request);
  if (rejected) return rejected;
  try {
    const shard = read();
    const resources = await readPublishedNodeResources(shard).catch(() => publishedNodeResourceFailure(shard));
    return activeShardResponseForRole(() => shard, role, request, resources);
  } catch (error) {
    const failure = shardFailureCode(error);
    return NextResponse.json({ error: failure.message, code: failure.code }, { status: failure.status });
  }
}

function sanitizeResourceBindings(
  bindings: ActiveNodeResourceBindings,
  nodeId: string,
  expectedCaptureRevision: string | null,
): {
  bindings: ActiveNodeResourceBindings;
  registryIndex: KnowledgeSurfaceRegistryIndexIdentity | null;
} {
  const closed = closeResourceBlockWithLiveRegistryIndex({
    bindings,
    expectedCaptureRevision,
  });
  if (closed.bindings.state !== 'available') {
    return { bindings: closed.bindings, registryIndex: null };
  }
  const sanitized = sanitizePublicResourceBindingLaunches(closed.bindings, nodeId);
  const stillAvailable = sanitized.state === 'available'
    && sanitized.items.some((item) => item.availability === 'available');
  return {
    bindings: sanitized,
    registryIndex: stillAvailable ? closed.registryIndex : null,
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
  publishedResources?: PublishedNodeResources,
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
    const raw = attachActiveAuthorityResourcePresence(read(), role);
    const activeIdentity = resolveActiveShardIdentity();
    if (publishedResources && (raw.shardClass !== 'node-detail'
      || raw.node.id !== publishedResources.nodeId
      || publishedResourceEnvelopeKey(raw.envelope) !== publishedResources.envelopeKey
      || publishedResourceEnvelopeKey(activeIdentity.envelope) !== publishedResources.envelopeKey)) {
      throw new Error('Node resource publication changed while reading');
    }
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
    const latestCutover = readLiveLatestKnowledgeCutover();
    if (shard.shardClass === 'node-detail') {
      const detail = shard as unknown as PublicAuthorityNodeDetailShard;
      const mathematics = projectGovernedFormulaToActiveMathematics(detail.node.mathematics)
        ?? projectActiveNodeMathematics(detail.node.teachingFields);
      const teachingCaptureRevision = readActiveTeachingCaptureRevision(raw as AuthorityNodeDetailShard);
      const closedResources = publishedResources ?? sanitizeResourceBindings(
        attachActiveAuthorityResourceBindings(raw as AuthorityNodeDetailShard, role),
        (raw as AuthorityNodeDetailShard).node.id,
        teachingCaptureRevision,
      );
      const resourceBindings = closedResources.bindings;
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
        registryIndex: closedResources.registryIndex,
        teachingCaptureRevision,
        latestCutover,
      });
      return NextResponse.json(
        surface.status === 'ok' ? withKnowledgeSurface(payload, surface.knowledgeSurface) : payload,
      );
    }
    const surface = knowledgeSurfaceFromLearnerShard({
      shard: withMath,
      role: surfaceRole,
      locale: resolved.locale,
      latestCutover,
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
  // 根入口在发布前必须确认分片集闭包合格（spec：default/search/
  // neighborhood/detail 闭包缺失或身份失配时不得发布根入口）；部署或
  // 挂载遗漏 coverage 收据时 fail closed，而不是等后续点击再失败。
  return loadRootShardWithCoverage();
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

function normalizedSearchNeedle(value: string): string {
  return value.trim().toLocaleLowerCase('zh-CN');
}

function searchEntryMatches(
  entry: { label: string; aliases: readonly string[] },
  needle: string,
): boolean {
  if (!needle) return false;
  if (entry.label.trim().toLocaleLowerCase('zh-CN').includes(needle)) return true;
  return entry.aliases.some((alias) => (
    alias.trim().toLocaleLowerCase('zh-CN').includes(needle)
  ));
}

/**
 * Bounded domain search over the sealed identity-safe index (#1738). The
 * complete index never leaves the server; responses carry the same public
 * envelope as learner shards so clients can fail closed on identity drift.
 */
export function activeDomainSearchResponse(
  input: {
    domainKey: string;
    query: string;
    canonicalType: string | null;
    page: number;
    pageSize: number;
    request: Request;
  },
): NextResponse {
  const rejected = knowledgeSurfaceSelectorRejection(input.request);
  if (rejected) return rejected;
  try {
    const query = input.query.trim().slice(0, 120);
    const canonicalType = input.canonicalType && input.canonicalType.length <= 60
      ? input.canonicalType
      : null;
    const pageSize = Math.min(
      Math.max(1, Math.floor(input.pageSize || AUTHORITY_DOMAIN_SEARCH_PAGE_LIMIT)),
      AUTHORITY_DOMAIN_SEARCH_PAGE_LIMIT,
    );
    const page = Math.max(0, Math.floor(input.page));
    const index = loadDomainSearchIndexShard(input.domainKey);

    const qualification = resolveActiveLocaleQualification();
    const capability = qualification?.capability ?? historicalLocaleCapability();
    const resolved = resolveActiveLocaleRequest(input.request, capability);
    if (!resolved.ok) return resolved.response;
    const activeIdentity = resolveActiveShardIdentity();
    // One version-matched envelope for empty and matched responses alike.
    const envelope = publicAuthorityShardEnvelope(
      activeIdentity.envelope,
      localeBindingForCapability(
        resolved.locale,
        capability,
        `acv-${activeIdentity.envelope.authority.snapshotHash}`,
      ),
    );

    if (query.length < AUTHORITY_DOMAIN_SEARCH_MIN_QUERY_CHARS) {
      return NextResponse.json({
        contract: AUTHORITY_DOMAIN_SEARCH_CONTRACT,
        envelope,
        domainId: index.domainId,
        query,
        canonicalType,
        page: 0,
        pageSize,
        total: 0,
        hits: [],
      } satisfies AuthorityDomainSearchResponse);
    }
    const needle = normalizedSearchNeedle(query);
    // 受治理搜索词先于过滤参与匹配：公式按请求 locale 的可访问名可被发现
    // （#1740 spec：Search matches mathematical content），原始索引标签不动。
    const formulaSearchTerms = governedFormulaSearchTerms(
      index.entries.flatMap((entry) => (entry.canonicalType === 'Formula' ? [entry.id] : [])),
      resolved.locale,
      activeIdentity.envelope.authority.releaseId,
    );
    // 完整 locale 模式下，对象名按请求语言的投影参与匹配（#1741）：英文
    // 查询命中英文对象名，sealed 索引的 zh 标签不再是唯一匹配面。
    const localeLabels = capability.mode === 'complete-locale' && qualification?.manifest
      ? new Map(index.entries.flatMap((entry) => {
        const projected = localeProjectedObjectLabel(
          entry.id,
          resolved.locale,
          qualification.manifest,
        );
        return projected ? [[entry.id, projected] as const] : [];
      }))
      : null;
    const entryLabelFor = (entry: { id: string; label: string }): string => (
      localeLabels?.get(entry.id) ?? entry.label
    );
    const matched = index.entries
      .filter((entry) => !canonicalType || entry.canonicalType === canonicalType)
      .filter((entry) => {
        // 完整 locale 模式下 uncovered 对象（无当前语言对象名）不参与
        // 匹配——绝不让中文占位符出现在外文搜索结果里（#1741 P1）。
        if (localeLabels && !localeLabels.has(entry.id) && !formulaSearchTerms.has(entry.id)) {
          return false;
        }
        return searchEntryMatches(
          localeLabels?.has(entry.id)
            ? { ...entry, label: entryLabelFor(entry), aliases: [] }
            : entry,
          needle,
        )
          || (formulaSearchTerms.has(entry.id)
            && normalizedSearchNeedle(formulaSearchTerms.get(entry.id)!).includes(needle));
      })
      .sort((left, right) => (
        entryLabelFor(left).localeCompare(entryLabelFor(right), 'zh-CN')
        || left.id.localeCompare(right.id)
      ));
    const start = page * pageSize;
    const pageEntries = matched.slice(start, start + pageSize);

    const receipt = capability.mode === 'complete-locale' && qualification?.qualification
      ? (resolved.locale === 'en' ? qualification.qualification.en : qualification.qualification.zhCN)
      : null;
    const hits = attachGovernedMathToSearchHits(
      applyLocaleToSearchHits(
        pageEntries,
        resolved.locale,
        capability.mode === 'complete-locale' ? qualification?.manifest ?? null : null,
        receipt,
      ),
      resolved.locale,
      // 同版绑定：搜索命中只在命中对象属于当前 Authority release 时携带公式投影
      activeIdentity.envelope.authority.releaseId,
    );
    const response: AuthorityDomainSearchResponse = {
      contract: AUTHORITY_DOMAIN_SEARCH_CONTRACT,
      envelope,
      domainId: index.domainId,
      query,
      canonicalType,
      page,
      pageSize,
      total: matched.length,
      hits,
    };
    return NextResponse.json(response);
  } catch (error) {
    const failure = shardFailureCode(error);
    return NextResponse.json(
      { error: failure.message, code: failure.code },
      { status: failure.status },
    );
  }
}
