import type {
  PlatformStatusPayload,
  PlatformSourceCoverageStatus,
  PlatformReplayStatus,
} from '@/components/platform/platform-ui-contracts';
import type { ResourceRendererLaunchContext } from '@/features/lesson-engine/resource-renderer-config';
import { getControlWorkbenchReturnHref } from '@/features/control-workbench/routing';
import type { WorkbenchSessionContext } from '@/features/control-workbench/types';

export type ExperienceShellSurface =
  | 'simulation-hub'
  | 'simulation-scene'
  | 'arena-hall'
  | 'arena-challenge-detail'
  | 'control-workbench'
  | 'course-resource-launch';

export type ExperienceShellSlot =
  | 'context-header'
  | 'workflow-navigation'
  | 'main-stage'
  | 'side-panels'
  | 'status-rail'
  | 'bottom-tools'
  | 'support-drawer';

export type TaskWorkspaceArchetype =
  | 'immersive-scene'
  | 'engineering-analysis'
  | 'challenge-task'
  | 'lesson-runtime'
  | 'learner-data'
  | 'operations-analytics'
  | 'governance-console';

export type TaskWorkspaceZone =
  | 'context-strip'
  | 'command-bar'
  | 'instrument-area'
  | 'evidence-rail'
  | 'support-drawer'
  | 'bottom-tools'
  | 'floating-dock-safe-area';

export type ExperienceLaunchKind =
  | 'standalone'
  | 'course-launched'
  | 'arena-preview'
  | 'official-evaluation'
  | 'teacher-review'
  | 'admin-review';

export type TaskWorkspaceRoleScope = 'student' | 'teacher' | 'admin';

export type ExperienceReplayState =
  | 'unavailable'
  | 'pending'
  | 'verified'
  | 'mismatched'
  | 'restricted';

export type ExperienceModelRegistryStatus = 'registered' | 'preview' | 'missing' | 'unsupported';

export interface ExperienceLaunchContext {
  kind: ExperienceLaunchKind;
  roleScope?: readonly TaskWorkspaceRoleScope[];
  course?: {
    sessionId?: string | null;
    lessonItemId?: string | null;
    lessonPlanId?: string | null;
    classId?: string | null;
  };
  arena?: {
    taskId?: string;
    publicationId?: string;
    classId?: string;
    seasonId?: string;
  };
}

export interface ExperienceReplayContext {
  state: ExperienceReplayState;
  protocolVersion?: string;
  checksum?: string;
}

export interface ExperienceModelRelationContext {
  relation: 'same' | 'simplified' | 'surrogate';
  registryStatus: ExperienceModelRegistryStatus;
  modelId?: string;
}

export interface ExperienceShellMigrationContract {
  surface: ExperienceShellSurface;
  adapter: string;
  preserves: string;
}

export interface ExperienceShellSlotContract {
  slot: ExperienceShellSlot;
  accepts: string;
}

export interface ExperienceBreadcrumb {
  label: string;
  href?: string;
}

export interface ExperienceLaunchDescription {
  label: string;
  visualBoundary: 'standalone' | 'course' | 'preview' | 'official' | 'review';
  summary: string;
}

export interface ExperienceStatusPayloads {
  launch: PlatformStatusPayload;
  evaluation: PlatformStatusPayload;
  replay: PlatformStatusPayload;
  modelRelation: PlatformStatusPayload;
}

export interface WorkbenchExperienceContext {
  launch: ExperienceLaunchContext;
  taskId?: string;
  title: string;
  returnHref: string;
  breadcrumbs: ExperienceBreadcrumb[];
  slotContracts: ExperienceShellSlotContract[];
}

export interface CourseLaunchExperienceContext {
  launch: ExperienceLaunchContext;
  course: NonNullable<ExperienceLaunchContext['course']>;
  renderMode: 'embedded' | 'standalone';
  runtimeContracts: string[];
}

export interface TaskWorkspaceArchetypeContract {
  archetype: TaskWorkspaceArchetype;
  primaryZone: TaskWorkspaceZone;
  requiredZones: readonly TaskWorkspaceZone[];
  localControls: readonly string[];
  shellControls: readonly string[];
}

export interface TaskWorkspaceRouteContract {
  href: string;
  surface: ExperienceShellSurface;
  archetype: TaskWorkspaceArchetype;
  launchKind: ExperienceLaunchKind;
  returnTarget: string;
  roleScope: readonly TaskWorkspaceRoleScope[];
  requiredZones: readonly TaskWorkspaceZone[];
}

