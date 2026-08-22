import { buildAdaptivePathLaunchHref } from './adaptive-learning-center-contracts';
import {
  canonicalizeAdaptivePathInternalHref as canonicalizeDestinationHref,
  resolveAdaptivePathCenterOwnedTargetHref as resolveDestinationCenterTarget,
  resolveAdaptivePathDestinationContract,
} from '@/lib/adaptive-path-destination-contract';
import {
  projectAdaptivePathCorrectionOutcome,
  type AdaptivePathCorrectionOutcome,
} from './adaptive-path-correction-outcomes';

export type AdaptivePathJourneyNextActionState = 'ready' | 'blocked' | 'pending-result' | 'path-complete';

export interface AdaptivePathJourneyNodeView {
  nodeId: string;
  title: string;
  type: string;
  sourceKind?: string | null;
  sourceRef?: string | null;
}

export interface AdaptivePathJourneyNextAction {
  state: AdaptivePathJourneyNextActionState;
  nodeId: string | null;
  title: string;
  type: string | null;
  href: string | null;
  reason: string | null;
  recovery: { label: string; href: string } | null;
}

export interface AdaptivePathCorrectionNode extends AdaptivePathJourneyNodeView {
  estimatedTimeMinutes: number | null;
}

export interface AdaptivePathCorrectionProposal {
  trigger: {
    kind: 'failed-checkpoint' | 'deviation';
    nodeId: string;
    title: string;
    reason: string;
  };
  originalRemaining: AdaptivePathCorrectionNode[];
  proposedRemaining: AdaptivePathCorrectionNode[];
  changes: Array<
    | {
        kind: 'reordered';
        nodeId: string;
        title: string;
        movedAfterNodeId: string;
      }
    | {
        kind: 'removed';
        nodeId: string;
        title: string;
        reason: string;
      }
    | {
        kind: 'replaced';
        nodeId: string;
        title: string;
        replacementNodeId: string;
        replacementTitle: string;
      }
  >;
  supportingFacts: string[];
  estimatedRemainingWork: {
    originalMinutes: number | null;
    proposedMinutes: number | null;
    differenceMinutes: number | null;
  };
}

export interface AdaptivePathJourneyCorrection {
  proposal: AdaptivePathCorrectionProposal | null;
  unavailableReason: string | null;
  candidateFingerprint: string | null;
  pathUpdatedAt: string | null;
  decision: AdaptivePathCorrectionDecisionState | null;
  history: AdaptivePathCorrectionDecisionHistoryItem[];
}

interface AdaptivePathJourneyCorrectionProjection {
  proposal: AdaptivePathCorrectionProposal | null;
  unavailableReason: string | null;
}

export type AdaptivePathCorrectionDecisionType = 'confirmed' | 'rejected' | 'deferred';

export interface AdaptivePathCorrectionDecisionState {
  decision: AdaptivePathCorrectionDecisionType;
  createdAt: string | null;
  applied: boolean;
}

export interface AdaptivePathCorrectionDecisionHistoryItem extends AdaptivePathCorrectionDecisionState {
  candidateFingerprint: string;
  outcome: AdaptivePathCorrectionOutcome | null;
}

export interface AuthorizedAdaptivePathJourney {
  path: { id: string; title: string };
  goal: { id: string };
  context: { pathId: string; goalId: string; requestedNodeId: string | null };
  current: AdaptivePathJourneyNodeView | null;
  progress: { completed: number; total: number };
  return: { label: string; href: string };
  pathStatus: string;
  nextAction: AdaptivePathJourneyNextAction;
  correction?: AdaptivePathJourneyCorrection;
}

export interface AdaptivePathJourneyPathRecord {
  id?: unknown;
  title?: unknown;
  goalId?: unknown;
  pathStatus?: unknown;
  currentNodeId?: unknown;
  nodeIds?: unknown;
  pathPayload?: unknown;
  terminalValidation?: unknown;
  lastExecutionMetadata?: unknown;
  deviations?: unknown;
  updatedAt?: unknown;
  correctionDecisions?: unknown;
  executions?: unknown;
}

export type AdaptivePathJourneyTargetDisposition =
  | 'destination-control'
  | 'path-center-explicit'
  | 'path-center-server-evidence'
  | 'external-fallback'
  | 'blocked';

