import type { ControlAnalysisRequest, StructureSpec } from './types';
import {
  getUnit43DesignPayload,
  getUnit43FallbackResult,
  type Unit43PanelId,
} from './unit-4-3-fixtures';

export type { Unit43PanelId } from './unit-4-3-fixtures';

export type Unit43PanelParams =
  | {
      gain: number;
      piPoleFrequency: number;
      leadZeroFrequency: number;
      leadPoleFrequency: number;
    }
  | {
      gain: number;
      lagPoleFrequency: number;
      lagZeroFrequency: number;
      leadZeroFrequency: number;
      leadPoleFrequency: number;
    }
  | {
      kp: number;
      ki: number;
      kd: number;
    }
  | {
      gain: number;
      leadZeroFrequency: number;
      leadPoleFrequency: number;
    };

type CaseConfig = Omit<ControlAnalysisRequest, 'runtimeMode' | 'structures' | 'outputs' | 'rootLocus'> & {
  caseId: string;
  rootLocus: Omit<ControlAnalysisRequest['rootLocus'], 'currentGain'>;
};

const CASE_CONFIG: Record<Unit43PanelId, CaseConfig> = {
  pi_lead: {
    caseId: 'unit43_pi_lead',
    plant: {
      numerator: [1],
      denominator: [0.4, 1.4, 1],
      coefficientOrder: 'descending',
      label: 'PI+超前对象',
    },
    timeRange: { start: 0, end: 8, samples: 480 },
    frequencyRange: { min: 1e-2, max: 1e2, samples: 360 },
    rootLocus: { minGain: 0, maxGain: 12, samples: 96 },
    feasibleRegion: undefined,
    delay: undefined,
    discreteConfig: undefined,
    stateSpaceSpec: undefined,
    referenceProfile: undefined,
    disturbanceProfile: undefined,
  },
  lag_lead: {
    caseId: 'unit43_lag_lead',
    plant: {
      numerator: [1],
      denominator: [0.05, 0.65, 1.6, 1],
      coefficientOrder: 'descending',
      label: '滞后+超前对象',
    },
    timeRange: { start: 0, end: 30, samples: 520 },
    frequencyRange: { min: 1e-2, max: 1e2, samples: 360 },
    rootLocus: { minGain: 0, maxGain: 12, samples: 96 },
    feasibleRegion: undefined,
    delay: undefined,
    discreteConfig: undefined,
    stateSpaceSpec: undefined,
    referenceProfile: undefined,
    disturbanceProfile: undefined,
  },
  pid_filtered: {
    caseId: 'unit43_pid_filtered',
    plant: {
      numerator: [1],
      denominator: [1, 3, 2],
      coefficientOrder: 'descending',
      label: '带滤波 PID 对象',
    },
    timeRange: { start: 0, end: 10, samples: 480 },
    frequencyRange: { min: 1e-2, max: 1e2, samples: 360 },
    rootLocus: { minGain: 0, maxGain: 10, samples: 96 },
    feasibleRegion: undefined,
    delay: undefined,
    discreteConfig: undefined,
    stateSpaceSpec: undefined,
    referenceProfile: undefined,
    disturbanceProfile: undefined,
  },
  heading_case: {
    caseId: 'unit43_heading_case',
    plant: {
      numerator: [0.01715],
      denominator: [1, 2.24375, 0.214375, 0],
      coefficientOrder: 'descending',
      label: '客船航向保持对象',
    },
    timeRange: { start: 0, end: 160, samples: 540 },
    frequencyRange: { min: 1e-3, max: 1e1, samples: 360 },
    rootLocus: { minGain: 0, maxGain: 12, samples: 96 },
    feasibleRegion: undefined,
    delay: undefined,
    discreteConfig: undefined,
    stateSpaceSpec: undefined,
    referenceProfile: undefined,
    disturbanceProfile: undefined,
  },
  roll_boundary: {
    caseId: 'unit43_roll_boundary',
    plant: {
      numerator: [1],
      denominator: [2.052, 0.3929, 1],
      coefficientOrder: 'descending',
      label: '横摇减摇鳍对象',
    },
    timeRange: { start: 0, end: 20, samples: 520 },
    frequencyRange: { min: 1e-2, max: 1e2, samples: 360 },
    rootLocus: { minGain: 0, maxGain: 8, samples: 96 },
    feasibleRegion: undefined,
    delay: undefined,
    discreteConfig: undefined,
    stateSpaceSpec: undefined,
    referenceProfile: undefined,
    disturbanceProfile: undefined,
  },
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function positiveOr(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function finiteOr(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback;
}

export function normalizeUnit43PanelParams(
  panelId: Unit43PanelId,
  params: Unit43PanelParams,
) {
  if (panelId === 'pi_lead') {
    const piParams = params as Extract<Unit43PanelParams, { piPoleFrequency: number }>;
    const leadZero = positiveOr(piParams.leadZeroFrequency, 1);
    const leadPole = positiveOr(piParams.leadPoleFrequency, leadZero * 2);
    return {
      gain: clamp(positiveOr(piParams.gain, 1), 0.2, 40),
      piPoleFrequency: clamp(positiveOr(piParams.piPoleFrequency, 0.5), 0.02, 20),
      leadZeroFrequency: Math.min(leadZero, leadPole * 0.95),
      leadPoleFrequency: Math.max(leadPole, leadZero * 1.05),
    };
  }

  if (panelId === 'lag_lead') {
    const lagLeadParams = params as Extract<Unit43PanelParams, { lagPoleFrequency: number }>;
    const lagPole = positiveOr(lagLeadParams.lagPoleFrequency, 0.05);
    const lagZero = Math.max(positiveOr(lagLeadParams.lagZeroFrequency, 0.2), lagPole * 1.05);
    const leadZero = Math.max(positiveOr(lagLeadParams.leadZeroFrequency, 1), lagZero * 1.05);
    const leadPole = Math.max(positiveOr(lagLeadParams.leadPoleFrequency, 4), leadZero * 1.05);
    return {
      gain: clamp(positiveOr(lagLeadParams.gain, 1), 0.2, 40),
      lagPoleFrequency: lagPole,
      lagZeroFrequency: lagZero,
      leadZeroFrequency: leadZero,
      leadPoleFrequency: leadPole,
    };
  }

  if (panelId === 'heading_case') {
    const headingParams = params as Extract<Unit43PanelParams, { gain: number; leadZeroFrequency: number }>;
    const leadZero = positiveOr(headingParams.leadZeroFrequency, 0.1);
    const leadPole = positiveOr(headingParams.leadPoleFrequency, 0.25);
    return {
      gain: clamp(positiveOr(headingParams.gain, 1), 0.2, 40),
      leadZeroFrequency: Math.min(leadZero, leadPole * 0.95),
      leadPoleFrequency: Math.max(leadPole, leadZero * 1.05),
    };
  }

  const pidParams = params as Extract<Unit43PanelParams, { kp: number }>;
  return {
    kp: clamp(positiveOr(pidParams.kp, 0.2), 0.02, 40),
    ki: clamp(positiveOr(pidParams.ki, 0.2), 0.001, 40),
    kd: clamp(Math.max(finiteOr(pidParams.kd, 0), 0), 0, 40),
  };
}

function buildPiLeadStructures(
  params: ReturnType<typeof normalizeUnit43PanelParams>,
): StructureSpec[] {
  const panelParams = params as ReturnType<typeof normalizeUnit43PanelParams> & {
    gain: number;
    piPoleFrequency: number;
    leadZeroFrequency: number;
    leadPoleFrequency: number;
  };
  return [
    { kind: 'gain', enabled: true, params: { k: panelParams.gain }, label: '总增益' },
    { kind: 'pi', enabled: true, params: { k: 1, ti: 1 / panelParams.piPoleFrequency }, label: 'PI 低频托举' },
    {
      kind: 'lead',
      enabled: true,
      params: {
        k: 1,
        tau: 1 / panelParams.leadZeroFrequency,
        alpha: panelParams.leadZeroFrequency / panelParams.leadPoleFrequency,
      },
      label: '超前中频整理',
    },
  ];
}

function buildLagLeadStructures(
  params: ReturnType<typeof normalizeUnit43PanelParams>,
): StructureSpec[] {
  const panelParams = params as ReturnType<typeof normalizeUnit43PanelParams> & {
    gain: number;
    lagPoleFrequency: number;
    lagZeroFrequency: number;
    leadZeroFrequency: number;
    leadPoleFrequency: number;
  };
  return [
    { kind: 'gain', enabled: true, params: { k: panelParams.gain }, label: '总增益' },
    {
      kind: 'lag',
      enabled: true,
      params: {
        k: 1,
        tau: 1 / panelParams.lagZeroFrequency,
        beta: panelParams.lagZeroFrequency / panelParams.lagPoleFrequency,
      },
      label: '滞后低频补偿',
    },
    {
      kind: 'lead',
      enabled: true,
      params: {
        k: 1,
        tau: 1 / panelParams.leadZeroFrequency,
        alpha: panelParams.leadZeroFrequency / panelParams.leadPoleFrequency,
      },
      label: '超前裕量回收',
    },
  ];
}

function buildPidStructures(
  panelId: Unit43PanelId,
  params: ReturnType<typeof normalizeUnit43PanelParams>,
): StructureSpec[] {
  const panelParams = params as ReturnType<typeof normalizeUnit43PanelParams> & {
    kp: number;
    ki: number;
    kd: number;
  };
  return [
    {
      kind: 'pid',
      enabled: true,
      params: {
        kp: panelParams.kp,
        ki: panelParams.ki,
        kd: panelParams.kd,
        tf: panelId === 'pid_filtered' ? 0.05 : 0,
      },
      label: panelId === 'pid_filtered' ? '带滤波 PID' : 'PID 通道重写',
    },
  ];
}

function buildHeadingStructures(
  params: ReturnType<typeof normalizeUnit43PanelParams>,
): StructureSpec[] {
  const panelParams = params as ReturnType<typeof normalizeUnit43PanelParams> & {
    gain: number;
    leadZeroFrequency: number;
    leadPoleFrequency: number;
  };
  return [
    { kind: 'gain', enabled: true, params: { k: panelParams.gain }, label: '总增益' },
    {
      kind: 'lead',
      enabled: true,
      params: {
        k: 1,
        tau: 1 / panelParams.leadZeroFrequency,
        alpha: panelParams.leadZeroFrequency / panelParams.leadPoleFrequency,
      },
      label: '超前校正',
    },
  ];
}

export function buildUnit43AnalysisRequest(
  panelId: Unit43PanelId,
  params: Unit43PanelParams,
): ControlAnalysisRequest {
  const config = CASE_CONFIG[panelId];
  const normalized = normalizeUnit43PanelParams(panelId, params);
  const currentGain =
    ('gain' in normalized ? normalized.gain : 'kp' in normalized ? normalized.kp : 1) ?? 1;

  let structures: StructureSpec[];
  if (panelId === 'pi_lead') {
    structures = buildPiLeadStructures(normalized);
  } else if (panelId === 'lag_lead') {
    structures = buildLagLeadStructures(normalized);
  } else if (panelId === 'heading_case') {
    structures = buildHeadingStructures(normalized);
  } else {
    structures = buildPidStructures(panelId, normalized);
  }

  return {
    runtimeMode: 'analysis',
    caseId: config.caseId,
    plant: config.plant,
    structures,
    outputs: ['step_response', 'root_locus', 'magnitude', 'phase', 'nyquist', 'bode'],
    timeRange: config.timeRange,
    frequencyRange: config.frequencyRange,
    rootLocus: {
      ...config.rootLocus,
      currentGain,
    },
    feasibleRegion: config.feasibleRegion,
    delay: config.delay,
    discreteConfig: config.discreteConfig,
    stateSpaceSpec: config.stateSpaceSpec,
    referenceProfile: config.referenceProfile,
    disturbanceProfile: config.disturbanceProfile,
  };
}

function formatNumber(value: number, digits = 3) {
  return Number(value.toFixed(digits)).toString();
}

function formatCornerTermFromFrequency(frequency: number) {
  return `${formatNumber(1 / frequency)}s+1`;
}

export function formatUnit43PlantFormula(panelId: Unit43PanelId) {
  if (panelId === 'pi_lead') {
    return 'P_1(s)=\\dfrac{1}{(s+1)(0.4s+1)}';
  }
  if (panelId === 'lag_lead') {
    return 'P_2(s)=\\dfrac{1}{(s+1)(0.5s+1)(0.1s+1)}';
  }
  if (panelId === 'pid_filtered') {
    return 'P_3(s)=\\dfrac{1}{(s+1)(s+2)}';
  }
  if (panelId === 'heading_case') {
    return 'P_h(s)=\\dfrac{0.01715}{s(s+0.1)(s+2.14375)}';
  }
  return 'G_{\\varphi M_f}(s)=\\dfrac{1}{2.052s^2+0.3929s+1}';
}

export function formatUnit43ControllerFormula(
  panelId: Unit43PanelId,
  params: Unit43PanelParams,
) {
  const normalized = normalizeUnit43PanelParams(panelId, params);

  if (panelId === 'pi_lead') {
    const panelParams = normalized as ReturnType<typeof normalizeUnit43PanelParams> & {
      gain: number;
      piPoleFrequency: number;
      leadZeroFrequency: number;
      leadPoleFrequency: number;
    };
    return `C(s)=${formatNumber(panelParams.gain)}\\left(1+\\dfrac{1}{${formatNumber(1 / panelParams.piPoleFrequency)}s}\\right)\\dfrac{${formatCornerTermFromFrequency(panelParams.leadZeroFrequency)}}{${formatCornerTermFromFrequency(panelParams.leadPoleFrequency)}}`;
  }

  if (panelId === 'lag_lead') {
    const panelParams = normalized as ReturnType<typeof normalizeUnit43PanelParams> & {
      gain: number;
      lagPoleFrequency: number;
      lagZeroFrequency: number;
      leadZeroFrequency: number;
      leadPoleFrequency: number;
    };
    return `C(s)=${formatNumber(panelParams.gain)}\\dfrac{${formatCornerTermFromFrequency(panelParams.lagZeroFrequency)}}{${formatCornerTermFromFrequency(panelParams.lagPoleFrequency)}}\\dfrac{${formatCornerTermFromFrequency(panelParams.leadZeroFrequency)}}{${formatCornerTermFromFrequency(panelParams.leadPoleFrequency)}}`;
  }

  if (panelId === 'heading_case') {
    const panelParams = normalized as ReturnType<typeof normalizeUnit43PanelParams> & {
      gain: number;
      leadZeroFrequency: number;
      leadPoleFrequency: number;
    };
    return `C(s)=${formatNumber(panelParams.gain)}\\dfrac{${formatCornerTermFromFrequency(panelParams.leadZeroFrequency)}}{${formatCornerTermFromFrequency(panelParams.leadPoleFrequency)}}`;
  }

  const panelParams = normalized as ReturnType<typeof normalizeUnit43PanelParams> & {
    kp: number;
    ki: number;
    kd: number;
  };
  if (panelId === 'pid_filtered') {
    return `C(s)=${formatNumber(panelParams.kp)}+\\dfrac{${formatNumber(panelParams.ki)}}{s}+\\dfrac{${formatNumber(panelParams.kd)}s}{0.05s+1}`;
  }
  return `C(s)=${formatNumber(panelParams.kp)}+\\dfrac{${formatNumber(panelParams.ki)}}{s}+${formatNumber(panelParams.kd)}s`;
}

export function getUnit43PanelBaseline(panelId: Unit43PanelId) {
  const payload = getUnit43DesignPayload(panelId);
  return {
    plantTex: payload.plant_tex,
    controllerTex: payload.controller_tex,
    goalLines: payload.goal_lines ?? [],
  };
}

export { getUnit43FallbackResult };
