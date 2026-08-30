import type {
  InteractiveRuntimeManifest,
  InteractiveRuntimeModuleManifest,
  InteractiveRuntimeStepManifest,
} from './layout-renderer';
import { buildControlWorkbenchClientEvidenceDraft } from './control-workbench-evidence';
import type { ControlWorkbenchComparisonSnapshot } from './control-workbench-comparison';
import { asRecord, stringField } from './manifest-payload-fields';
import { computeCapabilityRef } from './compute-capability-ref';
import type { ControlAnalysisRequest, ControlAnalysisResult } from '@/resources/control-system/analysis/types';

type ContentRecord = Record<string, unknown>;

export type ControlWorkbenchSubmissionField = {
  key: string;
  label: string;
  input: 'text' | 'number' | 'slider' | 'select' | 'toggle';
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  presets?: number[];
  defaultValue?: string | number | boolean;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function tryBeginControlWorkbenchSubmission(lock: { current: boolean }) {
  if (lock.current) return false;
  lock.current = true;
  return true;
}

export function stringArrayField(payload: ContentRecord, keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()));
    }
  }
  return [];
}

export function controlAnalysisRequestFromPayload(payload: ContentRecord): ControlAnalysisRequest | undefined {
  const request = asRecord(payload.request ?? payload.analysisRequest ?? payload.analysis_request);
  return isControlAnalysisRequest(request) ? request as unknown as ControlAnalysisRequest : undefined;
}

export function controlAnalysisResultFromPayload(payload: ContentRecord): ControlAnalysisResult | undefined {
  const fallback = asRecord(payload.fallbackResult ?? payload.fallback_result);
  return isControlAnalysisResult(fallback) ? fallback as unknown as ControlAnalysisResult : undefined;
}

export function controlWorkbenchLayoutFromPayload(payload: ContentRecord): 'quad' | 'platform' | 'standard-quad' {
  const layout = stringField(payload, ['layout', 'workbenchLayout', 'workbench_layout']);
  return layout === 'platform' || layout === 'standard-quad' ? layout : 'quad';
}

export function controlWorkbenchSubmissionFieldsFromPayload(payload: ContentRecord): ControlWorkbenchSubmissionField[] {
  const fields = payload.submissionFields ?? payload.submission_fields;
  if (!Array.isArray(fields)) return [];
  return fields
    .map((item): ControlWorkbenchSubmissionField | null => {
      const record = asRecord(item);
      const key = typeof record.key === 'string' ? record.key.trim() : '';
      const label = typeof record.label === 'string' ? record.label.trim() : key;
      if (!key || !label) return null;
      const input = typeof record.input === 'string' ? record.input : typeof record.type === 'string' ? record.type : 'text';
      const normalizedInput = ['text', 'number', 'slider', 'select', 'toggle'].includes(input) ? input as ControlWorkbenchSubmissionField['input'] : 'text';
      return {
        key,
        label,
        input: normalizedInput,
        min: Number.isFinite(Number(record.min)) ? Number(record.min) : undefined,
        max: Number.isFinite(Number(record.max)) ? Number(record.max) : undefined,
        step: Number.isFinite(Number(record.step)) ? Number(record.step) : undefined,
        options: stringArrayField(record, ['options']),
        presets: Array.isArray(record.presets)
          ? record.presets.map(Number).filter((value) => Number.isFinite(value))
          : undefined,
        defaultValue: scalarSubmissionValue(record.defaultValue ?? record.default_value),
      };
    })
    .filter((item): item is ControlWorkbenchSubmissionField => Boolean(item));
}

function scalarSubmissionValue(value: unknown): string | number | boolean | undefined {
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return undefined;
}

function submissionDefaultsFromPayload(payload: ContentRecord) {
  return asRecord(payload.submissionDefaults ?? payload.submission_defaults ?? payload.defaultSubmission ?? payload.default_submission);
}

export function initialControlWorkbenchSubmissionValues(
  payload: ContentRecord,
  request: ControlAnalysisRequest | undefined,
): Record<string, string | number | boolean> {
  const fields = controlWorkbenchSubmissionFieldsFromPayload(payload);
  const defaults = submissionDefaultsFromPayload(payload);
  if (fields.length === 0) {
    return parameterSnapshotFromRequest(request) as Record<string, string | number | boolean>;
  }
  return Object.fromEntries(fields.map((field) => {
    const direct = scalarSubmissionValue(defaults[field.key]);
    if (direct !== undefined) return [field.key, direct];
    if (field.defaultValue !== undefined) return [field.key, field.defaultValue];
    if (field.input === 'slider') return [field.key, field.min ?? 0];
    return [field.key, ''];
  }));
}