export function resolveAdaptivePathJourneyTargetDisposition(
  resourceType: string,
  target: string,
  context: { nodeId?: string | null; sourceKind?: string | null; sourceRef?: string | null } = {},
): AdaptivePathJourneyTargetDisposition {
  return resolveAdaptivePathDestinationContract(resourceType, target, context).disposition;
}

export function resolveAdaptivePathCenterOwnedTargetHref(resourceType: string, target: string): string | null {
  return resolveDestinationCenterTarget(resourceType, target);
}

export function buildAuthorizedAdaptivePathJourney(
  path: AdaptivePathJourneyPathRecord,
  input: { requestedNodeId?: string | null } = {},
): AuthorizedAdaptivePathJourney {
  const pathId = readNonEmptyString(path.id) ?? 'unknown-path';
  const goalId = readNonEmptyString(path.goalId) ?? 'unknown-goal';
  const payload = readRecord(path.pathPayload);
  const metadata = readRecord(path.lastExecutionMetadata);
  const terminalValidation = readRecord(path.terminalValidation);
  const mainPathNodeIds = readStrictStringArray(payload.mainPathNodeIds) ?? [];
  const planNodes = readRecordArray(payload.planNodes);
  const journeyNodes = planNodes
    .map(readJourneyNode)
    .filter((node): node is JourneyNodeRecord => Boolean(node));
  const nodeById = new Map(journeyNodes.map((node) => [node.nodeId, node]));
  const completedNodeIds = new Set(readStringArray(metadata.completedNodeIds));
  const failedNodeIds = new Set(readStringArray(metadata.failedNodeIds));
  const deviations = readRecordArray(path.deviations);
  const currentNodeId = readNonEmptyString(path.currentNodeId);
  const persistedCurrentNode = currentNodeId ? nodeById.get(currentNodeId) ?? null : null;
  const requestedNodeId = readNonEmptyString(input.requestedNodeId);
  const summaryHref = buildPathCenterHref({ pathId, goalId, nodeId: null });
  const persistedPathStatus = readNonEmptyString(path.pathStatus) ?? 'active';
  const structureComplete = hasCompleteJourneyStructure(
    pathId,
    goalId,
    mainPathNodeIds,
    planNodes,
    journeyNodes,
    nodeById,
    currentNodeId,
    persistedCurrentNode,
    path.terminalValidation,
  );

  const allComplete = mainPathNodeIds.length > 0 && mainPathNodeIds.every((nodeId) => completedNodeIds.has(nodeId));
  const terminalNodeId = readNonEmptyString(terminalValidation.nodeId);
  const terminalState = readNonEmptyString(terminalValidation.state);
  const terminalRequired = Boolean(terminalNodeId) && terminalState !== 'not-required';
  const terminalComplete = !terminalRequired || terminalState === 'completed' || terminalState === 'passed';
  const pathComplete = structureComplete && allComplete && terminalComplete;
  const normalizedPathStatus = pathComplete ? 'completed' : persistedPathStatus;
  const actionNode = structureComplete && !pathComplete
    ? selectJourneyActionNode({
        mainPathNodeIds,
        nodeById,
        completedNodeIds,
        currentNodeId: currentNodeId as string,
        terminalNodeId,
        terminalRequired,
        terminalComplete,
        allComplete,
      })
    : persistedCurrentNode;
  const returnHref = buildPathCenterHref({ pathId, goalId, nodeId: actionNode?.nodeId ?? currentNodeId });
  const correction = structureComplete
    ? buildAdaptivePathJourneyCorrection({
        mainPathNodeIds,
        nodeById,
        completedNodeIds,
        failedNodeIds,
        terminalNodeId,
        terminalState,
        deviations,
      })
    : {
        proposal: null,
        unavailableReason: hasCorrectionTrigger({ failedNodeIds, terminalState, deviations })
          ? '学习路径结构不完整，暂时无法生成可靠的纠偏方案。'
          : null,
      };
  const projectedCorrection = projectAdaptivePathCorrectionDecisionState({
    correction,
    pathUpdatedAt: readDateISOString(path.updatedAt),
    decisions: readRecordArray(path.correctionDecisions),
    executions: readRecordArray(path.executions),
    terminalNodeId,
    terminalState,
  });
  const base = {
    path: {
      id: pathId,
      title: readNonEmptyString(path.title) ?? '学习路径',
    },
    goal: { id: goalId },
    context: { pathId, goalId, requestedNodeId },
    current: actionNode ? toNodeView(actionNode) : null,
    progress: {
      completed: mainPathNodeIds.filter((nodeId) => completedNodeIds.has(nodeId)).length,
      total: mainPathNodeIds.length,
    },
    return: { label: '返回学习路径', href: summaryHref },
    pathStatus: normalizedPathStatus,
    correction: projectedCorrection,
  };

  if (!structureComplete) {
    return {
      ...base,
      nextAction: blockedAction(null, '学习路径结构需要重新生成。', returnHref),
    };
  }

  if (pathComplete) {
    return {
      ...base,
      nextAction: {
        state: 'path-complete',
        nodeId: null,
        title: '查看路径总结',
        type: null,
        href: summaryHref,
        reason: null,
        recovery: null,
      },
    };
  }

  if (!actionNode) {
    return {
      ...base,
      nextAction: blockedAction(null, '学习路径结构需要重新生成。', returnHref),
    };
  }

  if (
    failedNodeIds.has(actionNode.nodeId) ||
    terminalState === 'failed' ||
    terminalState === 'low-confidence' ||
    persistedPathStatus === 'fallback'
  ) {
    return {
      ...base,
      nextAction: blockedAction(actionNode, '当前结果未通过路径验证，请按提示恢复后重试。', returnHref),
    };
  }

  const readiness = readRecord(actionNode.readiness);
  const missingOutcomeRefs = readStringArray(readiness.missingOutcomeRefs);
  if (missingOutcomeRefs.length > 0 || terminalState === 'in-progress' || (allComplete && terminalRequired && !terminalComplete)) {
    return {
      ...base,
      nextAction: unavailableAction(
        'pending-result',
        actionNode,
        '结果正在同步，完成绑定后即可继续。',
        { label: '刷新结果状态', href: returnHref },
      ),
    };
  }

  const readinessState = readNonEmptyString(readiness.state);
  if (
    requestedNodeId === actionNode.nodeId && !completedNodeIds.has(actionNode.nodeId) ||
    actionNode.status === 'locked' ||
    (readinessState !== null && readinessState !== 'ready')
  ) {
    const reason = readNonEmptyString(readiness.message) ??
      readNonEmptyString(readiness.unlockMessage) ??
      '请先完成当前节点或满足解锁条件。';
    return {
      ...base,
      nextAction: blockedAction(actionNode, reason, returnHref),
    };
  }

  const target = readNonEmptyString(actionNode.target);
  if (!target) {
    return {
      ...base,
      nextAction: blockedAction(actionNode, '当前节点缺少可验证的启动目标。', returnHref),
    };
  }
  const targetDisposition = resolveAdaptivePathJourneyTargetDisposition(actionNode.type, target, actionNode);
  if (targetDisposition === 'blocked') {
    return {
      ...base,
      nextAction: blockedAction(actionNode, '当前节点的启动目标不受平台支持，请重新生成路径。', returnHref),
    };
  }
  const href = targetDisposition !== 'destination-control'
    ? returnHref
    : buildAdaptivePathLaunchHref(target, {
        goalId,
        pathId,
        nodeId: actionNode.nodeId,
        routeIntent: 'path-execution',
        resourceType: actionNode.type,
      });

  return {
    ...base,
    nextAction: {
      state: 'ready',
      ...toNodeView(actionNode),
      href,
      reason: null,
      recovery: null,
    },
  };
}

