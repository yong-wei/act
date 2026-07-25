/**
 * 仿真任务完成规则与去重
 *
 * - 以学生、来源、任务和规范化来源产物身份构成幂等键
 * - 任务证据以零画像权重保存，按证据层级选择唯一最高任务证据
 * - 具名或通用虚拟仿真及自由控制工作台使用三个不同有效运行规则
 * - 语义指纹排除完全重复运行
 * - Arena 由已接受提交及挑战完成谓词决定
 * - 奥德赛由持久化通关状态决定
 */

import type { SimulationTaskCatalogEntry } from './simulation-task-catalog';
import {
  GENERIC_TASK_DISTINCT_RUNS_REQUIRED,
  getSimulationTaskByKey,
  isDistinctRunsTask,
} from './simulation-task-catalog';
import type {
  GovernedTaskEvidenceContext,
  SemanticFingerprintInput,
} from './simulation-task-evidence';
import { buildSemanticFingerprint, isDistinctRun } from './simulation-task-evidence';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TaskCompletionState {
  taskKey: string;
  /** 任务是否已达到满分完成 */
  attained: boolean;
  /** 有效不同运行数（仅 distinct-valid-runs 任务） */
  distinctValidRuns: number;
  /** 所需不同运行数 */
  requiredRuns: number;
  /** 最高证据层级 */
  highestTier: string | null;
  /** 有效证据的 artifactKey 列表 */
  effectiveArtifactKeys: string[];
}

export interface TaskCompletionEvaluation {
  taskKey: string;
  attained: boolean;
  reason: string;
}

// ─── Distinct Runs Evaluation ────────────────────────────────────────────────

/**
 * 从一组任务证据中提取不同有效运行数。
 * 使用语义指纹判定不同运行：完全相同指纹的重放或重复不计入。
 */
export function countDistinctValidRuns(
  evidenceList: readonly GovernedTaskEvidenceContext[],
): number {
  const seenFingerprints = new Set<string>();
  for (const evidence of evidenceList) {
    if (evidence.portraitWeight !== 0) continue; // 安全检查
    if (evidence.sourceValidity !== 'valid') continue;
    if (evidence.completionAuthority !== 'validated-distinct-runs') continue;
    if (evidence.tier === 'process') continue;
    seenFingerprints.add(evidence.semanticFingerprint);
  }
  return seenFingerprints.size;
}

/**
 * 判断一组语义指纹是否满足"不同运行"要求。
 */
export function hasDistinctRuns(
  fingerprints: readonly SemanticFingerprintInput[],
  requiredCount: number = GENERIC_TASK_DISTINCT_RUNS_REQUIRED,
): boolean {
  const seen = new Set<string>();
  for (const fp of fingerprints) {
    seen.add(buildSemanticFingerprint(fp));
    if (seen.size >= requiredCount) return true;
  }
  return false;
}

/**
 * 判断新指纹相对于已有指纹集合是否为不同运行。
 */
export function isNovelRun(
  existingFingerprints: readonly string[],
  incoming: SemanticFingerprintInput,
): boolean {
  const incomingFp = buildSemanticFingerprint(incoming);
  return !existingFingerprints.includes(incomingFp);
}

// ─── Task Completion Evaluation ──────────────────────────────────────────────

/**
 * 评估单个任务的完成状态。
 */
