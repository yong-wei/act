import { resolveArenaWorkbenchContext } from '@/features/arena/workbench/context';
import type { ArenaWorkbenchContext } from '@/features/arena/workbench/types';
import { getArenaChallengeObject } from '@/features/arena/data/seed-challenges';
import {
  buildWorkbenchPlantTargetFromArenaObject,
  createDefaultWorkbenchSubmissionPolicy,
  type NominalModelArtifact,
  type WorkbenchExperimentSignalType,
  type WorkbenchPresetId,
  type WorkbenchSessionContext,
  type WorkbenchViewId,
} from './contracts';
import type { ChallengeObject, LeaderboardType } from '@/features/arena/types';
import type {
  ControlWorkbenchResolutionResult,
  ControlWorkbenchRouteParams,
} from './types';
import { buildWorkbenchDesignFlow, type WorkbenchDesignFlowSource } from './design-flow';

const DEFAULT_EXPLORE_OBJECT_ID = 'plant-second-order-underdamped';

const WORKSPACE_PRESET_MAP: Record<string, WorkbenchPresetId> = {
  'classic-four-view': 'classic-whitebox',
  'classic-whitebox': 'classic-whitebox',
  'multi-representation-linkage': 'classic-whitebox',
  'block-diagram-workbench': 'composite-control',
  'predictive-control': 'predictive-control',
  'blackbox-identification': 'blackbox-identification',
  'black-box-identification': 'blackbox-identification',
  'assignment-guided': 'assignment-guided',
  odyssey: 'odyssey',
  'control-odyssey': 'odyssey',
  explore: 'free-explore',
  'free-explore': 'free-explore',
};

const WORKSPACE_VIEW_MAP: Record<string, WorkbenchViewId[]> = {
  'multi-representation-linkage': ['time-domain', 'bode', 'root-locus', 'nyquist'],
  'black-box-identification': ['experiment-dataset', 'identification', 'response-comparison', 'metric-summary'],
  'block-diagram-workbench': ['time-domain', 'response-comparison', 'control-effort', 'metric-summary'],
  'predictive-control': ['time-domain', 'control-effort', 'metric-summary'],
  'control-odyssey': ['time-domain', 'metric-summary'],
};

function withDesignFlow(session: WorkbenchDesignFlowSource): WorkbenchSessionContext {
  return {
    ...session,
    designFlow: buildWorkbenchDesignFlow(session),
  } as WorkbenchSessionContext;
}

function normalizePreset(preset: string | undefined, arenaContext?: ArenaWorkbenchContext): WorkbenchPresetId {
  if (preset && WORKSPACE_PRESET_MAP[preset]) {
    return WORKSPACE_PRESET_MAP[preset];
  }
  if (arenaContext && WORKSPACE_PRESET_MAP[arenaContext.recommendedWorkspaceMode]) {
    return WORKSPACE_PRESET_MAP[arenaContext.recommendedWorkspaceMode];
  }
  return 'free-explore';
}

function resolveAllowedViews(arenaContext?: ArenaWorkbenchContext): WorkbenchViewId[] {
  if (!arenaContext) {
    return ['time-domain', 'bode', 'root-locus', 'nyquist'];
  }
  return WORKSPACE_VIEW_MAP[arenaContext.recommendedWorkspaceMode] ?? ['time-domain', 'metric-summary'];
}

function buildWhiteBoxWorkingModelFromObject(object: ChallengeObject, notes: string): NominalModelArtifact | null {
  const model = object.model;
  if (object.visibility !== 'white-box' || !model) {
    return null;
  }

  const sourceObjectId = object.id;
  const modelVersion = object.modelVersion ?? 'public';

  return {
    id: `working-model:${sourceObjectId}:${modelVersion}`,
    sourceObjectId,
    sourceVisibility: object.visibility,
    modelType: 'transfer-function',
    representation: {
      kind: 'transfer-function',
      display: model.display,
      latex: model.latex,
      numerator: [...model.numerator],
      denominator: [...model.denominator],
    },
    validationMetrics: [],
    createdAt: 'public-model',
    notes,
  };
}

function buildWhiteBoxWorkingModel(arenaContext: ArenaWorkbenchContext): NominalModelArtifact | null {
  return buildWhiteBoxWorkingModelFromObject(
    arenaContext.object,
    '白箱对象的公开模型作为初始工作模型。',
  );
}

