'use client';

import { useEffect, useState } from 'react';

import {
  probeGraphicsCapability,
  probeModelCapability,
  type GraphicsCapability,
} from './simulation-capability';
import { subscribeMarineCanvasStatus, type MarineCanvasStatus } from './marine-status-store';
import type { SimulationReadiness } from './simulation-capability';

export interface SimulationReadinessState {
  status: SimulationReadiness;
  modelOk: boolean;
  graphics: GraphicsCapability | null;
}

/**
 * 七船共享的运行就绪状态（#2151）：
 * 以真实 MarineCanvas 生命周期为主源（初始化/失败/设备丢失即时反映），
 * 离屏能力探测仅作为画布尚未发布状态时的准备期参考；显式 ?graphics= 覆盖
 * 时只探测指定后端，不被另一后端的成功掩盖。
 */
export function useSimulationReadiness(): SimulationReadinessState {
  const [model, setModel] = useState<{ ok: boolean } | null>(null);
  const [graphics, setGraphics] = useState<GraphicsCapability | null>(null);
  const [canvasStatus, setCanvasStatus] = useState<MarineCanvasStatus | null>(null);

  useEffect(() => {
    let active = true;
    void probeModelCapability().then((value) => {
      if (active) setModel(value);
    });
    const explicitParam = typeof window === 'undefined'
      ? null
      : new URLSearchParams(window.location.search).get('graphics');
    const explicit = explicitParam === 'webgl' || explicitParam === 'webgpu' ? explicitParam : null;
    void probeGraphicsCapability(explicit).then((value) => {
      if (active) setGraphics(value);
    });
    const unsubscribe = subscribeMarineCanvasStatus((value) => {
      if (active) setCanvasStatus(value);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  let status: SimulationReadiness;
  if (canvasStatus === 'failed') {
    status = 'unavailable';
  } else if (!model || !model.ok) {
    status = 'preparing-model';
  } else if (canvasStatus === 'runnable') {
    status = 'runnable';
  } else if (graphics && !graphics.ok) {
    status = 'unavailable';
  } else {
    status = 'preparing-graphics';
  }

  return { status, modelOk: Boolean(model?.ok), graphics };
}
