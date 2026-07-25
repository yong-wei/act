/**
 * 仿真任务证据实时物化
 *
 * 统一虚拟仿真、控制工作台、Arena 和奥德赛的实时写入边界：
 * - 过程产物只形成任务进度
 * - 正式通关或已接受提交按来源规则决定任务达成
 * - 同一学生、同一来源、同一任务的同一产物只保留最高层级
 * - 界面浏览与孤立参数调整不形成独立事实
 * - 教师预览、管理员操作和未确认归属事件不写入学生任务证据
 */

import type { SimulationTaskSource } from './simulation-task-catalog';
import {
  GENERIC_CONTROL_WORKBENCH_TASK_KEY,
  GENERIC_VIRTUAL_SIMULATION_TASK_KEY,
  resolveArenaTaskKey,
  resolveOdysseyTaskKey,
  resolveVirtualSimulationTaskKey,
} from './simulation-task-catalog';
import type {
  BuildTaskEvidenceInput,
  GovernedTaskEvidenceContext,
  SemanticFingerprintInput,
  TaskEvidenceSummary,
  TaskEvidenceTier,
} from './simulation-task-evidence';
import {
  buildGovernedTaskEvidence,
  isTaskEvidenceEligibleEvent,
  selectHighestTierEvidence,
} from './simulation-task-evidence';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TaskMaterializationActor {
  userId: string;
  role: 'student' | 'teacher' | 'admin' | 'guest';
}

export interface TaskMaterializationResult {
  status: 'accepted' | 'rejected' | 'deduplicated';
  evidence?: GovernedTaskEvidenceContext;
  reason?: string;
}

export interface PersistedSimulationRunQuality {
  hasQualityTarget: boolean;
  meetsQualityTarget: boolean;
}

function qualityRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function firstBoolean(...values: unknown[]): boolean | undefined {
  return values.find((value): value is boolean => typeof value === 'boolean');
}

/**
 * Reads only the canonical SimulationRun task spec and server-persisted summary.
 * A declared evaluation target fails closed unless the summary contains an
 * explicit evaluator verdict.
 */
export function evaluatePersistedSimulationRunQuality(
  taskSpecSnapshot: unknown,
  summary: unknown,
): PersistedSimulationRunQuality {
  const taskSpec = qualityRecord(taskSpecSnapshot);
  const evaluationSpecRef = qualityRecord(taskSpec.evaluationSpecRef);
  const qualityTarget = qualityRecord(taskSpec.qualityTarget);
  const hasQualityTarget = (
    typeof evaluationSpecRef.id === 'string'
    && evaluationSpecRef.id.trim().length > 0
  ) || Object.keys(qualityTarget).length > 0;

  if (!hasQualityTarget) {
    return { hasQualityTarget: false, meetsQualityTarget: false };
  }

  const summaryRecord = qualityRecord(summary);
  const evaluation = qualityRecord(summaryRecord.evaluation);
  const verdict = firstBoolean(
    summaryRecord.qualityTargetMet,
    summaryRecord.meetsQualityTarget,
    evaluation.meetsQualityTarget,
    evaluation.passed,
  );

  return {
    hasQualityTarget: true,
    meetsQualityTarget: verdict === true,
  };
}

export interface VirtualSimulationArtifactInput {
  actor: TaskMaterializationActor;
  eventType: string;
  /** 具名虚拟仿真任务 ID（可选，缺失时归入通用任务） */
  namedTaskId?: string | null;
  /** 来源产物 ID（如 SimulationLog.id 或 SimulationRun.id） */
  sourceArtifactId: string;
  occurredAt: string;
  tier: TaskEvidenceTier;
  fingerprint: SemanticFingerprintInput;
  summary: TaskEvidenceSummary;
  capabilityMappingTags?: string[];
}

export interface ControlWorkbenchArtifactInput {
  actor: TaskMaterializationActor;
  eventType: string;
  sourceArtifactId: string;
  occurredAt: string;
  tier: TaskEvidenceTier;
  fingerprint: SemanticFingerprintInput;
  summary: TaskEvidenceSummary;
  /** 是否具有持久化设计或结果 */
  hasPersistedDesign: boolean;
  /** 所选对象是否有目标或评价指标 */
  hasQualityTarget?: boolean;
  /** 是否满足质量指标 */
  meetsQualityTarget?: boolean;
  capabilityMappingTags?: string[];
}