export const EXPERIENCE_SHELL_SLOT_ORDER: ExperienceShellSlot[] = [
  'context-header',
  'workflow-navigation',
  'main-stage',
  'side-panels',
  'status-rail',
  'bottom-tools',
  'support-drawer',
];

export const TASK_WORKSPACE_ARCHETYPE_CONTRACTS: TaskWorkspaceArchetypeContract[] = [
  {
    archetype: 'immersive-scene',
    primaryZone: 'instrument-area',
    requiredZones: ['context-strip', 'instrument-area', 'command-bar', 'evidence-rail', 'bottom-tools', 'support-drawer', 'floating-dock-safe-area'],
    localControls: ['camera tools', 'scene parameter controls', 'telemetry toggles'],
    shellControls: ['Konling', 'role cockpit', 'account settings'],
  },
  {
    archetype: 'engineering-analysis',
    primaryZone: 'instrument-area',
    requiredZones: ['context-strip', 'command-bar', 'instrument-area', 'evidence-rail', 'support-drawer', 'floating-dock-safe-area'],
    localControls: ['chart toggles', 'panel configuration', 'parameter controls', 'submission controls'],
    shellControls: ['Konling', 'role cockpit', 'account settings'],
  },
  {
    archetype: 'challenge-task',
    primaryZone: 'command-bar',
    requiredZones: ['context-strip', 'command-bar', 'instrument-area', 'evidence-rail', 'support-drawer', 'floating-dock-safe-area'],
    localControls: ['workspace launch', 'leaderboard filters', 'challenge inspection'],
    shellControls: ['Konling', 'role cockpit', 'account settings'],
  },
  {
    archetype: 'lesson-runtime',
    primaryZone: 'instrument-area',
    requiredZones: ['context-strip', 'instrument-area', 'support-drawer', 'floating-dock-safe-area'],
    localControls: ['step navigation', 'activity controls', 'submission controls'],
    shellControls: ['Konling', 'role cockpit', 'account settings'],
  },
  {
    archetype: 'learner-data',
    primaryZone: 'instrument-area',
    requiredZones: ['context-strip', 'command-bar', 'instrument-area', 'evidence-rail', 'support-drawer', 'floating-dock-safe-area'],
    localControls: ['pathway filters', 'evidence inspection', 'competency drilldown'],
    shellControls: ['Konling', 'role cockpit', 'account settings'],
  },
  {
    archetype: 'operations-analytics',
    primaryZone: 'instrument-area',
    requiredZones: ['context-strip', 'command-bar', 'instrument-area', 'evidence-rail', 'support-drawer', 'floating-dock-safe-area'],
    localControls: ['cohort filters', 'experiment assignment controls', 'analytics drilldown'],
    shellControls: ['Konling', 'role cockpit', 'account settings'],
  },
  {
    archetype: 'governance-console',
    primaryZone: 'evidence-rail',
    requiredZones: ['context-strip', 'command-bar', 'instrument-area', 'evidence-rail', 'support-drawer', 'floating-dock-safe-area'],
    localControls: ['policy review filters', 'audit evidence inspection', 'approval controls'],
    shellControls: ['Konling', 'role cockpit', 'account settings'],
  },
];

export const TASK_WORKSPACE_ROUTE_CONTRACTS: TaskWorkspaceRouteContract[] = [
  {
    href: '/simulations/cruise',
    surface: 'simulation-scene',
    archetype: 'immersive-scene',
    launchKind: 'standalone',
    returnTarget: '/simulations',
    roleScope: ['student', 'teacher', 'admin'],
    requiredZones: ['context-strip', 'instrument-area', 'command-bar', 'evidence-rail', 'bottom-tools', 'support-drawer', 'floating-dock-safe-area'],
  },
  {
    href: '/interactive-learning/control-workbench',
    surface: 'control-workbench',
    archetype: 'engineering-analysis',
    launchKind: 'standalone',
    returnTarget: '/interactive-learning/cross-domain-exploration',
    roleScope: ['student', 'teacher', 'admin'],
    requiredZones: ['context-strip', 'command-bar', 'instrument-area', 'evidence-rail', 'support-drawer', 'floating-dock-safe-area'],
  },
  {
    href: '/arena/challenges/[taskId]',
    surface: 'arena-challenge-detail',
    archetype: 'challenge-task',
    launchKind: 'arena-preview',
    returnTarget: '/arena',
    roleScope: ['student', 'teacher', 'admin'],
    requiredZones: ['context-strip', 'command-bar', 'instrument-area', 'evidence-rail', 'support-drawer', 'floating-dock-safe-area'],
  },
  {
    href: '/interactive-learning/courses/[lesson]',
    surface: 'course-resource-launch',
    archetype: 'lesson-runtime',
    launchKind: 'course-launched',
    returnTarget: '/interactive-learning/courses',
    roleScope: ['student', 'teacher'],
    requiredZones: ['context-strip', 'instrument-area', 'support-drawer', 'floating-dock-safe-area'],
  },
];

