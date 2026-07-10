const NODE_ID_SCALAR_KEYS = new Set([
  'nodeId',
  'currentNodeId',
  'activeNodeId',
  'fromNodeId',
  'toNodeId',
  'previousNodeId',
  'nextNodeId',
  'resourceNodeId',
  'parentResourceNodeId',
  'evidenceReadinessSourceNodeId',
]);

const NODE_ID_ARRAY_KEYS = new Set([
  'nodeIds',
  'mainPathNodeIds',
  'activeNodeIds',
  'lockedNodeIds',
  'nextNodeIds',
  'remainingNodeIds',
  'completedNodeIds',
  'failedNodeIds',
  'skippedNodeIds',
  'excludedNodeIds',
  'teacherAssignedNodeIds',
  'prerequisiteNodeIds',
  'requiredCompletedNodeIds',
  'fallbackNodeIds',
  'missingCompletedNodeIds',
  'riskNodeIds',
  'candidateResourceNodeIds',
  'selectedCandidateNodeIds',
  'terminalValidationNodeIds',
  'checkpointNodeIds',
  'draftNodeIds',
  'repairedNodeIds',
  'insertedNodeIds',
  'removedNodeIds',
]);

export function remapPathNodeId(
  value: string,
  aliases: ReadonlyMap<string, string>,
): string;
export function remapPathNodeId(
  value: string | null | undefined,
  aliases: ReadonlyMap<string, string>,
): string | null;
export function remapPathNodeId(
  value: string | null | undefined,
  aliases: ReadonlyMap<string, string>,
): string | null {
  if (typeof value !== 'string') return null;
  return aliases.get(value) ?? value;
}

export function remapPathNodeIdArray(
  value: unknown,
  aliases: ReadonlyMap<string, string>,
): string[] {
  if (!Array.isArray(value)) return [];
  const remapped: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const nodeId = aliases.get(item) ?? item;
    if (seen.has(nodeId)) continue;
    seen.add(nodeId);
    remapped.push(nodeId);
  }
  return remapped;
}

export function remapPathNodeReferences<T>(
  value: T,
  aliases: ReadonlyMap<string, string>,
): T {
  if (Array.isArray(value)) {
    return value.map((item) => remapPathNodeReferences(item, aliases)) as T;
  }
  if (!isPlainRecord(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => {
    if (NODE_ID_SCALAR_KEYS.has(key)) {
      return [key, typeof child === 'string' ? aliases.get(child) ?? child : child];
    }
    if (NODE_ID_ARRAY_KEYS.has(key)) {
      return [key, remapPathNodeIdArray(child, aliases)];
    }
    return [key, remapPathNodeReferences(child, aliases)];
  })) as T;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
