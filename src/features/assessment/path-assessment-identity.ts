import type { AdaptiveQuestionScope } from './adaptive-engine';

export interface PathIdentityRecord {
  goalId: string | null;
  nodeIds?: unknown;
  pathPayload?: unknown;
}

export interface PathIdentityPort {
  findOwnedCurrentPath(input: {
    pathId: string;
    userId: string;
    nodeId: string;
  }): Promise<PathIdentityRecord | null>;
}

export interface PathAssessmentIdentity {
  pathId: string;
  nodeId: string;
  goalId: string;
  routeIntent: string | null;
  questionScope: AdaptiveQuestionScope;
}

export interface ResolvePathAssessmentIdentityInput {
  port: PathIdentityPort;
  actorUserId: string;
  sessionId: string;
  pathId?: string | null;
  nodeId?: string | null;
  routeIntent?: string | null;
  clientGoalId?: string | null;
  kind: 'question' | 'answer';
}

const MESSAGES = {
  question: {
    missing: '路径自适应题目请求缺少完整 path/node 上下文',
    sessionMismatch: '路径自适应题目请求的 sessionId 与 path/node 不匹配',
    notFound: '未找到可用的路径自适应题目上下文',
    goalMismatch: '路径自适应题目请求的 goalId 与服务端路径目标不匹配',
    nodeNotOnPath: '路径自适应题目请求的 nodeId 不属于当前路径',
    notAssessmentNode: '路径自适应题目请求的 nodeId 不是自适应测验或检查点节点',
  },
  answer: {
    missing: '路径自适应答案提交缺少完整 path/node 上下文',
    sessionMismatch: '路径自适应答案提交的 sessionId 与 path/node 不匹配',
    notFound: '未找到可用的路径自适应答案上下文',
    goalMismatch: '路径自适应答案提交的 goalId 与服务端路径目标不匹配',
    nodeNotOnPath: '路径自适应答案提交的 nodeId 不属于当前路径',
    notAssessmentNode: '路径自适应答案提交的 nodeId 不是自适应测验或检查点节点',
  },
} as const;

export function scopedPathAssessmentSessionId(pathId: string, nodeId: string): string {
  return `adaptive-path:${pathId}:${nodeId}`;
}

export async function resolvePathAssessmentIdentity(
  input: ResolvePathAssessmentIdentityInput,
): Promise<PathAssessmentIdentity | null> {
  const messages = MESSAGES[input.kind];
  const pathId = trimOrNull(input.pathId);
  const nodeId = trimOrNull(input.nodeId);
  const routeIntent = trimOrNull(input.routeIntent);
  const requiresPathContext = input.sessionId.startsWith('adaptive-path:')
    || routeIntent === 'path-execution'
    || Boolean(nodeId);
  if (!requiresPathContext) return null;
  if (!pathId || !nodeId) {
    throw new Error(messages.missing);
  }
  if (input.sessionId !== scopedPathAssessmentSessionId(pathId, nodeId)) {
    throw new Error(messages.sessionMismatch);
  }
  const path = await input.port.findOwnedCurrentPath({
    pathId,
    userId: input.actorUserId,
    nodeId,
  });
  if (!path?.goalId) {
    throw new Error(messages.notFound);
  }
  const clientGoalId = trimOrNull(input.clientGoalId);
  if (clientGoalId && clientGoalId !== path.goalId) {
    throw new Error(messages.goalMismatch);
  }
  if (!readPathNodeIds(path).includes(nodeId)) {
    throw new Error(messages.nodeNotOnPath);
  }
  const pathNode = readPathNode(path, nodeId);
  if (!isPathAssessmentNode(pathNode)) {
    throw new Error(messages.notAssessmentNode);
  }
  return {
    pathId,
    nodeId,
    goalId: path.goalId,
    routeIntent,
    questionScope: inferPathAssessmentScope(pathNode),
  };
}

function isPathAssessmentNode(
  pathNode: Record<string, unknown> | null,
): pathNode is Record<string, unknown> & { type: 'adaptive_quiz' | 'checkpoint' } {
  return pathNode?.type === 'adaptive_quiz' || pathNode?.type === 'checkpoint';
}

function inferPathAssessmentScope(
  pathNode: Record<string, unknown> & { type: 'adaptive_quiz' | 'checkpoint' },
): AdaptiveQuestionScope {
  const checkpoint = readRecord(pathNode.checkpoint);
  const explicitStage = readAssessmentStage(pathNode.assessmentStage) ??
    readAssessmentStage(pathNode.stagePurpose) ??
    readAssessmentStage(checkpoint.assessmentPurpose) ??
    readAssessmentStage(checkpoint.remediationBehavior) ??
    readAssessmentStage(pathNode.nodeId) ??
    readAssessmentStage(pathNode.id) ??
    readAssessmentStage(pathNode.displayName) ??
    readAssessmentStage(pathNode.title);
  if (explicitStage) return explicitStage;
  return pathNode.type === 'checkpoint' ? 'checkpoint' : 'readiness';
}

function readAssessmentStage(
  value: unknown,
): Extract<AdaptiveQuestionScope, 'readiness' | 'checkpoint' | 'remediation' | 'terminal-validation'> | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (
    normalized.includes('terminal-validation') ||
    normalized.includes('终结验证') ||
    normalized.includes('题目型终结')
  ) {
    return 'terminal-validation';
  }
  if (
    normalized.includes('remediation') ||
    normalized.includes('remedial') ||
    normalized.includes('补救') ||
    normalized.includes('修复') ||
    normalized.includes('薄弱')
  ) {
    return 'remediation';
  }
  if (
    normalized.includes('checkpoint') ||
    normalized.includes('检查点') ||
    normalized.includes('阶段检查')
  ) {
    return 'checkpoint';
  }
  if (
    normalized.includes('readiness') ||
    normalized.includes('readiness-gate') ||
    normalized.includes('precheck') ||
    normalized.includes('预检') ||
    normalized.includes('准备')
  ) {
    return 'readiness';
  }
  return null;
}

function readPathNode(path: { pathPayload?: unknown }, nodeId: string): Record<string, unknown> | null {
  const payload = readRecord(path.pathPayload);
  const planNodes = Array.isArray(payload.planNodes) ? payload.planNodes : [];
  return planNodes
    .map(readRecord)
    .find((entry) => entry.nodeId === nodeId) ?? null;
}

function readPathNodeIds(path: { nodeIds?: unknown; pathPayload?: unknown }): string[] {
  const payload = readRecord(path.pathPayload);
  const fromNodeIds = Array.isArray(path.nodeIds) ? path.nodeIds : [];
  const fromPayload = Array.isArray(payload.mainPathNodeIds) ? payload.mainPathNodeIds : [];
  return Array.from(new Set([...fromNodeIds, ...fromPayload].filter((value): value is string => typeof value === 'string')));
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function trimOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}
