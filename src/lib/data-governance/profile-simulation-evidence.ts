import { sceneTraceSourceRefId } from '@/lib/data-governance/simulation-scene-run-persistence';
import {
  PRACTICE_DISPLAY_BOUNDARY,
  PREVIEW_DISPLAY_BOUNDARY,
} from '@/lib/practice-lab-run-contract/types';
import { getAllRegisteredResourceMetadata } from '@/lib/resource-registry-metadata';

/**
 * 普通个人中心仿真证据投影（Issue #1991）。
 *
 * canonical 来源与 AI 实验档案（#1912）同一白名单口径：仅
 * `scene_simulation` + `simulation_scene` + `completed` 的学生自有运行；
 * arena_preview / agent_experiment 等由竞技场画像与 AI 工坊专门视图消费，
 * 不在个人中心重复统计。旧 `SimulationLog`（控制奥德赛链路）做兼容回读，
 * 并按 #1912 的确定性身份键 `sceneTraceSourceRefId(userId, odysseyRunId)`
 * 桥接去重：同一底层产物只保留 canonical 代表项，不以时间或数值猜测等价。
 */

export type ProfileSimulationEvidenceState = 'available' | 'empty' | 'unavailable';

export interface ProfileSimulationEvidenceItem {
  id: string;
  sourceKind: 'canonical-run' | 'legacy-log';
  sourceRefId: string | null;
  title: string;
  sourceLabel: string;
  resultAuthority: 'preview' | 'official';
  score: number | null;
  durationSeconds: number | null;
  parameters: Record<string, number>;
  occurredAt: string;
  href: string | null;
}

export interface ProfileSimulationEvidenceProjection {
  state: ProfileSimulationEvidenceState;
  /** 去重后的可展示训练总数；读取失败时为 null，不伪造 0。 */
  total: number | null;
  /** 有时长记录贡献的秒数总和；无任何记录携带时长时为 null。 */
  totalDurationSeconds: number | null;
  /** 有得分记录的均分；无任何记录携带得分时为 null。 */
  averageScore: number | null;
  /** 最近活动（时间倒序，最多 RECENT_LIMIT 条）。 */
  items: ProfileSimulationEvidenceItem[];
}

export const PROFILE_SIMULATION_RECENT_LIMIT = 20;

export const PROFILE_SIMULATION_RUN_WHERE = {
  ownerUserId: '',
  runKind: 'scene_simulation',
  sourceDomain: 'simulation_scene',
  status: 'completed',
} as const;

interface ProfileSimulationEvidenceDb {
  simulationRun: {
    findMany: (args?: any) => Promise<CanonicalRunRow[]>;
  };
  simulationLog: {
    findMany: (args?: any) => Promise<LegacyLogRow[]>;
  };
}

interface CanonicalRunRow {
  id: string;
  ownerUserId: string | null;
  runKind: string;
  sourceDomain: string;
  sourceRefId: string;
  resourceId: string | null;
  status: string;
  summary: unknown;
  completedAt: Date | null;
  createdAt: Date;
}

