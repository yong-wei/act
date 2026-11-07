'use client';

import { useEffect, useState } from 'react';

import {
  probeGraphicsCapability,
  probeModelCapability,
  toSimulationReadiness,
  type GraphicsCapability,
  type SimulationReadiness,
} from './simulation-capability';

export interface SimulationReadinessState {
  status: SimulationReadiness;
  modelOk: boolean;
  graphics: GraphicsCapability | null;
}

/**
 * 七船共享的运行前置就绪状态（#2151）：
 * 与 MarineCanvas 使用同一探测缓存；用于开始门控与状态徽章。
 */
export function useSimulationReadiness(): SimulationReadinessState {
  const [model, setModel] = useState<{ ok: boolean } | null>(null);
  const [graphics, setGraphics] = useState<GraphicsCapability | null>(null);

  useEffect(() => {
    let active = true;
    void probeModelCapability().then((value) => {
      if (active) setModel(value);
    });
    void probeGraphicsCapability().then((value) => {
      if (active) setGraphics(value);
    });
    return () => { active = false; };
  }, []);

  return { status: toSimulationReadiness(model, graphics), modelOk: Boolean(model?.ok), graphics };
}