export const EXPERIENCE_SHELL_MIGRATION_CONTRACTS: ExperienceShellMigrationContract[] = [
  {
    surface: 'simulation-hub',
    adapter: 'Expose hub cards through the shared context header and workflow navigation.',
    preserves: 'Simulation catalog filtering and route destinations stay owned by simulation resources.',
  },
  {
    surface: 'simulation-scene',
    adapter: 'Wrap SceneShell-compatible pages with launch provenance and replay status rail.',
    preserves: 'Scene physics, model stepping, telemetry capture, and asset loading stay inside scene modules.',
  },
  {
    surface: 'arena-hall',
    adapter: 'Render Arena discovery inside the shared workflow navigation and main-stage shell.',
    preserves: 'Arena task filtering, publication visibility, and leaderboard policy stay in Arena modules.',
  },
  {
    surface: 'arena-challenge-detail',
    adapter: 'Keep challenge detail read-only while exposing Workbench launch and preview/official status.',
    preserves: 'Challenge detail routing, leaderboard eligibility, and Workbench href generation remain unchanged.',
  },
  {
    surface: 'control-workbench',
    adapter: 'Use context header, main stage, side panels, status rail, and return navigation slots.',
    preserves: 'Submission, metrics, replay, evidence, panel persistence, and object selection stay in Workbench modules.',
  },
  {
    surface: 'course-resource-launch',
    adapter: 'Add visible course provenance around ResourceRenderer-launched experiences.',
    preserves: 'ResourceRenderer, InteractiveProvider, BaseWidgetProps, progress callbacks, and config merge order.',
  },
];

const defaultSlotContracts: ExperienceShellSlotContract[] = [
  {
    slot: 'context-header',
    accepts: 'launch provenance, breadcrumb lineage, task identity, and return navigation',
  },
  {
    slot: 'workflow-navigation',
    accepts: 'discover, inspect, launch, experiment, submit, compare, and review workflow steps',
  },
  {
    slot: 'main-stage',
    accepts: 'scene canvas, Arena challenge content, or Control Workbench engineering panels',
  },
  {
    slot: 'side-panels',
    accepts: 'metrics, model relation, evidence explanation, and workflow-specific tools',
  },
  {
    slot: 'status-rail',
    accepts: 'submission status, replay state, preview/official boundary, and evidence provenance',
  },
  {
    slot: 'bottom-tools',
    accepts: 'camera presets, chart view controls, local reset controls, and task-specific utilities',
  },
  {
    slot: 'support-drawer',
    accepts: 'explanations, hints, assistant support, teacher-only notes, and operational logs',
  },
];

export function describeExperienceLaunch(launch: ExperienceLaunchContext): ExperienceLaunchDescription {
  if (launch.kind === 'course-launched') {
    return {
      label: '课程内启动',
      visualBoundary: 'course',
      summary: '该体验由 DB BOPPPS 课程资源启动，保留课堂、课次和资源上下文。',
    };
  }
  if (launch.kind === 'arena-preview') {
    return {
      label: 'Arena 预览',
      visualBoundary: 'preview',
      summary: '该体验用于公开预览或虚拟试运行，不作为官方榜单证据。',
    };
  }
  if (launch.kind === 'official-evaluation') {
    return {
      label: '官方评价',
      visualBoundary: 'official',
      summary: '该体验连接官方评价或提交流程，隐藏评价边界必须保持可见。',
    };
  }
  if (launch.kind === 'teacher-review') {
    return {
      label: '教师复核',
      visualBoundary: 'review',
      summary: '该体验由教师复核入口打开，保留课堂、学生与教学证据的角色边界。',
    };
  }
  if (launch.kind === 'admin-review') {
    return {
      label: '管理员复核',
      visualBoundary: 'review',
      summary: '该体验由管理员复核入口打开，保留审计、策略和受限数据的角色边界。',
    };
  }
  return {
    label: '独立探索',
    visualBoundary: 'standalone',
    summary: '该体验由独立入口启动，不携带课程或 Arena 官方评价上下文。',
  };
}

