'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import type { CruiseControllerMode, CruiseControllerParams, CruiseRole } from '@/lib/cruise-course';
import { CRUISE_COURSE_MODE } from '@/lib/cruise-course';

type WorkspaceTab = 'simulation' | 'linkage';

interface CruiseWorkspaceProps {
  role: CruiseRole;
  sessionId: string;
  currentStepTitle: string;
}

interface SyncMessagePayload {
  type: 'cruise-course-sync';
  source: 'simulation' | 'linkage';
  payload: {
    controlMode?: CruiseControllerMode;
    controller?: CruiseControllerParams;
    metrics?: {
      timeDomain?: {
        overshoot?: number;
        settlingTime?: number;
        accel?: number;
        steadyStateError?: number;
        riseTime?: number;
      } | null;
      frequencyDomain?: {
        phaseMargin?: number;
        gainMargin?: number;
      } | null;
      lateralAccelG?: number;
    };
  };
}

export function CruiseWorkspace({
  role,
  sessionId,
  currentStepTitle,
}: CruiseWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('simulation');
  const simulationRef = useRef<HTMLIFrameElement>(null);
  const linkageRef = useRef<HTMLIFrameElement>(null);
  const [controlMode, setControlMode] = useState<CruiseControllerMode>('pid');
  const [controller, setController] = useState<CruiseControllerParams>({ kp: 1.2, ki: 0.3, kd: 0.8 });
  const [timeMetrics, setTimeMetrics] = useState<{ overshoot?: number; settlingTime?: number; accel?: number }>({});
  const [frequencyMetrics, setFrequencyMetrics] = useState<{ phaseMargin?: number; gainMargin?: number }>({});

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data as SyncMessagePayload | undefined;
      if (!data || data.type !== 'cruise-course-sync') {
        return;
      }

      if (data.payload?.controlMode) {
        setControlMode(data.payload.controlMode);
      }
      if (data.payload?.controller) {
        setController(data.payload.controller);
      }
      if (data.payload?.metrics?.timeDomain) {
        const metric = data.payload.metrics.timeDomain;
        setTimeMetrics((prev) => ({
          ...prev,
          overshoot: metric.overshoot,
          settlingTime: metric.settlingTime,
          accel: metric.accel ?? data.payload?.metrics?.lateralAccelG,
        }));
      }
      if (data.payload?.metrics?.frequencyDomain) {
        const metric = data.payload.metrics.frequencyDomain;
        setFrequencyMetrics({
          phaseMargin: metric.phaseMargin,
          gainMargin: metric.gainMargin,
        });
      }

      if (data.source === 'simulation' && linkageRef.current?.contentWindow) {
        linkageRef.current.contentWindow.postMessage(data, window.location.origin);
      }

      if (data.source === 'linkage' && simulationRef.current?.contentWindow) {
        simulationRef.current.contentWindow.postMessage(data, window.location.origin);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({
      courseMode: CRUISE_COURSE_MODE,
      role,
      sessionId,
      embed: '1',
    });
    return params.toString();
  }, [role, sessionId]);

  const controllerText = useMemo(() => {
    if (controlMode === 'p') {
      return `P: Kp=${controller.kp.toFixed(2)}`;
    }
    if (controlMode === 'pd') {
      return `PD: Kp=${controller.kp.toFixed(2)}, Kd=${controller.kd.toFixed(2)}`;
    }
    return `PID: Kp=${controller.kp.toFixed(2)}, Ki=${controller.ki.toFixed(2)}, Kd=${controller.kd.toFixed(2)}`;
  }, [controlMode, controller.kd, controller.ki, controller.kp]);

  const timeMetricText = useMemo(() => {
    const parts: string[] = [];
    if (typeof timeMetrics.overshoot === 'number') {
      parts.push(`σ=${timeMetrics.overshoot.toFixed(1)}%`);
    }
    if (typeof timeMetrics.settlingTime === 'number') {
      parts.push(`ts=${timeMetrics.settlingTime.toFixed(1)}s`);
    }
    if (typeof timeMetrics.accel === 'number') {
      parts.push(`a=${timeMetrics.accel.toFixed(3)}g`);
    }
    return parts.length ? parts.join(' · ') : '时域指标待更新';
  }, [timeMetrics.accel, timeMetrics.overshoot, timeMetrics.settlingTime]);

  const frequencyMetricText = useMemo(() => {
    const phase = typeof frequencyMetrics.phaseMargin === 'number' ? `PM=${frequencyMetrics.phaseMargin.toFixed(1)}°` : null;
    let gain: string | null = null;
    if (typeof frequencyMetrics.gainMargin === 'number') {
      gain = Number.isFinite(frequencyMetrics.gainMargin) ? `GM=${frequencyMetrics.gainMargin.toFixed(1)}dB` : 'GM=∞';
    }
    const parts = [phase, gain].filter(Boolean);
    return parts.length ? parts.join(' · ') : '频域指标待更新';
  }, [frequencyMetrics.gainMargin, frequencyMetrics.phaseMargin]);

  return (
    <section className="rounded-2xl border border-white/15 bg-slate-900/70 p-3">
      <div className="flex items-center justify-between gap-2 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('simulation')}
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              activeTab === 'simulation'
                ? 'border-cyan-300/80 bg-cyan-400/20 text-cyan-100'
                : 'border-white/20 text-slate-300'
            }`}
          >
            仿真
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('linkage')}
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              activeTab === 'linkage'
                ? 'border-cyan-300/80 bg-cyan-400/20 text-cyan-100'
                : 'border-white/20 text-slate-300'
            }`}
          >
            多表征联动
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-2.5 py-1 text-xs text-cyan-100">{controllerText}</span>
          <span className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-2.5 py-1 text-xs text-emerald-100">{timeMetricText}</span>
          <span className="rounded-full border border-violet-300/30 bg-violet-400/10 px-2.5 py-1 text-xs text-violet-100">{frequencyMetricText}</span>
          <span className="rounded-full border border-white/20 px-3 py-1 text-xs text-slate-200">{currentStepTitle}</span>
        </div>
      </div>

      <div className="h-[calc(100vh-230px)] min-h-[620px] overflow-hidden rounded-xl border border-white/10 bg-black">
        <iframe
          ref={simulationRef}
          title="cruise-simulation-embedded"
          src={`/simulations/cruise?${queryString}`}
          className={`h-full w-full ${activeTab === 'simulation' ? 'block' : 'hidden'}`}
        />
        <iframe
          ref={linkageRef}
          title="multi-linkage-embedded"
          src={`/interactive-learning/multi-representation-linkage?${queryString}`}
          className={`h-full w-full ${activeTab === 'linkage' ? 'block' : 'hidden'}`}
        />
      </div>
    </section>
  );
}
