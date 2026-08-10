import type { CorrectionState, LinkageResponseType, PoleZeroPoint } from './model';

export const DESIGN_SNAPSHOT_COLORS = [
  '#d946ef',
  '#ea580c',
  '#16a34a',
  '#2563eb',
  '#7c3aed',
  '#0891b2',
] as const;

export interface MultiRepresentationDesignState {
  objectId: string | null;
  modelPoles: PoleZeroPoint[];
  modelZeros: PoleZeroPoint[];
  gain: number;
  closedLoopGain: number;
  responseType: LinkageResponseType;
  showMargins: boolean;
  correctionState: CorrectionState;
  timeRange: { start: number; end: number; samples: number };
  frequencyRange: { min: number; max: number; samples: number };
}

export function getRestoredPointIdentityCounters(
  state: Pick<MultiRepresentationDesignState, 'modelPoles' | 'modelZeros'>,
): { id: number; pair: number } {
  const points = [...state.modelPoles, ...state.modelZeros];
  const nextCounter = (pattern: RegExp) => points.reduce((next, point) => {
    const match = pattern.exec(point.id) ?? (point.pairKey ? pattern.exec(point.pairKey) : null);
    const value = match?.[1] ? Number(match[1]) : Number.NaN;
    return Number.isInteger(value) && value >= next ? value + 1 : next;
  }, 100);

  return {
    id: nextCounter(/^(?:pole|zero)-(\d+)$/),
    pair: nextCounter(/^(?:pole|zero)-pair-(\d+)$/),
  };
}

export interface DesignSnapshot {
  id: string;
  name: string;
  color: string;
  createdAt: number;
  visible: boolean;
  design: MultiRepresentationDesignState;
}

export function cloneDesignState(state: MultiRepresentationDesignState): MultiRepresentationDesignState {
  return {
    ...state,
    modelPoles: state.modelPoles.map((point) => ({ ...point })),
    modelZeros: state.modelZeros.map((point) => ({ ...point })),
    correctionState: { ...state.correctionState },
    timeRange: { ...state.timeRange },
    frequencyRange: { ...state.frequencyRange },
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPoleZeroPoint(value: unknown): value is PoleZeroPoint {
  if (!value || typeof value !== 'object') return false;
  const point = value as Record<string, unknown>;
  return typeof point.id === 'string'
    && isFiniteNumber(point.re)
    && isFiniteNumber(point.im)
    && (typeof point.pairKey === 'string' || point.pairKey === null);
}

function isCorrectionState(value: unknown): value is CorrectionState {
  if (!value || typeof value !== 'object') return false;
  const state = value as Record<string, unknown>;
  return typeof state.enabled === 'boolean'
    && ['pi', 'pd', 'pid', 'lead', 'lag', 'lead_lag'].includes(String(state.kind))
    && typeof state.derivativeFilterEnabled === 'boolean'
    && [
      'controllerGain',
      'kp',
      'ki',
      'kd',
      'ti',
      'td',
      'tf',
      'leadZeroFrequency',
      'leadPoleFrequency',
      'lagZeroFrequency',
      'lagPoleFrequency',
    ].every((key) => isFiniteNumber(state[key]));
}

function isDesignState(value: unknown): value is MultiRepresentationDesignState {
  if (!value || typeof value !== 'object') return false;
  const state = value as Record<string, unknown>;
  const correction = state.correctionState;
  const timeRange = state.timeRange as Record<string, unknown> | undefined;
  const frequencyRange = state.frequencyRange as Record<string, unknown> | undefined;
  const hasValidTimeRange = timeRange !== undefined
    && isFiniteNumber(timeRange.start)
    && isFiniteNumber(timeRange.end)
    && isFiniteNumber(timeRange.samples)
    && Number.isInteger(timeRange.samples)
    && timeRange.start >= 0
    && timeRange.end > timeRange.start
    && timeRange.samples >= 2;
  const hasValidFrequencyRange = frequencyRange !== undefined
    && isFiniteNumber(frequencyRange.min)
    && isFiniteNumber(frequencyRange.max)
    && isFiniteNumber(frequencyRange.samples)
    && Number.isInteger(frequencyRange.samples)
    && frequencyRange.min > 0
    && frequencyRange.max > frequencyRange.min
    && frequencyRange.samples >= 2;
  return (typeof state.objectId === 'string' || state.objectId === null)
    && Array.isArray(state.modelPoles) && state.modelPoles.every(isPoleZeroPoint)
    && Array.isArray(state.modelZeros) && state.modelZeros.every(isPoleZeroPoint)
    && isFiniteNumber(state.gain)
    && isFiniteNumber(state.closedLoopGain)
    && (state.responseType === 'step' || state.responseType === 'impulse' || state.responseType === 'ramp')
    && typeof state.showMargins === 'boolean'
    && isCorrectionState(correction)
    && hasValidTimeRange
    && hasValidFrequencyRange;
}

export function readDesignSnapshots(storage: Storage | null, key: string): DesignSnapshot[] {
  if (!storage) return [];
  try {
    const value: unknown = JSON.parse(storage.getItem(key) ?? '[]');
    if (!Array.isArray(value)) return [];
    return value.flatMap((snapshot) => {
      if (!snapshot || typeof snapshot !== 'object') return [];
      const record = snapshot as Record<string, unknown>;
      if (
        typeof record.id !== 'string'
        || typeof record.name !== 'string'
        || typeof record.color !== 'string'
        || !isFiniteNumber(record.createdAt)
        || typeof record.visible !== 'boolean'
        || !isDesignState(record.design)
      ) {
        return [];
      }
      return [{
        id: record.id,
        name: record.name,
        color: record.color,
        createdAt: record.createdAt,
        visible: record.visible,
        design: cloneDesignState(record.design),
      }];
    });
  } catch {
    return [];
  }
}

export function writeDesignSnapshots(storage: Storage | null, key: string, snapshots: DesignSnapshot[]) {
  if (!storage) return;
  storage.setItem(key, JSON.stringify(snapshots));
}

export function createDesignSnapshot(
  design: MultiRepresentationDesignState,
  index: number,
  now = Date.now(),
): DesignSnapshot {
  return {
    id: `snapshot-${now}-${index}`,
    name: `方案 ${index + 1}`,
    color: DESIGN_SNAPSHOT_COLORS[index % DESIGN_SNAPSHOT_COLORS.length],
    createdAt: now,
    visible: true,
    design: cloneDesignState(design),
  };
}
