import type { AdaptivePathCorrectionProposal } from '@/features/adaptive/adaptive-path-journey-contracts';

export interface AdaptivePathCorrectionApplicationInput {
  nodeIds: unknown;
  currentNodeId: unknown;
  pathPayload: unknown;
  lastExecutionMetadata: unknown;
  deviations?: unknown;
}

export interface AdaptivePathCorrectionApplication {
  nodeIds: string[];
  currentNodeId: string;
  pathPayload: Record<string, unknown>;
  lastExecutionMetadata: Record<string, unknown>;
}

export function buildAdaptivePathCorrectionApplication(
  input: AdaptivePathCorrectionApplicationInput,
  proposal: AdaptivePathCorrectionProposal,
): AdaptivePathCorrectionApplication | null {
  const pathPayload = readRecord(input.pathPayload);
  const nodeIds = readStringArray(pathPayload.mainPathNodeIds).length > 0
    ? readStringArray(pathPayload.mainPathNodeIds)
    : readStringArray(input.nodeIds);
  const currentNodeId = readString(input.currentNodeId);
  if (!currentNodeId || nodeIds.length === 0) return null;
  if (!nodeIds.includes(currentNodeId)) return null;

  const lastExecutionMetadata = readRecord(input.lastExecutionMetadata);
  const completedNodeIds = new Set(readStringArray(lastExecutionMetadata.completedNodeIds));
  const skippedNodeIds = new Set(readStringArray(lastExecutionMetadata.skippedNodeIds));
  const governedDeviationNodeIds = new Set(
    readRecordArray(input.deviations)
      .filter((deviation) => ['skip', 'replacement', 'abandonment'].includes(readString(deviation.deviationType) ?? ''))
      .flatMap((deviation) => readStringArray([deviation.priorNodeId])),
  );
  const currentIndex = nodeIds.indexOf(currentNodeId);
  // Completed nodes and the current node are immutable history; only unfinished
  // predecessors explicitly handled by a governed deviation may be removed.
  const preservedNodeIds = nodeIds.filter((nodeId, index) => (
    index < currentIndex
      ? completedNodeIds.has(nodeId) || (!skippedNodeIds.has(nodeId) && !governedDeviationNodeIds.has(nodeId))
      : completedNodeIds.has(nodeId) || nodeId === currentNodeId
  ));
  const preserved = new Set(preservedNodeIds);
  const proposedFutureNodeIds = proposal.proposedRemaining
    .map((node) => node.nodeId)
    .filter((nodeId) => !preserved.has(nodeId));
  const nextNodeIds = unique([...preservedNodeIds, ...proposedFutureNodeIds]);
  if (!hasMaterialChange(nodeIds, nextNodeIds)) return null;

  const planNodes = readRecordArray(pathPayload.planNodes);
  const nodeById = new Map(planNodes
    .map((node) => [readString(node.nodeId), node] as const)
    .filter((entry): entry is [string, Record<string, unknown>] => Boolean(entry[0])));
  const nextPlanNodes = nextNodeIds.map((nodeId) => nodeById.get(nodeId)).filter(Boolean);
  if (nextPlanNodes.length !== nextNodeIds.length) return null;

  return {
    nodeIds: nextNodeIds,
    currentNodeId,
    pathPayload: {
      ...pathPayload,
      mainPathNodeIds: nextNodeIds,
      planNodes: nextPlanNodes,
    },
    lastExecutionMetadata,
  };
}

function hasMaterialChange(left: string[], right: string[]): boolean {
  return left.length !== right.length || left.some((nodeId, index) => nodeId !== right[index]);
}

function unique(value: string[]): string[] {
  return [...new Set(value)];
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(readRecord) : [];
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : [];
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
