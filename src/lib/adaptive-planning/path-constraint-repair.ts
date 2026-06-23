export const PATH_CONSTRAINT_REPAIR_VERSION = 'path-constraint-repair.v1';

export type PathConstraintRepairStatus = 'satisfied' | 'repaired' | 'infeasible';
export type PathConstraintTerminalValidation = 'official' | 'preview';

export interface PathConstraintRepairCandidate {
  nodeId: string;
  estimatedTimeMinutes: number;
  prerequisiteNodeIds: string[];
  checkpointRole?: 'diagnostic' | 'formative' | 'mastery' | string;
  terminalValidation?: PathConstraintTerminalValidation;
  locked?: boolean;
  fallbackNodeIds?: string[];
  removable?: boolean;
  serialOnly?: boolean;
  parallelizable?: boolean;
}

export interface PathConstraintRepairInput {
  draftNodeIds: string[];
  candidates: PathConstraintRepairCandidate[];
  constraints: {
    timeBudgetMinutes: number;
    requiredCheckpointCount: number;
    terminalValidationRequired: boolean;
    allowParallelGroups?: boolean;
  };
  versionRefs: Record<string, string | null | undefined>;
}

export interface PathConstraintSolverAdapter {
  id: string;
  repair(input: PathConstraintRepairInput): PathConstraintRepairResult;
}

export interface PathConstraintInfeasibleReason {
  code:
    | 'hard-prerequisite-missing'
    | 'checkpoint-resource-missing'
    | 'terminal-validation-resource-missing'
    | 'time-budget-insufficient'
    | 'locked-node-without-fallback';
  nodeIds: string[];
  message: string;
}

export interface PathConstraintRepairResult {
  status: PathConstraintRepairStatus;
  draftNodeIds: string[];
  repairedNodeIds: string[];
  insertedNodeIds: string[];
  removedNodeIds: string[];
  checkpointNodeIds: string[];
  terminalValidationNodeIds: string[];
  repairedConstraints: string[];
  tradeoffs: string[];
  limitations: string[];
  infeasibleReasons: PathConstraintInfeasibleReason[];
  versionRefs: Record<string, string | null>;
}

