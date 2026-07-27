/**
 * 历史仿真任务证据 dry-run
 *
 * 使用实时路径相同的当前仿真任务目录、稳定产物身份和来源白名单
 * 生成候选与跳过原因。不直接重建画像。
 *
 * 候选必须同时具有学生、发生时间、可确认产品语义和可解析到当前目录的任务身份。
 * 缺失具名任务身份但保留稳定来源语义的记录进入通用虚拟仿真项。
 * 已下线或不再可解析的具名任务记录以明确原因跳过。
 */

import type { SimulationTaskSource } from './simulation-task-catalog';
import {
  GENERIC_VIRTUAL_SIMULATION_TASK_KEY,
  getSimulationTaskCatalog,
  resolveArenaTaskKey,
  resolveOdysseyTaskKey,
  resolveVirtualSimulationTaskKey,
} from './simulation-task-catalog';
import type { TaskEvidenceTier } from './simulation-task-evidence';
import {
  buildArtifactKey,
  buildSemanticFingerprint,
  tierAtLeast,
} from './simulation-task-evidence';

// ─── Types ───────────────────────────────────────────────────────────────────

export type HistoricalSkipReason =
  | 'missing-student'
  | 'missing-occurred-at'
  | 'missing-product-semantics'
  | 'task-no-longer-published'
  | 'task-unresolvable'
  | 'ineligible-event-type'
  | 'param-change-only'
  | 'insufficient-context'
  | 'teacher-or-admin-action'
  | 'duplicate-artifact';

export interface HistoricalRecord {
  /** 记录 ID */
  id: string;
  /** 学生用户 ID（可能缺失） */
  userId?: string | null;
  /** 发生时间（可能缺失） */
  occurredAt?: string | null;
  /** 来源 */
  source: SimulationTaskSource;
  /** 事件类型或产品语义标记 */
  eventType?: string | null;
  /** 具名任务 ID（可能缺失或已下线） */
  namedTaskId?: string | null;
  /** 奥德赛关卡 ID */
  odysseyLevelId?: string | null;
  /** 是否为 Arena 指派 */
  isArenaAssigned?: boolean;
  /** Arena 任务 ID */
  arenaTaskId?: string | null;
  /** 来源产物 ID */
  sourceArtifactId?: string | null;
  /** 推断的证据层级 */
  tier?: TaskEvidenceTier;
  /** 语义指纹输入 */
  fingerprint?: {
    plantRef?: string;
    modelRef?: string;
    controllerConfigHash?: string;
    keyInputHash?: string;
  };
  /** 是否为参数调整记录 */
  isParamChangeOnly?: boolean;
  /** 控制工作台是否保存了设计或可复核结果 */
  hasPersistedDesign?: boolean;
  /** 控制工作台来源是否定义了质量目标 */
  hasQualityTarget?: boolean;
  /** 控制工作台结果是否满足质量目标 */
  meetsQualityTarget?: boolean;
  /** Arena 提交是否已被接受 */
  accepted?: boolean;
  /** Arena 关联官方评测是否有效 */
  evaluationValid?: boolean;
  /** 奥德赛是否具有持久化通关状态 */
  persistentClear?: boolean;
  /** 角色 */
  actorRole?: string | null;
}

export interface HistoricalCandidate {
  recordId: string;
  taskKey: string;
  source: SimulationTaskSource;
  artifactKey: string;
  tier: TaskEvidenceTier;
  semanticFingerprint: string;
  occurredAt: string;
  userId: string;
}

export interface HistoricalSkip {
  recordId: string;
  reason: HistoricalSkipReason;
  detail?: string;
}

export interface HistoricalDryRunResult {
  generatedAt: string;
  catalogVersion: string;
  totalRecords: number;
  candidates: HistoricalCandidate[];
  skips: HistoricalSkip[];
  affectedStudents: number;
  candidateCountByTask: Record<string, number>;
  skipCountByReason: Record<string, number>;
}