export interface ArenaArtifactInput {
  actor: TaskMaterializationActor;
  eventType: string;
  taskId: string;
  /** ArenaSubmission.id */
  submissionId: string;
  occurredAt: string;
  /** 提交是否已被接受 */
  accepted: boolean;
  /** 关联评测是否有效 */
  evaluationValid: boolean;
  fingerprint: SemanticFingerprintInput;
  summary: TaskEvidenceSummary;
  capabilityMappingTags?: string[];
}

export interface OdysseyArtifactInput {
  actor: TaskMaterializationActor;
  eventType: string;
  levelId: string;
  /** 是否为 Arena 指派运行 */
  isArenaAssigned: boolean;
  /** 关联 Arena 任务 ID（Arena 指派时） */
  arenaTaskId?: string;
  /** 来源产物 ID */
  sourceArtifactId: string;
  occurredAt: string;
  /** 是否为持久化通关 */
  persistentClear: boolean;
  fingerprint: SemanticFingerprintInput;
  summary: TaskEvidenceSummary;
  capabilityMappingTags?: string[];
}

// ─── Actor Validation ────────────────────────────────────────────────────────

function validateStudentActor(actor: TaskMaterializationActor): string | null {
  if (actor.role !== 'student') {
    return `actor-role-not-student:${actor.role}`;
  }
  if (!actor.userId || actor.userId.trim().length === 0) {
    return 'missing-student-user-id';
  }
  return null;
}

// ─── Virtual Simulation Materialization ──────────────────────────────────────

export function materializeVirtualSimulationTaskEvidence(
  input: VirtualSimulationArtifactInput,
  existingEvidence: GovernedTaskEvidenceContext | null = null,
): TaskMaterializationResult {
  const actorError = validateStudentActor(input.actor);
  if (actorError) return { status: 'rejected', reason: actorError };

  if (!isTaskEvidenceEligibleEvent(input.eventType)) {
    return { status: 'rejected', reason: `ineligible-event:${input.eventType}` };
  }

  const taskKey = resolveVirtualSimulationTaskKey(input.namedTaskId ?? null);
  if (!taskKey) {
    return { status: 'rejected', reason: 'task-no-longer-published' };
  }

  const evidenceInput: BuildTaskEvidenceInput = {
    studentUserId: input.actor.userId,
    taskKey,
    source: 'virtual-simulation',
    tier: input.tier,
    occurredAt: input.occurredAt,
    normalizedSourceArtifactId: input.sourceArtifactId,
    semanticFingerprint: input.fingerprint,
    summary: input.summary,
    capabilityMappingTags: input.capabilityMappingTags,
  };

  const incoming = buildGovernedTaskEvidence(evidenceInput);
  const selected = selectHighestTierEvidence(existingEvidence, incoming);

  if (existingEvidence && selected === existingEvidence) {
    return { status: 'deduplicated', evidence: existingEvidence, reason: 'tier-not-higher' };
  }

  return { status: 'accepted', evidence: selected };
}

// ─── Control Workbench Materialization ───────────────────────────────────────

export function materializeControlWorkbenchTaskEvidence(
  input: ControlWorkbenchArtifactInput,
  existingEvidence: GovernedTaskEvidenceContext | null = null,
): TaskMaterializationResult {
  const actorError = validateStudentActor(input.actor);
  if (actorError) return { status: 'rejected', reason: actorError };

  if (!isTaskEvidenceEligibleEvent(input.eventType)) {
    return { status: 'rejected', reason: `ineligible-event:${input.eventType}` };
  }

  // 自由控制工作台必须具有持久化设计或结果
  if (!input.hasPersistedDesign) {
    return { status: 'rejected', reason: 'missing-persisted-design' };
  }

  // 所选对象有目标时，必须满足该指标
  if (input.hasQualityTarget && !input.meetsQualityTarget) {
    return { status: 'rejected', reason: 'quality-target-not-met' };
  }

  const taskKey = GENERIC_CONTROL_WORKBENCH_TASK_KEY;

  const evidenceInput: BuildTaskEvidenceInput = {
    studentUserId: input.actor.userId,
    taskKey,
    source: 'control-workbench',
    tier: input.tier,
    occurredAt: input.occurredAt,
    normalizedSourceArtifactId: input.sourceArtifactId,
    semanticFingerprint: input.fingerprint,
    summary: input.summary,
    capabilityMappingTags: input.capabilityMappingTags,
  };

  const incoming = buildGovernedTaskEvidence(evidenceInput);
  const selected = selectHighestTierEvidence(existingEvidence, incoming);

  if (existingEvidence && selected === existingEvidence) {
    return { status: 'deduplicated', evidence: existingEvidence, reason: 'tier-not-higher' };
  }

  return { status: 'accepted', evidence: selected };
}

