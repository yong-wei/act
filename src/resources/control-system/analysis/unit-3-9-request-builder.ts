import type { ControlAnalysisRequest, StructureSpec } from './types';

export type Unit39PanelId = 'baseline' | 'lead' | 'integral' | 'integral_example' | 'lag';

export type Unit39PanelParams = {
  gain?: number;
  zeroFrequency?: number;
  poleFrequency?: number;
  integralZeroFrequency?: number;
};

type CaseConfig = Omit<ControlAnalysisRequest, 'runtimeMode' | 'structures' | 'outputs' | 'rootLocus'> & {
  caseId: string;
  rootLocus: Omit<ControlAnalysisRequest['rootLocus'], 'currentGain'>;
};

const HEADING_PLANT = {
  numerator: [0.01715],
  denominator: [1, 2.24375, 0.214375, 0],
  coefficientOrder: 'descending' as const,
  label: '船舶航向控制对象',
};

const CASE_CONFIG: CaseConfig = {
  caseId: 'unit39_heading_mapping',
  plant: HEADING_PLANT,
  responseType: 'step',
  timeRange: { start: 0, end: 180, samples: 560 },
  frequencyRange: { min: 1e-3, max: 1e1, samples: 420 },
  rootLocus: { minGain: 0, maxGain: 12, samples: 120 },
  feasibleRegion: undefined,
  delay: undefined,
  discreteConfig: undefined,
  stateSpaceSpec: undefined,
  referenceProfile: undefined,
  disturbanceProfile: undefined,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function positiveOr(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

export function normalizeUnit39PanelParams(panelId: Unit39PanelId, params: Unit39PanelParams) {
  const source = params as Record<string, number>;

  if (panelId === 'baseline') {
    return { gain: 2.25 };
  }

  if (panelId === 'integral') {
    return {
      gain: clamp(positiveOr(source.gain, 2.25), 0.2, 12),
      integralZeroFrequency: clamp(positiveOr(source.integralZeroFrequency, 0.025), 0.002, 0.5),
    };
  }

  if (panelId === 'integral_example') {
    const zeroFrequency = clamp(positiveOr(source.zeroFrequency, 0.05), 0.005, 1);
    const poleFrequency = clamp(Math.max(positiveOr(source.poleFrequency, 0.5), zeroFrequency * 1.05), 0.01, 3);
    return {
      gain: 2.25,
      integralZeroFrequency: 0.025,
      zeroFrequency,
      poleFrequency,
    };
  }

  const fallbackGain = panelId === 'lag' ? 4.5 : 2.25;
  const fallbackZero = panelId === 'lag' ? 0.025 : 0.5;
  const fallbackPole = panelId === 'lag' ? 0.0125 : 2;
  const zeroFrequency = clamp(positiveOr(source.zeroFrequency, fallbackZero), 0.002, 5);
  const rawPole = positiveOr(source.poleFrequency, fallbackPole);
  const poleFrequency = panelId === 'lag'
    ? clamp(Math.min(rawPole, zeroFrequency * 0.95), 0.001, 2)
    : clamp(Math.max(rawPole, zeroFrequency * 1.05), 0.005, 10);

  return {
    gain: clamp(positiveOr(source.gain, fallbackGain), 0.2, 12),
    zeroFrequency,
    poleFrequency,
  };
}

function buildBaselineStructures(params: ReturnType<typeof normalizeUnit39PanelParams>): StructureSpec[] {
  return [{ kind: 'gain', enabled: true, params: { k: params.gain }, label: '基准增益' }];
}

function buildLeadStructures(params: ReturnType<typeof normalizeUnit39PanelParams>): StructureSpec[] {
  const panelParams = params as { gain: number; zeroFrequency: number; poleFrequency: number };
  return [
    { kind: 'gain', enabled: true, params: { k: panelParams.gain }, label: '总增益' },
    {
      kind: 'lead',
      enabled: true,
      params: {
        k: 1,
        tau: 1 / panelParams.zeroFrequency,
        alpha: panelParams.zeroFrequency / panelParams.poleFrequency,
      },
      label: '超前校正',
    },
  ];
}

function buildIntegralStructures(params: ReturnType<typeof normalizeUnit39PanelParams>): StructureSpec[] {
  const panelParams = params as { gain: number; integralZeroFrequency: number };
  return [
    { kind: 'gain', enabled: true, params: { k: panelParams.gain }, label: '总增益' },
    {
      kind: 'pi',
      enabled: true,
      params: {
        k: 1,
        ti: 1 / panelParams.integralZeroFrequency,
      },
      label: '积分校正',
    },
  ];
}

function buildIntegralExampleStructures(params: ReturnType<typeof normalizeUnit39PanelParams>): StructureSpec[] {
  const panelParams = params as { gain: number; integralZeroFrequency: number; zeroFrequency: number; poleFrequency: number };
  return [
    { kind: 'gain', enabled: true, params: { k: panelParams.gain }, label: '总增益' },
    {
      kind: 'pi',
      enabled: true,
      params: {
        k: 1,
        ti: 1 / panelParams.integralZeroFrequency,
      },
      label: '积分环节',
    },
    {
      kind: 'lead',
      enabled: true,
      params: {
        k: 1,
        tau: 1 / panelParams.zeroFrequency,
        alpha: panelParams.zeroFrequency / panelParams.poleFrequency,
      },
      label: '中频校正',
    },
  ];
}

function buildLagStructures(params: ReturnType<typeof normalizeUnit39PanelParams>): StructureSpec[] {
  const panelParams = params as { gain: number; zeroFrequency: number; poleFrequency: number };
  return [
    { kind: 'gain', enabled: true, params: { k: panelParams.gain }, label: '总增益' },
    {
      kind: 'lag',
      enabled: true,
      params: {
        k: 1,
        tau: 1 / panelParams.zeroFrequency,
        beta: panelParams.zeroFrequency / panelParams.poleFrequency,
      },
      label: '滞后校正',
    },
  ];
}

export function buildUnit39AnalysisRequest(panelId: Unit39PanelId, params: Unit39PanelParams): ControlAnalysisRequest {
  const normalized = normalizeUnit39PanelParams(panelId, params);
  const currentGain = 'gain' in normalized ? normalized.gain : 2.25;
  const structures =
    panelId === 'baseline'
      ? buildBaselineStructures(normalized)
      : panelId === 'lead'
        ? buildLeadStructures(normalized)
        : panelId === 'integral'
          ? buildIntegralStructures(normalized)
          : panelId === 'integral_example'
            ? buildIntegralExampleStructures(normalized)
            : buildLagStructures(normalized);

  return {
    runtimeMode: 'analysis',
    caseId: `unit39_${panelId}`,
    plant: CASE_CONFIG.plant,
    structures,
    outputs: ['step_response', 'root_locus', 'magnitude', 'phase', 'nyquist', 'bode'],
    responseType: CASE_CONFIG.responseType,
    timeRange: CASE_CONFIG.timeRange,
    frequencyRange: CASE_CONFIG.frequencyRange,
    rootLocus: {
      ...CASE_CONFIG.rootLocus,
      currentGain,
    },
    feasibleRegion: CASE_CONFIG.feasibleRegion,
    delay: CASE_CONFIG.delay,
    discreteConfig: CASE_CONFIG.discreteConfig,
    stateSpaceSpec: CASE_CONFIG.stateSpaceSpec,
    referenceProfile: CASE_CONFIG.referenceProfile,
    disturbanceProfile: CASE_CONFIG.disturbanceProfile,
  };
}

export function buildUnit39ControllerCurveRequest(panelId: Unit39PanelId, params: Unit39PanelParams): ControlAnalysisRequest {
  const request = buildUnit39AnalysisRequest(panelId, params);
  return {
    ...request,
    caseId: `${request.caseId}_controller`,
    plant: {
      numerator: [1],
      denominator: [1],
      coefficientOrder: 'descending',
      label: '控制器',
    },
    rootLocus: { minGain: 0, maxGain: 1, samples: 2, currentGain: 1 },
  };
}

function formatNumber(value: number, digits = 3) {
  return Number(value.toFixed(digits)).toString();
}

function cornerTerm(frequency: number) {
  return `${formatNumber(1 / frequency)}s+1`;
}

export function formatUnit39PlantFormula() {
  return 'P(s)=\\dfrac{0.01715}{s(s+0.1)(s+2.14375)}';
}

export function formatUnit39ControllerFormula(panelId: Unit39PanelId, params: Unit39PanelParams) {
  const normalized = normalizeUnit39PanelParams(panelId, params);

  if (panelId === 'baseline') {
    return 'C_0(s)=2.25';
  }

  if (panelId === 'integral') {
    const panelParams = normalized as { gain: number; integralZeroFrequency: number };
    return `C(s)=${formatNumber(panelParams.gain)}\\left(1+\\dfrac{1}{${formatNumber(1 / panelParams.integralZeroFrequency)}s}\\right)`;
  }

  if (panelId === 'integral_example') {
    const panelParams = normalized as {
      gain: number;
      integralZeroFrequency: number;
      zeroFrequency: number;
      poleFrequency: number;
    };
    return `C(s)=${formatNumber(panelParams.gain)}\\left(1+\\dfrac{1}{${formatNumber(1 / panelParams.integralZeroFrequency)}s}\\right)\\dfrac{${cornerTerm(panelParams.zeroFrequency)}}{${cornerTerm(panelParams.poleFrequency)}}`;
  }

  const panelParams = normalized as { gain: number; zeroFrequency: number; poleFrequency: number };
  return `C(s)=${formatNumber(panelParams.gain)}\\dfrac{${cornerTerm(panelParams.zeroFrequency)}}{${cornerTerm(panelParams.poleFrequency)}}`;
}