// ─── Eligible Events (same as real-time) ─────────────────────────────────────

const HISTORICAL_ELIGIBLE_EVENTS = new Set([
  'simulation_finish',
  'simulation_session_complete',
  'design_session_complete',
  'workspace_submission',
  'arena_submit',
  'arena_evaluation_complete',
  'odyssey_level_clear',
  'odyssey_persistent_clear',
]);

// ─── Dry Run Engine ──────────────────────────────────────────────────────────

function resolveTaskKeyForRecord(record: HistoricalRecord): { taskKey: string | null; skipReason?: HistoricalSkipReason } {
  switch (record.source) {
    case 'arena': {
      const taskId = record.arenaTaskId ?? record.namedTaskId;
      if (!taskId) return { taskKey: null, skipReason: 'task-unresolvable' };
      const key = resolveArenaTaskKey(taskId);
      if (!key) return { taskKey: null, skipReason: 'task-no-longer-published' };
      return { taskKey: key };
    }

    case 'odyssey': {
      const levelId = record.odysseyLevelId ?? record.namedTaskId;
      if (!levelId) return { taskKey: null, skipReason: 'task-unresolvable' };
      const key = resolveOdysseyTaskKey(levelId, record.isArenaAssigned ?? false);
      if (!key) return { taskKey: null, skipReason: 'task-no-longer-published' };
      if (record.isArenaAssigned && key !== `arena:${record.arenaTaskId ?? ''}`) {
        return { taskKey: null, skipReason: 'task-unresolvable' };
      }
      return { taskKey: key };
    }

    case 'virtual-simulation': {
      const key = resolveVirtualSimulationTaskKey(record.namedTaskId ?? null);
      if (!key) return { taskKey: null, skipReason: 'task-no-longer-published' };
      return { taskKey: key };
    }

    case 'control-workbench': {
      // 控制工作台历史统一归入通用任务
      return { taskKey: 'control-workbench:free' };
    }

    default:
      return { taskKey: null, skipReason: 'task-unresolvable' };
  }
}

function validateSourceSemantics(record: HistoricalRecord): string | null {
  switch (record.source) {
    case 'arena':
      if (record.eventType !== 'arena_submit') return 'arena-evaluation-without-accepted-submission';
      if (record.accepted !== true) return 'arena-submission-not-accepted';
      if (record.evaluationValid !== true) return 'arena-evaluation-not-valid';
      return null;
    case 'odyssey':
      if (record.isArenaAssigned) return 'arena-assigned-requires-accepted-submission';
      if (record.persistentClear !== true) return 'odyssey-clear-not-persisted';
      return null;
    case 'control-workbench':
      if (record.hasPersistedDesign !== true) return 'missing-persisted-design';
      if (record.hasQualityTarget && record.meetsQualityTarget !== true) return 'quality-target-not-met';
      return null;
    case 'virtual-simulation':
      return null;
    default:
      return 'unsupported-source';
  }
}

/**
 * 执行历史任务证据 dry-run。
 * 输出候选任务归属、通用虚拟仿真回退、跳过原因和受影响学生统计。
 * 不直接重建画像。
 */
