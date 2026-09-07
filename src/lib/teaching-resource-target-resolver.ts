/**
 * 共享教学资源 resourceId→href 解析（#2047）。
 *
 * 三段解析的唯一服务端真源：教材 `textbook-unit:` 复合单元、DB
 * TeachingResource、治理注册表资源（registry:/arena-task:）。陪伴资源卡
 * verify 路由与控灵引用分配共用本模块；版本校验口径沿用 companion verify
 * （教材 markdown sha256 / DB updatedAt ISO / 注册表全量治理投影内容哈希）。
 */

import { verifyGovernedRegistryCard } from '@/features/ai/companion/governed-registry-card';
import { getRegisteredResourceMetadataByNodeId } from '@/lib/resource-registry-metadata';
import { prisma } from '@/lib/prisma';
import { hashTextbookMarkdown } from '@/lib/textbook-resource-coach/identity';
import {
  buildTextbookReaderHref,
  loadTextbookCitationUnits,
} from '@/lib/textbook-reader';

const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.ogg'];

export type TeachingResourceTargetKind =
  | 'textbook-unit'
  | 'governed-registry-resource'
  | 'interactive-resource';

export type TeachingResourceViewerRole = 'student' | 'teacher' | 'admin';

/**
 * companion verify 语义：teacherOnly 对所有查看者按 not-found 混淆降级；
 * role-gated（控灵）：学生 unauthorized fail closed，教师/管理员可见。
 */
export type TeacherOnlyPolicy = 'always-unavailable' | 'role-gated';

export interface TeachingResourceTextbookIdentity {
  resourceId: string;
  bookId: string;
  edition: string;
  unitId: string;
  sourceRevision: string;
  contentHash: string;
  structuralPath: string[];
}

export type TeachingResourceTargetResolution =
  | {
      status: 'available';
      kind: TeachingResourceTargetKind;
      href: string;
      /** STATIC_MEDIA 内嵌地址（companion 卡内联渲染用；芯片仍走 href 页面路由）。 */
      mediaUrl?: string;
      mediaKind?: 'video' | 'audio';
      /** 教材单元身份（含当前 markdown sha256），供 vbh 句柄签发。 */
      textbookIdentity?: TeachingResourceTextbookIdentity;
      /** DB TeachingResource updatedAt（live 解析时的当前版本）。 */
      interactiveVersionHash?: string;
    }
  | {
      status: 'unavailable';
      kind: TeachingResourceTargetKind;
      reason: 'not-found' | 'hash-drift' | 'unauthorized';
    };

export function classifyTeachingResourceTarget(
  resourceId: string,
  kind?: string | null,
): TeachingResourceTargetKind {
  if (kind === 'textbook-unit' || resourceId.startsWith('textbook-unit:')) {
    return 'textbook-unit';
  }
  if (
    kind === 'governed-registry-resource'
    || resourceId.startsWith('registry:')
    || resourceId.startsWith('arena-task:')
  ) {
    return 'governed-registry-resource';
  }
  return 'interactive-resource';
}

/** 从复合 unitId（textbook-unit:{bookId}@{edition}/{path}）解析 bookId。 */
export function parseTextbookBookId(resourceId: string): string | null {
  if (!resourceId.startsWith('textbook-unit:')) return null;
  const rest = resourceId.slice('textbook-unit:'.length);
  const atIndex = rest.indexOf('@');
  if (atIndex <= 0) return null;
  return rest.slice(0, atIndex);
}

export async function resolveTeachingResourceTarget(input: {
  resourceId: string;
  /** 期望版本（companion 卡片快照）；缺省为 live 解析，不做哈希比对。 */
  versionHash?: string | null;
  kind?: string | null;
  viewerRole: TeachingResourceViewerRole;
  teacherOnlyPolicy: TeacherOnlyPolicy;
}): Promise<TeachingResourceTargetResolution> {
  const kind = classifyTeachingResourceTarget(input.resourceId, input.kind);
  if (kind === 'textbook-unit') {
    return verifyTextbookUnit(input.resourceId, input.versionHash ?? null);
  }
  if (kind === 'governed-registry-resource') {
    return verifyGovernedRegistryResource(input.resourceId, input.versionHash ?? null);
  }
  return verifyInteractiveResource(input.resourceId, input.versionHash ?? null, input);
}