export function repairPathConstraints(input: PathConstraintRepairInput): PathConstraintRepairResult {
  const candidatesById = new Map(input.candidates.map((candidate) => [candidate.nodeId, candidate]));
  const selectedIds = unique(input.draftNodeIds.filter((nodeId) => candidatesById.has(nodeId)));
  const insertedNodeIds: string[] = [];
  const removedNodeIds: string[] = [];
  const repairedConstraints: string[] = [];
  const tradeoffs: string[] = [];
  const limitations: string[] = [];
  const infeasibleReasons: PathConstraintInfeasibleReason[] = [];

  const insertCandidate = (
    nodeId: string,
    beforeNodeId?: string,
    options: { collectReasons?: boolean } = {},
    stack = new Set<string>(),
  ): boolean => {
    if (!candidatesById.has(nodeId)) return false;
    if (selectedIds.includes(nodeId)) return true;
    if (stack.has(nodeId)) {
      if (options.collectReasons !== false) {
        infeasibleReasons.push({
          code: 'hard-prerequisite-missing',
          nodeIds: [...stack, nodeId],
          message: `Node ${nodeId} participates in a cyclic prerequisite chain.`,
        });
      }
      return false;
    }
    const candidate = candidatesById.get(nodeId)!;
    const nextStack = new Set(stack);
    nextStack.add(nodeId);
    for (const prerequisiteId of candidate.prerequisiteNodeIds) {
      if (!insertCandidate(prerequisiteId, beforeNodeId ?? nodeId, options, nextStack)) {
        if (options.collectReasons !== false) {
          infeasibleReasons.push({
            code: 'hard-prerequisite-missing',
            nodeIds: [nodeId, prerequisiteId],
            message: `Node ${nodeId} requires missing prerequisite ${prerequisiteId}.`,
          });
        }
        return false;
      }
    }
    const beforeIndex = beforeNodeId ? selectedIds.indexOf(beforeNodeId) : -1;
    if (beforeIndex >= 0) {
      selectedIds.splice(beforeIndex, 0, nodeId);
    } else {
      selectedIds.push(nodeId);
    }
    insertedNodeIds.push(nodeId);
    return true;
  };

  const tryInsertCandidate = (nodeId: string, beforeNodeId?: string): boolean => {
    const beforeSelectedIds = [...selectedIds];
    const beforeInsertedNodeIds = [...insertedNodeIds];
    const inserted = insertCandidate(nodeId, beforeNodeId, { collectReasons: false });
    if (inserted) return true;
    selectedIds.splice(0, selectedIds.length, ...beforeSelectedIds);
    insertedNodeIds.splice(0, insertedNodeIds.length, ...beforeInsertedNodeIds);
    return false;
  };

  const prerequisiteClosure = (nodeId: string, seen = new Set<string>()): string[] => {
    if (seen.has(nodeId)) return [];
    seen.add(nodeId);
    const candidate = candidatesById.get(nodeId);
    if (!candidate) return [];
    return [
      ...candidate.prerequisiteNodeIds.flatMap((prerequisiteId) => prerequisiteClosure(prerequisiteId, seen)),
      ...candidate.prerequisiteNodeIds.filter((prerequisiteId) => candidatesById.has(prerequisiteId)),
    ];
  };

  const isFallbackSupportForSelected = (candidateNodeId: string): boolean => selectedIds.some((nodeId) => {
    const candidate = candidatesById.get(nodeId);
    if (!candidate?.locked) return false;
    return (candidate.fallbackNodeIds ?? []).some((fallbackNodeId) =>
      unique([...prerequisiteClosure(fallbackNodeId), fallbackNodeId]).includes(candidateNodeId)
    );
  });

  for (const nodeId of [...selectedIds]) {
    const candidate = candidatesById.get(nodeId);
    if (!candidate) continue;
    const nodeIndex = selectedIds.indexOf(nodeId);
    for (const prerequisiteId of candidate.prerequisiteNodeIds) {
      if (selectedIds.includes(prerequisiteId)) continue;
      if (insertCandidate(prerequisiteId, nodeId)) {
        repairedConstraints.push('hard-prerequisites');
        continue;
      }
      infeasibleReasons.push({
        code: 'hard-prerequisite-missing',
        nodeIds: [nodeId, prerequisiteId],
        message: `Node ${nodeId} requires missing prerequisite ${prerequisiteId}.`,
      });
    }
    if (nodeIndex >= 0) {
      selectedIds.sort((left, right) => prerequisiteDepth(left, candidatesById) - prerequisiteDepth(right, candidatesById));
    }
  }

  const terminalBeforeInsert = selectedIds.find((nodeId) => candidatesById.get(nodeId)?.terminalValidation === 'official');
  while (checkpointIds(selectedIds, candidatesById).length < input.constraints.requiredCheckpointCount) {
    const checkpoint = input.candidates
      .filter((candidate) => candidate.checkpointRole && !selectedIds.includes(candidate.nodeId))
      .sort((left, right) => left.estimatedTimeMinutes - right.estimatedTimeMinutes || left.nodeId.localeCompare(right.nodeId))[0];
    if (!checkpoint) {
      limitations.push('checkpoint-resource-missing');
      infeasibleReasons.push({
        code: 'checkpoint-resource-missing',
        nodeIds: [],
        message: 'No bounded checkpoint candidate can satisfy checkpoint policy.',
      });
      break;
    }
    const inserted = input.candidates
      .filter((candidate) => candidate.checkpointRole && !selectedIds.includes(candidate.nodeId))
      .sort((left, right) => left.estimatedTimeMinutes - right.estimatedTimeMinutes || left.nodeId.localeCompare(right.nodeId))
      .some((candidate) => tryInsertCandidate(candidate.nodeId, terminalBeforeInsert));
    if (inserted) {
      repairedConstraints.push('checkpoint-coverage');
    } else {
      infeasibleReasons.push({
        code: 'checkpoint-resource-missing',
        nodeIds: [],
        message: 'No bounded checkpoint candidate can satisfy checkpoint policy.',
      });
      break;
    }
  }

  if (input.constraints.terminalValidationRequired && !hasOfficialTerminalValidation(selectedIds, candidatesById)) {
    const insertedTerminal = input.candidates
      .filter((candidate) => candidate.terminalValidation === 'official' && !selectedIds.includes(candidate.nodeId))
      .sort((left, right) => left.estimatedTimeMinutes - right.estimatedTimeMinutes || left.nodeId.localeCompare(right.nodeId))
      .some((candidate) => tryInsertCandidate(candidate.nodeId));
    if (insertedTerminal) {
      repairedConstraints.push('terminal-validation');
    } else {
      const previewNodeIds = selectedIds.filter((nodeId) => candidatesById.get(nodeId)?.terminalValidation === 'preview');
      infeasibleReasons.push({
        code: 'terminal-validation-resource-missing',
        nodeIds: previewNodeIds,
        message: previewNodeIds.length > 0
          ? 'Only preview terminal validation is available in the bounded candidate set.'
          : 'No official terminal validation candidate is available in the bounded candidate set.',
      });
    }
  }

  for (const nodeId of [...selectedIds]) {
    const candidate = candidatesById.get(nodeId);
    if (!candidate?.locked) continue;
    let fallbackSatisfied = false;
    let fallbackRepaired = false;
    for (const fallbackNodeId of candidate.fallbackNodeIds ?? []) {
      if (!candidatesById.has(fallbackNodeId)) continue;
      const fallbackIndex = selectedIds.indexOf(fallbackNodeId);
      const nodeIndex = selectedIds.indexOf(nodeId);
      const fallbackChain = unique([...prerequisiteClosure(fallbackNodeId), fallbackNodeId]);
      const fallbackChainReady = nodeIndex < 0 || fallbackChain.every((id) => {
        const selectedIndex = selectedIds.indexOf(id);
        return selectedIndex >= 0 && selectedIndex < nodeIndex;
      });
      if (fallbackIndex >= 0 && fallbackChainReady) {
        fallbackSatisfied = true;
        break;
      }
      if (fallbackIndex >= 0 && nodeIndex >= 0) {
        const idsToMove = fallbackChain;
        for (const id of idsToMove) {
          const selectedIndex = selectedIds.indexOf(id);
          if (selectedIndex >= 0) {
            selectedIds.splice(selectedIndex, 1);
          } else {
            insertedNodeIds.push(id);
          }
        }
        const anchorIndex = selectedIds.indexOf(nodeId);
        selectedIds.splice(anchorIndex, 0, ...idsToMove);
        fallbackSatisfied = true;
        fallbackRepaired = true;
        break;
      }
      const insertedCount = insertedNodeIds.length;
      if (tryInsertCandidate(fallbackNodeId, nodeId)) {
        fallbackSatisfied = true;
        fallbackRepaired = insertedNodeIds.length > insertedCount;
        break;
      }
    }
    if (fallbackSatisfied) {
      if (fallbackRepaired) {
        repairedConstraints.push('locked-node-fallback');
      }
      continue;
    }
    if ((candidate.fallbackNodeIds ?? []).length === 0) {
      infeasibleReasons.push({
        code: 'locked-node-without-fallback',
        nodeIds: [nodeId],
        message: `Locked node ${nodeId} has no bounded fallback node.`,
      });
    } else {
      infeasibleReasons.push({
        code: 'locked-node-without-fallback',
        nodeIds: [nodeId, ...(candidate.fallbackNodeIds ?? [])],
        message: `Locked node ${nodeId} has no available bounded fallback node.`,
      });
    }
  }

  while (estimatedMinutes(selectedIds, candidatesById) > input.constraints.timeBudgetMinutes) {
    const removable = selectedIds
      .map((nodeId) => candidatesById.get(nodeId))
      .filter((candidate): candidate is PathConstraintRepairCandidate => Boolean(candidate))
      .filter((candidate) =>
        candidate.removable &&
        !candidate.checkpointRole &&
        candidate.terminalValidation !== 'official' &&
        !isPrerequisiteForSelected(candidate.nodeId, selectedIds, candidatesById) &&
        !isFallbackSupportForSelected(candidate.nodeId)
      )
      .sort((left, right) => right.estimatedTimeMinutes - left.estimatedTimeMinutes || left.nodeId.localeCompare(right.nodeId))[0];
    if (!removable) {
      infeasibleReasons.push({
        code: 'time-budget-insufficient',
        nodeIds: [...selectedIds],
        message: `No removable bounded node can bring the path under ${input.constraints.timeBudgetMinutes} minutes.`,
      });
      break;
    }
    selectedIds.splice(selectedIds.indexOf(removable.nodeId), 1);
    removedNodeIds.push(removable.nodeId);
    repairedConstraints.push('time-budget');
    limitations.push(`removed-optional-node:${removable.nodeId}`);
  }

  const checkpointNodeIds = checkpointIds(selectedIds, candidatesById);
  const terminalValidationNodeIds = selectedIds.filter((nodeId) =>
    candidatesById.get(nodeId)?.terminalValidation === 'official'
  );
  if (insertedNodeIds.length > 0) {
    tradeoffs.push(`inserted-bounded-nodes:${insertedNodeIds.join(',')}`);
  }
  if (removedNodeIds.length > 0) {
    tradeoffs.push(`removed-bounded-nodes:${removedNodeIds.join(',')}`);
  }
  if (
    input.constraints.allowParallelGroups &&
    selectedIds.some((nodeId) => candidatesById.get(nodeId)?.parallelizable)
  ) {
    limitations.push('parallel-grouping-not-supported');
  }

  return {
    status: infeasibleReasons.length > 0
      ? 'infeasible'
      : insertedNodeIds.length > 0 || removedNodeIds.length > 0 || repairedConstraints.length > 0
        ? 'repaired'
        : 'satisfied',
    draftNodeIds: input.draftNodeIds,
    repairedNodeIds: selectedIds,
    insertedNodeIds: unique(insertedNodeIds),
    removedNodeIds: unique(removedNodeIds),
    checkpointNodeIds,
    terminalValidationNodeIds,
    repairedConstraints: unique(repairedConstraints),
    tradeoffs,
    limitations,
    infeasibleReasons: dedupeReasons(infeasibleReasons),
    versionRefs: Object.fromEntries(
      Object.entries(input.versionRefs).map(([key, value]) => [key, value ?? null])
    ),
  };
}

