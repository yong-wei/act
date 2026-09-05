/**
 * 治理注册表资源卡身份与版本校验（服务端共用）。
 *
 * 静态治理注册表（registry:/arena-task: 资源节点）没有独立版本号字段，
 * 真实版本契约（sourceHash/sourceVersionRef 等）分布在治理元数据投影的
 * 各字段中（含 defaultConfig）。版本口径因此以注册表条目的**全量治理投影**
 * （含 progression/operational/semantic patches 合并结果）做键排序稳定序列化
 * 内容哈希：任何治理字段随部署变更后，旧会话快照哈希不再匹配、对应卡片降级；
 * 注册表条目删除则解析失败降级。
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

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function computeGovernedRegistryContentHash(
  metadata: NonNullable<ReturnType<typeof getRegisteredResourceMetadataByNodeId>>,
): string {
  return `registry-sha256:${createHash('sha256').update(stableStringify(metadata), 'utf8').digest('hex')}`;
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