// ─── Arena Materialization ───────────────────────────────────────────────────

export function materializeArenaTaskEvidence(
  input: ArenaArtifactInput,
  existingEvidence: GovernedTaskEvidenceContext | null = null,
): TaskMaterializationResult {
  const actorError = validateStudentActor(input.actor);
  if (actorError) return { status: 'rejected', reason: actorError };

  if (!isTaskEvidenceEligibleEvent(input.eventType)) {
    return { status: 'rejected', reason: `ineligible-event:${input.eventType}` };
  }

  // Arena 仅由已接受提交决定
  if (!input.accepted) {
    return { status: 'rejected', reason: 'submission-not-accepted' };
  }

  // 关联评测必须有效
  if (!input.evaluationValid) {
    return { status: 'rejected', reason: 'evaluation-not-valid' };
  }

  const taskKey = resolveArenaTaskKey(input.taskId);
  if (!taskKey) {
    return { status: 'rejected', reason: 'task-missing-completion-predicate' };
  }

  const evidenceInput: BuildTaskEvidenceInput = {
    studentUserId: input.actor.userId,
    taskKey,
    source: 'arena',
    tier: 'submission',
    occurredAt: input.occurredAt,
    normalizedSourceArtifactId: input.submissionId,
    semanticFingerprint: input.fingerprint,
    summary: input.summary,
    capabilityMappingTags: input.capabilityMappingTags,
  };

  const incoming = buildGovernedTaskEvidence(evidenceInput);
  const selected = selectHighestTierEvidence(existingEvidence, incoming);

  if (existingEvidence && selected === existingEvidence) {
    return { status: 'deduplicated', evidence: existingEvidence, reason: 'tier-not-higher' };
  }

  return { status: 'accepted', evidence: selected };
}

// ─── Odyssey Materialization ─────────────────────────────────────────────────

export function materializeOdysseyTaskEvidence(
  input: OdysseyArtifactInput,
  existingEvidence: GovernedTaskEvidenceContext | null = null,
): TaskMaterializationResult {
  const actorError = validateStudentActor(input.actor);
  if (actorError) return { status: 'rejected', reason: actorError };

  if (!isTaskEvidenceEligibleEvent(input.eventType)) {
    return { status: 'rejected', reason: `ineligible-event:${input.eventType}` };
  }

  // 奥德赛仅由持久化通关状态决定
  if (!input.persistentClear) {
    return { status: 'rejected', reason: 'not-persistent-clear' };
  }

  // Arena 指派运行优先归入 Arena 任务
  const taskKey = resolveOdysseyTaskKey(input.levelId, input.isArenaAssigned);
  if (!taskKey) {
    return { status: 'rejected', reason: 'odyssey-level-not-in-catalog' };
  }
  if (input.isArenaAssigned && taskKey !== `arena:${input.arenaTaskId ?? ''}`) {
    return { status: 'rejected', reason: 'arena-assignment-task-mismatch' };
  }

  const source: SimulationTaskSource = input.isArenaAssigned && taskKey.startsWith('arena:')
    ? 'arena'
    : 'odyssey';

  const tier: TaskEvidenceTier = source === 'arena' ? 'submission' : 'clear';

  const evidenceInput: BuildTaskEvidenceInput = {
    studentUserId: input.actor.userId,
    taskKey,
    source,
    tier,
    occurredAt: input.occurredAt,
    normalizedSourceArtifactId: input.sourceArtifactId,
    semanticFingerprint: input.fingerprint,
    summary: input.summary,
    capabilityMappingTags: input.capabilityMappingTags,
  };

  const incoming = buildGovernedTaskEvidence(evidenceInput);
  const selected = selectHighestTierEvidence(existingEvidence, incoming);

  if (existingEvidence && selected === existingEvidence) {
    return { status: 'deduplicated', evidence: existingEvidence, reason: 'tier-not-higher' };
  }

  return { status: 'accepted', evidence: selected };
}
