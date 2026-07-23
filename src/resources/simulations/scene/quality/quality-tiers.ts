/**
 * 质量分级：后处理/粒子/阴影/水面细分三档参数、设备探测默认档、
 * 帧时间超预算自动降档（冷却保护）、手动覆盖优先。
 */

export type QualityTierId = 'high' | 'medium' | 'low';

export interface QualityTierParams {
  readonly postEnabled: boolean;
  readonly particleScale: number;
  readonly shadowMapSize: number;
  readonly shadowsEnabled: boolean;
  readonly waterTier: 'high' | 'medium' | 'low';
  /** 设备像素比上限（低档压分辨率）。 */
  readonly dprCap: number;
}

/** 帧时间预算：1080p60 目标的安全线（≈55fps）。 */
export const QUALITY_FRAME_BUDGET_MS = 1000 / 55;

export const SCENE_QUALITY_TIERS: Record<QualityTierId, QualityTierParams> = {
  high: { postEnabled: true, particleScale: 1, shadowMapSize: 2048, shadowsEnabled: true, waterTier: 'high', dprCap: 2 },
  medium: { postEnabled: true, particleScale: 0.5, shadowMapSize: 1024, shadowsEnabled: true, waterTier: 'medium', dprCap: 1.5 },
  low: { postEnabled: false, particleScale: 0.25, shadowMapSize: 512, shadowsEnabled: false, waterTier: 'low', dprCap: 1 },
};

export interface DeviceCapabilitySignals {
  readonly isMobile: boolean;
  readonly hardwareConcurrency: number;
  readonly devicePixelRatio: number;
  /** GPU 为软件渲染（SwiftShader/llvmpipe 等）：MSAA 后处理会直接击垮上下文。 */
  readonly softwareRenderer?: boolean;
}

export function probeDefaultQualityTier(signals: DeviceCapabilitySignals): QualityTierId {
  if (signals.isMobile || signals.softwareRenderer) return 'low';
  if (signals.hardwareConcurrency >= 8) return 'high';
  return 'medium';
}

const TIER_ORDER: readonly QualityTierId[] = ['high', 'medium', 'low'];

export interface QualityGovernorOptions {
  readonly initialTier: QualityTierId;
  readonly budgetMs?: number;
  /** 持续超预算窗口（毫秒）：超过才降档，抖动不降。 */
  readonly windowMs?: number;
  /** 两次降档之间的冷却（毫秒）。 */
  readonly cooldownMs?: number;
}

export function createQualityGovernor({
  initialTier,
  budgetMs = QUALITY_FRAME_BUDGET_MS,
  windowMs = 600,
  cooldownMs = 8000,
}: QualityGovernorOptions) {
  let tier = initialTier;
  let override: QualityTierId | null = null;
  let overBudgetSince: number | null = null;
  let lastDegradeAt = Number.NEGATIVE_INFINITY;

  return {
    get tier(): QualityTierId {
      return override ?? tier;
    },
    get probedTier(): QualityTierId {
      return tier;
    },
    setOverride(next: QualityTierId | null) {
      override = next;
    },
    reportFrame(frameMs: number, nowMs: number) {
      if (override) return;
      if (frameMs > budgetMs) {
        overBudgetSince ??= nowMs;
        if (nowMs - overBudgetSince >= windowMs && nowMs - lastDegradeAt >= cooldownMs) {
          const index = TIER_ORDER.indexOf(tier);
          if (index < TIER_ORDER.length - 1) {
            tier = TIER_ORDER[index + 1];
            lastDegradeAt = nowMs;
          }
          overBudgetSince = null;
        }
      } else {
        overBudgetSince = null;
      }
    },
  };
}

export type QualityGovernor = ReturnType<typeof createQualityGovernor>;
