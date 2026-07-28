import type { ControlAnalysisRequest, ControlAnalysisResult } from '@/resources/control-system/analysis/types';

export interface ControlWorkbenchComparisonRequest {
  id: string;
  label: string;
  role: string;
  request: ControlAnalysisRequest;
}

export interface ControlWorkbenchValidationSnapshot extends Record<string, unknown> {
  validationStatus: 'validated' | 'unavailable';
  validationScope: 'engine_result_only';
  dominantPoles: string;
  overshootPercent: number | null;
  riseTime10To90Seconds: number | null;
  settlingTime5PercentSeconds: number | null;
  overshootDisplay: number | string | null;
  riseTimeDisplay: number | string | null;
  settlingTimeDisplay: number | string | null;
  gainCrossoverRadPerSec: number | null;
  phaseMarginDeg: number | null;
  gainMarginDb: number | null;
  derivedSystemState: string;
}

export interface ControlWorkbenchComparisonSnapshot {
  comparisonRequestId: string;
  parameterSnapshot: { k: number | null };
  validationSnapshot: ControlWorkbenchValidationSnapshot;
}

export function isControlWorkbenchSubmissionReady(input: {
  currentRequestKey: string;
  currentResultEntry: { requestKey: string; result: ControlAnalysisResult | null } | null;
  comparisonRequestKey: string;
  comparisonState: { requestKey: string; snapshots: ControlWorkbenchComparisonSnapshot[]; ready: boolean };
  comparisonCount: number;
  submitPending: boolean;
}) {
  const currentResult = input.currentResultEntry?.requestKey === input.currentRequestKey
    ? input.currentResultEntry.result
    : null;
  const mainReady = Boolean(currentResult && !currentResult.isFallback);
  const comparisonsReady = input.comparisonCount === 0
    || (input.comparisonState.requestKey === input.comparisonRequestKey
      && input.comparisonState.ready
      && input.comparisonState.snapshots.length === input.comparisonCount);
  return mainReady && comparisonsReady && !input.submitPending;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function finiteNumber(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function controlRequestGain(request: ControlAnalysisRequest): number | null {
  const gains = request.structures.filter((structure) => structure.kind === 'gain' && structure.enabled);
  return gains.length === 1 ? finiteNumber(gains[0].params.k) : null;
}

export function controlRequestWithGain(
  request: ControlAnalysisRequest,
  gainField: string,
  value: unknown,
): ControlAnalysisRequest {
  if (gainField !== 'k') return request;
  const gain = finiteNumber(value);
  if (gain === null) return request;
  const enabledGainIndexes = request.structures
    .map((structure, index) => ({ structure, index }))
    .filter(({ structure }) => structure.kind === 'gain' && structure.enabled)
    .map(({ index }) => index);
  if (enabledGainIndexes.length !== 1) return request;
  const targetIndex = enabledGainIndexes[0];
  return {
    ...request,
    structures: request.structures.map((structure, index) => index === targetIndex
      ? { ...structure, params: { ...structure.params, k: gain } }
      : structure),
    rootLocus: { ...request.rootLocus, currentGain: gain },
  };
}

export function buildControlWorkbenchComparisonRequests({
  baseRequest,
  payload,
  values,
}: {
  baseRequest: ControlAnalysisRequest;
  payload: Record<string, unknown>;
  values: Record<string, string | number | boolean>;
}): ControlWorkbenchComparisonRequest[] {
  const mode = String(payload.comparisonMode ?? payload.comparison_mode ?? '').trim();
  const declarations = payload.comparisonRequests ?? payload.comparison_requests;
  if (!mode || !Array.isArray(declarations)) return [];

  return declarations.flatMap((declaration) => {
    const item = record(declaration);
    const id = String(item.id ?? '').trim();
    if (!id) return [];
    const fixed = record(item.fixedKOverride ?? item.fixed_k_override);
    const requestDeclaration = record(item.request);
    const fixedField = String(fixed.field ?? '').trim();
    const dynamicField = String(requestDeclaration.gainField ?? requestDeclaration.gain_field ?? '').trim();
    const request = fixedField
      ? controlRequestWithGain(baseRequest, fixedField, fixed.value)
      : dynamicField
        ? controlRequestWithGain(baseRequest, dynamicField, values[dynamicField])
        : baseRequest;
    return [{
      id,
      label: String(item.label ?? id),
      role: String(item.role ?? 'comparison'),
      request: { ...request, caseId: `${request.caseId ?? 'control-workbench'}:comparison:${id}` },
    }];
  });
}

function formatPole(value: { re: number; im: number }) {
  const sign = value.im >= 0 ? '+' : '-';
  return `${value.re.toFixed(3)}${sign}j${Math.abs(value.im).toFixed(3)}`;
}

function formatDominantPoles(poles: Array<{ re: number; im: number }>) {
  if (poles.length === 0) return '';
  const maxReal = Math.max(...poles.map((pole) => pole.re));
  return poles
    .filter((pole) => Math.abs(pole.re - maxReal) <= 1e-6)
    .sort((left, right) => right.re - left.re || right.im - left.im)
    .map(formatPole)
    .join('，');
}

function deriveSystemState(result: ControlAnalysisResult) {
  const maxReal = Math.max(...result.rootLocus.currentPoles.map((pole) => pole.re));
  if (!Number.isFinite(maxReal)) return '无法判定';
  if (maxReal > 1e-4) return '不稳定';
  if (Math.abs(maxReal) <= 1e-4) return '临界稳定';
  if ((result.metrics.phaseMarginDeg ?? Number.POSITIVE_INFINITY) <= 5) return '近临界但稳定';
  return '稳定';
}

export function buildControlWorkbenchValidationSnapshot(
  result: ControlAnalysisResult | null | undefined,
): ControlWorkbenchValidationSnapshot {
  if (!result || result.isFallback) {
    return {
      validationStatus: 'unavailable',
      validationScope: 'engine_result_only',
      dominantPoles: '',
      overshootPercent: null,
      riseTime10To90Seconds: null,
      settlingTime5PercentSeconds: null,
      overshootDisplay: '',
      riseTimeDisplay: '',
      settlingTimeDisplay: '',
      gainCrossoverRadPerSec: null,
      phaseMarginDeg: null,
      gainMarginDb: null,
      derivedSystemState: '',
    };
  }
  return {
    validationStatus: 'validated',
    validationScope: 'engine_result_only',
    dominantPoles: formatDominantPoles(result.rootLocus.currentPoles),
    overshootPercent: result.metrics.overshootPct,
    riseTime10To90Seconds: result.metrics.riseTimeSec,
    settlingTime5PercentSeconds: result.metrics.settlingTimeSec,
    overshootDisplay: result.metrics.overshootPct ?? '不作为稳定瞬态指标',
    riseTimeDisplay: result.metrics.riseTimeSec ?? '不存在有限值',
    settlingTimeDisplay: result.metrics.settlingTimeSec ?? '不存在有限值',
    gainCrossoverRadPerSec: result.metrics.gainCrossoverRadPerSec,
    phaseMarginDeg: result.metrics.phaseMarginDeg,
    gainMarginDb: result.metrics.gainMarginDb,
    derivedSystemState: deriveSystemState(result),
  };
}

export function buildControlWorkbenchComparisonSnapshot(
  comparison: ControlWorkbenchComparisonRequest,
  result: ControlAnalysisResult | null | undefined,
): ControlWorkbenchComparisonSnapshot {
  return {
    comparisonRequestId: comparison.id,
    parameterSnapshot: { k: controlRequestGain(comparison.request) },
    validationSnapshot: buildControlWorkbenchValidationSnapshot(result),
  };
}
