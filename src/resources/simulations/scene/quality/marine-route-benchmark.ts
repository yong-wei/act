/**
 * M5 四路线对照的裁决（#2137）。
 * 只消费调用方读到的实测。缺实现、缺核心功能或空硬件不能变成成功的“保持现状”。
 * 本模块不改生产默认后端。
 */

export const REQUIRED_M5_ROUTES = [
  'webgl-gerstner',
  'webgl-fft',
  'webgpu-gerstner',
  'webgpu-fft',
] as const;

export const REQUIRED_M5_SCENES = ['wave-only', 'feature-parity'] as const;

export type M5RouteId = (typeof REQUIRED_M5_ROUTES)[number];
export type M5SceneId = (typeof REQUIRED_M5_SCENES)[number];
export type EvidenceKind = 'actual' | 'cpu-throttle' | 'pixel-scale' | 'effect-injection';
export type CostMethod = 'gpu-elapsed' | 'completed-work' | 'frame-interval';

export interface RouteObservation {
  readonly route: M5RouteId;
  readonly scene: M5SceneId;
  readonly implemented: boolean;
  readonly coreFeaturesPresent: boolean;
  readonly hardwareContext: string | null;
  readonly renderer: string | null;
  readonly softwareFallback: boolean;
  readonly frameP95Ms: number | null;
  readonly frameMedianMs: number | null;
  readonly gpuMs: number | null;
  readonly completedWorkMs: number | null;
  readonly qualityScore: number | null;
  readonly pixelMean: number | null;
  readonly imagePath: string | null;
  readonly evidenceKind: EvidenceKind;
  /** 主机没有该 API。不是实现缺口，不废除已测到的另一条路线。 */
  readonly hostUnavailable: boolean;
}

export interface RouteFailure {
  readonly route: string;
  readonly scene: string;
  readonly reason: 'missing-observation' | 'stub' | 'missing-core-feature' | 'missing-hardware';
}

export interface CostPoint {
  readonly route: M5RouteId;
  readonly scene: M5SceneId;
  readonly method: CostMethod;
  readonly costMs: number;
  readonly qualityScore: number;
}

export interface MarineRouteBenchmarkReport {
  readonly passed: boolean;
  readonly productionDefaultChanged: false;
  readonly adoption: 'not-adopted';
  readonly hardwareContext: string | null;
  readonly historicalDeviceGate: string;
  readonly failedRoutes: readonly RouteFailure[];
  readonly rankedByMethod: Readonly<Record<CostMethod, readonly CostPoint[]>>;
  readonly pareto: readonly CostPoint[];
  readonly significantWinner: null | M5RouteId;
  readonly uncertainty: string;
  readonly simulatedSamples: number;
  readonly softwareFallbackSamples: number;
  readonly unavailableRoutes: readonly { readonly route: string; readonly scene: string }[];
}

const HISTORICAL_DEVICE_GATE = '本轮声明主机是 M5。#2103/#2104/#2120 的低端或移动真机条目保留为历史外部覆盖，不阻塞本轮，也不把模拟压力写成另一台设备。';

export function frameIntervalIsVsyncLocked(medianMs: number | null): boolean {
  if (medianMs === null || !Number.isFinite(medianMs) || medianMs <= 0) return false;
  const hz = 1000 / medianMs;
  return [60, 120, 144].some((refresh) => Math.abs(hz - refresh) / refresh < 0.08);
}

export function assertProductionDefaultUnchanged(changed: boolean): void {
  if (changed) throw new Error('benchmark must not change the production marine backend');
}

function finitePositive(value: number | null): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function sampleCost(observation: RouteObservation): { method: CostMethod; costMs: number } | null {
  if (observation.evidenceKind !== 'actual' || observation.softwareFallback) return null;
  if (!observation.implemented || !observation.coreFeaturesPresent) return null;
  if (finitePositive(observation.gpuMs)) return { method: 'gpu-elapsed', costMs: observation.gpuMs };
  if (finitePositive(observation.completedWorkMs)) return { method: 'completed-work', costMs: observation.completedWorkMs };
  if (!frameIntervalIsVsyncLocked(observation.frameMedianMs) && finitePositive(observation.frameP95Ms)) {
    return { method: 'frame-interval', costMs: observation.frameP95Ms };
  }
  return null;
}

