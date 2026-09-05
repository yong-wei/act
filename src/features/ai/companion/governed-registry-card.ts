/**
 * 治理注册表资源卡身份与版本校验（服务端共用）。
 *
 * 静态治理注册表（registry:/arena-task: 资源节点）没有独立版本号字段，
 * 版本口径以治理元数据核心字段（类型/标签/跳转目标/知识节点）的稳定序列化
 * 内容哈希承载：内容或跳转目标随部署变更后，旧会话快照哈希不再匹配，
 * 对应卡片降级；注册表条目删除则解析失败降级。
 */

import { createHash } from 'node:crypto';

import { getRegisteredResourceMetadataByNodeId } from '@/lib/resource-registry-metadata';

export interface GovernedRegistryCard {
  resourceId: string;
  versionHash: string;
  reason: string;
  kind: 'governed-registry-resource';
}

export interface GovernedRegistryVerifyResult {
  status: 'available' | 'unavailable';
  reason?: 'not-found' | 'hash-drift';
  href?: string;
}

function computeGovernedRegistryContentHash(metadata: NonNullable<ReturnType<typeof getRegisteredResourceMetadataByNodeId>>): string {
  const canonical = JSON.stringify({
    id: metadata.id,
    type: metadata.type,
    label: metadata.label,
    launchTarget: metadata.launchTarget ?? null,
    renderTarget: metadata.renderTarget ?? null,
    knowledgeNodeIds: [...(metadata.knowledgeNodeIds ?? [])].sort(),
  });
  return `registry-sha256:${createHash('sha256').update(canonical, 'utf8').digest('hex')}`;
}

/** 按注册表资源节点身份解析资源卡快照；条目缺失（下架/未知身份）返回 null。 */
export function resolveGovernedRegistryCard(resourceNodeId: string): GovernedRegistryCard | null {
  const metadata = getRegisteredResourceMetadataByNodeId(resourceNodeId);
  if (!metadata) return null;
  return {
    resourceId: resourceNodeId,
    versionHash: computeGovernedRegistryContentHash(metadata),
    reason: metadata.label,
    kind: 'governed-registry-resource',
  };
}

/** 打开/恢复时按注册表当前内容重校验；哈希漂移或条目缺失仅降级对应卡片。 */
export function verifyGovernedRegistryCard(resourceId: string, versionHash: string): GovernedRegistryVerifyResult {
  const metadata = getRegisteredResourceMetadataByNodeId(resourceId);
  if (!metadata) return { status: 'unavailable', reason: 'not-found' };
  if (versionHash !== computeGovernedRegistryContentHash(metadata)) {
    return { status: 'unavailable', reason: 'hash-drift' };
  }
  const href = metadata.launchTarget ?? metadata.renderTarget;
  if (!href) return { status: 'unavailable', reason: 'not-found' };
  return { status: 'available', href };
}
