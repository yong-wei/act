import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { LEGACY_STOPPED_PATH_STATUS } from '@/lib/canonical-learning-path-transition/contracts';
import { throwIfLearningPathNotWritable } from '@/lib/canonical-learning-path-transition/mutation-guard';
import { runWithLearningPathWriteFence } from '@/lib/canonical-learning-path-transition/write-fence';
import { projectSelectionBasisOntoPlanNodes } from '@/lib/adaptive-path-node-decisions';
import {
  completeKonlingCandidateSelectionToolRun,
  KonlingCandidateSelectionToolRunError,
} from '@/lib/konling-candidate-selection-tool-run';
import {
  recordPathChoiceEvidence,
  type PathChoiceEvidenceAction,
} from '@/lib/control-correction-path-rounds';
import {
  assertCanWriteStudentPath,
  assertPathMutableForWrite,
  getLearningPathRequester,
  learningPathMutationBlockedResponse,
  readPathForAccess,
  refreshPathEvidenceFeatureCache,
  requireIdempotencyKey,
} from '../../route-helpers';

export const dynamic = 'force-dynamic';

const CHOICE_ACTIONS = new Set(['selection', 'rejection', 'switch', 'helpfulness']);
const LEGACY_OPTION_PATH_NODE_TYPE_TO_RESOURCE_TYPE: Record<string, string> = {
  interactive_lesson: 'lesson_step',
  knowledge_card: 'knowledge_card',
  adaptive_quiz: 'adaptive_quiz',
  control_workbench: 'control_workbench',
  simulation: 'simulation',
  arena_task: 'arena_task',
  external_resource: 'external_resource',
  reflection: 'reflection',
  checkpoint: 'checkpoint',
  konling: 'konling',
};

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const requester = await getLearningPathRequester();
    if (requester instanceof NextResponse) return requester;
    const params = await props.params;
    const path = await readPathForAccess(params.id);
    if (path instanceof NextResponse) return path;
    const denied = assertCanWriteStudentPath(requester, path);
    if (denied) return denied;
    const stopped = assertPathMutableForWrite(path);
    if (stopped) return stopped;

    const body = await request.json();
    const missingIdempotencyKey = requireIdempotencyKey(body.idempotencyKey);
    if (missingIdempotencyKey) return missingIdempotencyKey;
    if (typeof body.action !== 'string' || !CHOICE_ACTIONS.has(body.action)) {
      return NextResponse.json({ error: '路径选择动作不符合契约' }, { status: 400 });
    }

    const batchId = nullableString(body.batchId);
    const candidateId = nullableString(body.candidateId);
    const toolRunId = nullableString(body.toolRunId);
    if (toolRunId && body.action !== 'selection') {
      return NextResponse.json({ error: 'Candidate selection tool runs only accept selection actions' }, { status: 400 });
    }
    if (Boolean(batchId) !== Boolean(candidateId)) {
      return NextResponse.json({ error: 'Candidate batch and candidate identities must be provided together' }, { status: 400 });
    }
    if (toolRunId && (!batchId || !candidateId)) {
      return NextResponse.json({ error: 'Candidate selection tool runs require batch and candidate identities' }, { status: 400 });
    }
    let persistedCandidateOption: ServerPathChoiceOption | null = null;
    let persistedCandidateRationale: string | null = null;
    if (batchId && candidateId) {
      const batch = await (prisma as any).adaptivePathCandidateBatch.findUnique({
        where: { id: batchId },
        include: { candidates: { where: { id: candidateId }, take: 1 } },
      });
      const candidate = batch?.candidates[0];
      if (
        !batch
        || batch.status !== 'succeeded'
        || batch.sourcePathId !== params.id
        || batch.userId !== path.userId
        || batch.goalId !== path.goalId
        || !candidate
      ) {
        return NextResponse.json({ error: 'Candidate does not belong to this path batch' }, { status: 404 });
      }
      const snapshot = readRecord(candidate.snapshot);
      if (nullableString(snapshot.styleId) !== candidate.styleId) {
        return NextResponse.json({ error: 'Candidate snapshot identity is invalid' }, { status: 409 });
      }
      const candidateOptions = readPathOptions({ pathOptions: [snapshot] });
      persistedCandidateOption = resolveChoiceOption(
        candidateOptions,
        snapshot.optionId,
        snapshot.styleId,
      );
      if (!persistedCandidateOption || persistedCandidateOption.styleId !== candidate.styleId) {
        return NextResponse.json({ error: 'Candidate snapshot payload is invalid' }, { status: 409 });
      }
      persistedCandidateRationale = `已确认选择“${nullableString(candidate.label) ?? persistedCandidateOption.styleId}”，正在同步到路径中心。`;
      const requestedOptionId = nullableString(body.selectedOptionId);
      const requestedStyleId = nullableString(body.selectedStyleId);
      if (
        (requestedOptionId && requestedOptionId !== persistedCandidateOption.optionId) ||
        (requestedStyleId && requestedStyleId !== persistedCandidateOption.styleId)
      ) {
        return NextResponse.json({ error: 'Selected option does not match the candidate identity' }, { status: 409 });
      }
      if (toolRunId) {
        await completeKonlingCandidateSelectionToolRun(prisma as any, {
          toolRunId,
          actorUserId: requester.userId,
          targetUserId: path.userId,
          batchId,
          candidateId,
          pathId: params.id,
          goalId: path.goalId ?? '',
          selectedOptionId: persistedCandidateOption.optionId,
          selectedStyleId: persistedCandidateOption.styleId,
          studentSafeRationale: persistedCandidateRationale,
          idempotencyKey: body.idempotencyKey,
          complete: false,
        });
      }
    }

    const pathOptions = readPathOptions(path.pathPayload);
    const styleIds = new Set([
      ...Array.from(pathOptions.values()).map((option) => option.styleId),
      ...(persistedCandidateOption ? [persistedCandidateOption.styleId] : []),
    ]);
    const selectedOption = body.action === 'rejection'
      ? resolveChoiceOption(pathOptions, body.selectedOptionId, body.selectedStyleId)
      : persistedCandidateOption
        ?? resolveChoiceOption(pathOptions, body.selectedOptionId, body.selectedStyleId);
    const selectedStyleId = selectedOption?.styleId ?? null;
    const previousStyleId = nullableString(body.previousStyleId);
    const rejectedStyleIds = [
      ...readStringArray(body.rejectedStyleIds),
      ...readStringArray(body.rejectedOptionIds).map((optionId) => (
        optionId === persistedCandidateOption?.optionId
          ? persistedCandidateOption.styleId
          : pathOptions.get(optionId)?.styleId ?? optionId
      )),
    ];
    const hasUnknownStyle = [
      selectedStyleId,
      previousStyleId,
      ...rejectedStyleIds,
    ].some((styleId) => styleId && !styleIds.has(styleId));
    if (
      styleIds.size === 0 ||
      hasUnknownStyle ||
      ((body.action === 'selection' || body.action === 'switch' || body.action === 'helpfulness') && !selectedStyleId) ||
      (body.action === 'rejection' && rejectedStyleIds.length === 0)
    ) {
      return NextResponse.json({ error: '路径选择必须引用当前路径方案中的 styleId' }, { status: 400 });
    }
    if (selectedStyleId && rejectedStyleIds.includes(selectedStyleId)) {
      return NextResponse.json({ error: '路径选择不能同时选择并拒绝同一 styleId' }, { status: 400 });
    }
    if (body.action === 'helpfulness' && rejectedStyleIds.length > 0) {
      return NextResponse.json({ error: '路径有用性反馈不能携带 rejectedStyleIds' }, { status: 400 });
    }
    if (
      shouldAdoptSelectedOption(body.action) &&
      (!selectedOption || !hasExecutableOptionPayload(selectedOption))
    ) {
      return NextResponse.json({ error: '所选路径缺少可执行节点，请重新生成学习路径后再选择' }, { status: 409 });
    }
    const existingChoice = findExistingChoiceByIdempotencyKey(
      path,
      body.idempotencyKey,
      body.action,
      selectedStyleId,
      rejectedStyleIds,
      previousStyleId,
      typeof body.helpful === 'boolean' ? body.helpful : null,
    );
    if (existingChoice.conflict) {
      return NextResponse.json({ error: '路径选择幂等键已被其他选择请求使用' }, { status: 409 });
    }
    if (existingChoice.dedupeKey) {
      if (toolRunId && batchId && candidateId && persistedCandidateOption && persistedCandidateRationale) {
        await completeKonlingCandidateSelectionToolRun(prisma as any, {
          toolRunId, actorUserId: requester.userId, targetUserId: path.userId,
          batchId, candidateId, pathId: params.id, goalId: path.goalId ?? '',
          selectedOptionId: persistedCandidateOption.optionId,
          selectedStyleId: persistedCandidateOption.styleId,
          studentSafeRationale: persistedCandidateRationale,
          idempotencyKey: body.idempotencyKey,
        });
      }
      const cacheRefresh = await refreshPathEvidenceFeatureCache(path.userId);
      return NextResponse.json({
        choice: { emitted: false, dedupeKey: existingChoice.dedupeKey },
        pathUpdate: null,
        cacheRefresh,
      });
    }
    const choice = await recordPathChoiceEvidence(prisma as any, {
      pathId: params.id,
      userId: path.userId,
      goalId: path.goalId ?? null,
      action: body.action as PathChoiceEvidenceAction,
      selectedStyleId,
      selectedPolicyFamily: selectedOption?.policyFamily ?? null,
      rejectedStyleIds,
      previousStyleId,
      diagnosisSnapshotRef: resolveServerDiagnosisSnapshotRef(path),
      resourceMix: selectedOption?.resourceMix ?? {},
      rationaleMetadata: selectedOption?.rationaleMetadata ?? {},
      helpful: typeof body.helpful === 'boolean' ? body.helpful : null,
      eventId: nullableString(body.eventId),
      idempotencyKey: body.idempotencyKey,
      actorUserId: requester.userId,
      actorRole: requester.role,
    });
    const pathUpdate = shouldAdoptSelectedOption(body.action) && selectedOption
      ? choice.emitted
        ? await adoptSelectedPathOption(path, selectedOption)
        : null
      : null;
    const cacheRefresh = await refreshPathEvidenceFeatureCache(path.userId);
    if (toolRunId && batchId && candidateId && persistedCandidateOption && persistedCandidateRationale) {
      await completeKonlingCandidateSelectionToolRun(prisma as any, {
        toolRunId, actorUserId: requester.userId, targetUserId: path.userId,
        batchId, candidateId, pathId: params.id, goalId: path.goalId ?? '',
        selectedOptionId: persistedCandidateOption.optionId,
        selectedStyleId: persistedCandidateOption.styleId,
        studentSafeRationale: persistedCandidateRationale,
        idempotencyKey: body.idempotencyKey,
      });
    }

    return NextResponse.json({ choice, pathUpdate, cacheRefresh });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (error instanceof KonlingCandidateSelectionToolRunError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const blocked = learningPathMutationBlockedResponse(error);
    if (blocked) return blocked;
    console.error('[LearningPathChoice] Error:', error);
    return NextResponse.json({ error: '记录路径选择失败' }, { status: 500 });
  }
}

