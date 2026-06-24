import { SimulationShell } from '../_components/simulation-shell';
import { DestroyerSimulation } from '../_components/simulation-loaders';
import { StudentFeedbackTaskPanel } from '@/features/assessment/student-feedback-task-panel';
import { buildFeedbackTaskContext, type FeedbackTaskQuery } from '@/lib/student-feedback-task-contract';

export const dynamic = 'force-dynamic';

export default async function DestroyerSimulationPage({
  searchParams,
}: {
  searchParams?: Promise<FeedbackTaskQuery>;
}) {
  const params = await searchParams;
  const feedbackContext = buildFeedbackTaskContext(params ?? {});
  return (
    <SimulationShell
      title="军用驱逐舰战术机动仿真"
      subtitle="Nomoto 船舶运动模型 · 航向保持与战术机动"
      activeHref="/simulations/destroyer"
      localToolTemplate="heading-control"
    >
      <StudentFeedbackTaskPanel context={feedbackContext} surface="simulation-destroyer" className="mb-4" />
      <DestroyerSimulation />
    </SimulationShell>
  );
}