function evaluationStatus(launch: ExperienceLaunchContext): PlatformStatusPayload {
  const official = launch.kind === 'official-evaluation';
  const preview = launch.kind === 'arena-preview';
  const review = launch.kind === 'teacher-review' || launch.kind === 'admin-review';
  return {
    id: 'experience-evaluation-boundary',
    label: '评价边界',
    source: { domain: 'arena', capability: 'experience-shell' },
    summary: official
      ? '当前体验连接官方评价流程；公开预览结果不得覆盖隐藏官方评价。'
      : preview
        ? '当前体验是 Arena 预览；结果不能作为官方榜单证据。'
        : review
          ? '当前体验用于教师或管理员复核；复核证据不得替代学生正式提交。'
          : '当前体验不产生 Arena 官方评价。',
    categories: {
      confidence: official || preview || review ? 'high' : 'medium',
      sourceCoverage: official || preview || review ? 'complete' : 'partial',
      privacy: official || launch.kind === 'admin-review' ? 'restricted' : launch.kind === 'teacher-review' ? 'classroom' : 'public',
      replay: 'missing',
      protocol: preview ? 'preview' : 'current',
      evaluation: official ? 'official' : preview ? 'preview' : review ? 'hidden' : 'not-evaluated',
      readiness: 'ready',
      fallback: 'none',
    },
  };
}

function replayCategory(state: ExperienceReplayState): PlatformReplayStatus {
  if (state === 'verified') return 'ready';
  if (state === 'pending') return 'partial';
  if (state === 'restricted') return 'partial';
  if (state === 'mismatched') return 'stale';
  return 'missing';
}

function replayStatus(replay: ExperienceReplayContext | undefined): PlatformStatusPayload {
  const state = replay?.state ?? 'unavailable';
  return {
    id: 'experience-replay-state',
    label: '回放状态',
    source: { domain: 'simulation', capability: 'trace-replay' },
    summary: `回放状态：${state}${replay?.protocolVersion ? `，协议 ${replay.protocolVersion}` : ''}`,
    details: replay?.checksum
      ? [{ label: '回放校验', value: replay.checksum, roleScope: 'teacher-scoped' }]
      : [],
    categories: {
      confidence: state === 'verified' ? 'high' : state === 'pending' || state === 'restricted' ? 'medium' : 'low',
      sourceCoverage: state === 'verified' ? 'complete' : state === 'unavailable' ? 'missing' : 'partial',
      privacy: state === 'restricted' ? 'restricted' : 'public',
      replay: replayCategory(state),
      protocol: replay?.protocolVersion ? 'current' : 'missing',
      evaluation: 'not-evaluated',
      readiness: state === 'mismatched' ? 'degraded' : 'ready',
      fallback: state === 'unavailable' ? 'fallback-missing-context' : 'none',
    },
  };
}

function registryCoverage(status: ExperienceModelRegistryStatus): PlatformSourceCoverageStatus {
  if (status === 'registered') return 'complete';
  if (status === 'preview') return 'partial';
  if (status === 'unsupported') return 'unsupported';
  return 'missing';
}

function modelRelationStatus(modelRelation: ExperienceModelRelationContext | undefined): PlatformStatusPayload {
  const relation = modelRelation?.relation ?? 'same';
  const registryStatus = modelRelation?.registryStatus ?? 'missing';
  const equivalentModel = relation === 'same';
  const registeredEquivalentModel = registryStatus === 'registered' && equivalentModel;
  return {
    id: 'experience-model-relation',
    label: '模型关系',
    source: { domain: 'arena', capability: 'model-registry' },
    summary: `Arena 模型关系：${relation}；注册状态：${registryStatus}${modelRelation?.modelId ? `；模型 ${modelRelation.modelId}` : ''}`,
    categories: {
      confidence: registeredEquivalentModel ? 'high' : 'medium',
      sourceCoverage: registryStatus === 'registered' && !equivalentModel
        ? 'partial'
        : registryCoverage(registryStatus),
      privacy: 'public',
      replay: 'missing',
      protocol: registryStatus === 'unsupported' ? 'unsupported' : 'current',
      evaluation: 'not-evaluated',
      readiness: registeredEquivalentModel ? 'ready' : 'degraded',
      fallback: registryStatus === 'missing' ? 'fallback-missing-context' : 'none',
    },
  };
}

