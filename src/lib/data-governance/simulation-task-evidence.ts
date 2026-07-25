/**
 * 受治理仿真任务证据上下文
 *
 * 定义稳定产物键、语义指纹、证据层级、脱敏摘要和去重语义。
 * 任务证据以零画像权重保存在不可变学习事实的受治理上下文中，
 * 保留原有能力映射标签及"仿真验证与证据"映射，
 * 供后续任务画像投影按任务键产生唯一贡献。
 */

import { createHash } from 'node:crypto';

import type { SimulationTaskSource } from './simulation-task-catalog';

// ─── Evidence Tier ───────────────────────────────────────────────────────────

/**
 * 证据层级，从低到高。
 * 同一产物只保留最高层级作为有效任务证据。
 */
export type TaskEvidenceTier =
  | 'process'       // 过程上下文（参数调整附着）
  | 'run'           // 完成运行
  | 'evaluation'    // 评估结果
  | 'submission'    // 正式提交
  | 'clear';        // 通关/满分完成

const TIER_ORDER: Record<TaskEvidenceTier, number> = {
  process: 0,
  run: 1,
  evaluation: 2,
  submission: 3,
  clear: 4,
};

/** 比较两个证据层级，返回较高者 */
export function higherTier(a: TaskEvidenceTier, b: TaskEvidenceTier): TaskEvidenceTier {
  return TIER_ORDER[a] >= TIER_ORDER[b] ? a : b;
}

/** 判断 a 是否 >= b */
export function tierAtLeast(a: TaskEvidenceTier, b: TaskEvidenceTier): boolean {
  return TIER_ORDER[a] >= TIER_ORDER[b];
}

// ─── Artifact Key ────────────────────────────────────────────────────────────

/**
 * 稳定产物标识组成。
 * artifactKey 使用上述字段的版本化 SHA-256 摘要，避免把学生或来源身份写入公开键。
 * 内容相同而学生不同的产物不互相去重。
 */
export interface ArtifactKeyComponents {
  studentUserId: string;
  sourceFamily: SimulationTaskSource;
  taskKey: string;
  /** 来源的规范化产物身份（如 submissionId、runId、logId） */
  normalizedSourceArtifactId: string;
}

export function buildArtifactKey(components: ArtifactKeyComponents): string {
  const digest = createHash('sha256').update([
    components.studentUserId,
    components.sourceFamily,
    components.taskKey,
    components.normalizedSourceArtifactId,
  ].join('\u001f')).digest('hex');
  return `simulation-task-artifact:v1:${digest}`;
}

// ─── Semantic Fingerprint ────────────────────────────────────────────────────

/**
 * 语义指纹用于判定同一任务中的不同运行。
 * 使用版本化的被控对象、模型、控制器配置和关键输入字段。
 * 不含处理时间、包装事件标识或证据层级。
 */
export interface SemanticFingerprintInput {
  /** 被控对象标识或哈希 */
  plantRef?: string;
  /** 模型标识或版本 */
  modelRef?: string;
  /** 控制器配置规范化哈希 */
  controllerConfigHash?: string;
  /** 关键输入字段规范化哈希 */
  keyInputHash?: string;
}

function canonicalizeFingerprintValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalizeFingerprintValue);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalizeFingerprintValue(entry)]),
    );
  }
  return value;
}

export function hashSemanticFingerprintValue(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalizeFingerprintValue(value)))
    .digest('hex');
}

export function buildSemanticFingerprint(input: SemanticFingerprintInput): string {
  const parts = [
    input.plantRef ?? '',
    input.modelRef ?? '',
    input.controllerConfigHash ?? '',
    input.keyInputHash ?? '',
  ];
  return parts.join('|');
}

/**
 * 判断两个语义指纹是否表示不同运行。
 * 至少一项不同即为不同运行。
 */
export function isDistinctRun(a: SemanticFingerprintInput, b: SemanticFingerprintInput): boolean {
  return (
    (a.plantRef ?? '') !== (b.plantRef ?? '') ||
    (a.modelRef ?? '') !== (b.modelRef ?? '') ||
    (a.controllerConfigHash ?? '') !== (b.controllerConfigHash ?? '') ||
    (a.keyInputHash ?? '') !== (b.keyInputHash ?? '')
  );
}

// ─── Governed Task Evidence Context ─────────────────────────────────────────

/**
 * 受治理任务证据上下文，附着在不可变学习事实的 contextJson 中。
 */
export interface GovernedTaskEvidenceContext {
  /** 合同版本 */
  schemaVersion: 'simulation-task-evidence.v1';
  /** 稳定任务标识 */
  taskKey: string;
  /** 稳定产物标识（带学生归属命名空间） */
  artifactKey: string;
  /** 来源 */
  source: SimulationTaskSource;
  /** 证据层级 */
  tier: TaskEvidenceTier;
  /** 发生时间 ISO 8601 */
  occurredAt: string;
  /** 语义指纹（用于判定不同运行） */
  semanticFingerprint: string;
  /** 可复核脱敏摘要 */
  summary: TaskEvidenceSummary;
  /** 来源有效性状态 */
  sourceValidity: TaskEvidenceSourceValidity;
  /** 画像权重（本变更内固定为 0） */
  portraitWeight: 0;
  /** 并行携带的仿真验证与证据映射 */
  portraitDimensionMapping: 'simulationValidationEvidence';
  /** 原有能力映射标签 */
  capabilityMappingTags: string[];
}