export function canonicalizeAdaptivePathInternalHref(target: string): string | null {
  return canonicalizeDestinationHref(target);
}

interface JourneyNodeRecord extends AdaptivePathJourneyNodeView {
  target: string | null;
  status: string | null;
  readiness: unknown;
  estimatedTimeMinutes: number | null;
  checkpoint: boolean;
  prerequisiteNodeIds: string[];
}

function readJourneyNode(value: Record<string, unknown>): JourneyNodeRecord | null {
  const nodeId = readNonEmptyString(value.nodeId);
  const title = readNonEmptyString(value.title);
  const type = readNonEmptyString(value.type);
  if (!nodeId || !title || !type) return null;
  return {
    nodeId,
    title,
    type,
    sourceKind: readNonEmptyString(value.sourceKind),
    sourceRef: readNonEmptyString(value.sourceRef),
    target: readNonEmptyString(value.target),
    status: readNonEmptyString(value.status),
    readiness: value.readiness,
    estimatedTimeMinutes: readNonNegativeNumber(value.estimatedTimeMinutes),
    checkpoint: value.checkpoint === true || type === 'checkpoint',
    prerequisiteNodeIds: readStringArray(value.prerequisiteNodeIds),
  };
}

function projectAdaptivePathCorrectionDecisionState(input: {
  correction: AdaptivePathJourneyCorrectionProjection;
  pathUpdatedAt: string | null;
  decisions: Record<string, unknown>[];
  executions: Record<string, unknown>[];
  terminalNodeId: string | null;
  terminalState: string | null;
}): AdaptivePathJourneyCorrection {
  const candidateFingerprint = input.correction.proposal
    ? fingerprintAdaptivePathCorrectionProposal(input.correction.proposal)
    : null;
  const decisions = input.decisions
    .map((value) => toAdaptivePathCorrectionDecisionHistoryItem(
      value,
      input.executions,
      input.terminalNodeId,
      input.terminalState,
    ))
    .filter((item): item is AdaptivePathCorrectionDecisionHistoryItem => Boolean(item));
  const history = decisions.slice(0, 10);
  const decision = candidateFingerprint
    ? decisions.find((item) => item.candidateFingerprint === candidateFingerprint) ?? null
    : null;
  return {
    ...input.correction,
    candidateFingerprint,
    pathUpdatedAt: input.pathUpdatedAt,
    decision,
    history,
  };
}

