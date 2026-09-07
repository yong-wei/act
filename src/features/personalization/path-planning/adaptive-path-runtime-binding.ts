/**
 * 候选节点 → Runtime 资源绑定解析（Issue #2055）。
 *
 * 绑定独立于节点导航 target：以教学投影确定性身份规则（teaching-projection
 * identity 派生格式的逆向映射，与 #2046 前瞻映射同一张表）把节点反解到投影
 * `act:*` resourceId，经其 sourcePath 得到 blob 内容键或 release 资产路径，再与
 * 活动 Runtime release manifest 连接确认可用性。release manifest 是"可绑定"的
 * 唯一真源，禁止模糊匹配；绑定失败逐节点显式记录状态与原因，不静默跳过。
 */

export type AdaptivePathRuntimeBindingState =
  | 'bound'
  | 'no-runtime-identity'
  | 'not-in-active-release'
  | 'no-active-release';

export interface AdaptivePathNodeRuntimeBinding {
  nodeId: string;
  /** 教学投影 `act:*` resourceId；身份反解失败为 null。 */
  resourceId: string | null;
  /** 教学投影资源类型（card/handout/video/audio/simulation…）。 */
  resourceType: string | null;
  state: AdaptivePathRuntimeBindingState;
  /** bound 时为 release 资产路径或 blob 内容键（`blob:<sha256>`），其余为 null。 */
  objectKey: string | null;
  /** bound 时为 release manifest 记录的内容校验值。 */
  contentSha256: string | null;
  runtimeReleaseId: string | null;
  /** 解析依据的教学投影标识。 */
  projectionId: string | null;
  /** 失败原因码；bound 时为 null。 */
  reason: string | null;
  /** 节点出现的候选 styleId 列表（批次元数据装饰，供学生安全投影分组）。 */
  candidateStyleIds?: string[];
}

/** 可能承载 Runtime 资产身份的节点类型；其余平台原生类型不产生绑定记录。 */
const RUNTIME_ASSET_BEARING_NODE_TYPES = new Set([
  'video',
  'audio',
  'slides',
  'handout',
  'knowledge_card',
  'simulation',
  'arena_task',
]);

const CONTENT_KEY_PATTERN = /^content:([a-f0-9]{64})$/u;
const AUTHORING_MEDIA_PATH_PATTERN = /^authoring:(lessons\/[^/]+\/media\/)(?:processed\/)?(.+)$/u;

export interface TeachingProjectionResourceIndex {
  projectionId: string;
  resourcesByResourceId: Map<string, { resourceType: string; sourcePath: string | null }>;
}

export interface RuntimeReleaseFileIndex {
  releaseId: string;
  filesByPath: Map<string, { sha256: string }>;
  filesBySha256: Map<string, { path: string }>;
}
/**
 * ResourceNode → 教学投影 resourceId 确定性反解。
 * 与 `path-planning-consumes-teaching-projection`（#2046）的映射表互为逆向；
 * runtime-media 仅认 B′′ 已身份化的媒体（课次导入视频 / 课次音频），
 * 其余媒体 id 不猜测归属。
 */
export function deriveTeachingProjectionResourceIdentity(
  nodeId: string,
): { resourceId: string; resourceType: string } | null {
  let match = /^runtime-handout:([^:]+)$/u.exec(nodeId);
  if (match) return { resourceId: `act:handout:${match[1]}`, resourceType: 'handout' };
  match = /^runtime-media:([^:]+):([^:]+)$/u.exec(nodeId);
  if (match) {
    const lessonKey = match[1];
    const mediaId = match[2];
    if (mediaId === `${lessonKey}-intro-video`) {
      return { resourceId: `act:video:${lessonKey}`, resourceType: 'video' };
    }
    if (mediaId === `${lessonKey}-audio`) {
      return { resourceId: `act:audio:${lessonKey}`, resourceType: 'audio' };
    }
    return null;
  }
  match = /^knowledge-card:(.+)$/u.exec(nodeId);
  if (match) return { resourceId: `act:card:${match[1]}`, resourceType: 'card' };
  match = /^arena-task:(.+)$/u.exec(nodeId);
  if (match) {
    // B′′ 键为 arena-task-<slug>，挑战 id 为 task-<slug>（与 teaching-resource-launch-maps 同一归一化）。
    const slug = match[1].replace(/^task-/u, '');
    return { resourceId: `act:simulation:arena-task-${slug}`, resourceType: 'simulation' };
  }
  return null;
}

export function isRuntimeAssetBearingNodeType(nodeType: string): boolean {
  return RUNTIME_ASSET_BEARING_NODE_TYPES.has(nodeType);
}

/** sourcePath → release 对象键（纯函数）：成功时给出对象键与期望校验值。 */
export function resolveRuntimeSourceObjectKey(
  sourcePath: string | null,
  release: RuntimeReleaseFileIndex,
): { objectKey: string; contentSha256: string } | { reason: string } {
  if (sourcePath === null) return { reason: 'null-source-path' };
  const contentKey = CONTENT_KEY_PATTERN.exec(sourcePath);
  if (contentKey) {
    const sha256 = contentKey[1];
    const file = release.filesBySha256.get(sha256);
    if (!file) return { reason: 'content-key-not-in-release' };
    return { objectKey: `blob:${sha256}`, contentSha256: sha256 };
  }
  if (sourcePath.startsWith('authoring:')) {
    const mediaPath = AUTHORING_MEDIA_PATH_PATTERN.exec(sourcePath);
    if (!mediaPath) return { reason: 'authoring-path-unmapped' };
    const assetPath = `${mediaPath[1]}${mediaPath[2]}`;
    const file = release.filesByPath.get(assetPath);
    if (!file) return { reason: 'asset-path-not-in-release' };
    return { objectKey: assetPath, contentSha256: file.sha256 };
  }
  return { reason: 'non-asset-source-path' };
}

