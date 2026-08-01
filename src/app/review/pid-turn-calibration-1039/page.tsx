import { notFound } from 'next/navigation';

import { AIRecommendPanel } from '@/resources/simulations/ai-recommend-panel';

const envelope = [
  { time: 0, heading: 0, tolerance: 10 },
  { time: 30, heading: 0, tolerance: 10 },
  { time: 90, heading: 90, tolerance: 15 },
  { time: 180, heading: 90, tolerance: 10 },
];

export default function PidRecommendationEvidencePage() {
  if (process.env.COMMERCIAL_UI_EVIDENCE !== '1') {
    notFound();
  }

  const appRevision = process.env.APP_REVISION ?? '';

  return (
    <main
      className="surface-page"
      data-app-revision={appRevision}
    >
      <div className="space-y-5">
        <header className="surface-card p-4 sm:p-6">
          <p className="text-xs font-medium text-primary">Control Workbench / PID turn calibration</p>
          <h1 className="mt-2 text-xl font-semibold sm:text-2xl">90 degree turn recommendation evidence</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            The recommendation target and score use the same 90 degree turn scenario with a 5 degree per second rudder-rate limit.
          </p>
        </header>

        <AIRecommendPanel
          envelope={envelope}
          seaState={{ level: 3, waveHeight: 1.2, windSpeed: 8 }}
          currentParams={{ kp: 1.2, ki: 0.02, kd: 0.6 }}
        />
      </div>
    </main>
  );
}
