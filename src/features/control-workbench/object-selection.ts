import { ARENA_CHALLENGE_OBJECTS, getArenaChallengeObject } from '@/features/arena/data/seed-challenges';
import {
  arenaSourceLabels,
  arenaVisibilityLabels,
} from '@/features/arena/display-labels';
import type { ChallengeObject } from '@/features/arena/types';
import type {
  NominalModelArtifact,
  WorkbenchSessionContext,
  WorkbenchViewId,
} from './contracts';
import { buildWorkbenchDesignFlow } from './design-flow';

export interface WorkbenchObjectLabel {
  label: string;
  value: string;
}

export interface WorkbenchObjectOption {
  id: string;
  name: string;
  selected: boolean;
  compatible: boolean;
  disabledReason?: string;
  modelLatex?: string;
  modelDisplay?: string;
  labels: WorkbenchObjectLabel[];
}

export interface WorkbenchObjectGroup {
  id: 'typical' | 'white-box' | 'other';
  label: string;
  options: WorkbenchObjectOption[];
}

export interface ObjectSelectionResult {
  session: WorkbenchSessionContext;
  error?: string;
}

const classicViewIds: WorkbenchViewId[] = ['time-domain', 'bode', 'root-locus', 'nyquist'];

function buildWhiteBoxWorkingModelFromObject(object: ChallengeObject): NominalModelArtifact | null {
  const model = object.model;
  if (object.visibility !== 'white-box' || !model) return null;

  const modelVersion = object.modelVersion ?? 'public';
  return {
    id: `working-model:${object.id}:${modelVersion}`,
    sourceObjectId: object.id,
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
    notes: '自由探索模式使用所选白箱对象作为初始工作模型。',
  };
}

function groupForObject(object: ChallengeObject): Pick<WorkbenchObjectGroup, 'id' | 'label'> {
  if (object.source === 'typical') return { id: 'typical', label: '典型对象' };
  if (object.visibility === 'white-box') return { id: 'white-box', label: '白箱对象' };
  return { id: 'other', label: '暂不兼容对象' };
}

function objectLabels(object: ChallengeObject): WorkbenchObjectLabel[] {
  return [
    { label: '来源', value: arenaSourceLabels[object.source] ?? object.source },
    { label: '可见性', value: arenaVisibilityLabels[object.visibility] ?? object.visibility },
    { label: '模型', value: object.modelType ?? object.adapterType ?? '未声明' },
  ];
}

function compatibilityReason(session: WorkbenchSessionContext, object: ChallengeObject): string | null {
  if (session.mode !== 'explore' && object.id !== session.object.id) {
    return '任务绑定模式不能替换官方对象。';
  }

  if (object.visibility !== 'white-box' || !object.model) {
    return '当前预设只支持公开传递函数的白箱对象。';
  }

  const hasClassicViews = classicViewIds.every((viewId) => session.allowedViews.includes(viewId));
  if (!hasClassicViews) {
    return '当前预设没有开启经典四图，不能切换此对象。';
  }

  return null;
}

export function getControlWorkbenchObjectGroups(session: WorkbenchSessionContext): WorkbenchObjectGroup[] {
  const selectedObjectId = 'selectedObjectId' in session ? session.selectedObjectId : session.object.id;
  const groups = new Map<WorkbenchObjectGroup['id'], WorkbenchObjectGroup>();

  for (const object of ARENA_CHALLENGE_OBJECTS) {
    const groupMeta = groupForObject(object);
    const group = groups.get(groupMeta.id) ?? { ...groupMeta, options: [] };
    const reason = compatibilityReason(session, object);

    group.options.push({
      id: object.id,
      name: object.name,
      selected: object.id === selectedObjectId,
      compatible: !reason,
      disabledReason: reason ?? undefined,
      modelLatex: object.model?.latex,
      modelDisplay: object.model?.display ?? object.scenarioSummary ?? object.publicInterface,
      labels: objectLabels(object),
    });
    groups.set(group.id, group);
  }

  return (['typical', 'white-box', 'other'] as const)
    .map((groupId) => groups.get(groupId))
    .filter((group): group is WorkbenchObjectGroup => Boolean(group));
}

export function selectControlWorkbenchObject(
  session: WorkbenchSessionContext,
  objectId: string,
): ObjectSelectionResult {
  const object = getArenaChallengeObject(objectId);
  if (!object) {
    return { session, error: '未找到该对象。' };
  }

  const reason = compatibilityReason(session, object);
  if (reason) {
    return { session, error: reason };
  }

  if (session.mode !== 'explore') {
    return { session };
  }

  const nextSession = {
    ...session,
    object,
    selectedObjectId: object.id,
    workingModel: buildWhiteBoxWorkingModelFromObject(object),
  };

  return {
    session: {
      ...nextSession,
      designFlow: buildWorkbenchDesignFlow(nextSession),
    },
  };
}
