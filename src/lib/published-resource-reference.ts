import type { TeachingResourceType } from './teaching-projection/contracts';

export const PUBLISHED_RESOURCE_LABELS: Record<TeachingResourceType, string> = {
  card: '知识卡', infographic: '信息图', handout: '讲义', video: '视频', audio: '音频', podcast: '音频',
  lesson: '课程', step: '课程步骤', exercise: '习题', simulation: '仿真',
  slides: '课件', project: '项目',
  textbook: '教材', 'textbook-chapter': '教材章节', 'textbook-section': '教材节',
};

export function publishedResourcePathType(type: TeachingResourceType) {
  if (type === 'card') return 'knowledge_card';
  if (type === 'lesson' || type === 'step') return 'lesson_step';
  if (type === 'podcast') return 'audio';
  if (type === 'textbook-section') return 'textbook_section';
  if (type === 'textbook-chapter') return 'textbook';
  return type;
}

export interface PublishedResourceIdentity {
  resourceId: string;
  projectionId: string;
  projectionHash: string;
  snapshotId: string;
  snapshotHash: string;
  runtimeReleaseId?: string | null;
  /** Optional content version used to keep a generated resource target exact. */
  resourceVersion?: string;
}

export interface ResourceFeatureReference extends PublishedResourceIdentity {
  resourceVersion: string;
  indexId: string;
  learnerPreparedness?: number | null;
}

export interface EngineeringResourceOrderEvidence {
  requiredNodeIds: string[];
  blockedNodeIds: string[];
  constraints: Array<{ relationId: string; sourceCanonicalId: string; targetCanonicalId: string;
    prerequisiteNodeId: string; dependentNodeId: string; source: 'ENGINEERING' }>;
  issues: string[];
}

export type PublishedResourceBackend =
  | { kind: 'card' }
  | { kind: 'infographic'; token: string }
  | { kind: 'route'; href: string }
  | { kind: 'media'; mediaType: 'video' | 'audio'; href: string; assetPath: string }
  | { kind: 'container'; childResourceIds: string[] }
  | { kind: 'reference-only'; reason: string };

export interface PublishedResourceFeature {
  identity: PublishedResourceIdentity;
  version: string;
  type: TeachingResourceType;
  title: string;
  summary: string;
  canonicalIds: string[];
  bindingIds: string[];
  bindingRoles: string[];
  sourcePath: string | null;
  baselineDifficulty: number | null;
  estimatedMinutes: number;
  estimateSource: 'catalog' | 'policy-estimate';
  executable: boolean;
  recommendable: boolean;
  limitation: string | null;
  backend: PublishedResourceBackend;
  appearance?: 'first' | 'revisit' | 'reference';
  teachingOrder?: { unitId: string; unitIndex: number; stepIndex: number | null } | null;
  anchorLabel?: string | null;
}

export interface PublishedResourceFeatureIndex {
  contract: 'published-resource-features/v1';
  indexId: string;
  projectionId: string;
  projectionHash: string;
  snapshotId: string;
  snapshotHash: string;
  runtimeReleaseId: string | null;
  authorityReleaseId: string;
  bindingReleaseId?: string | null;
  bindingHash?: string | null;
  generatedAt: string;
  resources: PublishedResourceFeature[];
  prerequisiteEdges: Array<{
    id: string;
    sourceId: string;
    targetId: string;
    origin: 'ENGINEERING';
  }>;
}

const SHA256 = /^[a-f0-9]{64}$/;
const RESOURCE_ID = /^act:[a-z][a-z-]*:[^/\\\s\u0000-\u001f]+$/u;
const REFERENCE_PATH = '/learning-resources/';

