import 'server-only';

import type { PrismaClient } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { getAllRegisteredResourceMetadata } from '@/lib/resource-registry-metadata';
import { sceneTraceSourceRefId } from '@/lib/data-governance/simulation-scene-run-persistence';
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
  type AiExperimentSourceType,
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
      select: { id: true, title: true, nodeIds: true, currentNodeId: true, lastExecutionMetadata: true },
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

/** 已采用路径的任务投影：当前节点进行中、未到达节点未解锁，完成节点不再列为任务。 */
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
      href: `/assessment/adaptive-practice?pathId=${path.id}`,
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

/** 注册表验证的导航目标：launchTarget（Arena）优先，否则 renderTarget（默认直开资源页）。 */
function registeredResourceNavigation(resourceId: string | null): { href: string; label: string } | null {
  if (!resourceId) return null;
  const metadata = getAllRegisteredResourceMetadata().find((entry) => entry.id === resourceId);
  const href = metadata?.launchTarget ?? metadata?.renderTarget ?? null;
  if (!href || !href.startsWith('/')) return null;
  return { href, label: '进入对应学习入口' };
}

function finiteScore(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function summaryMetrics(summary: unknown): Record<string, unknown> {
  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) return {};
  const metrics = (summary as Record<string, unknown>).metrics;
  return metrics && typeof metrics === 'object' && !Array.isArray(metrics)
    ? metrics as Record<string, unknown>
    : {};
}

/** 标准运行的类型与标题由来源合同决定（Issue #1912）：不猜测、不默认 PID。 */
function simulationRunItem(run: {
  id: string;
  runKind: string;
  sourceDomain: string;
  sourceRefId: string;
  resourceId: string | null;
  summary: unknown;
  completedAt: Date | null;
}): AiExperimentItem {
  const isControlWorkbench = run.sourceRefId.startsWith('control-workbench:');
  const metrics = summaryMetrics(run.summary);
  const navigation = isControlWorkbench
    ? { href: '/interactive-learning/control-workbench', label: '回到控制工作台' }
    : registeredResourceNavigation(run.resourceId);
  return {
    id: `simulation-run:${run.id}`,
    title: isControlWorkbench
      ? '控制工作台分析'
      : `场景仿真实验（${run.resourceId ?? run.runKind}）`,
    type: isControlWorkbench ? 'CONTROL_WORKBENCH' : 'SCENE_SIMULATION',
    // 标准运行是练习产物；正式评测仍以 Arena/奥德赛桥接为准，不越权升级。
    score: finiteScore(metrics.score),
    // 查询条件保证 completedAt 非空；此处只做类型收窄。
    createdAt: (run.completedAt ?? new Date(0)).toISOString(),
    sourceLabel: isControlWorkbench ? '控制工作台' : '场景仿真',
    resultAuthority: 'preview',
    sourceKind: 'simulation_run',
    navigation,
    parameters: pidParameters(metrics),
  };
}

