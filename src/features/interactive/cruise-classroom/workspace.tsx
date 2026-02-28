'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import type { CruiseRole } from '@/lib/cruise-course';
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
  payload: unknown;
}

export function CruiseWorkspace({
  role,
  sessionId,
  currentStepTitle,
}: CruiseWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('simulation');
  const simulationRef = useRef<HTMLIFrameElement>(null);
  const linkageRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data as SyncMessagePayload | undefined;
      if (!data || data.type !== 'cruise-course-sync') {
        return;
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

        <div className="flex items-center gap-2">
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
