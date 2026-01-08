import type { DisturbanceConfig, EnvelopeConfig, ReferenceSignalConfig, SignalEvent } from '../level-data';

// 游戏视口常量
export const VIEWPORT_WIDTH = 800;
export const VIEWPORT_HEIGHT = 400;
export const SHIP_X_OFFSET = 100; // 飞船在屏幕左侧的固定 X 坐标

// 障碍物生成参数
export const SEGMENT_WIDTH = 20; // 每个地形切片的宽度
export const WALL_BUFFER = 200; // 预生成的缓冲区大小 (像素)

export interface LevelSegment {
  id: number;
  x: number; // 世界坐标 X
  topY: number; // 上方障碍物底边缘 Y
  bottomY: number; // 下方障碍物顶边缘 Y
  gapCenter: number; // 通道中心 Y
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const sumStepEvents = (events: SignalEvent[], x: number) =>
  events.reduce((sum, event) => (x >= event.at ? sum + event.amplitude : sum), 0);

export const computeReferenceY = (reference: ReferenceSignalConfig, x: number) => {
  const base = reference.base ?? VIEWPORT_HEIGHT / 2;
  const safeDistance = reference.startSafeDistance ?? 500;

  if (x < safeDistance) {
    return base;
  }

  switch (reference.type) {
    case 'step':
    case 'sequence':
    case 'custom':
      return base + sumStepEvents(reference.events, x);
    case 'ramp': {
      const startAt = reference.events[0]?.at ?? safeDistance;
      const rampRate = reference.rampRate ?? 0;
      return base + Math.max(0, x - startAt) * rampRate;
    }
    case 'accel': {
      const startAt = reference.events[0]?.at ?? safeDistance;
      const accelRate = reference.accelRate ?? 0;
      const dx = Math.max(0, x - startAt);
      return base + 0.5 * accelRate * dx * dx;
    }
    default:
      return base;
  }
};

/**
 * 关卡生成器
 * 根据给定信号生成安全通道包络
 */
export class LevelGenerator {
  private lastX: number = 0;
  private lastGapCenter: number = VIEWPORT_HEIGHT / 2;
  private currentSegmentId: number = 0;

  constructor() {
    this.reset();
  }

  reset() {
    this.lastX = 0;
    this.lastGapCenter = VIEWPORT_HEIGHT / 2;
    this.currentSegmentId = 0;
  }

  /**
   * 生成下一批地形切片，直到覆盖到 targetX
   * @param targetX 当前可视区域右边界
   * @param maxDistance 关卡总长度（到达此距离后生成终点）
   */
  generateSegments(
    targetX: number,
    maxDistance: number,
    referenceConfig: ReferenceSignalConfig,
    envelopeConfig: EnvelopeConfig,
    disturbanceConfig?: DisturbanceConfig
  ): LevelSegment[] {
    const segments: LevelSegment[] = [];

    const FINISH_BUFFER = 800;
    const envelopeMargin = Math.max(20, envelopeConfig.margin);
    const boostMargin = Math.max(20, Math.round(envelopeMargin * 0.6));
    const stepBuffer = 100;
    const stepSignalTypes: ReferenceSignalConfig['type'][] = ['step', 'sequence', 'custom'];

    while (this.lastX < targetX + WALL_BUFFER) {
      let nextGapCenter = this.lastGapCenter;
      const isFinishZone = this.lastX >= maxDistance;
      const isDisturbanceZone = disturbanceConfig?.type === 'output-step'
        ? disturbanceConfig.events.some((event) => {
          const duration = event.duration ?? 160;
          const buffer = 120;
          return this.lastX >= event.at - buffer && this.lastX <= event.at + duration + buffer;
        })
        : false;
      let stepMargin = 0;
      if (!isFinishZone && stepSignalTypes.includes(referenceConfig.type)) {
        const isStepZone = referenceConfig.events.some(
          (event) => Math.abs(this.lastX - event.at) <= stepBuffer
        );
        if (isStepZone) {
          const referenceY = computeReferenceY(referenceConfig, this.lastX);
          const delta = Math.abs(referenceY - this.lastGapCenter);
          const baseBoost = Math.max(20, Math.round(envelopeMargin * 0.35));
          const deltaBoost = Math.min(Math.round(delta * 0.6), envelopeMargin);
          stepMargin = baseBoost + deltaBoost;
        }
      }

      const margin = isDisturbanceZone
        ? envelopeMargin + boostMargin + stepMargin
        : envelopeMargin + stepMargin;
      const gapHeight = isFinishZone ? VIEWPORT_HEIGHT : Math.min(VIEWPORT_HEIGHT, margin * 2);

      if (isFinishZone) {
        nextGapCenter = this.lastGapCenter;
        if (this.lastX > maxDistance + FINISH_BUFFER) {
          break;
        }
      } else {
        const referenceY = computeReferenceY(referenceConfig, this.lastX);
        const halfGap = gapHeight / 2;
        nextGapCenter = clamp(referenceY, halfGap, VIEWPORT_HEIGHT - halfGap);
      }

      const segment: LevelSegment = {
        id: this.currentSegmentId++,
        x: this.lastX,
        topY: nextGapCenter - gapHeight / 2,
        bottomY: nextGapCenter + gapHeight / 2,
        gapCenter: nextGapCenter,
      };

      segments.push(segment);
      this.lastX += SEGMENT_WIDTH;
      this.lastGapCenter = nextGapCenter;
    }

    return segments;
  }
}
