import { InteractiveLearningShell } from '@/features/interactive/interactive-learning-shell';
import {
  CRUISE_COURSE_MODE,
  type CruiseControllerMode,
  type CruiseControllerParams,
} from '@/lib/cruise-course';
import { MultiRepresentationLinkageClient } from '@/features/interactive/multi-representation-linkage/page-client';
import type { MultiRepresentationInitialParams } from '@/features/interactive/multi-representation-linkage/model';

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function numberParam(value: string | string[] | undefined): number | undefined {
  const parsed = Number(firstValue(value));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseInitialParams(searchParams: SearchParams | undefined): MultiRepresentationInitialParams {
  const controlMode = firstValue(searchParams?.controlMode) as CruiseControllerMode | undefined;
  const controller: Partial<CruiseControllerParams> = {
    kp: numberParam(searchParams?.kp),
    ki: numberParam(searchParams?.ki),
    kd: numberParam(searchParams?.kd),
  };

  return {
    courseMode: firstValue(searchParams?.courseMode) === CRUISE_COURSE_MODE,
    role: firstValue(searchParams?.role) === 'teacher' ? 'teacher' : 'student',
    embed: firstValue(searchParams?.embed) === '1',
    controlMode,
    controller,
    arenaTaskId: firstValue(searchParams?.arenaTask),
    publicationId: firstValue(searchParams?.publicationId),
  };
}

export default async function MultiRepresentationLinkageRoute(
  props: {
    searchParams?: Promise<SearchParams>;
  }
) {
  const searchParams = await props.searchParams;
  return (
    <InteractiveLearningShell
      activeHref="/interactive-learning/multi-representation-linkage"
      title="多表征联动"
      subtitle="开环极点零点、闭环时域、伯德图、根轨迹与奈奎斯特图同步刷新。"
    >
      <div
        data-interactive-atlas-workspace="multi-representation-linkage"
        data-commercial-student-entry-route="/interactive-learning/multi-representation-linkage"
      >
        <MultiRepresentationLinkageClient initialParams={parseInitialParams(searchParams)} />
      </div>
    </InteractiveLearningShell>
  );
}
