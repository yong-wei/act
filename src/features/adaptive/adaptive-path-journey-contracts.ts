import { buildAdaptivePathLaunchHref } from './adaptive-learning-center-contracts';
import { isStudentVisiblePathTarget } from '@/lib/control-correction-path-rounds';

export type AdaptivePathJourneyNextActionState = 'ready' | 'blocked' | 'pending-result' | 'path-complete';

export interface AdaptivePathJourneyNodeView {
  nodeId: string;
  title: string;
  type: string;
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

export interface AuthorizedAdaptivePathJourney {
  path: { id: string; title: string };
  goal: { id: string };
  context: { pathId: string; goalId: string; requestedNodeId: string | null };
  current: AdaptivePathJourneyNodeView | null;
  progress: { completed: number; total: number };
  return: { label: string; href: string };
  pathStatus: string;
  nextAction: AdaptivePathJourneyNextAction;
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
): AdaptivePathJourneyTargetDisposition {
  if (resourceType === 'external_resource') {
    return isSafeExternalTarget(target) ? 'external-fallback' : 'blocked';
  }
  const rawTarget = normalizePathCenterOwnedRawTarget(target);
  if (rawTarget) {
    if (!PATH_CENTER_RAW_RESOURCE_TYPES.has(resourceType)) return 'blocked';
    return ['knowledge_card', 'textbook_section', 'slides', 'handout'].includes(resourceType)
      ? 'path-center-explicit'
      : 'path-center-server-evidence';
  }
  const canonicalTarget = canonicalizeAdaptivePathInternalHref(target);
  if (!canonicalTarget || !isStudentVisiblePathTarget(canonicalTarget)) return 'blocked';
  return hasIntegratedJourneyDestination(resourceType, canonicalTarget) ? 'destination-control' : 'blocked';
}

export function resolveAdaptivePathCenterOwnedTargetHref(resourceType: string, target: string): string | null {
  if (resourceType === 'external_resource') return isSafeExternalTarget(target) ? target : null;
  if (!PATH_CENTER_RAW_RESOURCE_TYPES.has(resourceType)) return null;
  return normalizePathCenterOwnedRawTarget(target);
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
    return: { label: '返回学习路径', href: returnHref },
    pathStatus: normalizedPathStatus,
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
  const targetDisposition = resolveAdaptivePathJourneyTargetDisposition(actionNode.type, target);
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

function normalizePathCenterOwnedRawTarget(target: string): string | null {
  const normalized = target.startsWith('course-content/runtime/')
    ? `/${target.replace(/^course-content\/runtime\//, 'course-runtime/')}`
    : target;
  if (!normalized.startsWith('/') || normalized.startsWith('//') || /[\s\p{Cc}]/u.test(normalized)) return null;
  try {
    const parsed = new URL(normalized, 'https://act.local');
    if (parsed.origin !== 'https://act.local' || !parsed.pathname.startsWith('/course-runtime/')) return null;
    if (!parsed.pathname.split('/').filter(Boolean).every((segment) => isSafeEncodedPathSegment(segment))) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

function isSafeEncodedPathSegment(segment: string): boolean {
  let decoded = segment;
  for (let index = 0; index < 8; index += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      return false;
    }
  }
  try {
    if (decodeURIComponent(decoded) !== decoded) return false;
  } catch {
    return false;
  }
  return decoded !== '..' && !decoded.includes('/') && !decoded.includes('\\') && !/[\p{Cc}]/u.test(decoded);
}

function isSafeExternalTarget(target: string): boolean {
  try {
    const url = new URL(target);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

const PATH_CENTER_RAW_RESOURCE_TYPES = new Set([
  'knowledge_card',
  'knowledge_node',
  'textbook_section',
  'slides',
  'handout',
  'video',
  'audio',
]);

function hasIntegratedJourneyDestination(resourceType: string, target: string): boolean {
  const pathname = new URL(target, 'https://act.local').pathname;
  if (resourceType === 'knowledge_card' || resourceType === 'knowledge_node') {
    return pathname === '/knowledge' || pathname.startsWith('/knowledge/');
  }
  if (resourceType === 'interactive_lesson') {
    return pathname.startsWith('/interactive-learning/courses/');
  }
  if (['lesson_step', 'video', 'audio', 'slides', 'handout', 'quiz', 'textbook_section'].includes(resourceType)) {
    return pathname.startsWith('/interactive-learning/resources/');
  }
  if (['adaptive_quiz', 'checkpoint', 'reflection', 'konling', 'ai_intervention', 'intervention'].includes(resourceType)) {
    return pathname === '/assessment/adaptive-practice';
  }
  if (resourceType === 'control_workbench') {
    return pathname === '/interactive-learning/control-workbench';
  }
  if (resourceType === 'simulation') {
    return pathname.startsWith('/simulations/');
  }
  return false;
}

export function canonicalizeAdaptivePathInternalHref(target: string): string | null {
  if (!target.startsWith('/') || target.startsWith('//') || target.includes('\\') || /[\s\p{Cc}]/u.test(target)) {
    return null;
  }
  const rawPathname = target.split(/[?#]/, 1)[0] ?? target;
  if (!rawPathname.split('/').filter(Boolean).every((segment) => isSafeEncodedPathSegment(segment))) return null;
  try {
    const parsed = new URL(target, 'https://act.local');
    if (parsed.origin !== 'https://act.local') return null;
    if (!parsed.pathname.split('/').filter(Boolean).every((segment) => isSafeEncodedPathSegment(segment))) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

interface JourneyNodeRecord extends AdaptivePathJourneyNodeView {
  target: string | null;
  status: string | null;
  readiness: unknown;
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
    target: readNonEmptyString(value.target),
    status: readNonEmptyString(value.status),
    readiness: value.readiness,
  };
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
  return { nodeId: node.nodeId, title: node.title, type: node.type };
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
