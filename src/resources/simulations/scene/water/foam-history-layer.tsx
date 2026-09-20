'use client';

import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';

import type { GerstnerWave } from './gerstner-waves';
import {
  displayDriftVelocity,
  FoamHistoryField,
  FOAM_HISTORY_BY_TIER,
  FOAM_RECENTER_STEP_METERS,
  type FoamSourceInputs,
} from './foam-history';
import { useMarineVisualTime } from '../frame/marine-frame-provider';

/** 泡沫域边长（米）：覆盖船后完整尾迹史（~375m）与自然白浪斑块。 */
export const FOAM_DOMAIN_METERS = 1024;

/** 展示性漂移速率（米/秒）：受控慢漂（非波峰相速度、非教学海流）。 */
const DISPLAY_DRIFT_SPEED_METERS_PER_SECOND = 1.4;

/** QA 归因模式：natural = 只自然源；vessel = 只船源；off = 全关（A/B 基线）。 */
export type FoamAttribution = { natural: boolean; vessel: boolean };

function resolveAttributionFromLocation(): FoamAttribution {
  if (typeof window === 'undefined') return { natural: true, vessel: true };
  const mode = new URLSearchParams(window.location.search).get('qa-foam');
  if (mode === 'natural') return { natural: true, vessel: false };
  if (mode === 'vessel') return { natural: false, vessel: true };
  if (mode === 'off') return { natural: false, vessel: false };
  return { natural: true, vessel: true };
}

export interface MarineFoamFieldStats {
  readonly domainMeters: number;
  readonly resolution: number;
  readonly updateHz: number;
  readonly originX: number;
  readonly originZ: number;
  readonly timeSeconds: number;
  readonly epoch: number;
  readonly attribution: FoamAttribution;
  readonly lastStepCostMs: number;
  readonly avgStepCostMs: number;
  readonly depositsLastSecond: number;
  readonly densityAt: (worldX: number, worldZ: number) => number;
}

export interface MarineFoamFieldController {
  readonly field: FoamHistoryField;
  readonly texture: THREE.DataTexture;
  readonly domainMeters: number;
  readonly attribution: FoamAttribution;
  /** 船源沉积入口（世界坐标；WakeTrail 等消费者按秒积分调用）。 */
  deposit(worldX: number, worldZ: number, radiusMeters: number, amount: number): void;
  stats(): MarineFoamFieldStats;
}

interface FoamFieldInternalHandle {
  /** 推进场时间（固定步累积；seek/重置按政策清空）。 */
  tick(visualTime: number): void;
  /** 船累计位移超过重定位步长时整场世界重采样。 */
  recenter(x: number, z: number): void;
  /** 有变更时上传密度纹理。 */
  flushTexture(): void;
}

const MarineFoamFieldContext = createContext<MarineFoamFieldController | null>(null);

declare global {
  interface Window {
    /** QA 观测面：?qa=marine-foam 开启（效果归因/开销测量的只读探针）。 */
    __marineFoamField?: MarineFoamFieldStats;
  }
}

