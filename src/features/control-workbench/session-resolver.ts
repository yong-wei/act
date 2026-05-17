import { resolveArenaWorkbenchContext } from '@/features/arena/workbench/context';
import type { ArenaWorkbenchContext } from '@/features/arena/workbench/types';
import {
  buildWorkbenchPlantTargetFromArenaObject,
  createDefaultWorkbenchSubmissionPolicy,
  type NominalModelArtifact,
  type WorkbenchExperimentSignalType,
  type WorkbenchPresetId,
  type WorkbenchSessionContext,
  type WorkbenchViewId,
} from './contracts';
import type { LeaderboardType } from '@/features/arena/types';
import type {
  ControlWorkbenchResolutionResult,
  ControlWorkbenchRouteParams,
} from './types';

const WORKSPACE_PRESET_MAP: Record<string, WorkbenchPresetId> = {
  'classic-four-view': 'classic-whitebox',
  'classic-whitebox': 'classic-whitebox',
  'multi-representation-linkage': 'classic-whitebox',
  'block-diagram-workbench': 'composite-control',
  'blackbox-identification': 'blackbox-identification',
  'black-box-identification': 'blackbox-identification',
  'assignment-guided': 'assignment-guided',
  odyssey: 'odyssey',
  'control-odyssey': 'odyssey',
  explore: 'free-explore',
  'free-explore': 'free-explore',
};

const WORKSPACE_VIEW_MAP: Record<string, WorkbenchViewId[]> = {
  'multi-representation-linkage': ['time-domain', 'bode', 'root-locus', 'nyquist', 'metric-summary'],
  'black-box-identification': ['experiment-dataset', 'identification', 'response-comparison', 'metric-summary'],
  'block-diagram-workbench': ['time-domain', 'response-comparison', 'control-effort', 'metric-summary'],
  'predictive-control': ['time-domain', 'control-effort', 'metric-summary'],
  'control-odyssey': ['time-domain', 'metric-summary'],
};

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

function buildWhiteBoxWorkingModel(arenaContext: ArenaWorkbenchContext): NominalModelArtifact | null {
  const model = arenaContext.object.model;
  if (arenaContext.object.visibility !== 'white-box' || !model) {
    return null;
  }

  const sourceObjectId = arenaContext.object.id;
  const modelVersion = arenaContext.object.modelVersion ?? 'public';

  return {
    id: `working-model:${sourceObjectId}:${modelVersion}`,
    sourceObjectId,
    sourceVisibility: arenaContext.object.visibility,
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
    notes: '白箱对象的公开模型作为初始工作模型。',
  };
}

function buildExploreSession(params: ControlWorkbenchRouteParams): WorkbenchSessionContext {
  return {
    mode: 'explore',
    title: '自由探索',
    officialTarget: null,
    workingModel: null,
    allowedMethods: ['serial-compensator', 'pid'],
    allowedViews: resolveAllowedViews(),
    defaultPreset: normalizePreset(params.preset),
    experimentPolicy: {
      enabled: true,
      signalTypes: ['step', 'impulse', 'sine', 'chirp'],
      requiresPersistedDataset: false,
    },
    submissionPolicy: createDefaultWorkbenchSubmissionPolicy('explore'),
  };
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
    return {
      ...base,
      mode: 'assignment',
      publicationId: params.publicationId!,
      classId: params.classId,
      seasonId: params.seasonId,
    };
  }

  return {
    ...base,
    mode: arenaContext.entryMode === 'odyssey' ? 'odyssey' : 'challenge',
  };
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