function launchStatus(launch: ExperienceLaunchContext): PlatformStatusPayload {
  const description = describeExperienceLaunch(launch);
  const review = launch.kind === 'teacher-review' || launch.kind === 'admin-review';
  return {
    id: 'experience-launch-provenance',
    label: '启动来源',
    source: { domain: 'simulation', capability: 'experience-shell' },
    summary: description.summary,
    details: launch.roleScope?.length
      ? [{ label: '角色范围', value: launch.roleScope.join(', '), roleScope: launch.kind === 'admin-review' ? 'admin-scoped' : 'teacher-scoped' }]
      : [],
    categories: {
      confidence: 'high',
      sourceCoverage: 'complete',
      privacy: launch.kind === 'admin-review' ? 'restricted' : launch.kind === 'course-launched' || launch.kind === 'teacher-review' ? 'classroom' : 'public',
      replay: 'missing',
      protocol: launch.kind === 'arena-preview' ? 'preview' : 'current',
      evaluation: launch.kind === 'official-evaluation'
        ? 'official'
        : launch.kind === 'arena-preview'
          ? 'preview'
          : review
            ? 'hidden'
            : 'not-evaluated',
      readiness: 'ready',
      fallback: 'none',
    },
  };
}

export function buildExperienceStatusPayloads({
  launch,
  replay,
  modelRelation,
}: {
  launch: ExperienceLaunchContext;
  replay?: ExperienceReplayContext;
  modelRelation?: ExperienceModelRelationContext;
}): ExperienceStatusPayloads {
  return {
    launch: launchStatus(launch),
    evaluation: evaluationStatus(launch),
    replay: replayStatus(replay),
    modelRelation: modelRelationStatus(modelRelation),
  };
}

export function buildWorkbenchExperienceContext(session: WorkbenchSessionContext): WorkbenchExperienceContext {
  const arenaBound = 'taskId' in session;
  const title = arenaBound ? session.task.title : session.title ?? '综合仿真工作台';
  const launch: ExperienceLaunchContext = arenaBound
    ? {
      kind: session.submissionPolicy.officialEvaluationEnabled ? 'official-evaluation' : 'arena-preview',
      arena: {
        taskId: session.taskId,
        publicationId: 'publicationId' in session ? session.publicationId : undefined,
        classId: 'classId' in session ? session.classId : undefined,
        seasonId: 'seasonId' in session ? session.seasonId : undefined,
      },
    }
    : { kind: 'standalone' };

  return {
    launch,
    taskId: arenaBound ? session.taskId : undefined,
    title,
    returnHref: getControlWorkbenchReturnHref(session),
    breadcrumbs: arenaBound
      ? [
        { label: 'Arena', href: '/arena' },
        { label: session.task.title, href: `/arena/challenges/${session.taskId}` },
        { label: '控制工作台' },
      ]
      : [
        { label: '跨域探索', href: '/interactive-learning/cross-domain-exploration' },
        { label: '控制工作台' },
      ],
    slotContracts: defaultSlotContracts,
  };
}

export function buildCourseLaunchExperienceContext(
  launchContext: ResourceRendererLaunchContext,
  options: { embedded: boolean },
): CourseLaunchExperienceContext {
  return {
    launch: {
      kind: launchContext.provenance === 'db-boppps' ? 'course-launched' : 'standalone',
      course: {
        sessionId: launchContext.sessionId,
        lessonItemId: launchContext.lessonItemId,
        lessonPlanId: launchContext.lessonPlanId,
        classId: launchContext.classId,
      },
    },
    course: {
      sessionId: launchContext.sessionId,
      lessonItemId: launchContext.lessonItemId,
      lessonPlanId: launchContext.lessonPlanId,
      classId: launchContext.classId,
    },
    renderMode: options.embedded ? 'embedded' : 'standalone',
    runtimeContracts: [
      'ResourceRenderer',
      'InteractiveProvider',
      'BaseWidgetProps',
      'embedded progress callbacks',
      'registry.defaultConfig -> TeachingResource.config -> LessonItem.overrideConfig',
    ],
  };
}