/** 兼容日志的来源类型由 controlMode 与奥德赛桥接决定，不再统一标 PID（Issue #1912）。 */
function simulationLogItem(log: {
  id: string;
  controlMode: string;
  inputParams: unknown;
  score: number | null;
  isEthicalViolation: boolean;
  odysseyRunId: string | null;
  odysseyCompletedAt: Date | null;
  createdAt: Date;
}, resolvedOdysseyRunId: string | null): AiExperimentItem {
  const mode = String(log.controlMode ?? '').trim();
  // 旧版日志可能只在 inputParams.runId 携带奥德赛身份（Codex R1 review）：
  // 以外层解析出的身份为准投影类型、来源与导航。
  const isOdyssey = Boolean(log.odysseyRunId ?? resolvedOdysseyRunId);
  const type: AiExperimentSourceType = log.isEthicalViolation
    ? 'ETHICS_SANDBOX'
    : isOdyssey
      ? 'ODYSSEY_RUN'
      : ['PID', 'P', 'PD', 'MANUAL'].includes(mode.toUpperCase())
        ? 'PID_TUNING'
        : 'SCENE_SIMULATION';
  const title = log.isEthicalViolation
    ? '伦理沙盘演练'
    : isOdyssey
      ? '控制奥德赛演练'
      : ['PID', 'P', 'PD', 'MANUAL'].includes(mode.toUpperCase())
        ? `仿真调参（${mode}）`
        : `仿真实验（${mode || '未标注模式'}）`;
  return {
    id: `simulation:${log.id}`,
    title,
    type,
    score: typeof log.score === 'number' && Number.isFinite(log.score) ? log.score : null,
    createdAt: log.createdAt.toISOString(),
    sourceLabel: isOdyssey ? '控制奥德赛' : '仿真训练',
    resultAuthority: log.odysseyCompletedAt ? 'official' : 'preview',
    sourceKind: 'simulation_log',
    navigation: isOdyssey
      ? { href: '/interactive-learning/control-odyssey', label: '回到控制奥德赛' }
      : null,
    parameters: pidParameters(log.inputParams),
  };
}