interface LegacyLogRow {
  id: string;
  userId: string;
  controlMode: string;
  inputParams: unknown;
  score: number | null;
  duration: number | null;
  isEthicalViolation: boolean;
  odysseyRunId: string | null;
  odysseyCompletedAt: Date | null;
  createdAt: Date;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

/** 非官方展示边界值域：与运行合同真源绑定，preview（arena 预览）或
 * practice（场景/工作台练习）均可进入个人学习记录，official 一律排除。 */
const NON_OFFICIAL_DISPLAY_VISIBILITIES = new Set<string>([
  PREVIEW_DISPLAY_BOUNDARY.evaluationVisibility,
  PRACTICE_DISPLAY_BOUNDARY.evaluationVisibility,
]);

/** canonical summary 的展示资格：完整 metrics + 显式非官方显示边界。 */
function canonicalRunDisplayable(row: CanonicalRunRow): boolean {
  if (row.status !== 'completed') return false;
  if (row.runKind !== 'scene_simulation' || row.sourceDomain !== 'simulation_scene') return false;
  const summary = record(row.summary);
  if (Object.keys(record(summary.metrics)).length === 0) return false;
  const runContract = record(summary.runContract);
  return NON_OFFICIAL_DISPLAY_VISIBILITIES.has(String(runContract.evaluationVisibility))
    && runContract.officialEligible === false;
}

/** 学生安全参数白名单：顶层或 odyssey snapshot 的嵌套 pidParams 均可，其余键不透出。 */
function pidParameters(source: unknown): Record<string, number> {
  const input = record(source);
  const nested = record(input.pidParams);
  const parameters: Record<string, number> = {};
  for (const key of ['kp', 'ki', 'kd'] as const) {
    const value = finiteNumber(nested[key] ?? input[key]);
    if (value !== null) parameters[key] = value;
  }
  return parameters;
}

function registeredResourceHref(resourceId: string | null): string | null {
  if (!resourceId) return null;
  const metadata = getAllRegisteredResourceMetadata().find((entry) => entry.id === resourceId);
  const href = metadata?.launchTarget ?? metadata?.renderTarget ?? null;
  return href && href.startsWith('/') ? href : null;
}

function canonicalRunItem(row: CanonicalRunRow): ProfileSimulationEvidenceItem {
  const metrics = record(record(row.summary).metrics);
  const isControlWorkbench = row.sourceRefId.startsWith('control-workbench:');
  const occurredAt = row.completedAt ?? row.createdAt;
  return {
    id: `simulation-run:${row.id}`,
    sourceKind: 'canonical-run',
    sourceRefId: row.sourceRefId,
    title: isControlWorkbench
      ? '控制工作台分析'
      : `场景仿真实验（${row.resourceId ?? row.runKind}）`,
    sourceLabel: isControlWorkbench ? '控制工作台' : '场景仿真',
    resultAuthority: 'preview',
    score: finiteNumber(metrics.score),
    durationSeconds: finiteNumber(metrics.duration),
    parameters: pidParameters(metrics),
    occurredAt: occurredAt.toISOString(),
    href: isControlWorkbench
      ? '/interactive-learning/control-workbench'
      : registeredResourceHref(row.resourceId),
  };
}

function legacyOdysseyRunId(log: LegacyLogRow): string | null {
  return nonEmptyString(log.odysseyRunId)
    ?? nonEmptyString(record(log.inputParams).runId);
}

/** 未完成的奥德赛日志不计入：saveScore 先落 pending 记录（odysseyRunId 已
 * 写、odysseyCompletedAt 为空），积分与 Arena 桥接结束后才写完成时间。带
 * 奥德赛身份且未完成的记录不是完成训练事实；无奥德赛身份的历史日志是
 * 旧链路一次写入的完成记录，保持计入。 */
function legacyLogDisplayable(log: LegacyLogRow): boolean {
  const odysseyRunId = legacyOdysseyRunId(log);
  if (!odysseyRunId) return true;
  return log.odysseyCompletedAt !== null;
}

function legacyLogItem(log: LegacyLogRow): ProfileSimulationEvidenceItem {
  const mode = String(log.controlMode ?? '').trim();
  const odysseyRunId = legacyOdysseyRunId(log);
  const isOdyssey = Boolean(odysseyRunId);
  const isPidMode = ['PID', 'P', 'PD', 'MANUAL'].includes(mode.toUpperCase());
  const title = log.isEthicalViolation
    ? '伦理沙盘演练'
    : isOdyssey
      ? '控制奥德赛演练'
      : isPidMode
        ? `仿真调参（${mode.toUpperCase()}）`
        : `仿真实验（${mode || '未标注模式'}）`;
  return {
    id: `simulation:${log.id}`,
    sourceKind: 'legacy-log',
    sourceRefId: odysseyRunId ? sceneTraceSourceRefId(log.userId, odysseyRunId) : null,
    title,
    sourceLabel: log.isEthicalViolation
      ? '伦理沙盘'
      : isOdyssey
        ? '控制奥德赛'
        : '仿真训练',
    resultAuthority: log.odysseyCompletedAt ? 'official' : 'preview',
    score: finiteNumber(log.score),
    durationSeconds: finiteNumber(log.duration),
    parameters: pidParameters(log.inputParams),
    occurredAt: log.createdAt.toISOString(),
    href: isOdyssey
      ? '/interactive-learning/control-odyssey'
      : isPidMode
        ? '/simulations/destroyer'
        : null,
  };
}

/**
 * legacy→canonical 归并去重：legacy 日志的确定性身份键命中 canonical
 * sourceRefId 时视为同一底层产物，只保留 canonical 代表项。canonical 侧
 * 身份唯一性由 `@@unique([sourceDomain, sourceRefId])` 保证；legacy 侧仅对
 * 兜底 inputParams.runId 路径额外防重（该路径无数据库唯一约束）。
 */
function bridgeDeduplicated(
  items: ProfileSimulationEvidenceItem[],
): ProfileSimulationEvidenceItem[] {
  const canonicalIdentities = new Set(
    items.filter((item) => item.sourceKind === 'canonical-run' && item.sourceRefId)
      .map((item) => item.sourceRefId as string),
  );
  const seenLegacyIdentities = new Set<string>();
  return items.filter((item) => {
    if (item.sourceKind !== 'legacy-log') return true;
    const identity = item.sourceRefId;
    if (!identity) return true;
    if (canonicalIdentities.has(identity)) return false;
    if (seenLegacyIdentities.has(identity)) return false;
    seenLegacyIdentities.add(identity);
    return true;
  });
}

export async function readProfileSimulationEvidence(
  db: ProfileSimulationEvidenceDb,
  userId: string,
): Promise<ProfileSimulationEvidenceProjection> {
  try {
    const [runRows, logRows] = await Promise.all([
      db.simulationRun.findMany({
        where: { ...PROFILE_SIMULATION_RUN_WHERE, ownerUserId: userId },
        orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true, ownerUserId: true, runKind: true, sourceDomain: true,
          sourceRefId: true, resourceId: true, status: true, summary: true,
          completedAt: true, createdAt: true,
        },
      }),
      db.simulationLog.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true, userId: true, controlMode: true, inputParams: true,
          score: true, duration: true, isEthicalViolation: true,
          odysseyRunId: true, odysseyCompletedAt: true, createdAt: true,
        },
      }),
    ]);

    const items = bridgeDeduplicated([
      ...runRows
        .filter((row) => row.ownerUserId === userId && canonicalRunDisplayable(row))
        .map(canonicalRunItem),
      ...logRows
        .filter((row) => row.userId === userId && legacyLogDisplayable(row))
        .map(legacyLogItem),
    ]).sort((left, right) =>
      Date.parse(right.occurredAt) - Date.parse(left.occurredAt)
      || left.id.localeCompare(right.id),
    );

    const scored = items.filter((item) => item.score !== null) as Array<{ score: number }>;
    const timed = items.filter((item) => item.durationSeconds !== null) as Array<{ durationSeconds: number }>;
    const total = items.length;

    return {
      state: total > 0 ? 'available' : 'empty',
      total,
      totalDurationSeconds: timed.length > 0
        ? timed.reduce((sum, item) => sum + item.durationSeconds, 0)
        : null,
      averageScore: scored.length > 0
        ? Math.round(scored.reduce((sum, item) => sum + item.score, 0) / scored.length)
        : null,
      items: items.slice(0, PROFILE_SIMULATION_RECENT_LIMIT),
    };
  } catch {
    return {
      state: 'unavailable',
      total: null,
      totalDurationSeconds: null,
      averageScore: null,
      items: [],
    };
  }
}
