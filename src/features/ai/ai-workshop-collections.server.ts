import 'server-only';

import type { PrismaClient } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { buildAdaptivePracticePathExecutionHref } from '@/lib/adaptive-practice-path-navigation';
import { studentListAssignments, type StudentAssignmentDto } from '@/lib/assignments/public-api';
import {
  AI_WORKSHOP_COLLECTION_ACTIONS,
  availableCollection,
  emptyCollection,
  orderByOccurrence,
  unavailableCollection,
  type AiAchievementItem,
  type AiCollectionEnvelope,
  type AiExperimentItem,
  type AiJournalItem,
  type AiMilestoneItem,
  type AiTaskItem,
  type AiWorkshopCollections,
} from '@/features/ai/ai-workshop-collections';

const COLLECTION_ITEM_LIMIT = 12;

/** 成就与日志的显式记录类型白名单（Issue #1756）：推断徽章与草稿不得进入。 */
const ACHIEVEMENT_RECORD_TYPES = ['milestone', 'breakthrough'] as const;
const JOURNAL_RECORD_TYPES = ['reflection', 'portfolio'] as const;

/**
 * AI 工坊受治理集合装配器（服务端拥有）：只接受服务端会话学生身份，
 * 各来源独立读取、独立失败，不向客户端暴露原始载荷。
 */
export async function assembleAiWorkshopCollections(
  userId: string,
  db: PrismaClient = prisma,
): Promise<AiWorkshopCollections> {
  // 已采用路径同时供给任务与里程碑两个集合（同一来源），读取失败只影响这两者。
  const adoptedPath = await readAdoptedPath(userId, db);
  const [tasks, milestones, achievements, experiments, journals] = await Promise.all([
    readTaskCollection(userId, adoptedPath),
    readMilestoneCollection(adoptedPath),
    readGrowthCollection(userId, db),
    readExperimentCollection(userId, db),
    readJournalCollection(userId, db),
  ]);
  return {
    authority: 'server-owned',
    generatedAt: new Date().toISOString(),
    tasks,
    milestones,
    achievements,
    experiments,
    journals,
  };
}

type AdoptedPathRow = {
  id: string;
  title: string;
  goalId: string | null;
  nodeIds: unknown;
  currentNodeId: string | null;
  lastExecutionMetadata: unknown;
};

type AdoptedPathResult =
  | { ok: true; path: AdoptedPathRow | null; nodeIds: string[]; completedNodeIds: Set<string> | null; nodeTitle: (nodeId: string) => string }
  | { ok: false };

async function readAdoptedPath(userId: string, db: PrismaClient): Promise<AdoptedPathResult> {
  try {
    const path = await db.learningPath.findFirst({
      where: { userId, pathStatus: 'active' },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      select: { id: true, title: true, goalId: true, nodeIds: true, currentNodeId: true, lastExecutionMetadata: true },
    });
    const nodeIds = Array.isArray(path?.nodeIds)
      ? path.nodeIds.filter((id): id is string => typeof id === 'string')
      : [];
    // 执行记录维护的权威完成集合（跳过/改道不由数组位置推断）；
    // 缺失时返回 null，调用方不得把位置当完成状态。
    const rawCompleted = path?.lastExecutionMetadata
      && typeof path.lastExecutionMetadata === 'object'
      ? (path.lastExecutionMetadata as Record<string, unknown>).completedNodeIds
      : null;
    const completedNodeIds = Array.isArray(rawCompleted)
      ? new Set(rawCompleted.filter((id): id is string => typeof id === 'string'))
      : null;
    const nodes = nodeIds.length > 0
      ? await db.knowledgeNode.findMany({ where: { id: { in: nodeIds } }, select: { id: true, name: true } })
      : [];
    const nameById = new Map(nodes.map((node) => [node.id, node.name]));
    return {
      ok: true,
      path,
      nodeIds,
      completedNodeIds,
      nodeTitle: (nodeId) => nameById.get(nodeId) ?? '路径节点',
    };
  } catch (error) {
    console.error('[AiWorkshop] path source failed:', error instanceof Error ? error.message : 'unknown');
    return { ok: false };
  }
}