export function controlWorkbenchSubmissionFieldsComplete(
  fields: ControlWorkbenchSubmissionField[],
  values: Record<string, string | number | boolean>,
) {
  return fields.every((field) => {
    const value = values[field.key];
    return value !== undefined && value !== null && String(value).trim() !== '';
  });
}

export function buildControlWorkbenchRequestForSubmission(
  payload: Record<string, unknown>,
  values?: Record<string, string | number | boolean>,
): ControlAnalysisRequest | undefined {
  const contentPayload = payload as ContentRecord;
  const request = controlAnalysisRequestFromPayload(contentPayload);
  if (!request) return undefined;
  const currentValues = values ?? initialControlWorkbenchSubmissionValues(contentPayload, request);
  const dynamicRequest = poleControlWorkbenchRequest(contentPayload, request, currentValues)
    ?? shipComparisonControlWorkbenchRequest(contentPayload, request, currentValues)
    ?? parameterizedControlWorkbenchRequest(contentPayload, request, currentValues);
  return controlWorkbenchRequestWithFocusFrequency(contentPayload, dynamicRequest, currentValues);
}

function controlWorkbenchRequestWithFocusFrequency(
  payload: ContentRecord,
  request: ControlAnalysisRequest,
  values: Record<string, string | number | boolean>,
): ControlAnalysisRequest {
  const focusFrequencyField = stringField(payload, ['focusFrequencyField', 'focus_frequency_field']);
  if (!focusFrequencyField) return request;
  const frequency = Number(values[focusFrequencyField]);
  const isValid = Number.isFinite(frequency)
    && frequency > 0
    && frequency >= request.frequencyRange.min
    && frequency <= request.frequencyRange.max;
  if (isValid) {
    return { ...request, frequencyProbesRadPerSec: [frequency] };
  }
  const { frequencyProbesRadPerSec: _ignored, ...requestWithoutFrequencyProbes } = request;
  return requestWithoutFrequencyProbes;
}

function poleControlWorkbenchRequest(
  payload: ContentRecord,
  request: ControlAnalysisRequest,
  values: Record<string, string | number | boolean>,
): ControlAnalysisRequest | undefined {
  const fieldKeys = new Set(controlWorkbenchSubmissionFieldsFromPayload(payload).map((field) => field.key));
  if (!fieldKeys.has('sigma') || !fieldKeys.has('omega')) return undefined;

  const sigma = finiteSubmissionNumber(values.sigma, -1);
  const poleMode = String(values.pole_mode ?? values.mode ?? '');
  const isSingleRealPole = poleMode.includes('单') || poleMode.toLowerCase().includes('single');
  const omega = isSingleRealPole ? 0 : Math.abs(finiteSubmissionNumber(values.omega, 2));
  const numerator = isSingleRealPole
    ? [Math.abs(sigma) < 0.001 ? 0.001 : -sigma]
    : [roundControlRequestNumber(Math.max(0.0001, sigma * sigma + omega * omega))];
  const denominator = isSingleRealPole
    ? [1, 0]
    : [1, roundControlRequestNumber(-2 * sigma), 0];

  return {
    ...request,
    caseId: `${request.caseId ?? 'control-workbench'}:sigma-${sigma.toFixed(2)}:omega-${omega.toFixed(2)}`,
    plant: {
      ...request.plant,
      numerator,
      denominator,
    },
    structures: request.structures.length > 0
      ? request.structures.map((structure, index) => index === 0
        ? { ...structure, kind: 'gain', enabled: true, params: { ...structure.params, k: 1 }, label: structure.label ?? 'K' }
        : structure)
      : [{ kind: 'gain', enabled: true, params: { k: 1 }, label: 'K' }],
    rootLocus: {
      ...request.rootLocus,
      currentGain: 1,
    },
  };
}

