import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import {
  recordPathChoiceEvidence,
  type PathChoiceEvidenceAction,
} from '@/lib/control-correction-path-rounds';
import {
  assertCanWriteStudentPath,
  getLearningPathRequester,
  readPathForAccess,
  refreshPathEvidenceFeatureCache,
  requireIdempotencyKey,
} from '../../route-helpers';

export const dynamic = 'force-dynamic';

const CHOICE_ACTIONS = new Set(['selection', 'rejection', 'switch', 'helpfulness']);

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const requester = await getLearningPathRequester();
    if (requester instanceof NextResponse) return requester;
    const params = await props.params;
    const path = await readPathForAccess(params.id);
    if (path instanceof NextResponse) return path;
    const denied = assertCanWriteStudentPath(requester, path);
    if (denied) return denied;

    const body = await request.json();
    const missingIdempotencyKey = requireIdempotencyKey(body.idempotencyKey);
    if (missingIdempotencyKey) return missingIdempotencyKey;
    if (typeof body.action !== 'string' || !CHOICE_ACTIONS.has(body.action)) {
      return NextResponse.json({ error: '路径选择动作不符合契约' }, { status: 400 });
    }

    const pathOptions = readPathOptions(path.pathPayload);
    const styleIds = new Set(Array.from(pathOptions.values()).map((option) => option.styleId));
    const selectedOption = resolveChoiceOption(pathOptions, body.selectedOptionId, body.selectedStyleId);
    const selectedStyleId = selectedOption?.styleId ?? null;
    const previousStyleId = nullableString(body.previousStyleId);
    const rejectedStyleIds = [
      ...readStringArray(body.rejectedStyleIds),
      ...readStringArray(body.rejectedOptionIds).map((optionId) => pathOptions.get(optionId)?.styleId ?? optionId),
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
      ? await adoptSelectedPathOption(path, selectedOption)
      : null;
    const cacheRefresh = await refreshPathEvidenceFeatureCache(path.userId);

    return NextResponse.json({ choice, pathUpdate, cacheRefresh });
  } catch (error) {
    rethrowIfNextDynamicError(error);
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
  resourceMix: Record<string, number>;
  rationaleMetadata: Record<string, unknown>;
}

function readPathOptions(pathPayload: unknown): Map<string, ServerPathChoiceOption> {
  const payload = readRecord(pathPayload);
  const payloadPlanNodes = readRecordArray(payload.planNodes);
  const payloadPlanNodesById = new Map(payloadPlanNodes
    .map((node) => [nullableString(node.nodeId), node] as const)
    .filter((entry): entry is [string, Record<string, unknown>] => Boolean(entry[0])));
  const policyBundle = readRecord(payload.policyBundle);
  const paths = Array.isArray(policyBundle.paths) ? policyBundle.paths : [];
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
      resourceMix: readNumberRecord(option.resourceMix),
      rationaleMetadata: compactRecord({
        evidenceBasis: readStringArray(option.evidenceBasis),
        limitations: readStringArray(option.limitations),
        terminalValidationNodeIds: readStringArray(option.terminalValidationNodeIds),
        terminalValidationStrategy: readRecord(option.terminalValidationStrategy),
      }),
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
  const latestPath = await prisma.learningPath.findUnique({
    where: { id: path.id },
    select: {
      pathPayload: true,
      lastExecutionMetadata: true,
    },
  });
  const pathPayload = readRecord(latestPath?.pathPayload ?? path.pathPayload);
  const currentNodeId = option.activeNodeIds.find((nodeId) => option.nodeIds.includes(nodeId)) ?? option.nodeIds[0] ?? null;
  const selectedPlanNodes = normalizeSelectedPlanNodes(option.planNodes, currentNodeId);
  const updatedAt = new Date().toISOString();
  const pathPayloadUpdate = {
    ...pathPayload,
    selectedOptionId: option.optionId,
    selectedStyleId: option.styleId,
    selectedPolicyFamily: option.policyFamily,
    currentNodeId,
    mainPathNodeIds: option.nodeIds,
    planNodes: selectedPlanNodes,
    executionStatus: {
      ...readRecord(pathPayload.executionStatus),
      activeNodeId: currentNodeId,
      updatedAt,
    },
    visualization: updateSelectedPathVisualization(pathPayload.visualization, option.nodeIds, currentNodeId),
  };
  const lastExecutionMetadata = updateSelectedPathExecutionMetadata(
    latestPath?.lastExecutionMetadata ?? path.lastExecutionMetadata,
    option.nodeIds,
    currentNodeId,
    option,
  );
  await prisma.learningPath.update({
    where: { id: path.id },
    data: {
      nodeIds: option.nodeIds,
      currentNodeId,
      pathPayload: pathPayloadUpdate as unknown as Prisma.InputJsonValue,
      lastExecutionMetadata: lastExecutionMetadata as unknown as Prisma.InputJsonValue,
    },
  });
  return {
    selectedOptionId: option.optionId,
    selectedStyleId: option.styleId,
    currentNodeId,
    nodeIds: option.nodeIds,
  };
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
  return {
    nodeId,
    title: nullableString(summary.title) ?? nullableString(summary.displayName) ?? `学习节点 ${index + 1}`,
    type: inferredType,
    pathNodeType: nullableString(summary.pathNodeType) ?? inferredType,
    target: inferTargetFromOptionNode(nodeId),
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
  if (pathNodeType === 'checkpoint') return 'checkpoint';
  return null;
}

function inferTargetFromOptionNode(nodeId: string): string {
  if (nodeId.startsWith('simulation:')) return `/simulations/${encodeURIComponent(nodeId.slice('simulation:'.length))}`;
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
): Record<string, unknown> {
  const metadata = readRecord(value);
  const selectedNodeIds = new Set(nodeIds);
  return {
    ...metadata,
    activeNodeId: currentNodeId,
    selectedOptionId: option.optionId,
    selectedStyleId: option.styleId,
    selectedPolicyFamily: option.policyFamily,
    completedNodeIds: readStringArray(metadata.completedNodeIds).filter((nodeId) => selectedNodeIds.has(nodeId)),
    failedNodeIds: readStringArray(metadata.failedNodeIds).filter((nodeId) => selectedNodeIds.has(nodeId)),
    skippedNodeIds: readStringArray(metadata.skippedNodeIds).filter((nodeId) => selectedNodeIds.has(nodeId)),
  };
}

function updateSelectedPathVisualization(
  value: unknown,
  nodeIds: string[],
  currentNodeId: string | null,
): Record<string, unknown> {
  const visualization = readRecord(value);
  const map = readRecord(visualization.map);
  return {
    ...visualization,
    map: {
      ...map,
      mainPathNodeIds: nodeIds,
      currentNodeId,
    },
  };
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