function readLegacyRunId(inputParams: unknown): string | null {
  if (!inputParams || typeof inputParams !== 'object') return null;
  const value = (inputParams as Record<string, unknown>).runId;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readArtifactOdysseyRunId(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const value = (payload as Record<string, unknown>).odysseyRunId;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

async function readExperimentCollection(
  userId: string,
  db: PrismaClient,
): Promise<AiCollectionEnvelope<AiExperimentItem>> {
  try {
    // 来源白名单（Codex R1 review）：只有场景/工作台运行是学生学习证据；
    // arena_preview 与 agent_experiment 等其余 runKind 不得混入实验档案。
    const runWhere = {
      ownerUserId: userId,
      runKind: 'scene_simulation',
      sourceDomain: 'simulation_scene',
      status: 'completed',
      completedAt: { not: null } as const,
    };
    const [runs, runTotal, simulations, simulationTotal, arenaSubmissions, arenaTotal] = await Promise.all([
      db.simulationRun.findMany({
        where: runWhere,
        orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
        take: COLLECTION_ITEM_LIMIT,
        select: {
          id: true, runKind: true, sourceDomain: true, sourceRefId: true,
          resourceId: true, summary: true, completedAt: true,
        },
      }),
      db.simulationRun.count({ where: runWhere }),
      db.simulationLog.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: COLLECTION_ITEM_LIMIT,
        select: {
          id: true, controlMode: true, inputParams: true, score: true,
          isEthicalViolation: true, odysseyRunId: true, odysseyCompletedAt: true, createdAt: true,
        },
      }),
      db.simulationLog.count({ where: { userId } }),
      db.arenaSubmission.findMany({
        where: { userId },
        orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
        take: COLLECTION_ITEM_LIMIT,
        select: {
          id: true, taskId: true, method: true, score: true, valid: true, submittedAt: true,
          controllerArtifact: { select: { payload: true } },
        },
      }),
      db.arenaSubmission.count({ where: { userId } }),
    ]);

    // 跨来源活动身份解析（Issue #1912）：标准运行身份优先；奥德赛活动用
    // odysseyRunId 经 scene-trace 身份键确定性桥接，不以标题/时间猜测。
    const identityBySourceRef = new Map(runs.map((run) => [run.sourceRefId, `simulation-run:${run.id}`]));
    const resolveOdysseyIdentity = (runId: string): string =>
      identityBySourceRef.get(sceneTraceSourceRefId(userId, runId)) ?? `odyssey:${runId}`;

    const claimedIdentities = new Set<string>();
    const itemByIdentity = new Map<string, AiExperimentItem>();
    const claim = (identity: string, item: AiExperimentItem) => {
      claimedIdentities.add(identity);
      itemByIdentity.set(identity, item);
      return item;
    };
    // 桥接记录归并进代表项（Codex R1/R2 review）：保留最高适用结果权威、
    // 已验证导航与完整来源链路——代表项身份不变，被归并来源及其导航
    // 以 bridgedSources 展示，正式结果与可达入口不因合并丢失。
    // 正式桥接记录的分数总是更新代表项（arena 最后归并，正式评测优先）。
    const mergeIntoRepresentative = (
      identity: string,
      bridged: {
        official: boolean;
        score: number | null;
        sourceLabel: string;
        navigation: { href: string; label: string } | null;
      },
    ) => {
      const representative = itemByIdentity.get(identity);
      if (!representative) return;
      if (bridged.official) {
        representative.resultAuthority = 'official';
        if (typeof bridged.score === 'number') representative.score = bridged.score;
      }
      representative.bridgedSources = [
        ...(representative.bridgedSources ?? []),
        { sourceLabel: bridged.sourceLabel, navigation: bridged.navigation },
      ];
    };

    for (const run of runs) {
      claim(`simulation-run:${run.id}`, simulationRunItem(run));
    }
    for (const log of simulations) {
      const odysseyRunId = log.odysseyRunId ?? readLegacyRunId(log.inputParams);
      const identity = odysseyRunId ? resolveOdysseyIdentity(odysseyRunId) : `simulation:${log.id}`;
      if (claimedIdentities.has(identity)) {
        mergeIntoRepresentative(identity, {
          official: Boolean(log.odysseyCompletedAt),
          score: typeof log.score === 'number' && Number.isFinite(log.score) ? log.score : null,
          sourceLabel: '控制奥德赛',
          navigation: odysseyRunId
            ? { href: '/interactive-learning/control-odyssey', label: '回到控制奥德赛' }
            : null,
        });
        continue;
      }
      claim(identity, simulationLogItem(log, odysseyRunId));
    }
    for (const submission of arenaSubmissions) {
      const odysseyRunId = readArtifactOdysseyRunId(submission.controllerArtifact?.payload);
      const identity = odysseyRunId ? resolveOdysseyIdentity(odysseyRunId) : `arena:${submission.id}`;
      const arenaNavigation = { href: `/arena/challenges/${encodeURIComponent(submission.taskId)}`, label: '查看挑战详情' };
      if (claimedIdentities.has(identity)) {
        mergeIntoRepresentative(identity, {
          official: submission.valid,
          score: submission.valid && Number.isFinite(submission.score) ? submission.score : null,
          sourceLabel: 'Arena 竞技场',
          navigation: arenaNavigation,
        });
        continue;
      }
      claim(identity, {
        id: `arena:${submission.id}`,
        title: `Arena 提交（${submission.method}）`,
        type: 'ARENA_SUBMISSION',
        score: submission.valid && Number.isFinite(submission.score) ? submission.score : null,
        createdAt: submission.submittedAt.toISOString(),
        sourceLabel: 'Arena 竞技场',
        resultAuthority: submission.valid ? 'official' : 'preview',
        sourceKind: 'arena',
        navigation: arenaNavigation,
      });
    }

    const ordered = orderByOccurrence([...itemByIdentity.values()], (item) => item.createdAt)
      .slice(0, COLLECTION_ITEM_LIMIT);
    // 总数语义（Codex R2 review）：任一来源窗口截断时，窗口外的跨来源
    // 重复无法在不全量扫描下去重——此时不声称精确总数（null，展示端
    // 回退窗口数）；未截断时给出精确的去重活动总数，同一活动只计一次。
    const truncated = runTotal > runs.length
      || simulationTotal > simulations.length
      || arenaTotal > arenaSubmissions.length;
    const total = truncated ? null : itemByIdentity.size;
    return ordered.length > 0
      ? availableCollection(ordered, total, AI_WORKSHOP_COLLECTION_ACTIONS.experiments)
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