interface ServerPathChoiceOption {
  optionId: string;
  styleId: string;
  policyFamily: string | null;
  nodeIds: string[];
  activeNodeIds: string[];
  planNodes: Array<Record<string, unknown>>;
  terminalValidationNodeIds: string[];
  resourceMix: Record<string, number>;
  rationaleMetadata: Record<string, unknown>;
  recommendationProvenance: Record<string, unknown>;
}

function readPathOptions(pathPayload: unknown): Map<string, ServerPathChoiceOption> {
  const payload = readRecord(pathPayload);
  const payloadPlanNodes = readRecordArray(payload.planNodes);
  const payloadPlanNodesById = new Map(payloadPlanNodes
    .map((node) => [nullableString(node.nodeId), node] as const)
    .filter((entry): entry is [string, Record<string, unknown>] => Boolean(entry[0])));
  const policyBundle = readRecord(payload.policyBundle);
  const policyPaths = Array.isArray(policyBundle.paths) ? policyBundle.paths : [];
  const paths = policyPaths.length > 0
    ? policyPaths
    : Array.isArray(payload.pathOptions) ? payload.pathOptions : [];
  const options = new Map<string, ServerPathChoiceOption>();
  paths.forEach((item, index) => {
    const option = readRecord(item);
    const styleId = nullableString(option.styleId);
    if (!styleId) return;
    const nodeIds = readStringArray(option.nodeIds);
    if (nodeIds.length === 0) return;
    const optionId = nullableString(option.optionId) ?? `path-option-${index + 1}`;
    const planNodes = readOptionPlanNodes(option, nodeIds, payloadPlanNodesById);
    const serverOption = {
      optionId,
      styleId,
      policyFamily: nullableString(option.policyFamily),
      nodeIds,
      activeNodeIds: readStringArray(option.activeNodeIds),
      planNodes,
      terminalValidationNodeIds: readStringArray(option.terminalValidationNodeIds),
      resourceMix: readNumberRecord(option.resourceMix),
      rationaleMetadata: compactRecord({
        evidenceBasis: readStringArray(option.evidenceBasis),
        limitations: readStringArray(option.limitations),
        terminalValidationNodeIds: readStringArray(option.terminalValidationNodeIds),
        terminalValidationStrategy: readRecord(option.terminalValidationStrategy),
      }),
      recommendationProvenance: readRecord(option.recommendationProvenance),
    };
    options.set(styleId, serverOption);
    options.set(optionId, serverOption);
  });
  return options;
}