async function verifyTextbookUnit(
  resourceId: string,
  versionHash: string | null,
): Promise<TeachingResourceTargetResolution> {
  const bookId = parseTextbookBookId(resourceId);
  if (!bookId) return { status: 'unavailable', kind: 'textbook-unit', reason: 'not-found' };
  try {
    const units = await loadTextbookCitationUnits({ requests: [{ bookId, unitIds: [resourceId] }] });
    const unit = units[0];
    if (!unit) return { status: 'unavailable', kind: 'textbook-unit', reason: 'not-found' };
    const contentHash = hashTextbookMarkdown(unit.markdown);
    if (versionHash && contentHash !== versionHash) {
      return { status: 'unavailable', kind: 'textbook-unit', reason: 'hash-drift' };
    }
    return {
      status: 'available',
      kind: 'textbook-unit',
      href: buildTextbookReaderHref({
        bookId: unit.bookId,
        edition: unit.edition,
        unitPath: unit.structuralPath,
      }),
      textbookIdentity: {
        resourceId,
        bookId: unit.bookId,
        edition: unit.edition,
        unitId: unit.id,
        sourceRevision: unit.sourceRevision,
        contentHash,
        structuralPath: [...unit.structuralPath],
      },
    };
  } catch {
    return { status: 'unavailable', kind: 'textbook-unit', reason: 'not-found' };
  }
}

function verifyGovernedRegistryResource(
  resourceId: string,
  versionHash: string | null,
): TeachingResourceTargetResolution {
  if (versionHash !== null) {
    const result = verifyGovernedRegistryCard(resourceId, versionHash);
    if (result.status !== 'available' || !result.href) {
      return {
        status: 'unavailable',
        kind: 'governed-registry-resource',
        reason: result.reason ?? 'not-found',
      };
    }
    return { status: 'available', kind: 'governed-registry-resource', href: result.href };
  }
  const metadata = getRegisteredResourceMetadataByNodeId(resourceId);
  const href = metadata?.launchTarget ?? metadata?.renderTarget ?? null;
  if (!href) {
    return { status: 'unavailable', kind: 'governed-registry-resource', reason: 'not-found' };
  }
  return { status: 'available', kind: 'governed-registry-resource', href };
}

async function verifyInteractiveResource(
  resourceId: string,
  versionHash: string | null,
  input: { viewerRole: TeachingResourceViewerRole; teacherOnlyPolicy: TeacherOnlyPolicy },
): Promise<TeachingResourceTargetResolution> {
  const kind: TeachingResourceTargetKind = 'interactive-resource';
  const resource = await prisma.teachingResource.findUnique({
    where: { id: resourceId },
    select: { teacherOnly: true, updatedAt: true, type: true, content: true },
  });
  if (!resource) {
    return { status: 'unavailable', kind, reason: 'not-found' };
  }
  if (
    resource.teacherOnly
    && (input.teacherOnlyPolicy === 'always-unavailable' || input.viewerRole === 'student')
  ) {
    // companion 语义按 not-found 混淆存在性；控灵语义区分 unauthorized。
    return {
      status: 'unavailable',
      kind,
      reason: input.teacherOnlyPolicy === 'always-unavailable' ? 'not-found' : 'unauthorized',
    };
  }
  const updatedAt = new Date(resource.updatedAt).toISOString();
  if (versionHash !== null && updatedAt !== versionHash) {
    return { status: 'unavailable', kind, reason: 'hash-drift' };
  }
  const mediaUrl = staticMediaUrl(resource.type, resource.content ?? '');
  return {
    status: 'available',
    kind,
    href: `/interactive-learning/resources/${resourceId}`,
    ...(mediaUrl ? { mediaUrl, mediaKind: staticMediaKind(mediaUrl) } : {}),
    interactiveVersionHash: updatedAt,
  };
}

function staticMediaUrl(
  type: string | null,
  content: string,
): string | undefined {
  if (type !== 'STATIC_MEDIA' || !content) return undefined;
  if (
    content.endsWith('.mp4')
    || AUDIO_EXTENSIONS.some((extension) => content.endsWith(extension))
  ) {
    return content;
  }
  return undefined;
}

export function staticMediaKind(mediaUrl: string | undefined): 'video' | 'audio' | undefined {
  if (!mediaUrl) return undefined;
  if (mediaUrl.endsWith('.mp4')) return 'video';
  if (AUDIO_EXTENSIONS.some((extension) => mediaUrl.endsWith(extension))) return 'audio';
  return undefined;
}
