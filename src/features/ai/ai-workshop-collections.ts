/**
 * AI 工坊受治理学习集合契约（Issue #1756）。
 *
 * 每个集合独立携带 available / empty / unavailable 来源状态、已知总数、
 * 有界学生安全条目、限制说明与邻近行动；一个集合的状态不得授权其他
 * 集合显示零值或个人记录。所有时间为 ISO 字符串，保证服务端到客户端
 * 可序列化。
 */

export type AiCollectionState = 'available' | 'empty' | 'unavailable';

export interface AiCollectionAction {
  href: string;
  label: string;
}

export interface AiCollectionEnvelope<T> {
  state: AiCollectionState;
  /** 已知合格记录总数；来源不可用时为 null，不得伪造为 0。 */
  total: number | null;
  items: T[];
  limitation?: string;
  action: AiCollectionAction;
}

export interface AiTaskItem {
  id: string;
  title: string;
  category: 'theory' | 'simulation' | 'ethics';
  status: 'locked' | 'available' | 'in_progress' | 'completed';
  /** 已完成必需题比例（0-100）。 */
  progress: number;
  sourceKind: 'assignment' | 'path';
  sourceLabel: string;
  difficulty?: 'easy' | 'medium' | 'hard' | 'expert';
  estimatedTime?: number;
}

export interface AiMilestoneItem {
  id: string;
  title: string;
  order: number;
  status: 'PENDING' | 'CURRENT' | 'COMPLETED';
  sourceLabel: string;
  completedAt?: string;
  description?: string;
}

export interface AiAchievementItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  earnedAt: string;
  sourceLabel: string;
}

export interface AiExperimentItem {
  id: string;
  title: string;
  type: 'PID_TUNING' | 'ETHICS_SANDBOX' | 'ANOMALY_EVENT' | 'ARENA_SUBMISSION';
  /** 无正式分数的记录为 null，面板不得显示伪造分值。 */
  score: number | null;
  createdAt: string;
  sourceLabel: string;
  /** 结果权威性：official 正式 / preview 预览或无效。 */
  resultAuthority: 'official' | 'preview';
  parameters?: Record<string, number>;
}

export interface AiJournalItem {
  id: string;
  title: string;
  content: string;
  entryType: 'ETHICS_DECISION' | 'CERTIFICATE' | 'COMPETITION' | 'TRAINING' | 'REFLECTION' | 'GROWTH';
  createdAt: string;
  sourceLabel: string;
  grade?: string;
}

export interface AiWorkshopCollections {
  authority: 'server-owned';
  generatedAt: string;
  tasks: AiCollectionEnvelope<AiTaskItem>;
  milestones: AiCollectionEnvelope<AiMilestoneItem>;
  achievements: AiCollectionEnvelope<AiAchievementItem>;
  experiments: AiCollectionEnvelope<AiExperimentItem>;
  journals: AiCollectionEnvelope<AiJournalItem>;
}

export const AI_WORKSHOP_COLLECTION_ACTIONS: Record<
  keyof Omit<AiWorkshopCollections, 'authority' | 'generatedAt'>,
  AiCollectionAction
> = {
  tasks: { href: '/interactive-learning', label: '开始学习' },
  milestones: { href: '/interactive-learning', label: '开始学习' },
  achievements: { href: '/interactive-learning', label: '去学习' },
  experiments: { href: '/arena', label: '进入竞技场' },
  journals: { href: '/ai/copilot?context=portfolio-reflection&source=learning-journal&intent=create', label: '记录学习反思' },
};

const AI_WORKSHOP_RETRY_ACTION: AiCollectionAction = { href: '/ai', label: '刷新重试' };

export function availableCollection<T>(
  items: T[],
  total: number,
  action: AiCollectionAction,
): AiCollectionEnvelope<T> {
  return { state: 'available', total, items, action };
}

export function emptyCollection<T>(action: AiCollectionAction): AiCollectionEnvelope<T> {
  return { state: 'empty', total: 0, items: [], action };
}

export function unavailableCollection<T>(limitation: string): AiCollectionEnvelope<T> {
  return { state: 'unavailable', total: null, items: [], limitation, action: AI_WORKSHOP_RETRY_ACTION };
}

/** 路由级失败回退：五个集合同为 unavailable，互不伪造零值。 */
export function createUnavailableAiWorkshopCollections(
  limitation = '学习集合来源暂时无法确认，请稍后重试。',
): AiWorkshopCollections {
  return {
    authority: 'server-owned',
    generatedAt: new Date().toISOString(),
    tasks: unavailableCollection(limitation),
    milestones: unavailableCollection(limitation),
    achievements: unavailableCollection(limitation),
    experiments: unavailableCollection(limitation),
    journals: unavailableCollection(limitation),
  };
}

/** 按发生时间倒序、id 决胜的确定性排序（同读同序，Issue #1756）。 */
export function orderByOccurrence<T extends { id: string }>(items: T[], occurredAt: (item: T) => string): T[] {
  return [...items].sort((left, right) => (
    occurredAt(right).localeCompare(occurredAt(left)) || right.id.localeCompare(left.id)
  ));
}