function toAdaptivePathCorrectionDecisionHistoryItem(
  value: Record<string, unknown>,
  executions: Record<string, unknown>[],
  terminalNodeId: string | null,
  terminalState: string | null,
): AdaptivePathCorrectionDecisionHistoryItem | null {
  const candidateFingerprint = readNonEmptyString(value.candidateFingerprint);
  const decision = readAdaptivePathCorrectionDecisionType(value.decision);
  if (!candidateFingerprint || !decision) return null;
  const applicationResult = readRecord(value.applicationResult);
  return {
    candidateFingerprint,
    decision,
    createdAt: readDateISOString(value.createdAt),
    applied: applicationResult.applied === true,
    outcome: projectAdaptivePathCorrectionOutcome({ decision: value, executions, terminalNodeId, terminalState }),
  };
}

function readAdaptivePathCorrectionDecisionType(value: unknown): AdaptivePathCorrectionDecisionType | null {
  return value === 'confirmed' || value === 'rejected' || value === 'deferred' ? value : null;
}

export function fingerprintAdaptivePathCorrectionProposal(proposal: AdaptivePathCorrectionProposal): string {
  const input = JSON.stringify({
    trigger: proposal.trigger,
    originalRemaining: proposal.originalRemaining,
    proposedRemaining: proposal.proposedRemaining,
    changes: proposal.changes,
    supportingFacts: proposal.supportingFacts,
    estimatedRemainingWork: proposal.estimatedRemainingWork,
  });
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `correction-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function buildAdaptivePathJourneyCorrection(input: {
  mainPathNodeIds: string[];
  nodeById: Map<string, JourneyNodeRecord>;
  completedNodeIds: Set<string>;
  failedNodeIds: Set<string>;
  terminalNodeId: string | null;
  terminalState: string | null;
  deviations: Record<string, unknown>[];
}): AdaptivePathJourneyCorrectionProjection {
  const remainingNodeIds = input.mainPathNodeIds.filter((nodeId) => !input.completedNodeIds.has(nodeId));
  const originalRemaining = remainingNodeIds
    .map((nodeId) => input.nodeById.get(nodeId))
    .filter((node): node is JourneyNodeRecord => Boolean(node));
  if (originalRemaining.length !== remainingNodeIds.length) {
    return { proposal: null, unavailableReason: hasCorrectionTrigger(input) ? '路径中的未完成节点信息不完整，暂时无法生成可靠的纠偏方案。' : null };
  }

  const deviation = findCorrectableDeviation(input.deviations, originalRemaining);
  if (deviation) {
    return correctionFromDeviation({
      originalRemaining,
      trigger: {
        kind: 'deviation',
        node: deviation.priorNode,
        reason: deviation.reason,
      },
      deviation,
      completedNodeIds: input.completedNodeIds,
      supportingFacts: [
        deviation.reason,
        '候选差异仅来自已记录的路径执行事实和当前未完成的受治理节点。',
      ],
    });
  }
  if (hasRelevantDeviation(input.deviations)) {
    return {
      proposal: null,
      unavailableReason: hasNoMaterialDeviation(input.deviations, originalRemaining)
        ? '候选调整与当前未完成路径没有实质差异。'
        : '偏离记录缺少可核验的未完成节点对应关系，暂时无法生成可靠的纠偏方案。',
    };
  }

  const failedCheckpoint = originalRemaining.find((node) =>
    input.failedNodeIds.has(node.nodeId) && node.checkpoint,
  ) ?? (
    input.terminalState === 'failed' && input.terminalNodeId
      ? originalRemaining.find((node) => node.nodeId === input.terminalNodeId && node.checkpoint) ?? null
      : null
  );
  if (failedCheckpoint) {
    const preparation = findFailedCheckpointPreparation(failedCheckpoint, originalRemaining);
    return preparation
      ? correctionFromReordering({
          originalRemaining,
          trigger: {
            kind: 'failed-checkpoint',
            node: failedCheckpoint,
            reason: '检查点结果未通过。',
          },
          movedNode: failedCheckpoint,
          anchorNode: preparation,
          completedNodeIds: input.completedNodeIds,
          supportingFacts: [
            `“${failedCheckpoint.title}”的检查点结果未通过。`,
            `“${preparation.title}”是该检查点的可核验先修节点，且当前处于可用状态。`,
          ],
        })
      : {
          proposal: null,
          unavailableReason: '检查点未通过，但当前路径未提供可核验的补救关系，暂时无法生成可靠的纠偏方案。',
        };
  }

  return { proposal: null, unavailableReason: null };
}

function findFailedCheckpointPreparation(
  failedCheckpoint: JourneyNodeRecord,
  remainingNodes: JourneyNodeRecord[],
): JourneyNodeRecord | null {
  const failedIndex = remainingNodes.indexOf(failedCheckpoint);
  if (failedIndex < 0) return null;
  const prerequisiteIds = new Set(failedCheckpoint.prerequisiteNodeIds);
  const candidates = remainingNodes.filter((node, index) =>
    index > failedIndex && prerequisiteIds.has(node.nodeId) && isEligibleCorrectionNode(node),
  );
  return candidates.at(-1) ?? null;
}

function isEligibleCorrectionNode(node: JourneyNodeRecord): boolean {
  if (node.status === 'locked') return false;
  const readinessState = readNonEmptyString(readRecord(node.readiness).state);
  return readinessState === 'ready';
}

function findCorrectableDeviation(
  deviations: Record<string, unknown>[],
  remainingNodes: JourneyNodeRecord[],
): {
  type: 'skip' | 'replacement' | 'abandonment';
  priorNode: JourneyNodeRecord;
  targetNode: JourneyNodeRecord | null;
  reason: string;
} | null {
  const nodeById = new Map(remainingNodes.map((node) => [node.nodeId, node]));
  for (const deviation of deviations) {
    const deviationType = readNonEmptyString(deviation.deviationType);
    if (deviationType !== 'skip' && deviationType !== 'replacement' && deviationType !== 'abandonment') continue;
    const priorNodeId = readNonEmptyString(deviation.priorNodeId);
    const targetNodeId = readNonEmptyString(deviation.targetNodeId);
    const priorNode = priorNodeId ? nodeById.get(priorNodeId) ?? null : null;
    const targetNode = targetNodeId ? nodeById.get(targetNodeId) ?? null : null;
    if (!priorNode) continue;
    if (deviationType === 'skip' && (!targetNode || targetNode.nodeId !== priorNode.nodeId)) continue;
    if (deviationType === 'replacement' && (!targetNode || targetNode.nodeId === priorNode.nodeId)) continue;
    return {
      type: deviationType,
      priorNode,
      targetNode,
      reason: deviationType === 'skip'
        ? `已记录跳过“${priorNode.title}”。`
        : deviationType === 'replacement'
          ? `已记录将“${priorNode.title}”替换为“${targetNode?.title ?? '当前受治理节点'}”。`
          : `已记录放弃“${priorNode.title}”。`,
    };
  }
  return null;
}

function correctionFromDeviation(input: {
  originalRemaining: JourneyNodeRecord[];
  trigger: { kind: 'deviation'; node: JourneyNodeRecord; reason: string };
  deviation: NonNullable<ReturnType<typeof findCorrectableDeviation>>;
  completedNodeIds: Set<string>;
  supportingFacts: string[];
}): AdaptivePathJourneyCorrectionProjection {
  const proposedNodes = input.originalRemaining.filter((node) => node.nodeId !== input.deviation.priorNode.nodeId);
  if (!hasValidPrerequisiteOrder(proposedNodes, input.originalRemaining, input.completedNodeIds)) {
    return { proposal: null, unavailableReason: '已记录偏离会破坏当前未完成路径的先修约束，暂时无法生成可靠的纠偏方案。' };
  }
  if (sameNodeSequence(input.originalRemaining, proposedNodes)) {
    return { proposal: null, unavailableReason: '候选调整与当前未完成路径没有实质差异。' };
  }
  const changes: AdaptivePathCorrectionProposal['changes'] = input.deviation.type === 'replacement' && input.deviation.targetNode
    ? [{
        kind: 'replaced',
        nodeId: input.deviation.priorNode.nodeId,
        title: input.deviation.priorNode.title,
        replacementNodeId: input.deviation.targetNode.nodeId,
        replacementTitle: input.deviation.targetNode.title,
      }]
    : [{
        kind: 'removed',
        nodeId: input.deviation.priorNode.nodeId,
        title: input.deviation.priorNode.title,
        reason: input.deviation.type === 'skip' ? '已记录跳过。' : '已记录放弃。',
      }];
  return buildCorrectionProposal({
    originalRemaining: input.originalRemaining,
    proposedNodes,
    trigger: input.trigger,
    changes,
    supportingFacts: input.supportingFacts,
  });
}

function correctionFromReordering(input: {
  originalRemaining: JourneyNodeRecord[];
  trigger: { kind: 'failed-checkpoint' | 'deviation'; node: JourneyNodeRecord; reason: string };
  movedNode: JourneyNodeRecord;
  anchorNode: JourneyNodeRecord;
  completedNodeIds: Set<string>;
  supportingFacts: string[];
}): AdaptivePathJourneyCorrectionProjection {
  const proposedNodes = input.originalRemaining.filter((node) => node.nodeId !== input.movedNode.nodeId);
  const anchorIndex = proposedNodes.findIndex((node) => node.nodeId === input.anchorNode.nodeId);
  if (anchorIndex < 0) {
    return { proposal: null, unavailableReason: '候选纠偏缺少可核验的目标节点，暂时无法生成。' };
  }
  proposedNodes.splice(anchorIndex + 1, 0, input.movedNode);
  if (!hasValidPrerequisiteOrder(proposedNodes, input.originalRemaining, input.completedNodeIds)) {
    return { proposal: null, unavailableReason: '候选调整会破坏当前未完成路径的先修约束，暂时无法生成可靠的纠偏方案。' };
  }
  if (sameNodeSequence(input.originalRemaining, proposedNodes)) {
    return { proposal: null, unavailableReason: '候选调整与当前未完成路径没有实质差异。' };
  }
  return buildCorrectionProposal({
    originalRemaining: input.originalRemaining,
    proposedNodes,
    trigger: input.trigger,
    changes: [{
      kind: 'reordered',
      nodeId: input.movedNode.nodeId,
      title: input.movedNode.title,
      movedAfterNodeId: input.anchorNode.nodeId,
    }],
    supportingFacts: input.supportingFacts,
  });
}

function hasValidPrerequisiteOrder(
  nodes: JourneyNodeRecord[],
  originalRemaining: JourneyNodeRecord[],
  completedNodeIds: Set<string>,
): boolean {
  const indexByNodeId = new Map(nodes.map((node, index) => [node.nodeId, index]));
  const originalNodeIds = new Set(originalRemaining.map((node) => node.nodeId));
  return nodes.every((node, index) => node.prerequisiteNodeIds.every((prerequisiteNodeId) => {
    const prerequisiteIndex = indexByNodeId.get(prerequisiteNodeId);
    return originalNodeIds.has(prerequisiteNodeId)
      ? prerequisiteIndex !== undefined && prerequisiteIndex < index
      : completedNodeIds.has(prerequisiteNodeId);
  }));
}

function buildCorrectionProposal(input: {
  originalRemaining: JourneyNodeRecord[];
  proposedNodes: JourneyNodeRecord[];
  trigger: { kind: 'failed-checkpoint' | 'deviation'; node: JourneyNodeRecord; reason: string };
  changes: AdaptivePathCorrectionProposal['changes'];
  supportingFacts: string[];
}): AdaptivePathJourneyCorrectionProjection {
  const originalMinutes = totalEstimatedMinutes(input.originalRemaining);
  const proposedMinutes = totalEstimatedMinutes(input.proposedNodes);
  return {
    proposal: {
      trigger: {
        kind: input.trigger.kind,
        nodeId: input.trigger.node.nodeId,
        title: input.trigger.node.title,
        reason: input.trigger.reason,
      },
      originalRemaining: input.originalRemaining.map(toCorrectionNode),
      proposedRemaining: input.proposedNodes.map(toCorrectionNode),
      changes: input.changes,
      supportingFacts: input.supportingFacts,
      estimatedRemainingWork: {
        originalMinutes,
        proposedMinutes,
        differenceMinutes: originalMinutes !== null && proposedMinutes !== null ? proposedMinutes - originalMinutes : null,
      },
    },
    unavailableReason: null,
  };
}

function hasCorrectionTrigger(input: {
  failedNodeIds: Set<string>;
  terminalState: string | null;
  deviations: Record<string, unknown>[];
}): boolean {
  return input.failedNodeIds.size > 0 || input.terminalState === 'failed' || hasRelevantDeviation(input.deviations);
}

function hasRelevantDeviation(deviations: Record<string, unknown>[]): boolean {
  return deviations.some((deviation) => {
    const type = readNonEmptyString(deviation.deviationType);
    return type === 'skip' || type === 'replacement' || type === 'abandonment';
  });
}

function hasNoMaterialDeviation(
  deviations: Record<string, unknown>[],
  remainingNodes: JourneyNodeRecord[],
): boolean {
  const nodeIndexById = new Map(remainingNodes.map((node, index) => [node.nodeId, index]));
  return deviations.some((deviation) => {
    const type = readNonEmptyString(deviation.deviationType);
    if (type !== 'skip' && type !== 'replacement' && type !== 'abandonment') return false;
    const priorNodeId = readNonEmptyString(deviation.priorNodeId);
    const targetNodeId = readNonEmptyString(deviation.targetNodeId);
    if (!priorNodeId || !targetNodeId) return false;
    if (priorNodeId === targetNodeId) return true;
    const priorIndex = nodeIndexById.get(priorNodeId);
    const targetIndex = nodeIndexById.get(targetNodeId);
    return priorIndex !== undefined && targetIndex !== undefined && priorIndex === targetIndex + 1;
  });
}

function sameNodeSequence(left: JourneyNodeRecord[], right: JourneyNodeRecord[]): boolean {
  return left.length === right.length && left.every((node, index) => node.nodeId === right[index]?.nodeId);
}

function toCorrectionNode(node: JourneyNodeRecord): AdaptivePathCorrectionNode {
  return {
    ...toNodeView(node),
    estimatedTimeMinutes: node.estimatedTimeMinutes,
  };
}

function totalEstimatedMinutes(nodes: JourneyNodeRecord[]): number | null {
  if (!nodes.every((node) => node.estimatedTimeMinutes !== null)) return null;
  return nodes.reduce((total, node) => total + (node.estimatedTimeMinutes ?? 0), 0);
}

function hasCompleteJourneyStructure(
  pathId: string,
  goalId: string,
  mainPathNodeIds: string[],
  planNodes: Record<string, unknown>[],
  journeyNodes: JourneyNodeRecord[],
  nodeById: Map<string, JourneyNodeRecord>,
  currentNodeId: string | null,
  currentNode: JourneyNodeRecord | null,
  terminalValidation: unknown,
): boolean {
  return pathId !== 'unknown-path' &&
    goalId !== 'unknown-goal' &&
    mainPathNodeIds.length > 0 &&
    new Set(mainPathNodeIds).size === mainPathNodeIds.length &&
    planNodes.length > 0 &&
    journeyNodes.length === planNodes.length &&
    nodeById.size === journeyNodes.length &&
    mainPathNodeIds.every((nodeId) => nodeById.has(nodeId)) &&
    Boolean(currentNodeId && mainPathNodeIds.includes(currentNodeId) && currentNode) &&
    hasValidTerminalValidationContract(terminalValidation, mainPathNodeIds);
}

function selectJourneyActionNode(input: {
  mainPathNodeIds: string[];
  nodeById: Map<string, JourneyNodeRecord>;
  completedNodeIds: Set<string>;
  currentNodeId: string;
  terminalNodeId: string | null;
  terminalRequired: boolean;
  terminalComplete: boolean;
  allComplete: boolean;
}): JourneyNodeRecord | null {
  if (input.allComplete && input.terminalRequired && !input.terminalComplete && input.terminalNodeId) {
    return input.nodeById.get(input.terminalNodeId) ?? null;
  }
  const currentIndex = input.mainPathNodeIds.indexOf(input.currentNodeId);
  if (!input.completedNodeIds.has(input.currentNodeId)) {
    return input.nodeById.get(input.currentNodeId) ?? null;
  }
  for (const nodeId of input.mainPathNodeIds.slice(currentIndex + 1)) {
    if (!input.completedNodeIds.has(nodeId)) return input.nodeById.get(nodeId) ?? null;
  }
  return null;
}

function hasValidTerminalValidationContract(value: unknown, mainPathNodeIds: string[]): boolean {
  if (!isRecord(value)) return false;
  if (value.state === 'not-required') return value.nodeId === null;
  const nodeId = readNonEmptyString(value.nodeId);
  return Boolean(
    nodeId &&
    mainPathNodeIds.includes(nodeId) &&
    ['pending', 'in-progress', 'completed', 'passed', 'failed', 'low-confidence'].includes(String(value.state)),
  );
}

function blockedAction(
  node: JourneyNodeRecord | null,
  reason: string,
  returnHref: string,
): AdaptivePathJourneyNextAction {
  return unavailableAction(
    'blocked',
    node,
    reason,
    { label: '返回学习路径', href: returnHref },
  );
}

function unavailableAction(
  state: 'blocked' | 'pending-result',
  node: JourneyNodeRecord | null,
  reason: string,
  recovery: { label: string; href: string },
): AdaptivePathJourneyNextAction {
  return {
    state,
    nodeId: node?.nodeId ?? null,
    title: node?.title ?? '路径暂不可继续',
    type: node?.type ?? null,
    href: null,
    reason,
    recovery,
  };
}

function toNodeView(node: JourneyNodeRecord): AdaptivePathJourneyNodeView {
  return {
    nodeId: node.nodeId,
    title: node.title,
    type: node.type,
    sourceKind: node.sourceKind,
    sourceRef: node.sourceRef,
  };
}

function buildPathCenterHref(input: { pathId: string; goalId: string; nodeId: string | null }): string {
  const params = new URLSearchParams({
    goal: input.goalId,
    intent: 'path-execution',
    pathId: input.pathId,
  });
  if (input.nodeId) params.set('nodeId', input.nodeId);
  return `/assessment/adaptive-practice?${params.toString()}`;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(readRecord) : [];
}

function readStrictStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const strings = value.map(readNonEmptyString);
  return strings.every((item): item is string => Boolean(item)) ? strings : null;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function readNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function readNonNegativeNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function readDateISOString(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