/**
 * 逐节点解析 Runtime 资源绑定。非资产承载类型不产生记录；无活动 release 时
 * 资产承载节点统一记 `no-active-release`（批次级限制，不静默为空）。
 */
export function resolveAdaptivePathNodeRuntimeBindings(input: {
  nodes: ReadonlyArray<{ nodeId: string; nodeType: string }>;
  projection: TeachingProjectionResourceIndex | null;
  release: RuntimeReleaseFileIndex | null;
}): AdaptivePathNodeRuntimeBinding[] {
  const bindings: AdaptivePathNodeRuntimeBinding[] = [];
  const seen = new Set<string>();
  for (const node of input.nodes) {
    if (!isRuntimeAssetBearingNodeType(node.nodeType) || seen.has(node.nodeId)) continue;
    seen.add(node.nodeId);
    const projectionId = input.projection?.projectionId ?? null;
    if (!input.release) {
      bindings.push({
        nodeId: node.nodeId,
        resourceId: null,
        resourceType: null,
        state: 'no-active-release',
        objectKey: null,
        contentSha256: null,
        runtimeReleaseId: null,
        projectionId,
        reason: 'no-active-release',
      });
      continue;
    }
    const identity = deriveTeachingProjectionResourceIdentity(node.nodeId);
    if (!identity) {
      bindings.push(noRuntimeIdentity(node.nodeId, projectionId, input.release.releaseId, 'unmapped-node-id'));
      continue;
    }
    const resource = input.projection?.resourcesByResourceId.get(identity.resourceId);
    if (!resource) {
      bindings.push({
        nodeId: node.nodeId,
        resourceId: identity.resourceId,
        resourceType: identity.resourceType,
        state: 'no-runtime-identity',
        objectKey: null,
        contentSha256: null,
        runtimeReleaseId: input.release.releaseId,
        projectionId,
        reason: input.projection ? 'projection-resource-missing' : 'projection-unavailable',
      });
      continue;
    }
    const resolved = resolveRuntimeSourceObjectKey(resource.sourcePath, input.release);
    if ('reason' in resolved) {
      const state = resolved.reason === 'content-key-not-in-release'
        || resolved.reason === 'asset-path-not-in-release'
        || resolved.reason === 'authoring-path-unmapped'
        ? 'not-in-active-release'
        : 'no-runtime-identity';
      bindings.push({
        nodeId: node.nodeId,
        resourceId: identity.resourceId,
        resourceType: identity.resourceType,
        state,
        objectKey: null,
        contentSha256: null,
        runtimeReleaseId: input.release.releaseId,
        projectionId,
        reason: resolved.reason,
      });
      continue;
    }
    bindings.push({
      nodeId: node.nodeId,
      resourceId: identity.resourceId,
      resourceType: identity.resourceType,
      state: 'bound',
      objectKey: resolved.objectKey,
      contentSha256: resolved.contentSha256,
      runtimeReleaseId: input.release.releaseId,
      projectionId,
      reason: null,
    });
  }
  return bindings;
}

function noRuntimeIdentity(
  nodeId: string,
  projectionId: string | null,
  releaseId: string,
  reason: string,
): AdaptivePathNodeRuntimeBinding {
  return {
    nodeId,
    resourceId: null,
    resourceType: null,
    state: 'no-runtime-identity',
    objectKey: null,
    contentSha256: null,
    runtimeReleaseId: releaseId,
    projectionId,
    reason,
  };
}

/** 候选池诊断摘要：按状态与资源族（sourceKind）汇总可绑定计数。 */
export function summarizeAdaptivePathRuntimeBindings(
  bindings: ReadonlyArray<AdaptivePathNodeRuntimeBinding>,
  familyByNodeId: ReadonlyMap<string, string>,
): {
  byState: Record<string, number>;
  boundByFamily: Record<string, number>;
  unboundReasons: Record<string, number>;
  activeRuntimeReleaseId: string | null;
} {
  const byState: Record<string, number> = {};
  const boundByFamily: Record<string, number> = {};
  const unboundReasons: Record<string, number> = {};
  let activeRuntimeReleaseId: string | null = null;
  for (const binding of bindings) {
    byState[binding.state] = (byState[binding.state] ?? 0) + 1;
    activeRuntimeReleaseId ??= binding.runtimeReleaseId;
    if (binding.state === 'bound') {
      const family = familyByNodeId.get(binding.nodeId) ?? 'unknown';
      boundByFamily[family] = (boundByFamily[family] ?? 0) + 1;
    } else if (binding.reason) {
      unboundReasons[binding.reason] = (unboundReasons[binding.reason] ?? 0) + 1;
    }
  }
  return { byState, boundByFamily, unboundReasons, activeRuntimeReleaseId };
}

/** 批次级绑定限制码：存在资产承载节点但零绑定时显式受限，不静默空记录。 */
export function deriveAdaptivePathRuntimeBindingLimitationCodes(
  bindings: ReadonlyArray<AdaptivePathNodeRuntimeBinding>,
): string[] {
  if (bindings.length === 0) return [];
  if (bindings.some((binding) => binding.state === 'no-active-release')) {
    return ['no-active-runtime-release'];
  }
  if (!bindings.some((binding) => binding.state === 'bound')) {
    return ['no-bindable-runtime-resources'];
  }
  return [];
}