function parameterizedControlWorkbenchRequest(
  payload: ContentRecord,
  request: ControlAnalysisRequest,
  values: Record<string, string | number | boolean>,
): ControlAnalysisRequest {
  const numericFieldKeys = new Set(
    controlWorkbenchSubmissionFieldsFromPayload(payload)
      .filter((field) => field.input === 'slider' || field.input === 'number')
      .map((field) => field.key),
  );
  const numericSelectFieldKeys = new Set(
    controlWorkbenchSubmissionFieldsFromPayload(payload)
      .filter((field) => field.input === 'select'
        && (field.options?.length ?? 0) > 0
        && field.options?.every((option) => Number.isFinite(Number(option))))
      .map((field) => field.key),
  );
  const enabledGainTargets = request.structures
    .map((structure, index) => ({ structure, index }))
    .filter(({ structure }) => structure.kind === 'gain' && structure.enabled);
  const soleEnabledGainTarget = enabledGainTargets.length === 1 ? enabledGainTargets[0] : undefined;
  if (numericFieldKeys.size === 0 && numericSelectFieldKeys.size === 0) return request;
  let changed = false;
  let selectedGain: number | undefined;
  const structures = request.structures.map((structure, structureIndex) => {
    let structureChanged = false;
    const params = Object.fromEntries(Object.entries(structure.params).map(([key, value]) => {
      const isGainField = key === 'k'
        && (numericFieldKeys.has(key) || numericSelectFieldKeys.has(key));
      const isSoleEnabledGainTarget = isGainField
        && soleEnabledGainTarget?.index === structureIndex;
      if (isGainField && !isSoleEnabledGainTarget) return [key, value];
      if (!numericFieldKeys.has(key) && !isSoleEnabledGainTarget) return [key, value];
      const nextValue = finiteSubmissionNumber(values[key], value);
      if (nextValue !== value) {
        changed = true;
        structureChanged = true;
      }
      if (isSoleEnabledGainTarget) selectedGain = nextValue;
      return [key, nextValue];
    }));
    return structureChanged ? { ...structure, params } : structure;
  });
  const rootLocusChanged = selectedGain !== undefined
    && request.rootLocus.currentGain !== selectedGain;
  if (!changed && !rootLocusChanged) return request;
  return {
    ...request,
    structures: changed ? structures : request.structures,
    rootLocus: selectedGain === undefined
      ? request.rootLocus
      : { ...request.rootLocus, currentGain: selectedGain },
  };
}

function shipComparisonControlWorkbenchRequest(
  payload: ContentRecord,
  request: ControlAnalysisRequest,
  values: Record<string, string | number | boolean>,
): ControlAnalysisRequest | undefined {
  const fieldKeys = new Set(controlWorkbenchSubmissionFieldsFromPayload(payload).map((field) => field.key));
  if (!fieldKeys.has('selected_ship') || !fieldKeys.has('time_scale')) return undefined;

  const selectedShip = normalizeSelectedShip(values.selected_ship);
  const timeScale = clamp(finiteSubmissionNumber(values.time_scale, 1), 1, 5);
  const baseTimeEnd = request.timeRange.end > request.timeRange.start ? request.timeRange.end : 12;
  const scaledTimeRange = {
    ...request.timeRange,
    end: roundControlRequestNumber(Math.max(request.timeRange.start + 1, baseTimeEnd / timeScale)),
  };
  if (selectedShip === 'all') {
    return {
      ...request,
      caseId: `${request.caseId ?? 'control-workbench'}:ship-all:time-${timeScale.toFixed(1)}`,
      timeRange: scaledTimeRange,
    };
  }

  const pole = shipPolePreset(selectedShip);
  if (!pole) return {
    ...request,
    timeRange: scaledTimeRange,
  };

  const numerator = pole.omega === 0
    ? [roundControlRequestNumber(Math.max(0.0001, -pole.sigma))]
    : [roundControlRequestNumber(Math.max(0.0001, pole.sigma * pole.sigma + pole.omega * pole.omega))];
  const denominator = pole.omega === 0
    ? [1, 0]
    : [1, roundControlRequestNumber(-2 * pole.sigma), 0];

  return {
    ...request,
    caseId: `${request.caseId ?? 'control-workbench'}:ship-${selectedShip}:time-${timeScale.toFixed(1)}`,
    plant: {
      ...request.plant,
      numerator,
      denominator,
      label: `船 ${selectedShip}`,
    },
    structures: request.structures.length > 0
      ? request.structures.map((structure, index) => index === 0
        ? { ...structure, kind: 'gain', enabled: true, params: { ...structure.params, k: 1 }, label: structure.label ?? 'K' }
        : structure)
      : [{ kind: 'gain', enabled: true, params: { k: 1 }, label: 'K' }],
    timeRange: scaledTimeRange,
    rootLocus: {
      ...request.rootLocus,
      currentGain: 1,
    },
  };
}

function normalizeSelectedShip(value: string | number | boolean | undefined): 'A' | 'B' | 'C' | 'all' {
  const normalized = String(value ?? '全部').trim().toUpperCase();
  if (normalized === 'A' || normalized === 'B' || normalized === 'C') return normalized;
  return 'all';
}

