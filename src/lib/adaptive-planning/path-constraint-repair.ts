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
  coverageTargetIds?: string[];
}

export interface PathConstraintRepairInput {
  draftNodeIds: string[];
  candidates: PathConstraintRepairCandidate[];
  constraints: {
    timeBudgetMinutes: number;
    requiredCheckpointCount: number;
    terminalValidationRequired: boolean;
    requiredCoverageTargetIds?: string[];
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

  const isUsableFallbackCandidate = (fallbackNodeId: string): boolean => {
    return candidatesById.has(fallbackNodeId);
  };

  const fallbackChainForNodeId = (fallbackNodeId: string): string[] =>
    unique([...prerequisiteClosure(fallbackNodeId), fallbackNodeId]);

  const sortedFallbackNodeIds = (candidate: PathConstraintRepairCandidate): string[] =>
    [...candidate.fallbackNodeIds ?? []]
      .filter((fallbackNodeId) => isUsableFallbackCandidate(fallbackNodeId))
      .sort((left, right) =>
        estimatedMinutes(fallbackChainForNodeId(left), candidatesById) - estimatedMinutes(fallbackChainForNodeId(right), candidatesById) ||
        left.localeCompare(right)
      );

  const fallbackChainHasReadyLockedSupport = (
    fallbackChain: string[],
    selectedNodeIds: string[],
  ): boolean => fallbackChain.every((id) => {
    const candidate = candidatesById.get(id);
    if (!candidate?.locked) return true;
    return readyFallbackChainsForLockedNode(id, selectedNodeIds).length > 0;
  });

  const readyFallbackChainsForLockedNode = (
    nodeId: string,
    selectedNodeIds: string[],
  ): string[][] => {
    const nodeIndex = selectedNodeIds.indexOf(nodeId);
    if (nodeIndex < 0) return [];
    const candidate = candidatesById.get(nodeId);
    if (!candidate?.locked) return [];
    return sortedFallbackNodeIds(candidate)
      .map((fallbackNodeId) => fallbackChainForNodeId(fallbackNodeId))
      .filter((fallbackChain) => fallbackChain.every((id) => {
        const selectedIndex = selectedNodeIds.indexOf(id);
        return selectedIndex >= 0 && selectedIndex < nodeIndex;
      }) && fallbackChainHasReadyLockedSupport(fallbackChain, selectedNodeIds))
      .sort((left, right) =>
        estimatedMinutes(left, candidatesById) - estimatedMinutes(right, candidatesById) ||
        (left.at(-1) ?? '').localeCompare(right.at(-1) ?? '')
      );
  };

  const fallbackSupportNodeIdsForSelected = (selectedNodeIds = selectedIds): Set<string> => {
    const supportNodeIds = new Set<string>();
    for (const nodeId of selectedNodeIds) {
      const [supportChain] = readyFallbackChainsForLockedNode(nodeId, selectedNodeIds);
      for (const supportNodeId of supportChain ?? []) {
        supportNodeIds.add(supportNodeId);
      }
    }
    return supportNodeIds;
  };

  const isFallbackSupportForSelected = (
    candidateNodeId: string,
    selectedNodeIds = selectedIds,
  ): boolean => fallbackSupportNodeIdsForSelected(selectedNodeIds).has(candidateNodeId);

  const canReduceSelectionToBudget = (initialSelectedIds: string[]): boolean => {
    const candidateIds = [...initialSelectedIds];
    const requiredCoverageTargets = new Set(input.constraints.requiredCoverageTargetIds ?? []);
    while (estimatedMinutes(candidateIds, candidatesById) > input.constraints.timeBudgetMinutes) {
      const selectedCheckpointIds = checkpointIds(candidateIds, candidatesById);
      const selectedCoverageCounts = coverageCounts(candidateIds, candidatesById);
      const removable = candidateIds
        .map((nodeId) => candidatesById.get(nodeId))
        .filter((candidate): candidate is PathConstraintRepairCandidate => Boolean(candidate))
        .filter((candidate) =>
          candidate.removable &&
          (!candidate.checkpointRole || selectedCheckpointIds.length > input.constraints.requiredCheckpointCount) &&
          candidate.terminalValidation !== 'official' &&
          preservesRequiredCoverage(candidate, selectedCoverageCounts, requiredCoverageTargets) &&
          !isPrerequisiteForSelected(candidate.nodeId, candidateIds, candidatesById) &&
          !isFallbackSupportForSelected(candidate.nodeId, candidateIds)
        )
        .sort((left, right) => right.estimatedTimeMinutes - left.estimatedTimeMinutes || left.nodeId.localeCompare(right.nodeId))[0];
      if (!removable) return false;
      candidateIds.splice(candidateIds.indexOf(removable.nodeId), 1);
    }
    return true;
  };

  const insertIntoSelection = (
    targetSelectedIds: string[],
    nodeId: string,
    beforeNodeId?: string,
    stack = new Set<string>(),
  ): boolean => {
    if (!candidatesById.has(nodeId)) return false;
    if (targetSelectedIds.includes(nodeId)) return true;
    if (stack.has(nodeId)) return false;
    const candidate = candidatesById.get(nodeId)!;
    const nextStack = new Set(stack);
    nextStack.add(nodeId);
    for (const prerequisiteId of candidate.prerequisiteNodeIds) {
      if (!insertIntoSelection(targetSelectedIds, prerequisiteId, beforeNodeId ?? nodeId, nextStack)) {
        return false;
      }
    }
    const beforeIndex = beforeNodeId ? targetSelectedIds.indexOf(beforeNodeId) : -1;
    if (beforeIndex >= 0) {
      targetSelectedIds.splice(beforeIndex, 0, nodeId);
    } else {
      targetSelectedIds.push(nodeId);
    }
    return true;
  };

  const canSatisfyLockedFallbacks = (
    initialSelectedIds: string[],
    startIndex = 0,
    seenStates = new Set<string>(),
  ): boolean => {
    const stateKey = `${startIndex}:${initialSelectedIds.join('\u0000')}`;
    if (seenStates.has(stateKey)) return false;
    seenStates.add(stateKey);
    const lockedIndex = initialSelectedIds.findIndex((nodeId, index) =>
      index >= startIndex && Boolean(candidatesById.get(nodeId)?.locked)
    );
    if (lockedIndex < 0) return canReduceSelectionToBudget(initialSelectedIds);

    const nodeId = initialSelectedIds[lockedIndex];
    const candidate = candidatesById.get(nodeId)!;
    const fallbackChains = sortedFallbackNodeIds(candidate)
      .map((fallbackNodeId) => fallbackChainForNodeId(fallbackNodeId));
    for (const fallbackChain of fallbackChains) {
      const nodeIndex = initialSelectedIds.indexOf(nodeId);
      const fallbackChainReady = nodeIndex < 0 || fallbackChain.every((id) => {
        const selectedIndex = initialSelectedIds.indexOf(id);
        return selectedIndex >= 0 && selectedIndex < nodeIndex;
      });
      if (fallbackChainReady && canSatisfyLockedFallbacks(initialSelectedIds, lockedIndex + 1, seenStates)) {
        return true;
      }

      const nextSelectedIds = [...initialSelectedIds];
      const nextNodeIndex = nextSelectedIds.indexOf(nodeId);
      for (const id of fallbackChain) {
        const selectedIndex = nextSelectedIds.indexOf(id);
        if (selectedIndex >= 0) {
          nextSelectedIds.splice(selectedIndex, 1);
        }
      }
      const anchorIndex = nextNodeIndex >= 0 ? nextSelectedIds.indexOf(nodeId) : -1;
      if (anchorIndex >= 0) {
        nextSelectedIds.splice(anchorIndex, 0, ...fallbackChain);
      } else if (!insertIntoSelection(nextSelectedIds, fallbackChain.at(-1) ?? '', nodeId)) {
        continue;
      }
      if (canSatisfyLockedFallbacks(nextSelectedIds, 0, seenStates)) {
        return true;
      }
    }
    return false;
  };

  const canCompleteMandatoryRepairsWithinBudget = (
    initialSelectedIds: string[],
    seenStates = new Set<string>(),
  ): boolean => {
    const stateKey = initialSelectedIds.join('\u0000');
    if (seenStates.has(stateKey)) return false;
    seenStates.add(stateKey);

    if (checkpointIds(initialSelectedIds, candidatesById).length < input.constraints.requiredCheckpointCount) {
      const terminalBeforeInsert = initialSelectedIds.find((nodeId) =>
        candidatesById.get(nodeId)?.terminalValidation === 'official'
      );
      return input.candidates
        .filter((candidate) => candidate.checkpointRole && !initialSelectedIds.includes(candidate.nodeId))
        .sort((left, right) => left.estimatedTimeMinutes - right.estimatedTimeMinutes || left.nodeId.localeCompare(right.nodeId))
        .some((candidate) => {
          const candidateIds = [...initialSelectedIds];
          return insertIntoSelection(candidateIds, candidate.nodeId, terminalBeforeInsert) &&
            canCompleteMandatoryRepairsWithinBudget(candidateIds, seenStates);
        });
    }

    const terminalOptions = input.constraints.terminalValidationRequired &&
      !hasOfficialTerminalValidation(initialSelectedIds, candidatesById)
      ? input.candidates
          .filter((candidate) => candidate.terminalValidation === 'official' && !initialSelectedIds.includes(candidate.nodeId))
          .sort((left, right) => left.estimatedTimeMinutes - right.estimatedTimeMinutes || left.nodeId.localeCompare(right.nodeId))
      : [null];
    for (const terminalOption of terminalOptions) {
      const candidateIds = [...initialSelectedIds];
      if (terminalOption && !insertIntoSelection(candidateIds, terminalOption.nodeId)) {
        continue;
      }
      if (canSatisfyLockedFallbacks(candidateIds)) {
        return true;
      }
    }
    return false;
  };

  const canUseFallbackChainForLockedNode = (
    fallbackChain: string[],
    nodeId: string,
    options: { requireBudgetFeasible?: boolean } = {},
  ): boolean => fallbackChainHasReadyLockedSupport(fallbackChain, selectedIds) &&
    (options.requireBudgetFeasible === false ||
      canSatisfyLockedFallbacks(selectedIds, nextLockedStartIndex(selectedIds, nodeId)));

  const tryInsertCandidateWithinBudget = (nodeId: string, beforeNodeId?: string): boolean => {
    const beforeSelectedIds = [...selectedIds];
    const beforeInsertedNodeIds = [...insertedNodeIds];
    const inserted = insertCandidate(nodeId, beforeNodeId, { collectReasons: false });
    if (inserted && canCompleteMandatoryRepairsWithinBudget(selectedIds)) return true;
    selectedIds.splice(0, selectedIds.length, ...beforeSelectedIds);
    insertedNodeIds.splice(0, insertedNodeIds.length, ...beforeInsertedNodeIds);
    return false;
  };

  const withFeasibleMutation = (
    mutate: () => boolean,
    isFeasible: () => boolean = () => canReduceSelectionToBudget(selectedIds),
  ): boolean => {
    const beforeSelectedIds = [...selectedIds];
    const beforeInsertedNodeIds = [...insertedNodeIds];
    const mutated = mutate();
    if (mutated && isFeasible()) return true;
    selectedIds.splice(0, selectedIds.length, ...beforeSelectedIds);
    insertedNodeIds.splice(0, insertedNodeIds.length, ...beforeInsertedNodeIds);
    return false;
  };

  for (const nodeId of [...selectedIds]) {
    const candidate = candidatesById.get(nodeId);
    if (!candidate) continue;
    const nodeIndex = selectedIds.indexOf(nodeId);
    const beforeSelectedIds = [...selectedIds];
    const beforeInsertedNodeIds = [...insertedNodeIds];
    let insertedPrerequisite = false;
    let prerequisitesSatisfied = true;
    for (const prerequisiteId of candidate.prerequisiteNodeIds) {
      if (selectedIds.includes(prerequisiteId)) continue;
      if (tryInsertCandidate(prerequisiteId, nodeId)) {
        insertedPrerequisite = true;
      } else {
        prerequisitesSatisfied = false;
        break;
      }
    }
    if (insertedPrerequisite && prerequisitesSatisfied) {
      repairedConstraints.push('hard-prerequisites');
    } else if (!prerequisitesSatisfied) {
      selectedIds.splice(0, selectedIds.length, ...beforeSelectedIds);
      insertedNodeIds.splice(0, insertedNodeIds.length, ...beforeInsertedNodeIds);
    }
    if (nodeIndex >= 0) {
      selectedIds.sort((left, right) => comparePathNodeOrder(left, right, candidatesById));
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
      .some((candidate) => tryInsertCandidateWithinBudget(candidate.nodeId, terminalBeforeInsert));
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
    const terminalCandidates = input.candidates
      .filter((candidate) => candidate.terminalValidation === 'official' && !selectedIds.includes(candidate.nodeId))
      .sort((left, right) => left.estimatedTimeMinutes - right.estimatedTimeMinutes || left.nodeId.localeCompare(right.nodeId));
    const insertedTerminal = terminalCandidates
      .some((candidate) =>
        withFeasibleMutation(
          () => insertCandidate(candidate.nodeId, undefined, { collectReasons: false }),
          () => canSatisfyLockedFallbacks(selectedIds),
        )
      ) || terminalCandidates.some((candidate) => tryInsertCandidate(candidate.nodeId));
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

  let fallbackScanIndex = 0;
  const auditedLockedNodeIds = new Set<string>();
  const unsatisfiedLockedNodeIds = new Set<string>();
  while (fallbackScanIndex < selectedIds.length) {
    const nodeId = selectedIds[fallbackScanIndex];
    const candidate = candidatesById.get(nodeId);
    if (!candidate?.locked || auditedLockedNodeIds.has(nodeId)) {
      fallbackScanIndex += 1;
      continue;
    }
    let fallbackSatisfied = false;
    let fallbackRepaired = false;
    const attemptFallback = (requireBudgetFeasible: boolean): boolean => {
      const fallbackNodeIds = sortedFallbackNodeIds(candidate);
      const readyFallbackNodeIds = fallbackNodeIds.filter((fallbackNodeId) => {
        const nodeIndex = selectedIds.indexOf(nodeId);
        return nodeIndex < 0 || fallbackChainForNodeId(fallbackNodeId).every((id) => {
          const selectedIndex = selectedIds.indexOf(id);
          return selectedIndex >= 0 && selectedIndex < nodeIndex;
        });
      });
      for (const fallbackNodeId of unique([...readyFallbackNodeIds, ...fallbackNodeIds])) {
        const fallbackIndex = selectedIds.indexOf(fallbackNodeId);
        const nodeIndex = selectedIds.indexOf(nodeId);
        const fallbackChain = fallbackChainForNodeId(fallbackNodeId);
        const fallbackChainReady = nodeIndex < 0 || fallbackChain.every((id) => {
          const selectedIndex = selectedIds.indexOf(id);
          return selectedIndex >= 0 && selectedIndex < nodeIndex;
        });
        if (fallbackIndex >= 0 && fallbackChainReady) {
          if (!canUseFallbackChainForLockedNode(fallbackChain, nodeId, { requireBudgetFeasible })) continue;
          fallbackSatisfied = true;
          return true;
        }
        if (fallbackIndex >= 0 && nodeIndex >= 0) {
          const moveFallback = () => {
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
            return true;
          };
          const moved = withFeasibleMutation(
            moveFallback,
            () => canUseFallbackChainForLockedNode(fallbackChain, nodeId, { requireBudgetFeasible }),
          );
          if (!moved) continue;
          fallbackSatisfied = true;
          fallbackRepaired = true;
          return true;
        }
        const insertedCount = insertedNodeIds.length;
        const inserted = withFeasibleMutation(
          () => insertCandidate(fallbackNodeId, nodeId, { collectReasons: false }),
          () => canUseFallbackChainForLockedNode(fallbackChain, nodeId, { requireBudgetFeasible }),
        );
        if (inserted) {
          fallbackSatisfied = true;
          fallbackRepaired = insertedNodeIds.length > insertedCount;
          return true;
        }
      }
      return false;
    };
    attemptFallback(true) || attemptFallback(false);
    if (fallbackSatisfied) {
      if (fallbackRepaired) {
        repairedConstraints.push('locked-node-fallback');
        auditedLockedNodeIds.clear();
        unsatisfiedLockedNodeIds.clear();
        fallbackScanIndex = 0;
        continue;
      }
      auditedLockedNodeIds.add(nodeId);
      unsatisfiedLockedNodeIds.delete(nodeId);
      fallbackScanIndex += 1;
      continue;
    }
    auditedLockedNodeIds.add(nodeId);
    unsatisfiedLockedNodeIds.add(nodeId);
    fallbackScanIndex += 1;
  }

  for (const nodeId of unsatisfiedLockedNodeIds) {
    const candidate = candidatesById.get(nodeId);
    if (!candidate?.locked) continue;
    const selectedCheckpointIds = checkpointIds(selectedIds, candidatesById);
    const selectedCoverageCounts = coverageCounts(selectedIds, candidatesById);
    const requiredCoverageTargets = new Set(input.constraints.requiredCoverageTargetIds ?? []);
    if (
      candidate.removable &&
      (!candidate.checkpointRole || selectedCheckpointIds.length > input.constraints.requiredCheckpointCount) &&
      candidate.terminalValidation !== 'official' &&
      preservesRequiredCoverage(candidate, selectedCoverageCounts, requiredCoverageTargets) &&
      !isPrerequisiteForSelected(candidate.nodeId, selectedIds, candidatesById) &&
      !isFallbackSupportForSelected(candidate.nodeId)
    ) {
      selectedIds.splice(selectedIds.indexOf(candidate.nodeId), 1);
      removedNodeIds.push(candidate.nodeId);
      repairedConstraints.push('locked-node-fallback');
      limitations.push(`removed-optional-node:${candidate.nodeId}`);
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
    const selectedCheckpointIds = checkpointIds(selectedIds, candidatesById);
    const selectedCoverageCounts = coverageCounts(selectedIds, candidatesById);
    const requiredCoverageTargets = new Set(input.constraints.requiredCoverageTargetIds ?? []);
    const removable = selectedIds
      .map((nodeId) => candidatesById.get(nodeId))
      .filter((candidate): candidate is PathConstraintRepairCandidate => Boolean(candidate))
      .filter((candidate) =>
        candidate.removable &&
        (!candidate.checkpointRole || selectedCheckpointIds.length > input.constraints.requiredCheckpointCount) &&
        candidate.terminalValidation !== 'official' &&
        preservesRequiredCoverage(candidate, selectedCoverageCounts, requiredCoverageTargets) &&
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
    const insertedIndex = insertedNodeIds.indexOf(removable.nodeId);
    if (insertedIndex >= 0) {
      insertedNodeIds.splice(insertedIndex, 1);
    }
    removedNodeIds.push(removable.nodeId);
    repairedConstraints.push('time-budget');
    limitations.push(`removed-optional-node:${removable.nodeId}`);
  }

  for (const violation of prerequisiteOrderViolations(selectedIds, candidatesById)) {
    infeasibleReasons.push({
      code: 'hard-prerequisite-missing',
      nodeIds: [violation.nodeId, violation.prerequisiteId],
      message: `Node ${violation.nodeId} requires prerequisite ${violation.prerequisiteId} before it in the repaired path.`,
    });
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

function coverageCounts(
  nodeIds: string[],
  candidatesById: Map<string, PathConstraintRepairCandidate>,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const nodeId of nodeIds) {
    const candidate = candidatesById.get(nodeId);
    for (const targetId of candidate?.coverageTargetIds ?? []) {
      counts.set(targetId, (counts.get(targetId) ?? 0) + 1);
    }
  }
  return counts;
}

function preservesRequiredCoverage(
  candidate: PathConstraintRepairCandidate,
  selectedCoverageCounts: Map<string, number>,
  requiredCoverageTargets: Set<string>,
): boolean {
  if (requiredCoverageTargets.size === 0) return true;
  return (candidate.coverageTargetIds ?? []).every((targetId) =>
    !requiredCoverageTargets.has(targetId) || (selectedCoverageCounts.get(targetId) ?? 0) > 1
  );
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

function nextLockedStartIndex(selectedIds: string[], nodeId: string): number {
  const index = selectedIds.indexOf(nodeId);
  return index >= 0 ? index + 1 : 0;
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

function comparePathNodeOrder(
  left: string,
  right: string,
  candidatesById: Map<string, PathConstraintRepairCandidate>,
): number {
  const leftTerminalRank = candidatesById.get(left)?.terminalValidation === 'official' ? 1 : 0;
  const rightTerminalRank = candidatesById.get(right)?.terminalValidation === 'official' ? 1 : 0;
  return leftTerminalRank - rightTerminalRank ||
    prerequisiteDepth(left, candidatesById) - prerequisiteDepth(right, candidatesById);
}

function prerequisiteOrderViolations(
  nodeIds: string[],
  candidatesById: Map<string, PathConstraintRepairCandidate>,
): Array<{ nodeId: string; prerequisiteId: string }> {
  const selectedIndexById = new Map(nodeIds.map((nodeId, index) => [nodeId, index]));
  const violations: Array<{ nodeId: string; prerequisiteId: string }> = [];
  for (const nodeId of nodeIds) {
    const nodeIndex = selectedIndexById.get(nodeId);
    if (nodeIndex === undefined) continue;
    for (const prerequisiteId of candidatesById.get(nodeId)?.prerequisiteNodeIds ?? []) {
      const prerequisiteIndex = selectedIndexById.get(prerequisiteId);
      if (prerequisiteIndex === undefined || prerequisiteIndex > nodeIndex) {
        violations.push({ nodeId, prerequisiteId });
      }
    }
  }
  return violations;
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