function resolveChoiceOption(
  pathOptions: Map<string, ServerPathChoiceOption>,
  optionId: unknown,
  styleId: unknown,
): ServerPathChoiceOption | null {
  const selectedOptionId = nullableString(optionId);
  if (selectedOptionId) return pathOptions.get(selectedOptionId) ?? null;
  const selectedStyleId = nullableString(styleId);
  if (selectedStyleId) return pathOptions.get(selectedStyleId) ?? null;
  return null;
}

function shouldAdoptSelectedOption(action: unknown): boolean {
  return action === 'selection' || action === 'switch';
}

function hasExecutableOptionPayload(option: ServerPathChoiceOption): boolean {
  if (option.nodeIds.length === 0) return false;
  const planNodeIds = new Set(option.planNodes
    .filter((node) => typeof node.type === 'string')
    .map((node) => nullableString(node.nodeId))
    .filter(Boolean));
  return option.nodeIds.every((nodeId) => planNodeIds.has(nodeId));
}

async function adoptSelectedPathOption(
  path: any,
  option: ServerPathChoiceOption,
): Promise<{ selectedOptionId: string; selectedStyleId: string; currentNodeId: string | null; nodeIds: string[] }> {
  // Post-choice adopt must re-read + update under the same stop fence so a cutover
  // between evidence write and path mutation cannot reactivate a stopped Legacy path.
  return runWithLearningPathWriteFence(prisma as any, path.id, async (tx) => {
    if (typeof tx.learningPath.findFirst !== 'function') {
      throw new Error('LearningPath findFirst must be available on the write-fence transaction client');
    }
    if (typeof tx.learningPath.update !== 'function') {
      throw new Error('LearningPath update must be available on the write-fence transaction client');
    }

    const latestPath = await tx.learningPath.findFirst({
      where: { id: path.id },
      select: {
        id: true,
        pathStatus: true,
        pathPayload: true,
        lastExecutionMetadata: true,
        terminalValidation: true,
      },
    });
    throwIfLearningPathNotWritable(latestPath ?? {
      id: path.id,
      pathStatus: LEGACY_STOPPED_PATH_STATUS,
    });

    const pathPayload = readRecord(latestPath?.pathPayload ?? path.pathPayload);
    const selectedNodeState = readSelectedExecutionNodeState(latestPath ?? path, pathPayload);
    const currentNodeId = resolveSelectedPathCurrentNodeId(option, selectedNodeState);
    const selectedPlanNodes = normalizeSelectedPlanNodes(
      projectSelectionBasisOntoPlanNodes(option.planNodes, option.recommendationProvenance),
      currentNodeId,
    );
    const updatedAt = new Date().toISOString();
    const pathPayloadUpdate = {
      ...pathPayload,
      selectedOptionId: option.optionId,
      selectedStyleId: option.styleId,
      selectedPolicyFamily: option.policyFamily,
      currentNodeId,
      mainPathNodeIds: option.nodeIds,
      planNodes: selectedPlanNodes,
      executionStatus: updateSelectedPathExecutionStatus(pathPayload.executionStatus, option.nodeIds, currentNodeId, updatedAt, selectedNodeState),
      visualization: updateSelectedPathVisualization(pathPayload.visualization, option.nodeIds, currentNodeId, selectedNodeState),
    };
    const lastExecutionMetadata = updateSelectedPathExecutionMetadata(
      latestPath?.lastExecutionMetadata ?? path.lastExecutionMetadata,
      option.nodeIds,
      currentNodeId,
      option,
      selectedNodeState,
    );
    const terminalValidation = buildSelectedPathTerminalValidation(
      latestPath?.terminalValidation ?? path.terminalValidation,
      option,
      selectedPlanNodes,
      selectedNodeState,
    );
    const pathStatus = resolveSelectedPathStatus(option.nodeIds, currentNodeId, selectedNodeState, terminalValidation);
    await tx.learningPath.update({
      where: { id: path.id },
      data: {
        nodeIds: option.nodeIds,
        currentNodeId,
        pathStatus,
        pathPayload: pathPayloadUpdate as unknown as Prisma.InputJsonValue,
        lastExecutionMetadata: lastExecutionMetadata as unknown as Prisma.InputJsonValue,
        terminalValidation: terminalValidation as unknown as Prisma.InputJsonValue,
      },
    });
    return {
      selectedOptionId: option.optionId,
      selectedStyleId: option.styleId,
      currentNodeId,
      nodeIds: option.nodeIds,
    };
  });
}

