/**
 * 控灵主动陪伴触发决策核心（纯函数，无 IO）。
 *
 * 状态机：candidate → confirmed → delivered | suppressed | expired
 * 输入为服务端视角的事件快照与配置常量，输出为决策，供 API 路由落库执行。
 */

export type CompanionEventType =
  | 'pause-candidate'
  | 'wrong-answer'
  | 'progress-milestone'
  | 'resource-completed';

export type CompanionEventStatus =
  | 'candidate'
  | 'confirmed'
  | 'delivered'
  | 'suppressed'
  | 'expired';

export type CompanionPageKind = 'resource-textbook' | 'adaptive-practice';

/** 客户端上报的停顿窗口信号快照（服务端仅采信布尔状态，不采信客户端时刻）。 */
export interface CompanionPauseSignals {
  visible: boolean;
  focused: boolean;
  mediaPlaying: boolean;
  /** 上报前 N 秒内的有效学习操作次数（粗粒度计数）。 */
  recentActionCount: number;
}

export interface CompanionEventRecord {
  id: string;
  userId: string;
  pageKind: string;
  pageRef: string;
  eventType: string;
  status: string;
  createdAt: Date;
  confirmedAt: Date | null;
  expiresAt: Date;
}

export interface CompanionTriggerConfig {
  /** 二次确认窗口（毫秒）：candidate 创建后多久内可确认。 */
  confirmationWindowMs: number;
  /** 同类事件冷却（毫秒）。 */
  cooldownMs: number;
  /** 停顿确认要求的最小无操作秒数（由客户端停顿时长档映射为证据）。 */
  minIdleSeconds: number;
  /** 有效操作打断阈值：窗口内操作数达到该值即抑制。 */
  interruptingActionCount: number;
}

export const DEFAULT_COMPANION_TRIGGER_CONFIG: CompanionTriggerConfig = {
  confirmationWindowMs: 45_000,
  cooldownMs: 10 * 60_000,
  minIdleSeconds: 30,
  interruptingActionCount: 1,
};

const EVENT_PRIORITY: Record<CompanionEventType, number> = {
  'pause-candidate': 1,
  'resource-completed': 2,
  'progress-milestone': 3,
  'wrong-answer': 4,
};

export function eventPriority(eventType: CompanionEventType): number {
  return EVENT_PRIORITY[eventType] ?? 0;
}

/** 二次确认所需的最小事件快照（Prisma 记录结构兼容）。 */
export type CompanionCandidateSnapshot = Pick<
  CompanionEventRecord,
  'status' | 'createdAt' | 'expiresAt'
>;

/** 停顿候选是否满足两阶段确认的证据条件（页面可见、聚焦、无媒体播放、无打断操作）。 */
export function pauseSignalsEligible(
  signals: CompanionPauseSignals,
  config: CompanionTriggerConfig = DEFAULT_COMPANION_TRIGGER_CONFIG,
): boolean {
  return signals.visible
    && signals.focused
    && !signals.mediaPlaying
    && signals.recentActionCount < config.interruptingActionCount;
}

/**
 * 二次确认判定：candidate 必须仍在确认窗口内，且当前信号仍满足停顿条件。
 * 离开页面再返回的场景：旧 candidate 超出窗口或信号不满足 → expired，
 * 客户端应以新停顿重新创建 candidate，而不是续用旧事件。
 */
export function confirmPauseCandidate(
  candidate: CompanionCandidateSnapshot,
  signals: CompanionPauseSignals,
  now: Date,
  config: CompanionTriggerConfig = DEFAULT_COMPANION_TRIGGER_CONFIG,
): { decision: 'confirmed' | 'expired' | 'suppressed' } {
  if (candidate.status !== 'candidate') return { decision: 'suppressed' };
  if (now.getTime() > candidate.expiresAt.getTime()) return { decision: 'expired' };
  const createdWithinWindow = now.getTime() - candidate.createdAt.getTime() <= config.confirmationWindowMs;
  if (!createdWithinWindow) return { decision: 'expired' };
  if (!pauseSignalsEligible(signals, config)) return { decision: 'suppressed' };
  return { decision: 'confirmed' };
}

/** 冷却判定：同一用户同类事件在冷却期内不再接受新候选。 */
export function isCoolingDown(
  previous: Pick<CompanionEventRecord, 'eventType' | 'createdAt'> | null,
  now: Date,
  config: CompanionTriggerConfig = DEFAULT_COMPANION_TRIGGER_CONFIG,
): boolean {
  if (!previous) return false;
  return now.getTime() - previous.createdAt.getTime() < config.cooldownMs;
}

/** 过期清扫判定：确认/候选超期未投递即过期。 */
export function isExpired(
  event: Pick<CompanionEventRecord, 'expiresAt'>,
  now: Date,
): boolean {
  return now.getTime() > event.expiresAt.getTime();
}

/**
 * 优先级队列：同一时刻多个 confirmed 事件竞争一次展示时，高优先级先投递，
 * 低优先级在展示窗口内被抑制（避免连环气泡）。
 */
export function pickDeliverable<T extends { eventType: CompanionEventType; createdAt: Date; status: CompanionEventStatus }>(
  confirmedEvents: T[],
): T | null {
  const deliverable = confirmedEvents.filter((event) => event.status === 'confirmed');
  if (deliverable.length === 0) return null;
  return deliverable.sort((left, right) => {
    const priorityDiff = eventPriority(right.eventType) - eventPriority(left.eventType);
    if (priorityDiff !== 0) return priorityDiff;
    return left.createdAt.getTime() - right.createdAt.getTime();
  })[0];
}

/** 投递后落库时的事件终态与展示租约键（服务端唯一投递约束的语义输入）。 */
export function deliveryLeaseKey(userId: string, eventId: string): string {
  return `konling-companion:${userId}:${eventId}`;
}