async function readTaskCollection(
  userId: string,
  adoptedPath: AdoptedPathResult,
): Promise<AiCollectionEnvelope<AiTaskItem>> {
  try {
    const assignments = await studentListAssignments({ id: userId });
    const items: AiTaskItem[] = assignments
      .filter((assignment) => assignment.contextStatus === 'CURRENT')
      .map(assignmentToTaskItem);
    if (adoptedPath.ok && adoptedPath.path && adoptedPath.nodeIds.length > 0) {
      items.push(...pathTaskItems(adoptedPath));
    }
    return items.length > 0
      ? availableCollection(items, items.length, AI_WORKSHOP_COLLECTION_ACTIONS.tasks)
      : emptyCollection(AI_WORKSHOP_COLLECTION_ACTIONS.tasks);
  } catch (error) {
    console.error('[AiWorkshop] task source failed:', error instanceof Error ? error.message : 'unknown');
    return unavailableCollection('作业与任务来源暂时无法确认，请稍后重试。');
  }
}

/** 已采用路径的任务投影：当前节点进行中、未到达节点未解锁，完成节点不再列为任务。
 * 导航链接按服务端确认的 goal/path/node 与 path-execution 意图编码，目标页据此恢复执行上下文（#1910）。 */
function pathTaskItems(adoptedPath: Extract<AdoptedPathResult, { ok: true }>): AiTaskItem[] {
  const path = adoptedPath.path!;
  const completed = adoptedPath.completedNodeIds ?? new Set<string>();
  return adoptedPath.nodeIds
    .filter((nodeId) => !completed.has(nodeId))
    .map((nodeId) => ({
      id: `path:${path.id}:${nodeId}`,
      title: adoptedPath.nodeTitle(nodeId),
      category: 'theory' as const,
      status: nodeId === path.currentNodeId ? 'in_progress' as const : 'locked' as const,
      progress: 0,
      sourceKind: 'path' as const,
      sourceLabel: path.title,
      href: buildAdaptivePracticePathExecutionHref({
        goalId: path.goalId,
        pathId: path.id,
        nodeId,
      }),
    }));
}

function assignmentToTaskItem(assignment: StudentAssignmentDto): AiTaskItem {
  const progress = assignment.requiredQuestionCount > 0
    ? Math.round((assignment.submittedRequiredCount / assignment.requiredQuestionCount) * 100)
    : 0;
  return {
    id: `assignment:${assignment.id}`,
    title: assignment.title,
    category: 'theory',
    status: assignment.state === 'REVIEWED'
      ? 'completed'
      : assignment.state === 'OVERDUE'
        ? 'locked'
        : assignment.state === 'NOT_STARTED'
          ? 'available'
          : 'in_progress',
    progress,
    sourceKind: 'assignment',
    sourceLabel: '课程作业',
    // 与 studentAssignmentHref 同语义：作业 ID 必须路径编码（Issue #1756 review）。
    href: `/missions/assignments/${encodeURIComponent(assignment.id)}`,
  };
}

