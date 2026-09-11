import { ControlWorkbenchShell } from '@/features/control-workbench/shell/control-workbench-shell';
import { resolveControlWorkbenchSession } from '@/features/control-workbench/session-resolver';
import type { ControlWorkbenchRouteParams } from '@/features/control-workbench/types';
import { resolveAdaptivePathLaunchReturnContext } from '@/features/personalization/experience/adaptive-learning-center-contracts';
import { getServerAuthSession } from '@/lib/auth';
import { getPlatformCockpitHref } from '@/lib/platform-role-navigation';

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseRouteParams(searchParams: SearchParams | undefined): ControlWorkbenchRouteParams {
  return {
    arenaTask: firstValue(searchParams?.arenaTask),
    publicationId: firstValue(searchParams?.publicationId),
    classId: firstValue(searchParams?.classId),
    seasonId: firstValue(searchParams?.seasonId),
    preset: firstValue(searchParams?.preset),
    mode: firstValue(searchParams?.mode),
    objectId: firstValue(searchParams?.objectId),
  };
}

export default async function ControlWorkbenchRoute(
  props: {
    searchParams?: Promise<SearchParams>;
  }
) {
  const searchParams = await props.searchParams;
  const session = await getServerAuthSession();
  const pathLaunchContext = resolveAdaptivePathLaunchReturnContext(toSearchParams(searchParams));
  const result = resolveControlWorkbenchSession(parseRouteParams(searchParams));
  return (
    <ControlWorkbenchShell
      result={result}
      accountHref={getPlatformCockpitHref(session?.user?.role)}
      pathLaunchContext={pathLaunchContext}
    />
  );
}

function toSearchParams(searchParams: SearchParams | undefined): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    const item = firstValue(value);
    if (item) params.set(key, item);
  }
  return params;
}