export function runHistoricalTaskEvidenceDryRun(
  records: readonly HistoricalRecord[],
  generatedAt?: string,
): HistoricalDryRunResult {
  const candidates: HistoricalCandidate[] = [];
  const skips: HistoricalSkip[] = [];
  const affectedStudents = new Set<string>();
  const candidateIndexByArtifactKey = new Map<string, number>();
  const candidateCountByTask: Record<string, number> = {};
  const skipCountByReason: Record<string, number> = {};

  for (const record of records) {
    // 1. 验证学生归属
    if (!record.userId || record.userId.trim().length === 0) {
      pushSkip(skips, skipCountByReason, record.id, 'missing-student');
      continue;
    }

    // 2. 验证角色
    if (record.actorRole && record.actorRole !== 'student') {
      pushSkip(skips, skipCountByReason, record.id, 'teacher-or-admin-action', `role:${record.actorRole}`);
      continue;
    }

    // 3. 验证发生时间
    if (
      !record.occurredAt
      || record.occurredAt.trim().length === 0
      || !Number.isFinite(new Date(record.occurredAt).getTime())
    ) {
      pushSkip(skips, skipCountByReason, record.id, 'missing-occurred-at');
      continue;
    }

    // 4. 验证产品语义
    if (record.isParamChangeOnly) {
      pushSkip(skips, skipCountByReason, record.id, 'param-change-only');
      continue;
    }

    if (record.eventType && !HISTORICAL_ELIGIBLE_EVENTS.has(record.eventType)) {
      pushSkip(skips, skipCountByReason, record.id, 'ineligible-event-type', `event:${record.eventType}`);
      continue;
    }

    if (!record.eventType && !record.tier) {
      pushSkip(skips, skipCountByReason, record.id, 'missing-product-semantics');
      continue;
    }

    const sourceSemanticError = validateSourceSemantics(record);
    if (sourceSemanticError) {
      pushSkip(skips, skipCountByReason, record.id, 'insufficient-context', sourceSemanticError);
      continue;
    }

    // 5. 验证来源产物 ID
    if (!record.sourceArtifactId || record.sourceArtifactId.trim().length === 0) {
      pushSkip(skips, skipCountByReason, record.id, 'insufficient-context', 'missing-source-artifact-id');
      continue;
    }

    // 6. 解析任务键
    const { taskKey, skipReason } = resolveTaskKeyForRecord(record);
    if (!taskKey) {
      pushSkip(skips, skipCountByReason, record.id, skipReason ?? 'task-unresolvable');
      continue;
    }

    // 7. 构建候选
    const tier = record.tier ?? (
      record.source === 'arena'
        ? 'submission'
        : record.source === 'odyssey'
          ? 'clear'
          : record.source === 'control-workbench' && record.eventType === 'workspace_submission'
            ? 'submission'
            : 'run'
    );
    const artifactKey = buildArtifactKey({
      studentUserId: record.userId,
      sourceFamily: record.source,
      taskKey,
      normalizedSourceArtifactId: record.sourceArtifactId,
    });

    const semanticFingerprint = buildSemanticFingerprint(record.fingerprint ?? {});
    const candidate: HistoricalCandidate = {
      recordId: record.id,
      taskKey,
      source: record.source,
      artifactKey,
      tier,
      semanticFingerprint,
      occurredAt: record.occurredAt,
      userId: record.userId,
    };

    // 8. 幂等去重：同一产物只保留最高层级，不能由输入顺序决定。
    const existingIndex = candidateIndexByArtifactKey.get(artifactKey);
    if (existingIndex !== undefined) {
      const existing = candidates[existingIndex];
      if (tierAtLeast(existing.tier, candidate.tier)) {
        pushSkip(skips, skipCountByReason, record.id, 'duplicate-artifact', artifactKey);
        continue;
      }
      pushSkip(skips, skipCountByReason, existing.recordId, 'duplicate-artifact', artifactKey);
      candidates[existingIndex] = candidate;
      continue;
    }
    candidateIndexByArtifactKey.set(artifactKey, candidates.length);
    candidates.push(candidate);

    affectedStudents.add(record.userId);
    candidateCountByTask[taskKey] = (candidateCountByTask[taskKey] ?? 0) + 1;
  }

  return {
    generatedAt: generatedAt ?? new Date().toISOString(),
    catalogVersion: 'simulation-task-catalog.v1',
    totalRecords: records.length,
    candidates,
    skips,
    affectedStudents: affectedStudents.size,
    candidateCountByTask,
    skipCountByReason,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pushSkip(
  skips: HistoricalSkip[],
  countByReason: Record<string, number>,
  recordId: string,
  reason: HistoricalSkipReason,
  detail?: string,
): void {
  skips.push({ recordId, reason, detail });
  countByReason[reason] = (countByReason[reason] ?? 0) + 1;
}