function findExistingChoiceByIdempotencyKey(
  path: any,
  idempotencyKey: unknown,
  action: unknown,
  selectedStyleId: string | null,
  rejectedStyleIds: string[],
  previousStyleId: string | null,
  helpful: boolean | null,
): { dedupeKey: string | null; conflict: boolean } {
  const eventKey = nullableString(idempotencyKey);
  if (!eventKey) return { dedupeKey: null, conflict: false };
  const dedupeKey = buildChoiceDedupeKey(path.goalId, path.id, eventKey);
  const existingEntry = readRecordArray(readRecord(path.pathPayload).selectionHistory)
    .find((entry) => nullableString(entry.id) === dedupeKey);
  if (!existingEntry) return { dedupeKey: null, conflict: false };
  const relatedRefs = readRecord(existingEntry.relatedRefs);
  const preferenceEvidence = readRecord(existingEntry.preferenceEvidence);
  const actionValue = nullableString(existingEntry.type) ?? nullableString(preferenceEvidence.action);
  const existingSelectedStyleId = nullableString(existingEntry.selectedStyleId) ?? nullableString(relatedRefs.selectedStyleId) ?? null;
  const existingPreviousStyleId = nullableString(existingEntry.previousStyleId) ?? nullableString(relatedRefs.previousStyleId) ?? null;
  const existingHelpful = typeof existingEntry.helpful === 'boolean'
    ? existingEntry.helpful
    : typeof preferenceEvidence.helpful === 'boolean'
      ? preferenceEvidence.helpful
      : null;
  const existingRejectedStyleIds = readStringArray(existingEntry.rejectedStyleIds).length > 0
    ? readStringArray(existingEntry.rejectedStyleIds)
    : readStringArray(relatedRefs.rejectedStyleIds);
  return {
    dedupeKey,
    conflict:
      actionValue !== action ||
      existingSelectedStyleId !== selectedStyleId ||
      existingPreviousStyleId !== previousStyleId ||
      existingHelpful !== helpful ||
      !sameStringSet(existingRejectedStyleIds, rejectedStyleIds),
  };
}

