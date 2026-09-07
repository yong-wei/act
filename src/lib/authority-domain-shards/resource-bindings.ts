/**
 * Selection-bound Authority resource-binding projector.
 *
 * Resolves Teaching Projection resources that share the node-detail shard
 * envelope and returns learner-safe launch descriptors. Never invents routes
 * from Canonical IDs or copies Legacy graph DTOs into the active workspace.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  buildTeachingResourceLaunchMaps,
  resolveConfiguredTeachingProjectionRoot,
} from '@/lib/layered-graph/course-page-context';
import {
  loadStagedTeachingProjection,
  resolveTeachingProjectionStorePaths,
} from '@/lib/teaching-projection/store';
import {
  DEFAULT_DOMAIN_TEACHING_RUNTIME_RELATIVE,
  resolveDomainTeachingRuntimePaths,
} from './teaching';
import type {
  TeachingBindingRuntime,
  TeachingProjectionRole,
  TeachingResourceRuntime,
  TeachingResourceType,
} from '@/lib/teaching-projection/contracts';
import { resolveSafeLaunchTarget } from '@/features/knowledge/launch-target';
import type {
  ActiveNodeResourceBindings,
  ActiveResourceBinding,
  ActiveResourceBindingRole,
} from '@/features/knowledge/active-authority-graph-contracts';

import type { KnowledgeRole } from '@/lib/authoritative-knowledge';
import type { AuthorityNodeDetailShard } from './contracts';
import { fromResourceIdToken } from '@/lib/teaching-projection/textbook-locators/identity';
import { buildTextbookReaderHref } from '@/lib/textbook-reader';
import { TEXTBOOK_ID_ALIASES } from '@/lib/engineering-textbook-mapping';

const ROLE_LABEL: Record<TeachingProjectionRole, ActiveResourceBindingRole> = {
  EXPLAINS: '讲解',
  PRACTICES: '练习',
  ASSESSES: '评价',
  COVERS: '引用',
};

const ROLE_ORDER: readonly ActiveResourceBindingRole[] = ['讲解', '练习', '评价', '引用'];

export function humanTitleFromResourceId(resourceId: string): string | null {
  const match = resourceId.match(/^act:(audio|video|handout|exercise|card|simulation|lesson):(.+)$/);
  if (!match) return null;
  const kind = match[1];
  const rest = match[2];
  const unit = rest.match(/(\d+-\d+)/)?.[1];
  const labels: Record<string, string> = {
    audio: '音频',
    video: '视频',
    handout: '讲义',
    exercise: '练习',
    card: '知识卡',
    simulation: '仿真',
    lesson: '课程',
  };
  if (kind === 'card') {
    const name = rest.replace(/_\d+_[0-9a-f]+$/i, '').replace(/_/g, ' ').trim();
    return name || labels.card;
  }
  if (unit) return `${unit} ${labels[kind] ?? '教学资源'}`;
  return `${rest} ${labels[kind] ?? '教学资源'}`;
}

function resourceKindLabel(resourceType: TeachingResourceType | null): string {
  switch (resourceType) {
    case 'lesson':
      return '课程';
    case 'handout':
      return '讲义';
    case 'step':
      return '步骤';
    case 'textbook':
    case 'textbook-chapter':
    case 'textbook-section':
      return '教材';
    case 'card':
      return '知识卡';
    default:
      return '教学资源';
  }
}

function isUnsafeHref(href: string, nodeId: string): boolean {
  return href.includes(nodeId)
    || href.startsWith('file:')
    || href.includes('course-content/')
    || href.includes('\\')
    || /(?:^|\/)\.+\//.test(href);
}

function isHiddenFromViewer(href: string, role: KnowledgeRole | undefined): boolean {
  if (role !== 'STUDENT') return false;
  return /^(?:\/teacher|\/admin|\/api\/teacher|\/api\/admin)(?:\/|$)/.test(href);
}

/**
 * v2 textbook-section launch (#2043): decode the single-token section identity
 * back to its structural coordinate and resolve the unified reader href via
 * the alias table. Fails closed (null) on any drift — no href is fabricated.
 */
function textbookSectionReaderHref(resourceId: string): string | null {
  const token = resourceId.slice('act:textbook-section:'.length);
  if (!token || token.includes(':')) return null;
  let decoded: string;
  try {
    decoded = fromResourceIdToken(token);
  } catch {
    return null;
  }
  const segments = decoded.split(':');
  if (segments.length < 2 || segments.some((segment) => !segment)) return null;
  const bookId = segments[0]!;
  const alias = TEXTBOOK_ID_ALIASES.find((row) => row.readerBookId === bookId);
  if (!alias) return null;
  try {
    return buildTextbookReaderHref({
      bookId,
      edition: alias.edition,
      unitPath: segments.slice(1),
    });
  } catch {
    return null;
  }
}

