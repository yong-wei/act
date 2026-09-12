import type { ActiveResourceBinding } from './active-authority-graph-contracts';

const CARD_KINDS = new Set(['知识卡', 'card']);
const INFOGRAPH_KINDS = new Set(['信息图', 'infographic']);

const SYSTEM_RESOURCE_KIND_ORDER = [
  '课程',
  '讲义',
  '步骤',
  '教材',
  '仿真',
  '练习',
  '视频',
  '音频',
  '知识卡',
  '信息图',
  '教学资源',
] as const;

export interface InspectorPinnedLearningContent {
  card?: {
    state: string;
    summary?: string;
    insight?: string | null;
    explanation?: string | null;
  };
  infograph?: {
    state: string;
    alternativeText?: string;
  };
}

export interface InspectorSystemResourceContext {
  nodeKey: string;
  nodeLabel?: string | null;
  learningContent?: InspectorPinnedLearningContent;
  cardPinned?: boolean;
  infographPinned?: boolean;
}

export function isInspectorCardKind(kind: string): boolean {
  return CARD_KINDS.has(kind);
}

export function isInspectorInfographKind(kind: string): boolean {
  return INFOGRAPH_KINDS.has(kind);
}

function sameLearnerText(left: string | null | undefined, right: string | null | undefined): boolean {
  return (left ?? '') === (right ?? '');
}

function nodeInfographShardPath(nodeKey: string): string {
  return `/api/knowledge/shards/active/nodes/${encodeURIComponent(nodeKey)}/infograph`;
}

export function isPinnedInspectorLearningBinding(
  item: ActiveResourceBinding,
  context: InspectorSystemResourceContext,
): boolean {
  const card = context.learningContent?.card;
  const infograph = context.learningContent?.infograph;
  const cardPinned = context.cardPinned ?? card?.state === 'available';
  const infographPinned = context.infographPinned ?? infograph?.state === 'available';

  if (isInspectorCardKind(item.resourceKind)) {
    if (!cardPinned || card?.state !== 'available') return false;
    const titles = new Set(
      [context.nodeLabel, '知识卡'].filter((value): value is string => Boolean(value && value.trim())),
    );
    if (titles.has(item.title)) return true;
    if (item.viewer?.summary && card.summary) {
      return item.viewer.summary === card.summary
        && sameLearnerText(item.viewer.insight, card.insight)
        && sameLearnerText(item.viewer.explanation, card.explanation);
    }
    return item.launch.kind === 'viewer-shell' && !item.launch.href;
  }

  if (isInspectorInfographKind(item.resourceKind)) {
    if (!infographPinned || infograph?.state !== 'available') return false;
    const imageSrc = item.viewer?.imageSrc ?? '';
    if (
      imageSrc === nodeInfographShardPath(context.nodeKey)
      || imageSrc.includes(`/nodes/${encodeURIComponent(context.nodeKey)}/infograph`)
      || imageSrc.includes(`/nodes/${context.nodeKey}/infograph`)
    ) {
      return true;
    }
    const titles = new Set(
      [
        context.nodeLabel,
        infograph.alternativeText,
        context.nodeLabel ? `${context.nodeLabel} 信息图` : null,
        '信息图',
      ].filter((value): value is string => Boolean(value && value.trim())),
    );
    if (titles.has(item.title)) return true;
    return item.launch.kind === 'viewer-shell' && !item.launch.href && !item.viewer?.imageSrc;
  }

  return false;
}

export function systemResourceBindings(
  items: readonly ActiveResourceBinding[],
  context: InspectorSystemResourceContext,
): ActiveResourceBinding[] {
  const remaining = items.filter((item) => !isPinnedInspectorLearningBinding(item, context));
  const infographPinned = context.infographPinned
    ?? context.learningContent?.infograph?.state === 'available';
  if (!infographPinned) return remaining;
  const leftoverInfographs = remaining.filter((item) => isInspectorInfographKind(item.resourceKind));
  if (leftoverInfographs.length !== 1) return remaining;
  return remaining.filter((item) => item !== leftoverInfographs[0]);
}

export function groupSystemResourceBindingsByKind(
  items: readonly ActiveResourceBinding[],
): Array<{ kind: string; items: ActiveResourceBinding[] }> {
  const groups = new Map<string, ActiveResourceBinding[]>();
  for (const item of items) {
    const kind = item.resourceKind.trim() || '教学资源';
    const bucket = groups.get(kind);
    if (bucket) bucket.push(item);
    else groups.set(kind, [item]);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => {
      const leftRank = SYSTEM_RESOURCE_KIND_ORDER.indexOf(left as (typeof SYSTEM_RESOURCE_KIND_ORDER)[number]);
      const rightRank = SYSTEM_RESOURCE_KIND_ORDER.indexOf(right as (typeof SYSTEM_RESOURCE_KIND_ORDER)[number]);
      const leftOrder = leftRank === -1 ? SYSTEM_RESOURCE_KIND_ORDER.length : leftRank;
      const rightOrder = rightRank === -1 ? SYSTEM_RESOURCE_KIND_ORDER.length : rightRank;
      return leftOrder - rightOrder || left.localeCompare(right, 'zh-CN');
    })
    .map(([kind, grouped]) => ({
      kind,
      items: [...grouped].sort((left, right) =>
        left.title.localeCompare(right.title, 'zh-CN')
        || left.bindingRole.localeCompare(right.bindingRole, 'zh-CN')),
    }));
}