export type TaskEvidenceSourceValidity =
  | 'valid'
  | 'degraded'
  | 'unresolved';

/**
 * 脱敏摘要：仅保存来源标识、质量摘要与脱敏指标。
 * 不复制原始答案、隐藏评分细节或高频轨迹。
 */
export interface TaskEvidenceSummary {
  /** 来源标识（如 submissionId、runId） */
  sourceRef: string;
  /** 质量等级 */
  qualityBand: 'full' | 'partial' | 'minimal';
  /** 脱敏指标（不含隐藏官方评分内部） */
  metrics?: Record<string, number | string | boolean>;
  /** 简短可复核描述 */
  label?: string;
}

// ─── Construction Helpers ────────────────────────────────────────────────────

export interface BuildTaskEvidenceInput {
  studentUserId: string;
  taskKey: string;
  source: SimulationTaskSource;
  tier: TaskEvidenceTier;
  occurredAt: string;
  normalizedSourceArtifactId: string;
  semanticFingerprint: SemanticFingerprintInput;
  summary: TaskEvidenceSummary;
  sourceValidity?: TaskEvidenceSourceValidity;
  capabilityMappingTags?: string[];
}

export function buildGovernedTaskEvidence(input: BuildTaskEvidenceInput): GovernedTaskEvidenceContext {
  const artifactKey = buildArtifactKey({
    studentUserId: input.studentUserId,
    sourceFamily: input.source,
    taskKey: input.taskKey,
    normalizedSourceArtifactId: input.normalizedSourceArtifactId,
  });

  return {
    schemaVersion: 'simulation-task-evidence.v1',
    taskKey: input.taskKey,
    artifactKey,
    source: input.source,
    tier: input.tier,
    occurredAt: input.occurredAt,
    semanticFingerprint: buildSemanticFingerprint(input.semanticFingerprint),
    summary: input.summary,
    sourceValidity: input.sourceValidity ?? 'valid',
    portraitWeight: 0,
    portraitDimensionMapping: 'simulationValidationEvidence',
    capabilityMappingTags: input.capabilityMappingTags ?? [],
  };
}

// ─── Deduplication ───────────────────────────────────────────────────────────

/**
 * 对同一 artifactKey 的多条证据选择最高层级。
 * 返回应保留的有效任务证据。
 */
export function selectHighestTierEvidence(
  existing: GovernedTaskEvidenceContext | null,
  incoming: GovernedTaskEvidenceContext,
): GovernedTaskEvidenceContext {
  if (!existing) return incoming;
  if (TIER_ORDER[incoming.tier] > TIER_ORDER[existing.tier]) return incoming;
  return existing;
}

/**
 * 判断一条证据是否为受治理任务证据上下文。
 */
export function isGovernedTaskEvidence(value: unknown): value is GovernedTaskEvidenceContext {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return record.schemaVersion === 'simulation-task-evidence.v1'
    && typeof record.taskKey === 'string'
    && typeof record.artifactKey === 'string';
}

// ─── Source Whitelist ────────────────────────────────────────────────────────

/**
 * 可形成任务证据的产品语义事件白名单。
 * 浏览、打开面板、结果查看和孤立参数调整不产生任务证据。
 */
export const TASK_EVIDENCE_ELIGIBLE_EVENTS: ReadonlySet<string> = new Set([
  // 虚拟仿真
  'simulation_finish',
  'simulation_session_complete',
  // 控制工作台
  'design_session_complete',
  'workspace_submission',
  // Arena
  'arena_submit',
  'arena_evaluation_complete',
  // 奥德赛
  'odyssey_level_clear',
  'odyssey_persistent_clear',
]);

/**
 * 不可形成任务证据的事件（仅作为过程上下文或完全排除）。
 */
export const TASK_EVIDENCE_INELIGIBLE_EVENTS: ReadonlySet<string> = new Set([
  'page_view',
  'view',
  'arena_challenge_open',
  'arena_workspace_start',
  'arena_result_view',
  'arena_leaderboard_view',
  'arena_feedback_view',
  'simulation_scene_view',
  'simulation_help_open',
  'resource_open',
  'resource_view',
  'knowledge_card_open',
]);

/**
 * 判断事件是否有资格形成任务证据。
 */
export function isTaskEvidenceEligibleEvent(eventType: string): boolean {
  return TASK_EVIDENCE_ELIGIBLE_EVENTS.has(eventType);
}

/**
 * 判断事件是否明确不可形成任务证据。
 */
export function isTaskEvidenceIneligibleEvent(eventType: string): boolean {
  return TASK_EVIDENCE_INELIGIBLE_EVENTS.has(eventType);
}
