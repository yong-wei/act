import dynamicImport from 'next/dynamic';
import { FeaturePageNav } from '@/components/shared/feature-page-nav';
import { ArenaBlackBoxSubmissionPanel } from '@/features/arena/submissions/arena-blackbox-submission-panel';
import { prismaArenaSubmissionStore } from '@/features/arena/submissions/prisma-store';
import { resolveArenaWorkbenchContext } from '@/features/arena/workbench/context';

export const dynamic = 'force-dynamic';

const CruiseSimulation = dynamicImport(
  () => import('@/resources/simulations/simulations/cruise-simulation'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[560px] items-center justify-center text-slate-300">
        正在加载爱达·魔都号邮轮仿真场景...
      </div>
    ),
  },
);

type CruiseSimulationPageProps = {
  searchParams?: {
    arenaTask?: string | string[];
    mode?: string | string[];
  };
};

function getSingleSearchParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CruiseSimulationPage({ searchParams }: CruiseSimulationPageProps) {
  const arenaTaskId = getSingleSearchParam(searchParams?.arenaTask);
  const arenaContext = arenaTaskId ? resolveArenaWorkbenchContext(arenaTaskId) : null;
  const blackBoxTask = arenaContext?.task.workspaceMode === 'black-box-identification'
    ? arenaContext.task
    : null;
  const blackBoxSubmissions = blackBoxTask
    ? await prismaArenaSubmissionStore.listSubmissions({ taskId: blackBoxTask.id })
    : [];

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100">
      <FeaturePageNav title="邮轮仿真" backHref="/simulations" backLabel="返回仿真入口" floating />
      <CruiseSimulation />
      {blackBoxTask ? (
        <div className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 lg:px-8">
          <ArenaBlackBoxSubmissionPanel task={blackBoxTask} initialSubmissions={blackBoxSubmissions} />
        </div>
      ) : null}
    </div>
  );
}
