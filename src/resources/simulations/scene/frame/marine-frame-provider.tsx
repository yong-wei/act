'use client';

import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';

import {
  createMarineFrameRunner,
  type MarineFrameInputs,
  type MarineFrameRunner,
} from './marine-frame';

/**
 * 海洋场景帧 Provider（#2097）：在 Canvas 内提供统一帧快照与共享视觉时钟。
 *
 * 一帧由首个消费者推进并冻结快照（consumeFrame 的 stamp 去重保证同帧唯一）；
 * 其余模块经 useMarineVisualTime 读同一视觉时间，无 Provider 时回退 R3F 时钟
 * （未迁移船包零改动）。epoch 重置与尾迹清空同源：对 Provider 使用与尾迹相同的
 * React key（resetToken）重挂载。
 */
const MarineFrameContext = createContext<MarineFrameRunner | null>(null);

export interface MarineFrameRuntimeProbe {
  readonly timeSeconds: () => number;
  readonly seek: (timeSeconds: number) => void;
  readonly reset: () => void;
  readonly latestDigest: () => {
    visualTimeSeconds: number | null;
    simulationTimeSeconds: number | null;
    advancing: boolean | null;
    worldPose: { x: number; z: number; headingRad: number } | null;
  };
}

declare global {
  interface Window {
    __marineFrameRuntime?: MarineFrameRuntimeProbe;
  }
}

export function MarineFrameProvider({
  inputs,
  children,
}: {
  readonly inputs: MarineFrameInputs;
  readonly children: ReactNode;
}) {
  const runner = useMemo(() => createMarineFrameRunner(inputs), [inputs]);

  useEffect(() => {
    // QA 注入入口：?qa=marine-frame 开启（与知识图谱 QA 探针同一模式）。
    // 固定种子/时间注入由 capture 脚本经 seek/reset 驱动，确定性断言用 latestDigest。
    if (typeof window === 'undefined') return;
    if (!new URLSearchParams(window.location.search).has('qa', 'marine-frame')) return;
    window.__marineFrameRuntime = {
      timeSeconds: runner.clock.timeSeconds,
      seek: runner.clock.seek,
      reset: runner.clock.reset,
      latestDigest: () => {
        const snapshot = runner.latest();
        return snapshot
          ? {
              visualTimeSeconds: snapshot.visualTimeSeconds,
              simulationTimeSeconds: snapshot.simulationTimeSeconds,
              advancing: snapshot.advancing,
              worldPose: snapshot.worldPose,
              environmentPresetId: snapshot.environmentPresetId,
              qualityTier: snapshot.qualityTier,
              // 确定性采样点：同一时间/波场身份下高度必须可复现。
              referenceWaterHeight: snapshot.sampleWaterHeight(0, 0),
            }
          : {
              visualTimeSeconds: null,
              simulationTimeSeconds: null,
              advancing: null,
              worldPose: null,
              environmentPresetId: null,
              qualityTier: null,
              referenceWaterHeight: null,
            };
      },
    };
    return () => {
      delete window.__marineFrameRuntime;
    };
  }, [runner]);

  return <MarineFrameContext.Provider value={runner}>{children}</MarineFrameContext.Provider>;
}

/** 数值引擎接入：推进帧并取冻结快照（每帧一次；视觉消费者请用 useMarineVisualTime）。 */
export function useMarineFrameRunner(): MarineFrameRunner | null {
  return useContext(MarineFrameContext);
}

/**
 * 视觉时间源：Provider 存在时返回共享视觉时间（同帧唯一、暂停/倍速政策一致），
 * 否则回退 R3F elapsed（未迁移船包行为不变）。
 */
export function useMarineVisualTime(): (state: { clock: { elapsedTime: number; getElapsedTime?: () => number } }, delta: number) => number {
  const runner = useContext(MarineFrameContext);
  return useMemo(
    () => (runner
      ? (state, delta) => runner.consumeFrame(state.clock.elapsedTime, delta).visualTimeSeconds
      : (state) => state.clock.getElapsedTime?.() ?? state.clock.elapsedTime),
    [runner],
  );
}
