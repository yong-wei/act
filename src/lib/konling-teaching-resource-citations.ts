/**
 * 控灵教学投影绑定资源的服务端引用解析（#2047）。
 *
 * linkedResources 经共享三段解析得到安全 href：教材单元签发 vbh 句柄
 * （点击前经 version-bound-target 重校验），registry/DB 资源解析当前
 * launch/render 目标。解析失败、teacherOnly 对学生 fail closed、角色不可见
 * 的资源不进 citation allocator，只在 grounding 文本中保留非链接形式。
 */

import type { KonlingAssignableCitation } from '@/lib/konling-citation-protocol';
import type { KonlingLinkedTeachingResource } from '@/lib/konling-teaching-projection-context';
import type { TeachingResourceViewerRole } from '@/lib/teaching-resource-target-resolver';
import { resolveTeachingResourceTarget } from '@/lib/teaching-resource-target-resolver';
import { STRUCTURED_TEXTBOOK_UNIT_KIND } from '@/lib/textbook-resource-coach/types';
import { issueTextbookVersionBoundHref } from '@/lib/textbook-resource-coach/navigation-handle';

export interface KonlingTeachingResourceCitationResolution {
  /** 服务端解析成功、可进 citation allocator 的引用（按 resourceId 去重）。 */
  citations: KonlingAssignableCitation[];
  /** 解析失败/不可见资源：仅记录 id 与原因，不产出可点击条目。 */
  unresolved: Array<{ resourceId: string; reason: string }>;
}

export function konlingTeachingResourceViewerRole(
  role: string | null | undefined,
): TeachingResourceViewerRole {
  if (role === 'teacher') return 'teacher';
  if (role === 'admin') return 'admin';
  return 'student';
}

export async function resolveKonlingTeachingResourceCitations(input: {
  viewerRole: TeachingResourceViewerRole;
  linkedResources: readonly KonlingLinkedTeachingResource[];
  /** 投影身份：与 composed 通道共用同一 canonicalKey 去重空间。 */
  projectionId?: string | null;
}): Promise<KonlingTeachingResourceCitationResolution> {
  const citations: KonlingAssignableCitation[] = [];
  const unresolved: KonlingTeachingResourceCitationResolution['unresolved'] = [];
  const seen = new Set<string>();

  for (const resource of input.linkedResources) {
    if (seen.has(resource.resourceId)) continue;
    seen.add(resource.resourceId);

    const resolved = await resolveTeachingResourceTarget({
      resourceId: resource.resourceId,
      versionHash: null,
      viewerRole: input.viewerRole,
      teacherOnlyPolicy: 'role-gated',
    });
    if (resolved.status !== 'available') {
      unresolved.push({ resourceId: resource.resourceId, reason: `${resolved.kind}:${resolved.reason}` });
      continue;
    }

    if (resolved.textbookIdentity) {
      const identity = resolved.textbookIdentity;
      // vbh 签发依赖服务端密钥；不可签发时退回普通 reader href（无句柄则
      // 点击不经重校验，仅在开发弱密钥环境出现）。
      const vbhHref = issueTextbookVersionBoundHref(
        {
          resourceKind: STRUCTURED_TEXTBOOK_UNIT_KIND,
          resourceId: identity.resourceId,
          bookId: identity.bookId,
          edition: identity.edition,
          sourceRevision: identity.sourceRevision,
          unitId: identity.unitId,
          contentHash: identity.contentHash,
          anchorId: null,
        },
        identity.structuralPath,
      );
      citations.push({
        id: `teach-res:${resource.resourceId}`,
        sourceType: 'textbook',
        displayTitle: resource.title ?? resource.resourceId,
        href: vbhHref ?? resolved.href,
        verifiable: true,
        confidence: 'high',
        evidenceBasis: 'teaching-projection:textbook-unit',
        identity: {
          kind: 'textbook',
          bookId: identity.bookId,
          edition: identity.edition,
          sourceRevision: identity.sourceRevision,
          unitId: identity.unitId,
          fragmentId: null,
        },
      });
      continue;
    }

    citations.push({
      id: `teach-res:${resource.resourceId}`,
      sourceType: 'teaching-resource',
      displayTitle: resource.title ?? resource.resourceId,
      href: resolved.href,
      verifiable: true,
      confidence: 'high',
      evidenceBasis: `teaching-projection:${resolved.kind}`,
      identity: {
        kind: 'teaching-resource',
        resourceId: resource.resourceId,
        resourceType: resource.resourceType ?? null,
        projectionId: input.projectionId ?? null,
        canonicalId: resource.canonicalId,
      },
    });
  }

  return { citations, unresolved };
}