export function MarineFoamFieldProvider({
  tier,
  seaState,
  waves,
  amplitudeScale,
  positionSampler,
  children,
}: {
  readonly tier: 'high' | 'medium' | 'low';
  readonly seaState: number;
  readonly waves: readonly GerstnerWave[];
  readonly amplitudeScale: number;
  readonly positionSampler?: () => { readonly x: number; readonly z: number } | undefined;
  readonly children: ReactNode;
}) {
  const marineVisualTime = useMarineVisualTime();
  // R32F 密度纹理要求 WebGL2；WebGL1 回退（context 为 null）保持既有渲染路径。
  const isWebGL2 = useThree((state) => state.gl.capabilities.isWebGL2);

  const { controller, internal } = useMemo(() => {
    const spec = FOAM_HISTORY_BY_TIER[tier];
    const field = new FoamHistoryField({
      spec,
      domainMeters: FOAM_DOMAIN_METERS,
      driftMetersPerSecond: displayDriftVelocity(waves, DISPLAY_DRIFT_SPEED_METERS_PER_SECOND),
    });
    const texture = new THREE.DataTexture(
      field.grid,
      field.resolution,
      field.resolution,
      THREE.RedFormat,
      THREE.FloatType,
    );
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;

    const attribution = resolveAttributionFromLocation();
    let deposits = 0;
    let depositsWindowStart = 0;
    let depositsLastSecond = 0;
    let lastStepCostMs = 0;
    let avgStepCostMs = 0;
    let textureDirty = false;

    const sources: FoamSourceInputs = {
      waves,
      amplitudeScale,
      seaState,
      naturalEnabled: attribution.natural,
    };

    const controllerValue: MarineFoamFieldController = {
      field,
      texture,
      domainMeters: FOAM_DOMAIN_METERS,
      attribution,
      deposit(worldX, worldZ, radiusMeters, amount) {
        field.deposit(worldX, worldZ, radiusMeters, amount);
        deposits += 1;
        textureDirty = true;
      },
      stats(): MarineFoamFieldStats {
        return {
          domainMeters: FOAM_DOMAIN_METERS,
          resolution: field.resolution,
          updateHz: 1 / field.fixedDtSeconds,
          originX: field.originX,
          originZ: field.originZ,
          timeSeconds: field.timeSeconds,
          epoch: field.epoch,
          attribution: { ...attribution },
          lastStepCostMs,
          avgStepCostMs,
          depositsLastSecond,
          densityAt: (x, z) => field.densityAt(x, z),
        };
      },
    };

    const internalHandle: FoamFieldInternalHandle = {
      tick(visualTime) {
        const timeBefore = field.timeSeconds;
        const before = performance.now();
        field.advanceTime(visualTime, sources);
        const cost = performance.now() - before;
        if (field.timeSeconds !== timeBefore) {
          lastStepCostMs = cost;
          avgStepCostMs = avgStepCostMs === 0 ? cost : avgStepCostMs * 0.9 + cost * 0.1;
          textureDirty = true;
        }
        // 沉积计数按场时间 1s 滚动窗口
        if (field.timeSeconds - depositsWindowStart >= 1) {
          depositsLastSecond = deposits;
          deposits = 0;
          depositsWindowStart = field.timeSeconds;
        }
      },
      recenter(x, z) {
        if (Math.hypot(x - field.originX, z - field.originZ) >= FOAM_RECENTER_STEP_METERS) {
          field.recenter(x, z);
          textureDirty = true;
        }
      },
      flushTexture() {
        if (textureDirty) {
          texture.needsUpdate = true;
          textureDirty = false;
        }
      },
    };

    return { controller: controllerValue, internal: internalHandle };
  }, [tier, waves, amplitudeScale, seaState]);

  const controllerRef = useRef(controller);
  controllerRef.current = controller;
  const internalRef = useRef(internal);
  internalRef.current = internal;

  const fieldContextValue = useMemo(
    () => (isWebGL2 ? controller : null),
    [isWebGL2, controller]
  );

  useFrame((state, delta) => {
    if (!isWebGL2) return;
    const visualTime = marineVisualTime(state, delta);
    internalRef.current.tick(visualTime);
    const sampled = positionSampler?.();
    if (sampled) {
      internalRef.current.recenter(sampled.x, sampled.z);
    }
    internalRef.current.flushTexture();
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !isWebGL2) return;
    if (!new URLSearchParams(window.location.search).has('qa', 'marine-foam')) return;
    const active = controllerRef.current;
    window.__marineFoamField = active.stats();
    const interval = window.setInterval(() => {
      window.__marineFoamField = active.stats();
    }, 500);
    return () => {
      window.clearInterval(interval);
      delete window.__marineFoamField;
    };
  }, [isWebGL2]);

  return (
    <MarineFoamFieldContext.Provider value={fieldContextValue}>
      {children}
    </MarineFoamFieldContext.Provider>
  );
}

/** 消费共享泡沫场：GerstnerWater 宿主内有效；场外的尾迹保持既有渲染路径。 */
export function useMarineFoamField(): MarineFoamFieldController | null {
  return useContext(MarineFoamFieldContext);
}