async function readMilestoneCollection(
  adoptedPath: AdoptedPathResult,
): Promise<AiCollectionEnvelope<AiMilestoneItem>> {
  if (!adoptedPath.ok) {
    return unavailableCollection('学习路径来源暂时无法确认，请稍后重试。');
  }
  const { path, nodeIds, completedNodeIds, nodeTitle } = adoptedPath;
  if (!path || nodeIds.length === 0) {
    return emptyCollection(AI_WORKSHOP_COLLECTION_ACTIONS.milestones);
  }
  // 权威状态：执行记录的 completedNodeIds 判完成，currentNodeId 判当前；
  // 完成集合缺失时其余节点一律 PENDING，不按数组位置推断完成（Issue #1756 review）。
  const items: AiMilestoneItem[] = nodeIds.map((nodeId, index) => ({
    id: `path:${path.id}:${nodeId}`,
    title: nodeTitle(nodeId),
    order: index + 1,
    status: completedNodeIds?.has(nodeId)
      ? 'COMPLETED'
      : nodeId === path.currentNodeId
        ? 'CURRENT'
        : 'PENDING',
    sourceLabel: path.title,
  }));
  return availableCollection(items, items.length, AI_WORKSHOP_COLLECTION_ACTIONS.milestones);
}

async function readGrowthCollection(
  userId: string,
  db: PrismaClient,
): Promise<AiCollectionEnvelope<AiAchievementItem>> {
  try {
    const where = {
      userId,
      recordType: { in: [...ACHIEVEMENT_RECORD_TYPES] },
      invalidations: { none: {} },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    };
    const [records, total] = await Promise.all([
      db.growthRecord.findMany({
        where,
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        take: COLLECTION_ITEM_LIMIT,
        select: { id: true, recordType: true, title: true, description: true, occurredAt: true },
      }),
      db.growthRecord.count({ where }),
    ]);
    const items: AiAchievementItem[] = records.map((record) => ({
      id: `growth:${record.id}`,
      title: record.title,
      description: record.description,
      icon: record.recordType === 'breakthrough' ? '🚀' : '🏅',
      earnedAt: record.occurredAt.toISOString(),
      sourceLabel: '成长记录',
    }));
    return items.length > 0
      ? availableCollection(items, total, AI_WORKSHOP_COLLECTION_ACTIONS.achievements)
      : emptyCollection(AI_WORKSHOP_COLLECTION_ACTIONS.achievements);
  } catch (error) {
    console.error('[AiWorkshop] achievement source failed:', error instanceof Error ? error.message : 'unknown');
    return unavailableCollection('成就来源暂时无法确认，请稍后重试。');
  }
}

async function readExperimentCollection(
  userId: string,
  db: PrismaClient,
): Promise<AiCollectionEnvelope<AiExperimentItem>> {
  try {
    const [simulations, simulationTotal, arenaSubmissions, arenaTotal] = await Promise.all([
      db.simulationLog.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: COLLECTION_ITEM_LIMIT,
        select: {
          id: true, controlMode: true, inputParams: true, score: true,
          isEthicalViolation: true, odysseyCompletedAt: true, createdAt: true,
        },
      }),
      db.simulationLog.count({ where: { userId } }),
      db.arenaSubmission.findMany({
        where: { userId },
        orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
        take: COLLECTION_ITEM_LIMIT,
        select: { id: true, method: true, score: true, valid: true, submittedAt: true },
      }),
      db.arenaSubmission.count({ where: { userId } }),
    ]);
    const simulationItems: AiExperimentItem[] = simulations.map((log) => ({
      id: `simulation:${log.id}`,
      title: log.isEthicalViolation ? '伦理沙盘演练' : `仿真调参（${log.controlMode}）`,
      type: log.isEthicalViolation ? 'ETHICS_SANDBOX' : 'PID_TUNING',
      score: typeof log.score === 'number' && Number.isFinite(log.score) ? log.score : null,
      createdAt: log.createdAt.toISOString(),
      sourceLabel: '仿真训练',
      resultAuthority: log.odysseyCompletedAt ? 'official' : 'preview',
      parameters: pidParameters(log.inputParams),
    }));
    const arenaItems: AiExperimentItem[] = arenaSubmissions.map((submission) => ({
      id: `arena:${submission.id}`,
      title: `Arena 提交（${submission.method}）`,
      type: 'ARENA_SUBMISSION',
      score: submission.valid && Number.isFinite(submission.score) ? submission.score : null,
      createdAt: submission.submittedAt.toISOString(),
      sourceLabel: 'Arena 竞技场',
      resultAuthority: submission.valid ? 'official' : 'preview',
    }));
    const items = orderByOccurrence(
      [...simulationItems, ...arenaItems],
      (item) => item.createdAt,
    ).slice(0, COLLECTION_ITEM_LIMIT);
    const total = simulationTotal + arenaTotal;
    return items.length > 0
      ? availableCollection(items, total, AI_WORKSHOP_COLLECTION_ACTIONS.experiments)
      : emptyCollection(AI_WORKSHOP_COLLECTION_ACTIONS.experiments);
  } catch (error) {
    console.error('[AiWorkshop] experiment source failed:', error instanceof Error ? error.message : 'unknown');
    return unavailableCollection('实验记录来源暂时无法确认，请稍后重试。');
  }
}