function buildChoiceDedupeKey(goalId: unknown, pathId: unknown, eventKey: string): string {
  const prefix = !goalId || goalId === 'control-correction'
    ? 'control-correction-path'
    : 'learning-path';
  return `${prefix}:choice:${nullableString(pathId) ?? 'unknown-path'}:${eventKey}`;
}

function sameStringSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const leftSet = new Set(left);
  return right.every((item) => leftSet.has(item));
}

interface SelectedExecutionNodeState {
  completedNodeIds: Set<string>;
  failedNodeIds: Set<string>;
  skippedNodeIds: Set<string>;
  unavailableNodeIds: Set<string>;
}

function resolveSelectedPathCurrentNodeId(
  option: ServerPathChoiceOption,
  selectedNodeState: SelectedExecutionNodeState,
): string | null {
  const preferredNodeIds = option.activeNodeIds.length > 0 ? option.activeNodeIds : option.nodeIds;
  return [...preferredNodeIds, ...option.nodeIds]
    .find((nodeId) => option.nodeIds.includes(nodeId) && !selectedNodeState.unavailableNodeIds.has(nodeId))
    ?? null;
}

function resolveSelectedPathStatus(
  nodeIds: string[],
  currentNodeId: string | null,
  selectedNodeState: SelectedExecutionNodeState,
  terminalValidation: Record<string, unknown>,
): string {
  if (currentNodeId) return 'active';
  const terminalState = nullableString(terminalValidation.state);
  if (terminalState === 'failed' || terminalState === 'low-confidence' || terminalState === 'skipped') {
    return 'fallback';
  }
  if (nodeIds.some((nodeId) => selectedNodeState.failedNodeIds.has(nodeId) || selectedNodeState.skippedNodeIds.has(nodeId))) {
    return 'fallback';
  }
  if (terminalState === 'completed') {
    return 'completed';
  }
  if (nodeIds.length > 0 && nodeIds.every((nodeId) => selectedNodeState.completedNodeIds.has(nodeId))) {
    return 'completed';
  }
  return 'fallback';
}