export function isPublishedResourceIdentity(value: unknown): value is PublishedResourceIdentity {
  if (!value || typeof value !== 'object') return false;
  const ref = value as Partial<PublishedResourceIdentity>;
  return typeof ref.resourceId === 'string' && ref.resourceId.length <= 500
    && RESOURCE_ID.test(ref.resourceId)
    && typeof ref.projectionHash === 'string' && SHA256.test(ref.projectionHash)
    && ref.projectionId === 'proj-' + ref.projectionHash
    && typeof ref.snapshotHash === 'string' && SHA256.test(ref.snapshotHash)
    && ref.snapshotId === 'snap-' + ref.snapshotHash
    && (ref.runtimeReleaseId == null || (
      typeof ref.runtimeReleaseId === 'string'
      && /^[A-Za-z0-9][A-Za-z0-9:._-]{0,199}$/.test(ref.runtimeReleaseId)
    ))
    && (ref.resourceVersion === undefined || (
      typeof ref.resourceVersion === 'string' && SHA256.test(ref.resourceVersion)
    ));
}

export function buildPublishedResourceHref(identity: PublishedResourceIdentity): string {
  if (!isPublishedResourceIdentity(identity)) throw new Error('Invalid published resource reference');
  const query = new URLSearchParams({
    projection: identity.projectionId,
    projectionHash: identity.projectionHash,
    snapshot: identity.snapshotId,
    snapshotHash: identity.snapshotHash,
  });
  if (identity.runtimeReleaseId) query.set('runtime', identity.runtimeReleaseId);
  if (identity.resourceVersion) query.set('resourceVersion', identity.resourceVersion);
  return REFERENCE_PATH + encodeURIComponent(identity.resourceId) + '?' + query.toString();
}

export function parsePublishedResourceHref(href: string): PublishedResourceIdentity | null {
  if (!href.startsWith(REFERENCE_PATH) || href.includes('\\') || /[\u0000-\u0020]/u.test(href)) return null;
  try {
    const url = new URL(href, 'https://act.local');
    if (url.origin !== 'https://act.local') return null;
    const encodedId = url.pathname.slice(REFERENCE_PATH.length);
    if (!encodedId || encodedId.includes('/')) return null;
    const resourceId = decodeURIComponent(encodedId);
    for (const key of ['projection', 'projectionHash', 'snapshot', 'snapshotHash']) {
      if (url.searchParams.getAll(key).length !== 1) return null;
    }
    if (url.searchParams.getAll('runtime').length > 1) return null;
    if (url.searchParams.getAll('resourceVersion').length > 1) return null;
    const resourceVersion = url.searchParams.get('resourceVersion');
    const identity = {
      resourceId,
      projectionId: url.searchParams.get('projection'),
      projectionHash: url.searchParams.get('projectionHash'),
      snapshotId: url.searchParams.get('snapshot'),
      snapshotHash: url.searchParams.get('snapshotHash'),
      runtimeReleaseId: url.searchParams.get('runtime'),
      ...(resourceVersion === null ? {} : { resourceVersion }),
    };
    return isPublishedResourceIdentity(identity) ? identity : null;
  } catch {
    return null;
  }
}

export function publishedResourceNodeId(resourceId: string, resourceVersion: string): string {
  return 'published-resource:' + resourceVersion + ':' + resourceId;
}

/** Structural proof for a controlled published path entry; persistence also checks index membership. */
export function hasPublishedPlanNodeIdentity(node: {
  nodeId: string; type: string; sourceKind?: string; sourceRef?: string; target: string;
  resourceFeatureRef?: ResourceFeatureReference;
}): boolean {
  const ref = node.resourceFeatureRef;
  if (!ref || !isPublishedResourceIdentity(ref) || !SHA256.test(ref.resourceVersion) || !SHA256.test(ref.indexId)) return false;
  const type = ref.resourceId.split(':')[1] as TeachingResourceType;
  const target = parsePublishedResourceHref(node.target);
  return type in PUBLISHED_RESOURCE_LABELS && publishedResourcePathType(type) === node.type
    && node.sourceKind === 'teaching_projection' && node.sourceRef === ref.resourceId
    && node.nodeId === publishedResourceNodeId(ref.resourceId, ref.resourceVersion)
    && target?.resourceId === ref.resourceId && target.projectionId === ref.projectionId
    && target.projectionHash === ref.projectionHash && target.snapshotId === ref.snapshotId
    && target.snapshotHash === ref.snapshotHash && (target.runtimeReleaseId ?? null) === (ref.runtimeReleaseId ?? null)
    && (target.resourceVersion === undefined || target.resourceVersion === ref.resourceVersion);
}