export const deterministicPathConstraintRepairAdapter: PathConstraintSolverAdapter = {
  id: 'deterministic-bounded-repair',
  repair: repairPathConstraints,
};

function checkpointIds(
  nodeIds: string[],
  candidatesById: Map<string, PathConstraintRepairCandidate>,
): string[] {
  return nodeIds.filter((nodeId) => Boolean(candidatesById.get(nodeId)?.checkpointRole));
}

function hasOfficialTerminalValidation(
  nodeIds: string[],
  candidatesById: Map<string, PathConstraintRepairCandidate>,
): boolean {
  return nodeIds.some((nodeId) => candidatesById.get(nodeId)?.terminalValidation === 'official');
}

function estimatedMinutes(
  nodeIds: string[],
  candidatesById: Map<string, PathConstraintRepairCandidate>,
): number {
  return nodeIds.reduce((sum, nodeId) => sum + (candidatesById.get(nodeId)?.estimatedTimeMinutes ?? 0), 0);
}

function isPrerequisiteForSelected(
  candidateNodeId: string,
  selectedIds: string[],
  candidatesById: Map<string, PathConstraintRepairCandidate>,
): boolean {
  return selectedIds.some((nodeId) =>
    candidatesById.get(nodeId)?.prerequisiteNodeIds.includes(candidateNodeId)
  );
}

function prerequisiteDepth(
  nodeId: string,
  candidatesById: Map<string, PathConstraintRepairCandidate>,
  seen = new Set<string>(),
): number {
  if (seen.has(nodeId)) return 0;
  seen.add(nodeId);
  const prerequisites = candidatesById.get(nodeId)?.prerequisiteNodeIds ?? [];
  if (prerequisites.length === 0) return 0;
  return 1 + Math.max(...prerequisites.map((id) => prerequisiteDepth(id, candidatesById, seen)), 0);
}

function dedupeReasons(reasons: PathConstraintInfeasibleReason[]): PathConstraintInfeasibleReason[] {
  const seen = new Set<string>();
  return reasons.filter((reason) => {
    const key = `${reason.code}:${reason.nodeIds.join(',')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function unique<T extends string>(values: T[]): T[] {
  return Array.from(new Set(values));
}
