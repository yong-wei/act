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
  };
}

export default function MultiRepresentationLinkageRoute({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  return <MultiRepresentationLinkageClient initialParams={parseInitialParams(searchParams)} />;
}