export function projectAuthorityNodeResourceBindings(input: {
  nodeId: string;
  bindings: readonly TeachingBindingRuntime[];
  resources: readonly TeachingResourceRuntime[];
  viewerRole?: KnowledgeRole;
}): ActiveNodeResourceBindings {
  const matched = input.bindings.filter((binding) => binding.canonicalId === input.nodeId);
  if (matched.length === 0) {
    return { state: 'empty', message: '暂无已授权系统资源。' };
  }
  const resources = input.resources.filter((resource) =>
    matched.some((binding) => binding.resourceId === resource.resourceId));
  const launchMaps = buildTeachingResourceLaunchMaps(resources);
  const items: ActiveResourceBinding[] = [];
  for (const binding of matched) {
    const resource = resources.find((entry) => entry.resourceId === binding.resourceId);
    const title = resource?.title?.trim()
      || (resource ? humanTitleFromResourceId(resource.resourceId) : null);
    if (!title) continue;
    const candidateHref = launchMaps.resourceLaunchTargets[binding.resourceId] ?? null;
    // v2 textbook sections launch into the unified reader; the edition route
    // segment legitimately percent-encodes spaces (e.g. 14th%20Global%20Edition),
    // which the generic encoded-space guard would reject. The href is derived
    // from the sealed alias table and governed structural paths — not external
    // input — and still passes the unsafe/hidden gates below.
    const readerHref = resource?.resourceType === 'textbook-section'
      ? textbookSectionReaderHref(binding.resourceId)
      : null;
    const resolved = readerHref
      ? { href: readerHref }
      : resolveSafeLaunchTarget(candidateHref);
    const href = resolved.href
      && !isUnsafeHref(resolved.href, input.nodeId)
      && !isHiddenFromViewer(resolved.href, input.viewerRole)
      ? resolved.href
      : null;
    const kind = href
      ? (launchMaps.resourceRegistryIds[binding.resourceId] ? 'registry-resource' : 'direct-route')
      : 'unavailable';
    items.push({
      title,
      bindingRole: ROLE_LABEL[binding.role],
      resourceKind: resourceKindLabel(resource?.resourceType ?? null),
      availability: href ? 'available' : 'unavailable',
      launch: { kind, href },
    });
  }
  if (items.length === 0) {
    return { state: 'empty', message: '暂无已授权系统资源。' };
  }
  items.sort((left, right) =>
    ROLE_ORDER.indexOf(left.bindingRole) - ROLE_ORDER.indexOf(right.bindingRole)
    || left.title.localeCompare(right.title, 'zh-CN'));
  return { state: 'available', items };
}

function matchActiveTeachingProjection(shard: AuthorityNodeDetailShard): {
  status: 'unavailable' | 'mismatch' | 'available';
  authoringRevision: string | null;
  bindings?: readonly TeachingBindingRuntime[];
  resources?: readonly TeachingResourceRuntime[];
} {
  const teaching = shard.envelope.teaching;
  if (
    shard.envelope.match.teaching !== true
    || teaching.status !== 'available'
    || !teaching.projectionId
    || !teaching.projectionHash
  ) {
    return { status: 'unavailable', authoringRevision: null };
  }
  const overlay = resolveDomainTeachingRuntimePaths(process.cwd(), DEFAULT_DOMAIN_TEACHING_RUNTIME_RELATIVE);
  const sidecarPath = join(overlay.releasesDir, teaching.projectionId, 'inspector-sidecar.json');
  if (!existsSync(sidecarPath)) {
    return { status: 'unavailable', authoringRevision: null };
  }
  let sidecar: {
    envelopeProjectionId?: string;
    envelopeProjectionHash?: string;
    courseProjectionId?: string;
    courseProjectionHash?: string;
    authorityReleaseId?: string;
    authorityReleaseSetId?: string;
    authoritySnapshotId?: string;
    authoritySnapshotHash?: string;
  };
  try {
    sidecar = JSON.parse(readFileSync(sidecarPath, 'utf8')) as typeof sidecar;
  } catch {
    return { status: 'unavailable', authoringRevision: null };
  }
  if (
    sidecar.envelopeProjectionId !== teaching.projectionId
    || sidecar.envelopeProjectionHash !== teaching.projectionHash
  ) {
    return { status: 'mismatch', authoringRevision: null };
  }
  const authority = shard.envelope.authority;
  if (
    sidecar.authorityReleaseId !== authority.releaseId
    || sidecar.authorityReleaseSetId !== authority.releaseSetId
    || sidecar.authoritySnapshotId !== authority.snapshotId
    || sidecar.authoritySnapshotHash !== authority.snapshotHash
    || !sidecar.courseProjectionId
    || !sidecar.courseProjectionHash
  ) {
    return { status: 'mismatch', authoringRevision: null };
  }
  let staged;
  try {
    staged = loadStagedTeachingProjection(
      resolveTeachingProjectionStorePaths(resolveConfiguredTeachingProjectionRoot()),
      sidecar.courseProjectionId,
    );
  } catch {
    return { status: 'unavailable', authoringRevision: null };
  }
  if (
    staged.projectionId !== sidecar.courseProjectionId
    || staged.projectionHash !== sidecar.courseProjectionHash
    || !staged.artifacts.gate.passed
  ) {
    return { status: 'mismatch', authoringRevision: null };
  }
  const boundIds = new Set(staged.artifacts.bindings.map((binding) => binding.resourceId));
  return {
    status: 'available',
    authoringRevision: staged.artifacts.manifest.authoringRevision,
    bindings: staged.artifacts.bindings,
    resources: staged.artifacts.resources.filter((resource) => boundIds.has(resource.resourceId)),
  };
}

export function readActiveTeachingCaptureRevision(
  shard: AuthorityNodeDetailShard,
): string | null {
  const matched = matchActiveTeachingProjection(shard);
  return matched.status === 'available' ? matched.authoringRevision : null;
}

export function attachActiveAuthorityResourceBindings(
  shard: AuthorityNodeDetailShard,
  viewerRole?: KnowledgeRole,
): ActiveNodeResourceBindings {
  const matched = matchActiveTeachingProjection(shard);
  if (matched.status === 'unavailable') {
    return { state: 'unavailable', message: '当前系统资源暂时不可用。' };
  }
  if (matched.status !== 'available' || !matched.bindings || !matched.resources) {
    return { state: 'unavailable', message: '当前系统资源与所选对象身份不一致。' };
  }
  return projectAuthorityNodeResourceBindings({
    nodeId: shard.node.id,
    bindings: matched.bindings,
    resources: matched.resources,
    viewerRole,
  });
}
