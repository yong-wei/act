import { resolveArenaPathTargetIntegrity } from '@/lib/arena-path-target-integrity';
import { remapPersistedLearningPathReferences } from '@/lib/path-node-id-alias-remap';

export interface CanonicalizedVerifiedLegacyArenaPath<T> {
  path: T;
  nodeIdReplacements: ReadonlyMap<string, string>;
}

/**
 * Canonicalizes only legacy Arena identities accepted by the governed target-integrity whitelist.
 * Unknown or partially matching legacy records are deliberately left unchanged.
 */
export function canonicalizeVerifiedLegacyArenaPath<T>(
  path: T,
): CanonicalizedVerifiedLegacyArenaPath<T> {
  const pathRecord = toRecord(path);
  const payload = toRecord(pathRecord.pathPayload);
  const fixtureScope = payload.fixtureScope;
  const rawPlanNodes = Array.isArray(payload.planNodes) ? payload.planNodes.map(toRecord) : [];
  const nodeIdReplacements = new Map<string, string>();
  const canonicalTargets = new Map<string, NonNullable<ReturnType<typeof resolveArenaPathTargetIntegrity>['target']>>();
  for (const node of rawPlanNodes) {
    if (node.type !== 'arena_task' || typeof node.nodeId !== 'string') continue;
    const integrity = resolveArenaPathTargetIntegrity({ ...node, fixtureScope });
    if (integrity.status !== 'repaired') continue;
    nodeIdReplacements.set(node.nodeId, integrity.target.nodeId);
    canonicalTargets.set(node.nodeId, integrity.target);
  }
  if (nodeIdReplacements.size === 0) return { path, nodeIdReplacements };

  const canonicalPlanNodes = rawPlanNodes.map((node) => {
    const legacyNodeId = typeof node.nodeId === 'string' ? node.nodeId : '';
    return {
      ...node,
      ...(canonicalTargets.get(legacyNodeId) ?? {}),
    };
  });
  const terminalValidation = toRecord(pathRecord.terminalValidation);
  const terminalLegacyNodeId = typeof terminalValidation.nodeId === 'string'
    ? terminalValidation.nodeId
    : '';
  const terminalTarget = canonicalTargets.get(terminalLegacyNodeId);
  const canonicalizedPath = remapPersistedLearningPathReferences({
    ...pathRecord,
    pathPayload: {
      ...payload,
      planNodes: canonicalPlanNodes,
    },
  }, nodeIdReplacements);

  return {
    nodeIdReplacements,
    path: {
      ...toRecord(canonicalizedPath),
      terminalValidation: {
        ...toRecord(toRecord(canonicalizedPath).terminalValidation),
        ...(terminalTarget ? {
          nodeId: terminalTarget.nodeId,
          sourceKind: terminalTarget.sourceKind,
          sourceRef: terminalTarget.sourceRef,
          taskId: terminalTarget.sourceRef,
          target: terminalTarget.target,
        } : {}),
      },
    } as T,
  };
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
