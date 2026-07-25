import type { ResourceRendererLaunchContext } from '@/features/lesson-engine/resource-renderer-config';

export type SimulationCourseResourceKind = 'simulation-scene' | 'arena-workbench';

export interface SimulationSceneCourseEntry {
  id: string;
  label: string;
  href: string;
  objectId: string;
}

export interface SimulationCourseResourceConfig {
  resourceKind: SimulationCourseResourceKind;
  sceneId: string | null;
  scene: SimulationSceneCourseEntry | null;
  arenaTaskId: string | null;
  launchMode: string;
  telemetryPolicy: string;
  routeHref: string;
  governanceContext: Record<string, unknown>;
}

export type SimulationCourseLaunchEventType =
  | 'resource_open'
  | 'arena_workspace_start';

export type SimulationCourseCompletionEventType =
  | 'resource_complete'
  | 'simulation_finish';

export const ELIGIBLE_SIMULATION_SCENES: Record<string, SimulationSceneCourseEntry> = {
  cruise: {
    id: 'cruise',
    label: '爱达·魔都号邮轮横摇控制',
    href: '/simulations/cruise',
    objectId: 'plant-cruise-roll-blackbox',
  },
  destroyer: {
    id: 'destroyer',
    label: '055 型驱逐舰航向控制',
    href: '/simulations/destroyer',
    objectId: 'ship-destroyer-055',
  },
  dredger: {
    id: 'dredger',
    label: '天鲸号挖泥船动力定位',
    href: '/simulations/dredger',
    objectId: 'ship-dredger-tianjing',
  },
  drilling: {
    id: 'drilling',
    label: '海洋石油 981 钻井平台定位',
    href: '/simulations/drilling',
    objectId: 'platform-hysy981',
  },
  icebreaker: {
    id: 'icebreaker',
    label: '雪龙号破冰航行控制',
    href: '/simulations/icebreaker',
    objectId: 'ship-icebreaker-xuelong',
  },
  lng: {
    id: 'lng',
    label: '长恒号 LNG 船晃荡抑制',
    href: '/simulations/lng',
    objectId: 'ship-lng-changheng',
  },
  container: {
    id: 'container',
    label: 'MSC 集装箱船航迹保持',
    href: '/simulations/container',
    objectId: 'ship-container-msc',
  },
};

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readRecord(record: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = record[key];
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function resolveSimulationCourseResourceConfig(
  props: Record<string, unknown>,
): SimulationCourseResourceConfig {
  const resourceKind = readString(props, 'resourceKind') === 'arena-workbench'
    ? 'arena-workbench'
    : 'simulation-scene';
  const sceneId = readString(props, 'sceneId');
  const scene = sceneId ? ELIGIBLE_SIMULATION_SCENES[sceneId] ?? null : null;
  const arenaTaskId = readString(props, 'arenaTaskId') ?? readString(props, 'taskId');
  const configuredRoute = readString(props, 'routeHref') ?? readString(props, 'href');
  const fallbackRoute = resourceKind === 'arena-workbench' && arenaTaskId
    ? `/arena/challenges/${arenaTaskId}`
    : scene?.href ?? '/simulations';

  return {
    resourceKind,
    sceneId: sceneId ?? null,
    scene,
    arenaTaskId,
    launchMode: readString(props, 'launchMode') ?? 'route',
    telemetryPolicy: readString(props, 'telemetryPolicy') ?? 'course-context',
    routeHref: configuredRoute ?? fallbackRoute,
    governanceContext: readRecord(props, 'governanceContext'),
  };
}

function appendQueryParam(params: URLSearchParams, key: string, value: string | null | undefined) {
  if (value && value.trim().length > 0) {
    params.set(key, value);
  }
}

const GOVERNANCE_QUERY_KEYS = [
  'publicationId',
  'seasonId',
  'courseId',
  'assignmentId',
  'mode',
] as const;

function readContextString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function appendGovernanceParams(params: URLSearchParams, governanceContext: Record<string, unknown>) {
  for (const key of GOVERNANCE_QUERY_KEYS) {
    appendQueryParam(params, key, readContextString(governanceContext, key));
  }
}

function formatLaunchUrl(url: URL, originalHref: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(originalHref)) {
    return url.toString();
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

export function buildSimulationCourseLaunchHref(
  config: SimulationCourseResourceConfig,
  launchContext: ResourceRendererLaunchContext,
  completionChannelId?: string,
): string {
  const url = new URL(config.routeHref, 'https://course-resource.local');
  const { searchParams: params } = url;

  appendGovernanceParams(params, config.governanceContext);
  params.set('courseResource', '1');
  params.set('launchContext', launchContext.provenance);
  params.set('contextState', launchContext.contextState);
  appendQueryParam(params, 'resourceId', launchContext.resourceId);
  appendQueryParam(params, 'registryId', launchContext.registryId ?? undefined);
  appendQueryParam(params, 'sessionId', launchContext.sessionId ?? undefined);
  appendQueryParam(params, 'lessonItemId', launchContext.lessonItemId ?? undefined);
  appendQueryParam(params, 'lessonPlanId', launchContext.lessonPlanId ?? undefined);
  appendQueryParam(
    params,
    'classId',
    launchContext.classId ?? readContextString(config.governanceContext, 'classId') ?? undefined,
  );
  appendQueryParam(params, 'stage', launchContext.stage ?? undefined);
  appendQueryParam(params, 'sceneId', config.sceneId ?? undefined);
  appendQueryParam(params, 'arenaTask', config.arenaTaskId ?? undefined);
  appendQueryParam(params, 'completionChannelId', completionChannelId);

  return formatLaunchUrl(url, config.routeHref);
}

export function getSimulationCourseLaunchEventType(
  config: SimulationCourseResourceConfig,
): SimulationCourseLaunchEventType {
  return config.resourceKind === 'arena-workbench' && config.arenaTaskId
    ? 'arena_workspace_start'
    : 'resource_open';
}

export function getSimulationCourseCompletionEventType(
  config: SimulationCourseResourceConfig,
): SimulationCourseCompletionEventType {
  return config.resourceKind === 'arena-workbench'
    ? 'resource_complete'
    : 'simulation_finish';
}

export function buildSimulationCourseEvidencePayload(
  config: SimulationCourseResourceConfig,
  launchContext: ResourceRendererLaunchContext,
): Record<string, unknown> {
  const publicationId = readContextString(config.governanceContext, 'publicationId');
  const seasonId = readContextString(config.governanceContext, 'seasonId');
  const courseId = readContextString(config.governanceContext, 'courseId');
  const classId = launchContext.classId ?? readContextString(config.governanceContext, 'classId');
  const simulationId = config.sceneId ?? config.scene?.id ?? null;

  return {
    resourceKind: config.resourceKind,
    resourceId: launchContext.resourceId,
    registryId: launchContext.registryId,
    sessionId: launchContext.sessionId,
    lessonItemId: launchContext.lessonItemId,
    lessonPlanId: launchContext.lessonPlanId,
    classId,
    stage: launchContext.stage,
    sceneId: config.sceneId,
    sceneLabel: config.scene?.label ?? null,
    simulationId,
    arenaTaskId: config.arenaTaskId,
    taskId: config.arenaTaskId,
    publicationId,
    seasonId,
    courseId,
    telemetryPolicy: config.telemetryPolicy,
    governanceContext: config.governanceContext,
    launchContext,
  };
}