function readSelectedExecutionNodeState(
  latestPath: Record<string, unknown>,
  pathPayload: Record<string, unknown>,
): SelectedExecutionNodeState {
  const executionStatus = readRecord(pathPayload.executionStatus);
  const metadata = readRecord(latestPath.lastExecutionMetadata);
  const completedNodeIds = new Set([
    ...readStringArray(metadata.completedNodeIds),
    ...readStringArray(executionStatus.completedNodeIds),
  ]);
  const failedNodeIds = new Set([
    ...readStringArray(metadata.failedNodeIds),
    ...readStringArray(executionStatus.failedNodeIds),
  ]);
  const skippedNodeIds = new Set([
    ...readStringArray(metadata.skippedNodeIds),
    ...readStringArray(executionStatus.skippedNodeIds),
  ]);
  return {
    completedNodeIds,
    failedNodeIds,
    skippedNodeIds,
    unavailableNodeIds: new Set([...completedNodeIds, ...failedNodeIds, ...skippedNodeIds]),
  };
}

function buildSelectedPathTerminalValidation(
  value: unknown,
  option: ServerPathChoiceOption,
  selectedPlanNodes: Array<Record<string, unknown>>,
  selectedNodeState: SelectedExecutionNodeState,
): Record<string, unknown> {
  const terminalNodeId = option.terminalValidationNodeIds.find((nodeId) => option.nodeIds.includes(nodeId)) ?? null;
  if (!terminalNodeId) {
    return {
      nodeId: null,
      resourceType: null,
      state: 'not-required',
    };
  }

  const current = readRecord(value);
  const terminalNode = selectedPlanNodes.find((node) => nullableString(node.nodeId) === terminalNodeId);
  const resourceType = nullableString(terminalNode?.type) ?? inferResourceTypeFromOptionNode(terminalNodeId, null);
  const target = nullableString(terminalNode?.target) ?? inferTargetFromOptionNode(terminalNodeId);
  const sourceRef = nullableString(terminalNode?.sourceRef);
  const terminalBase = current.nodeId === terminalNodeId ? current : {};
  const policy = readRecord(terminalBase.policy);
  const existingTerminalState = current.nodeId === terminalNodeId
    ? terminalOutcomeState(nullableString(current.state))
    : null;
  const state = terminalStateFromNodeState(selectedNodeState, terminalNodeId, existingTerminalState);

  return compactRecord({
    ...terminalBase,
    nodeId: terminalNodeId,
    resourceType,
    state,
    target,
    sourceRef,
    taskId: terminalNodeId.startsWith('arena-task:') ? terminalNodeId.slice('arena-task:'.length) : null,
    policy,
  });
}

function readOptionPlanNodes(
  option: Record<string, unknown>,
  nodeIds: string[],
  fallbackPlanNodesById: Map<string, Record<string, unknown>>,
): Array<Record<string, unknown>> {
  const directPlanNodes = readRecordArray(option.planNodes);
  const directPlanNodesById = new Map(directPlanNodes
    .map((node) => [nullableString(node.nodeId), node] as const)
    .filter((entry): entry is [string, Record<string, unknown>] => Boolean(entry[0])));
  const planNodesById = directPlanNodesById.size > 0 ? directPlanNodesById : fallbackPlanNodesById;
  const summariesByNodeId = new Map(readRecordArray(option.nodeSummaries)
    .map((summary) => [nullableString(summary.nodeId), summary] as const)
    .filter((entry): entry is [string, Record<string, unknown>] => Boolean(entry[0])));
  return nodeIds.map((nodeId, index) => {
    const existingNode = planNodesById.get(nodeId);
    if (existingNode) return existingNode;
    const summary = summariesByNodeId.get(nodeId);
    return summary ? buildPlanNodeFromOptionSummary(nodeId, summary, index) : null;
  }).filter((node): node is Record<string, unknown> => Boolean(node));
}