function dominates(candidate: CostPoint, other: CostPoint): boolean {
  return candidate.scene === other.scene && candidate.costMs < other.costMs * 0.9;
}

export function judgeMarineRouteBenchmark(input: {
  readonly observations: readonly RouteObservation[];
  readonly productionDefaultChanged?: boolean;
}): MarineRouteBenchmarkReport {
  assertProductionDefaultUnchanged(input.productionDefaultChanged === true);
  const failedRoutes: RouteFailure[] = [];
  const actual = input.observations.filter((item) => item.evidenceKind === 'actual');
  for (const route of REQUIRED_M5_ROUTES) {
    for (const scene of REQUIRED_M5_SCENES) {
      const found = actual.find((item) => item.route === route && item.scene === scene);
      if (!found) {
        failedRoutes.push({ route, scene, reason: 'missing-observation' });
        continue;
      }
      if (found.hostUnavailable) continue;
      if (!found.implemented) failedRoutes.push({ route, scene, reason: 'stub' });
      else if (!found.coreFeaturesPresent) failedRoutes.push({ route, scene, reason: 'missing-core-feature' });
      else if (!found.hardwareContext || found.hardwareContext.trim().length === 0) {
        failedRoutes.push({ route, scene, reason: 'missing-hardware' });
      }
    }
  }
  const rankedByMethod: Record<CostMethod, CostPoint[]> = {
    'gpu-elapsed': [],
    'completed-work': [],
    'frame-interval': [],
  };
  for (const observation of actual) {
    if (failedRoutes.some((failure) => failure.route === observation.route && failure.scene === observation.scene)) continue;
    const cost = sampleCost(observation);
    if (!cost || observation.qualityScore === null || !Number.isFinite(observation.qualityScore)) continue;
    rankedByMethod[cost.method].push({
      route: observation.route,
      scene: observation.scene,
      method: cost.method,
      costMs: cost.costMs,
      qualityScore: observation.qualityScore,
    });
  }
  const paretoPool = rankedByMethod['gpu-elapsed'].length > 0
    ? rankedByMethod['gpu-elapsed']
    : rankedByMethod['completed-work'];
  const pareto = paretoPool.filter((point) => {
    const peers = paretoPool.filter((other) => other.scene === point.scene);
    return peers.every((other) => other === point || !dominates(other, point));
  });
  let significantWinner: M5RouteId | null = null;
  let uncertainty = '同一场景、同一质量门槛下，成本差没有超过 10%，不指定胜者。垂直同步锁定的帧间隔不参与成本排名。';
  const sceneWinners = REQUIRED_M5_SCENES.map((scene) => {
    const peers = paretoPool.filter((point) => point.scene === scene);
    if (peers.length < 2) return null;
    const cheapest = [...peers].sort((a, b) => a.costMs - b.costMs)[0]!;
    const separated = peers.every((other) => other === cheapest || dominates(cheapest, other));
    return separated ? cheapest.route : null;
  }).filter((route): route is M5RouteId => route !== null);
  if (sceneWinners.length === REQUIRED_M5_SCENES.length && sceneWinners.every((route) => route === sceneWinners[0])) {
    significantWinner = sceneWinners[0]!;
    uncertainty = '两个场景里，过了质量门槛的同一路线 GPU 耗时都比其余实测路线低 10% 以上。这是建议，不改生产默认。';
  }
  const hardwareContext = actual.find((item) => item.hardwareContext && item.hardwareContext.trim().length > 0)?.hardwareContext ?? null;
  return {
    passed: failedRoutes.length === 0,
    productionDefaultChanged: false,
    adoption: 'not-adopted',
    hardwareContext,
    historicalDeviceGate: HISTORICAL_DEVICE_GATE,
    failedRoutes,
    rankedByMethod,
    pareto,
    significantWinner,
    uncertainty,
    simulatedSamples: input.observations.filter((item) => item.evidenceKind !== 'actual').length,
    softwareFallbackSamples: input.observations.filter((item) => item.softwareFallback).length,
    unavailableRoutes: actual.filter((item) => item.hostUnavailable).map((item) => ({ route: item.route, scene: item.scene })),
  };
}