export function evaluateTaskCompletion(
  taskKey: string,
  evidenceList: readonly GovernedTaskEvidenceContext[],
): TaskCompletionEvaluation {
  const entry = getSimulationTaskByKey(taskKey);
  if (!entry) {
    return { taskKey, attained: false, reason: 'task-not-in-catalog' };
  }

  // 过滤属于该任务的有效证据
  const taskEvidence = evidenceList.filter(
    (e) => e.taskKey === taskKey
      && e.portraitWeight === 0
      && e.sourceValidity === 'valid',
  );

  if (taskEvidence.length === 0) {
    return { taskKey, attained: false, reason: 'no-evidence' };
  }

  switch (entry.completionRule.kind) {
    case 'arena-accepted-submission': {
      // Arena 任务由已接受提交决定
      const hasSubmission = taskEvidence.some(
        (e) => e.completionAuthority === 'arena-accepted-submission'
          && e.tier === 'submission',
      );
      return {
        taskKey,
        attained: hasSubmission,
        reason: hasSubmission ? 'accepted-submission-exists' : 'no-accepted-submission',
      };
    }

    case 'odyssey-persistent-clear': {
      // 奥德赛任务由持久化通关决定
      const hasClear = taskEvidence.some(
        (e) => e.completionAuthority === 'odyssey-persistent-clear'
          && e.tier === 'clear',
      );
      return {
        taskKey,
        attained: hasClear,
        reason: hasClear ? 'persistent-clear-exists' : 'no-persistent-clear',
      };
    }

    case 'distinct-valid-runs': {
      const required = entry.completionRule.requiredCount;
      const distinct = countDistinctValidRuns(taskEvidence.filter(
        (evidence) => evidence.completionAuthority === 'validated-distinct-runs',
      ));
      return {
        taskKey,
        attained: distinct >= required,
        reason: distinct >= required
          ? `distinct-runs-met:${distinct}/${required}`
          : `distinct-runs-insufficient:${distinct}/${required}`,
      };
    }

    default:
      return { taskKey, attained: false, reason: 'unknown-completion-rule' };
  }
}

// ─── Batch Completion State ──────────────────────────────────────────────────

/**
 * 为单个学生计算所有任务的完成状态。
 */
export function buildStudentTaskCompletionStates(
  allEvidence: readonly GovernedTaskEvidenceContext[],
): Map<string, TaskCompletionState> {
  const byTask = new Map<string, GovernedTaskEvidenceContext[]>();

  for (const evidence of allEvidence) {
    const list = byTask.get(evidence.taskKey) ?? [];
    list.push(evidence);
    byTask.set(evidence.taskKey, list);
  }

  const states = new Map<string, TaskCompletionState>();

  for (const [taskKey, evidenceList] of byTask) {
    const entry = getSimulationTaskByKey(taskKey);
    const evaluation = evaluateTaskCompletion(taskKey, evidenceList);
    const requiredRuns = entry && entry.completionRule.kind === 'distinct-valid-runs'
      ? entry.completionRule.requiredCount
      : 0;

    states.set(taskKey, {
      taskKey,
      attained: evaluation.attained,
      distinctValidRuns: countDistinctValidRuns(evidenceList),
      requiredRuns,
      highestTier: evidenceList.length > 0
        ? evidenceList.reduce((max, e) => {
            const order: Record<string, number> = { process: 0, run: 1, evaluation: 2, submission: 3, clear: 4 };
            return (order[e.tier] ?? 0) > (order[max] ?? 0) ? e.tier : max;
          }, evidenceList[0].tier)
        : null,
      effectiveArtifactKeys: deduplicateByArtifactKey(evidenceList).map((e) => e.artifactKey),
    });
  }

  return states;
}

// ─── Artifact Deduplication ──────────────────────────────────────────────────

/**
 * 按 artifactKey 去重，每个 artifactKey 只保留最高层级证据。
 */
export function deduplicateByArtifactKey(
  evidenceList: readonly GovernedTaskEvidenceContext[],
): GovernedTaskEvidenceContext[] {
  const byArtifact = new Map<string, GovernedTaskEvidenceContext>();
  const tierOrder: Record<string, number> = { process: 0, run: 1, evaluation: 2, submission: 3, clear: 4 };

  for (const evidence of evidenceList) {
    const existing = byArtifact.get(evidence.artifactKey);
    if (!existing || (tierOrder[evidence.tier] ?? 0) > (tierOrder[existing.tier] ?? 0)) {
      byArtifact.set(evidence.artifactKey, evidence);
    }
  }

  return Array.from(byArtifact.values());
}

/**
 * 计算单个学生在指定任务上的满分完成比例。
 * 返回 0-1 之间的值。
 */
export function computeTaskAttainmentRatio(
  taskKeys: readonly string[],
  allEvidence: readonly GovernedTaskEvidenceContext[],
): number {
  if (taskKeys.length === 0) return 0;
  let attainedCount = 0;
  for (const taskKey of taskKeys) {
    const evaluation = evaluateTaskCompletion(taskKey, allEvidence);
    if (evaluation.attained) attainedCount++;
  }
  return attainedCount / taskKeys.length;
}