function buildPlanNodeFromOptionSummary(
  nodeId: string,
  summary: Record<string, unknown>,
  index: number,
): Record<string, unknown> | null {
  const inferredType = inferResourceTypeFromOptionNode(nodeId, nullableString(summary.pathNodeType));
  if (!inferredType) return null;
  if (inferredType === 'external_resource') return null;
  const target = resolveTargetFromOptionSummary(nodeId, summary, inferredType);
  if (!target) return null;
  return {
    nodeId,
    title: nullableString(summary.title) ?? nullableString(summary.displayName) ?? `学习节点 ${index + 1}`,
    type: inferredType,
    pathNodeType: nullableString(summary.pathNodeType) ?? inferredType,
    target,
    estimatedTimeMinutes: typeof summary.estimatedTimeMinutes === 'number' ? summary.estimatedTimeMinutes : 0,
    status: nullableString(summary.status) ?? (index === 0 ? 'current' : 'next'),
    knowledgeCoverage: [],
    reasonCodes: ['legacy-option-summary'],
  };
}

function inferResourceTypeFromOptionNode(nodeId: string, pathNodeType: string | null): string | null {
  if (nodeId.startsWith('simulation:')) return 'simulation';
  if (nodeId.startsWith('arena-task:')) return 'arena_task';
  if (nodeId.startsWith('adaptive-quiz:')) return 'adaptive_quiz';
  if (nodeId.startsWith('quiz:')) return 'quiz';
  if (nodeId.startsWith('control-workbench:')) return 'control_workbench';
  if (nodeId.startsWith('knowledge-card:')) return 'knowledge_card';
  if (nodeId.startsWith('knowledge-node:')) return 'knowledge_card';
  if (nodeId.startsWith('external-resource:')) return 'external_resource';
  if (nodeId.startsWith('konling:')) return 'konling';
  if (pathNodeType) return LEGACY_OPTION_PATH_NODE_TYPE_TO_RESOURCE_TYPE[pathNodeType] ?? null;
  return null;
}

function resolveTargetFromOptionSummary(
  nodeId: string,
  summary: Record<string, unknown>,
  resourceType: string,
): string | null {
  const explicitTarget = [
    summary.launchTarget,
    summary.renderTarget,
    summary.target,
    summary.actionUrl,
    summary.href,
  ].map(nullableString).find((target) => target && isNavigableTarget(target));
  if (explicitTarget) return explicitTarget;
  if (resourceType === 'simulation') return null;
  return inferTargetFromOptionNode(nodeId);
}

function isNavigableTarget(target: string): boolean {
  return (target.startsWith('/') && !target.startsWith('//')) ||
    target.startsWith('http://') ||
    target.startsWith('https://');
}

function inferTargetFromOptionNode(nodeId: string): string {
  if (nodeId.startsWith('arena-task:')) return `/arena/challenges/${encodeURIComponent(nodeId.slice('arena-task:'.length))}`;
  if (nodeId.startsWith('knowledge-card:')) return `/knowledge?node=${encodeURIComponent(nodeId.slice('knowledge-card:'.length))}`;
  if (nodeId.startsWith('knowledge-node:')) return `/knowledge?node=${encodeURIComponent(nodeId.slice('knowledge-node:'.length))}`;
  return '/assessment/adaptive-practice';
}

function normalizeSelectedPlanNodes(
  planNodes: Array<Record<string, unknown>>,
  currentNodeId: string | null,
): Array<Record<string, unknown>> {
  return planNodes.map((node, index) => {
    const nodeId = nullableString(node.nodeId) ?? `path-node-${index + 1}`;
    const status = currentNodeId === nodeId
      ? 'current'
      : node.status === 'current'
        ? 'next'
        : node.status;
    return {
      ...node,
      nodeId,
      ...(typeof status === 'string' ? { status } : {}),
    };
  });
}

