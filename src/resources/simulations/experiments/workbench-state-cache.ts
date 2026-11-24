import type { ComparisonModeValue } from '@/lib/student-model-artifact-contract';
import type { FrozenVesselStudentModel, IdentificationChannel, VesselModelComparison } from './student-analysis';
import type { ModelKindValue, VesselCourseKey } from './vessel-workbench-policy';

export interface ScalarWorkbenchSnapshot {
  runId: string;
  modelId: string;
  actuatorId: string;
  channel: IdentificationChannel;
  kind: ModelKindValue;
  freeDecayRunId: string;
  freeDecayStartS: number;
  freeDecayEndS: number;
  startS: number;
  endS: number;
  mode: ComparisonModeValue;
  message: string;
  analyzedConditionKey: string | null;
  userModifiedCondition: boolean;
}

export interface DpWorkbenchSnapshot {
  trainingIds: [string, string, string];
  validationId: string;
  modelId: string;
  startS: number;
  endS: number;
  message: string;
  analyzedConditionKey: string | null;
  userModifiedCondition: boolean;
}

export interface ScopeArtifactsSnapshot {
  models: FrozenVesselStudentModel[];
  comparisons: VesselModelComparison[];
}

const scalarSnapshots = new Map<string, ScalarWorkbenchSnapshot>();
const dpSnapshots = new Map<string, DpWorkbenchSnapshot>();
const scopeArtifacts = new Map<string, ScopeArtifactsSnapshot>();

export function workbenchCacheKey(
  scopeKey: string,
  courseKey: VesselCourseKey,
  stepSequence?: number,
): string {
  return `${scopeKey}::${courseKey}::${stepSequence ?? 0}`;
}

export function getScalarWorkbenchSnapshot(key: string): ScalarWorkbenchSnapshot | undefined {
  return scalarSnapshots.get(key);
}

export function setScalarWorkbenchSnapshot(key: string, snap: ScalarWorkbenchSnapshot): void {
  scalarSnapshots.set(key, snap);
}

export function getDpWorkbenchSnapshot(key: string): DpWorkbenchSnapshot | undefined {
  return dpSnapshots.get(key);
}

export function setDpWorkbenchSnapshot(key: string, snap: DpWorkbenchSnapshot): void {
  dpSnapshots.set(key, snap);
}

export function getScopeArtifactsSnapshot(scopeKey: string): ScopeArtifactsSnapshot | undefined {
  return scopeArtifacts.get(scopeKey);
}

export function setScopeArtifactsSnapshot(scopeKey: string, snapshot: ScopeArtifactsSnapshot): void {
  scopeArtifacts.set(scopeKey, snapshot);
}

export function buildScalarConditionKey(input: {
  runId: string;
  channel: IdentificationChannel;
  kind: ModelKindValue;
  startS: number;
  endS: number;
  freeDecayRunId: string;
  freeDecayStartS: number;
  freeDecayEndS: number;
  mode?: ComparisonModeValue;
  actuatorId?: string;
  modelId?: string;
  showValidate: boolean;
}): string {
  return JSON.stringify([
    input.runId,
    input.channel,
    input.kind,
    Number(input.startS.toFixed(4)),
    Number(input.endS.toFixed(4)),
    input.freeDecayRunId,
    Number(input.freeDecayStartS.toFixed(4)),
    Number(input.freeDecayEndS.toFixed(4)),
    input.showValidate ? [input.mode ?? '', input.actuatorId ?? '', input.modelId ?? ''] : null,
  ]);
}

export function buildDpConditionKey(input: {
  trainingIds: string[];
  validationId: string;
  modelId: string;
  startS: number;
  endS: number;
  showValidate: boolean;
}): string {
  return JSON.stringify([
    input.showValidate ? input.validationId : input.trainingIds,
    input.showValidate ? input.modelId : '',
    Number(input.startS.toFixed(4)),
    Number(input.endS.toFixed(4)),
  ]);
}

export function defaultScalarSnapshot(
  channel: IdentificationChannel,
  kind: ModelKindValue,
  mode: ComparisonModeValue,
): ScalarWorkbenchSnapshot {
  return {
    runId: '', modelId: '', actuatorId: '', channel, kind,
    freeDecayRunId: '', freeDecayStartS: 10, freeDecayEndS: 120,
    startS: 10, endS: 60, mode, message: '', analyzedConditionKey: null, userModifiedCondition: false,
  };
}

export function defaultDpSnapshot(): DpWorkbenchSnapshot {
  return {
    trainingIds: ['', '', ''], validationId: '', modelId: '',
    startS: 10, endS: 280, message: '', analyzedConditionKey: null, userModifiedCondition: false,
  };
}

export function findMatchingFrozenModelForRun(
  selectableModels: FrozenVesselStudentModel[],
  channel: IdentificationChannel,
  runId: string,
): { model: FrozenVesselStudentModel; startS?: number; endS?: number } | null {
  const match = selectableModels
    .filter((m) => m.channel === channel && m.payload.trainingRuns.some((w) => w.runRef === runId))
    .at(-1);
  if (!match) return null;
  const win = match.payload.trainingRuns.find((w) => w.runRef === runId);
  return {
    model: match,
    startS: win && Number.isFinite(win.startS) ? win.startS : undefined,
    endS: win && Number.isFinite(win.endS) ? win.endS : undefined,
  };
}

export function commitScalarAnalysisSnapshot(
  cacheKey: string,
  base: Omit<ScalarWorkbenchSnapshot, 'analyzedConditionKey' | 'userModifiedCondition'>,
  showValidate: boolean,
): ScalarWorkbenchSnapshot {
  const analyzedConditionKey = buildScalarConditionKey({
    runId: base.runId,
    channel: base.channel,
    kind: base.kind,
    startS: base.startS,
    endS: base.endS,
    freeDecayRunId: base.freeDecayRunId,
    freeDecayStartS: base.freeDecayStartS,
    freeDecayEndS: base.freeDecayEndS,
    mode: base.mode,
    actuatorId: base.actuatorId,
    modelId: base.modelId,
    showValidate,
  });
  const snap: ScalarWorkbenchSnapshot = { ...base, analyzedConditionKey, userModifiedCondition: false };
  setScalarWorkbenchSnapshot(cacheKey, snap);
  return snap;
}

export function clearWorkbenchStateCache(): void {
  scalarSnapshots.clear();
  dpSnapshots.clear();
  scopeArtifacts.clear();
}