/** PID 参数白名单投影：只暴露 kp/ki/kd 有限数值，不序列化原始载荷。 */
function pidParameters(inputParams: unknown): Record<string, number> | undefined {
  if (!inputParams || typeof inputParams !== 'object') return undefined;
  const source = inputParams as Record<string, unknown>;
  const allowed: Record<string, number> = {};
  for (const key of ['kp', 'ki', 'kd'] as const) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) allowed[key] = value;
  }
  return Object.keys(allowed).length > 0 ? allowed : undefined;
}

async function readJournalCollection(
  userId: string,
  db: PrismaClient,
): Promise<AiCollectionEnvelope<AiJournalItem>> {
  try {
    const growthWhere = {
      userId,
      recordType: { in: [...JOURNAL_RECORD_TYPES] },
      invalidations: { none: {} },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    };
    const [records, growthTotal, ethicsLogs, ethicsTotal] = await Promise.all([
      db.growthRecord.findMany({
        where: growthWhere,
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        take: COLLECTION_ITEM_LIMIT,
        select: { id: true, recordType: true, title: true, description: true, occurredAt: true },
      }),
      db.growthRecord.count({ where: growthWhere }),
      db.ethicalLog.findMany({
        where: { userId, isResolved: true },
        orderBy: [{ resolvedAt: 'desc' }, { id: 'desc' }],
        take: COLLECTION_ITEM_LIMIT,
        select: { id: true, violationType: true, studentJustification: true, resolvedAt: true, createdAt: true },
      }),
      db.ethicalLog.count({ where: { userId, isResolved: true } }),
    ]);
    const growthItems: AiJournalItem[] = records.map((record) => ({
      id: `growth:${record.id}`,
      title: record.title,
      content: record.description,
      entryType: record.recordType === 'reflection' ? 'REFLECTION' : 'GROWTH',
      createdAt: record.occurredAt.toISOString(),
      sourceLabel: '成长记录',
    }));
    const ethicsItems: AiJournalItem[] = ethicsLogs.map((log) => ({
      id: `ethics:${log.id}`,
      title: `伦理决策整改（${log.violationType}）`,
      content: (log.studentJustification ?? '').slice(0, 280),
      entryType: 'ETHICS_DECISION',
      createdAt: (log.resolvedAt ?? log.createdAt).toISOString(),
      sourceLabel: '伦理沙盘',
    }));
    const items = orderByOccurrence(
      [...growthItems, ...ethicsItems],
      (item) => item.createdAt,
    ).slice(0, COLLECTION_ITEM_LIMIT);
    const total = growthTotal + ethicsTotal;
    return items.length > 0
      ? availableCollection(items, total, AI_WORKSHOP_COLLECTION_ACTIONS.journals)
      : emptyCollection(AI_WORKSHOP_COLLECTION_ACTIONS.journals);
  } catch (error) {
    console.error('[AiWorkshop] journal source failed:', error instanceof Error ? error.message : 'unknown');
    return unavailableCollection('学习日志来源暂时无法确认，请稍后重试。');
  }
}