function resolveExploreObject(objectId: string | undefined): ChallengeObject {
  const requested = objectId ? getArenaChallengeObject(objectId) : null;
  const fallback = getArenaChallengeObject(DEFAULT_EXPLORE_OBJECT_ID);

  if (requested?.visibility === 'white-box' && requested.model) {
    return requested;
  }
  if (fallback?.visibility === 'white-box' && fallback.model) {
    return fallback;
  }

  throw new Error('自由探索默认对象缺少白箱传递函数模型。');
}

function buildExploreSession(params: ControlWorkbenchRouteParams): WorkbenchSessionContext {
  const object = resolveExploreObject(params.objectId);

  return withDesignFlow({
    mode: 'explore',
    title: '综合仿真工作台',
    object,
    selectedObjectId: object.id,
    officialTarget: null,
    workingModel: buildWhiteBoxWorkingModelFromObject(
      object,
      '自由探索模式使用所选白箱对象作为初始工作模型。',
    ),
    allowedMethods: ['serial-compensator', 'pid'],
    allowedViews: resolveAllowedViews(),
    defaultPreset: normalizePreset(params.preset),
    experimentPolicy: {
      enabled: true,
      signalTypes: ['step', 'impulse', 'sine', 'chirp'],
      requiresPersistedDataset: false,
    },
    submissionPolicy: createDefaultWorkbenchSubmissionPolicy('explore'),
  });
}

function buildArenaBoundSession(
  arenaContext: ArenaWorkbenchContext,
  params: ControlWorkbenchRouteParams,
): WorkbenchSessionContext {
  const officialTarget = buildWorkbenchPlantTargetFromArenaObject(arenaContext.object);
  const defaultPreset = normalizePreset(params.preset, arenaContext);
  const isAssignment = Boolean(params.publicationId);
  const leaderboardTypes: LeaderboardType[] = isAssignment
    ? Array.from(new Set<LeaderboardType>([...arenaContext.task.leaderboardTypes, 'class']))
    : arenaContext.task.leaderboardTypes;
  const experimentSignalTypes: WorkbenchExperimentSignalType[] = arenaContext.object.visibility === 'black-box'
    ? ['step', 'sine', 'chirp', 'scenario']
    : [];
  const base = {
    taskId: arenaContext.task.id,
    task: arenaContext.task,
    object: arenaContext.object,
    metricProfile: arenaContext.metricProfile,
    leaderboardPolicy: arenaContext.leaderboardPolicy,
    officialTarget,
    workingModel: buildWhiteBoxWorkingModel(arenaContext),
    allowedMethods: arenaContext.allowedMethods,
    allowedViews: resolveAllowedViews(arenaContext),
    defaultPreset,
    recommendedWorkspaceMode: arenaContext.recommendedWorkspaceMode,
    experimentPolicy: {
      enabled: arenaContext.capabilities.supportsIdentification || arenaContext.object.visibility === 'black-box',
      signalTypes: experimentSignalTypes,
      requiresPersistedDataset: arenaContext.object.visibility === 'black-box',
    },
    submissionPolicy: createDefaultWorkbenchSubmissionPolicy(isAssignment ? 'assignment' : 'challenge', {
      leaderboardTypes,
    }),
  };

  if (isAssignment) {
    return withDesignFlow({
      ...base,
      mode: 'assignment',
      publicationId: params.publicationId!,
      classId: params.classId,
      seasonId: params.seasonId,
    });
  }

  return withDesignFlow({
    ...base,
    mode: arenaContext.entryMode === 'odyssey' ? 'odyssey' : 'challenge',
  });
}

export function resolveControlWorkbenchSession(
  params: ControlWorkbenchRouteParams,
): ControlWorkbenchResolutionResult {
  const arenaTask = params.arenaTask?.trim();

  if (!arenaTask) {
    return {
      ok: true,
      session: buildExploreSession(params),
    };
  }

  const arenaContext = resolveArenaWorkbenchContext(arenaTask);
  if (!arenaContext) {
    return {
      ok: false,
      error: {
        code: 'invalid-arena-task',
        message: `无法解析竞技场挑战：${arenaTask}`,
      },
    };
  }

  return {
    ok: true,
    session: buildArenaBoundSession(arenaContext, params),
  };
}
