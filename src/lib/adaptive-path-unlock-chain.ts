export type AdaptivePathUnlockConditionKind =
  | 'completed-node'
  | 'outcome'
  | 'evidence'
  | 'competency'
  | 'prerequisite';

export interface AdaptivePathUnlockCondition {
  id: string;
  kind: AdaptivePathUnlockConditionKind;
  title: string;
  current?: string;
  required?: string;
}

export interface AdaptivePathUnlockNextAction {
  title: string;
  target?: string;
}

export interface AdaptivePathUnlockChain {
  nodeId: string;
  reason: string;
  missingConditions: AdaptivePathUnlockCondition[];
  nextAction?: AdaptivePathUnlockNextAction;
  fallbackMessage?: string;
  canExplain: boolean;
}

export interface AdaptivePathUnlockChainNodeInput {
  nodeId: string;
  title?: string | null;
  target?: string | null;
  prerequisiteNodeIds?: readonly string[] | null;
  readiness?: {
    state?: string | null;
    message?: string | null;
    unlockMessage?: string | null;
    fallbackNodeIds?: readonly string[] | null;
    missingCompetencies?: readonly string[] | null;
    missingEvidenceCount?: number | null;
    missingCompletedNodeIds?: readonly string[] | null;
    missingOutcomeRefs?: readonly string[] | null;
  } | null;
}

export interface AdaptivePathUnlockChainContextNode {
  nodeId: string;
  title?: string | null;
  target?: string | null;
  type?: string | null;
  status?: string | null;
}

const UNAVAILABLE_MESSAGE = '暂时无法展示具体解锁条件，请联系教师或重新生成路径。';

export function buildAdaptivePathUnlockChain(
  node: AdaptivePathUnlockChainNodeInput,
  context: readonly AdaptivePathUnlockChainContextNode[] = [],
): AdaptivePathUnlockChain {
  const readiness = readReadiness(node.readiness);
  const nodeById = new Map(context.map((item) => [item.nodeId, item]));
  const missingConditions: AdaptivePathUnlockCondition[] = [];
  const seen = new Set<string>();

  const addCondition = (
    id: string,
    kind: AdaptivePathUnlockConditionKind,
    title: string,
    current?: string,
    required?: string,
  ) => {
    if (seen.has(id)) return;
    seen.add(id);
    missingConditions.push({
      id,
      kind,
      title,
      ...(current ? { current } : {}),
      ...(required ? { required } : {}),
    });
  };

  for (const completedNodeId of readiness?.missingCompletedNodeIds ?? []) {
    const title = titleFor(completedNodeId, nodeById) ?? '未完成的前置节点';
    addCondition(
      `completed-node:${completedNodeId}`,
      'completed-node',
      `完成「${title}」`,
      '未完成',
      '已完成',
    );
  }

  const missingOutcomeCount = readiness?.missingOutcomeRefs?.length ?? 0;
  if (missingOutcomeCount > 0) {
    addCondition(
      'outcome-refs',
      'outcome',
      `同步 ${missingOutcomeCount} 项指定学习结果`,
      '未同步',
      '结果已绑定',
    );
  }

  const missingEvidenceCount = readiness?.missingEvidenceCount ?? 0;
  if (missingEvidenceCount > 0) {
    addCondition(
      'evidence-count',
      'evidence',
      `补充 ${missingEvidenceCount} 条可复核学习证据`,
      `还差 ${missingEvidenceCount} 条`,
      '满足节点证据要求',
    );
  }

  for (const competency of readiness?.missingCompetencies ?? []) {
    addCondition(
      `competency:${competency}`,
      'competency',
      '提升对应能力准备度',
      '未达标',
      '满足节点能力要求',
    );
  }

  if (missingConditions.length === 0) {
    const prerequisiteIds = unique([
      ...(readiness?.fallbackNodeIds ?? []),
      ...(node.prerequisiteNodeIds ?? []),
    ]);
    for (const prerequisiteId of prerequisiteIds) {
      const title = titleFor(prerequisiteId, nodeById) ?? '前置节点';
      addCondition(
        `prerequisite:${prerequisiteId}`,
        'prerequisite',
        `完成「${title}」`,
        '未完成',
        '已完成',
      );
    }
  }

  if (missingConditions.length > 0) {
    const nextAction = buildNextAction(missingConditions, nodeById);
    return {
      nodeId: node.nodeId,
      reason: `尚未满足 ${missingConditions.length} 项解锁条件。`,
      missingConditions,
      nextAction,
      canExplain: true,
    };
  }

  const fallbackMessage = readNonEmptyString(readiness?.unlockMessage)
    ?? readNonEmptyString(readiness?.message)
    ?? undefined;
  if (fallbackMessage) {
    return {
      nodeId: node.nodeId,
      reason: fallbackMessage,
      missingConditions: [],
      nextAction: undefined,
      fallbackMessage,
      canExplain: false,
    };
  }

  return {
    nodeId: node.nodeId,
    reason: UNAVAILABLE_MESSAGE,
    missingConditions: [],
    nextAction: undefined,
    fallbackMessage: UNAVAILABLE_MESSAGE,
    canExplain: false,
  };
}

function buildNextAction(
  conditions: AdaptivePathUnlockCondition[],
  nodeById: Map<string, AdaptivePathUnlockChainContextNode>,
): AdaptivePathUnlockNextAction | undefined {
  const firstNodeCondition = conditions.find((condition) => condition.id.startsWith('completed-node:'));
  if (firstNodeCondition) {
    const nodeId = firstNodeCondition.id.slice('completed-node:'.length);
    const title = titleFor(nodeId, nodeById) ?? '前置节点';
    const target = authorizedTarget(nodeById.get(nodeId));
    return {
      title: `完成「${title}」后解锁`,
      ...(target ? { target } : {}),
    };
  }

  const firstPrerequisite = conditions.find((condition) => condition.id.startsWith('prerequisite:'));
  if (firstPrerequisite) {
    const nodeId = firstPrerequisite.id.slice('prerequisite:'.length);
    const title = titleFor(nodeId, nodeById) ?? '前置节点';
    const target = authorizedTarget(nodeById.get(nodeId));
    return {
      title: `完成「${title}」后解锁`,
      ...(target ? { target } : {}),
    };
  }

  return {
    title: '满足全部缺失条件后自动解锁',
  };
}

function readReadiness(value: AdaptivePathUnlockChainNodeInput['readiness']): AdaptivePathUnlockChainNodeInput['readiness'] {
  if (!value || typeof value !== 'object') return null;
  return value;
}

function readNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function authorizedTarget(node: AdaptivePathUnlockChainContextNode | undefined): string | undefined {
  if (!node || node.status === 'locked') return undefined;
  const target = readNonEmptyString(node.target);
  if (!target || !node.type) return undefined;
  return resolveAdaptivePathJourneyTargetDisposition(node.type, target) === 'blocked' ? undefined : target;
}

function titleFor(
  nodeId: string,
  nodeById: Map<string, AdaptivePathUnlockChainContextNode>,
): string | null {
  return readNonEmptyString(nodeById.get(nodeId)?.title);
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}
import { resolveAdaptivePathJourneyTargetDisposition } from '@/features/adaptive/adaptive-path-journey-contracts';