function updateSelectedPathExecutionMetadata(
  value: unknown,
  nodeIds: string[],
  currentNodeId: string | null,
  option: ServerPathChoiceOption,
  selectedNodeState: SelectedExecutionNodeState,
): Record<string, unknown> {
  const metadata = readRecord(value);
  return {
    ...metadata,
    activeNodeId: currentNodeId,
    selectedOptionId: option.optionId,
    selectedStyleId: option.styleId,
    selectedPolicyFamily: option.policyFamily,
    completedNodeIds: filterSelectedNodeSet(selectedNodeState.completedNodeIds, nodeIds),
    failedNodeIds: filterSelectedNodeSet(selectedNodeState.failedNodeIds, nodeIds),
    skippedNodeIds: filterSelectedNodeSet(selectedNodeState.skippedNodeIds, nodeIds),
  };
}

function updateSelectedPathExecutionStatus(
  value: unknown,
  nodeIds: string[],
  currentNodeId: string | null,
  updatedAt: string,
  selectedNodeState: SelectedExecutionNodeState,
): Record<string, unknown> {
  const executionStatus = readRecord(value);
  return {
    ...executionStatus,
    activeNodeId: currentNodeId,
    updatedAt,
    completedNodeIds: filterSelectedNodeSet(selectedNodeState.completedNodeIds, nodeIds),
    failedNodeIds: filterSelectedNodeSet(selectedNodeState.failedNodeIds, nodeIds),
    skippedNodeIds: filterSelectedNodeSet(selectedNodeState.skippedNodeIds, nodeIds),
  };
}

function updateSelectedPathVisualization(
  value: unknown,
  nodeIds: string[],
  currentNodeId: string | null,
  selectedNodeState: SelectedExecutionNodeState,
): Record<string, unknown> {
  const visualization = readRecord(value);
  const map = readRecord(visualization.map);
  return {
    ...visualization,
    map: {
      ...map,
      mainPathNodeIds: nodeIds,
      currentNodeId,
      completedNodeIds: filterSelectedNodeSet(selectedNodeState.completedNodeIds, nodeIds),
      failedNodeIds: filterSelectedNodeSet(selectedNodeState.failedNodeIds, nodeIds),
      skippedNodeIds: filterSelectedNodeSet(selectedNodeState.skippedNodeIds, nodeIds),
    },
  };
}

function filterSelectedNodeSet(value: Set<string>, nodeIds: string[]): string[] {
  return nodeIds.filter((nodeId) => value.has(nodeId));
}

function terminalOutcomeState(value: string | null): string | null {
  return value === 'completed' || value === 'failed' || value === 'low-confidence' || value === 'skipped'
    ? value
    : null;
}

function terminalStateFromNodeState(
  selectedNodeState: SelectedExecutionNodeState,
  terminalNodeId: string,
  existingTerminalState: string | null,
): string {
  if (selectedNodeState.failedNodeIds.has(terminalNodeId)) return 'failed';
  if (selectedNodeState.skippedNodeIds.has(terminalNodeId)) return 'skipped';
  if (existingTerminalState) return existingTerminalState;
  if (selectedNodeState.completedNodeIds.has(terminalNodeId)) return 'completed';
  return 'pending';
}

function resolveServerDiagnosisSnapshotRef(path: { learnerStateRef?: unknown; inputSnapshot?: unknown }): string | null {
  const inputSnapshot = readRecord(path.inputSnapshot);
  const candidates = [
    path.learnerStateRef,
    inputSnapshot.diagnosisSnapshotRef,
    inputSnapshot.diagnosisReportSnapshotId,
    inputSnapshot.snapshotId,
    readRecord(inputSnapshot.diagnosisReportSnapshot).id,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.length > 0) {
      return candidate;
    }
  }
  return null;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function readRecordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.map(readRecord).filter((record) => Object.keys(record).length > 0) : [];
}

function readNumberRecord(value: unknown): Record<string, number> {
  return Object.fromEntries(
    Object.entries(readRecord(value)).filter((entry): entry is [string, number] => typeof entry[1] === 'number'),
  );
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function compactRecord(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => {
    if (Array.isArray(entry)) return entry.length > 0;
    if (entry && typeof entry === 'object') return Object.keys(entry).length > 0;
    return entry !== null && entry !== undefined;
  }));
}