function shipPolePreset(ship: 'A' | 'B' | 'C') {
  if (ship === 'A') return { sigma: -1.5, omega: 2.2 };
  if (ship === 'B') return { sigma: -0.8, omega: 0 };
  return { sigma: 0.3, omega: 1.4 };
}

function finiteSubmissionNumber(value: string | number | boolean | undefined, fallback: number) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function roundControlRequestNumber(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function parameterSnapshotFromSubmissionValues(
  payload: ContentRecord,
  request: ControlAnalysisRequest | undefined,
  values?: Record<string, string | number | boolean>,
) {
  const fields = controlWorkbenchSubmissionFieldsFromPayload(payload);
  if (fields.length === 0) return parameterSnapshotFromRequest(request);
  const currentValues = values ?? initialControlWorkbenchSubmissionValues(payload, request);
  return Object.fromEntries(
    fields
      .map((field) => [field.key, currentValues[field.key]] as const)
      .filter(([, value]) => value !== undefined && value !== null && value !== ''),
  );
}

export function buildSharedControlWorkbenchEvidenceDraft({
  manifest,
  step,
  module,
  submittedAt,
  submissionValues,
  validationSnapshot,
  comparisonSnapshots,
  derivedResultRefs,
}: {
  manifest: InteractiveRuntimeManifest;
  step: InteractiveRuntimeStepManifest;
  module: InteractiveRuntimeModuleManifest;
  submittedAt: number;
  submissionValues?: Record<string, string | number | boolean>;
  validationSnapshot?: Record<string, unknown>;
  comparisonSnapshots?: ControlWorkbenchComparisonSnapshot[];
  derivedResultRefs?: Array<{ kind: string; id: string }>;
}) {
  const capabilityRef = computeCapabilityRef(module.payload);
  if (!capabilityRef) return null;
  const visiblePanelIds = stringArrayField(module.payload, ['visiblePanelIds', 'visible_panel_ids', 'panels']);
  const responseContractId = stringField(module.payload, ['responseContractId', 'response_contract_id', 'responseKind', 'response_kind']);
  const releaseState = stringField(module.payload, ['releaseState', 'release_state']) || 'course-controlled';
  const fallbackState = stringField(module.payload, ['fallbackState', 'fallback_state']) || 'supported';
  const request = controlAnalysisRequestFromPayload(module.payload);
  return buildControlWorkbenchClientEvidenceDraft({
    eventType: 'lesson_submit',
    clientEventId: `${step.id}:${module.id}:${submittedAt}`,
    attemptKey: `${step.id}:response:${submittedAt}`,
    lessonKey: manifest.lessonId,
    stepId: step.id,
    moduleId: module.id,
    componentId: module.id,
    actorRole: 'student',
    clientEventAt: new Date(submittedAt).toISOString(),
    capabilityId: capabilityRef,
    visiblePanelIds,
    parameterSnapshot: parameterSnapshotFromSubmissionValues(module.payload, request, submissionValues),
    selectedDesignState: { releaseState, fallbackState },
    derivedResultRefs,
    answerPayload: {
      responseContractId: responseContractId ?? 'parameter.set',
      submissionFieldKeys: controlWorkbenchSubmissionFieldsFromPayload(module.payload).map((field) => field.key),
      ...(validationSnapshot ? { validationSnapshot } : {}),
      ...(comparisonSnapshots?.length ? { comparisonSnapshots } : {}),
    },
    releaseState: releaseState === 'released' || releaseState === 'revealed' ? releaseState : 'released',
    fallbackState: fallbackState === 'fallback' || fallbackState === 'unsupported' ? fallbackState : 'supported',
  });
}

function isControlAnalysisRequest(value: ContentRecord): boolean {
  return value.runtimeMode === 'analysis'
    && typeof value.plant === 'object'
    && Array.isArray(value.structures)
    && Array.isArray(value.outputs)
    && typeof value.timeRange === 'object'
    && typeof value.frequencyRange === 'object'
    && typeof value.rootLocus === 'object';
}

function isControlAnalysisResult(value: ContentRecord): boolean {
  return typeof value.metrics === 'object'
    && typeof value.stepResponse === 'object'
    && typeof value.rootLocus === 'object'
    && typeof value.magnitude === 'object'
    && typeof value.phase === 'object'
    && typeof value.nyquist === 'object';
}

function parameterSnapshotFromRequest(request: ControlAnalysisRequest | undefined): Record<string, unknown> {
  if (!request) return {};
  return Object.fromEntries(
    request.structures.flatMap((structure) => Object.entries(structure.params).map(([key, value]) => [`${structure.kind}.${key}`, value])),
  );
}
