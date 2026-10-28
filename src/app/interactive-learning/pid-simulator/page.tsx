'use client';

import { InteractiveLearningShell } from '@/features/interactive/interactive-learning-shell';
import { PidSimulatorComponent } from '@/resources/interactive-learning/pid-simulator/pid-simulator-component';

export default function PidSimulatorPage() {
  return (
    <InteractiveLearningShell
      activeHref="/interactive-learning/pid-simulator"
      title="PID 控制仿真器"
      subtitle="多对象动态响应与参数调参"
    >
      <PidSimulatorComponent />
    </InteractiveLearningShell>
  );
}
