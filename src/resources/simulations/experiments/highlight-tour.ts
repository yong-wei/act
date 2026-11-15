import type { VesselReportSections } from '@/features/ilab/course-artifact-contract';
import type { VesselReadings, VesselSample } from '../simulations/vessel-experiment';
import type { FrozenVesselStudentModel, VesselModelComparison } from './student-analysis';
import type { Step20RunSummary } from './step20-evidence-workbench';

export type HighlightTourVesselId = 'cruise' | 'container' | 'drilling';

export type HighlightTourNodeId =
  | 'node-mismatch'
  | 'node-cruise'
  | 'node-container'
  | 'node-drilling'
  | 'node-step20';

export interface HighlightTourNode {
  id: HighlightTourNodeId;
  vesselId: HighlightTourVesselId;
  stepSeq: number;
  title: string;
  subtitle: string;
  focusFeature: string;
  samples: VesselSample[];
  readings: VesselReadings;
  models: FrozenVesselStudentModel[];
  comparisons: VesselModelComparison[];
  runs: Step20RunSummary[];
}

function makeCruiseSamples(faultAt180: boolean): VesselSample[] {
  const times = Array.from({ length: 25 }, (_, i) => i * 10);
  return times.map((t) => {
    const wave = 1.15 * Math.sin(t * 0.65) + 0.45 * Math.cos(t * 1.1);
    const stepTransient = t >= 20 ? 22 * (1 - Math.exp(-(t - 20) / 18) * Math.cos((t - 20) / 10)) : 0;
    const faultKick = faultAt180 && t >= 180 ? 3.8 * (1 - Math.exp(-(t - 180) / 14)) : 0;
    const roll = (faultAt180 ? 2.4 : 1.1) * Math.sin(t * 0.55) + faultKick;
    const portFin = faultAt180 && t >= 180 ? -25 : Math.max(-25, Math.min(25, -8.5 * Math.sin(t * 0.55)));
    const starboardFin = Math.max(-25, Math.min(25, 9.2 * Math.sin(t * 0.55)));
    return {
      time: t,
      values: {
        heading: stepTransient + wave * 0.4,
        portPod: Math.max(-35, Math.min(35, (20 - stepTransient) * 0.9)),
        starboardPod: Math.max(-35, Math.min(35, (20 - stepTransient) * 0.9)),
        roll,
        rollRate: 1.4 * Math.cos(t * 0.55),
        portFin,
        starboardFin,
        speed: faultAt180 && t >= 180 ? 6.4 : 8.0,
        finMoment: portFin * 1.8e5,
        actualRoll: roll + (faultAt180 && t >= 180 ? 0.65 : 0.25),
      },
    };
  });
}

function makeContainerSamples(): VesselSample[] {
  const times = Array.from({ length: 24 }, (_, i) => i * 10);
  return times.map((t) => {
    const turnSaturated = t >= 70 && t <= 120;
    const speed = turnSaturated ? 6.9 - 0.6 * Math.sin((t - 70) / 15) : 9.4;
    const rudder = turnSaturated ? 35 : t < 70 ? 8 * Math.sin(t / 15) : 3;
    const north = times
      .filter((x) => x <= t)
      .reduce((acc, _x, idx) => acc + (idx >= 7 && idx <= 12 ? 68 : 94), 0);
    return {
      time: t,
      values: {
        speed,
        groundSpeed: speed + 0.35,
        reference: 9.2,
        shaftRpm: speed * 8.6,
        referenceRpm: 80,
        heading: turnSaturated ? 18.5 : 4.2,
        rudder,
        north,
        east: turnSaturated ? 24.5 : 4.1,
        power: Math.pow(speed / 8, 3) * 19.5,
        fuel: t * 1.48,
        firstOrder: 185 * Math.sin(t * 0.6),
        secondOrder: 62,
      },
    };
  });
}

function makeDrillingSamples(): VesselSample[] {
  const times = Array.from({ length: 24 }, (_, i) => i * 10);
  return times.map((t) => {
    const faulted = t >= 180;
    const drift = faulted ? 2.15 * (1 - Math.exp(-(t - 180) / 16)) : 0.45 * Math.sin(t * 0.2);
    return {
      time: t,
      values: {
        north: drift,
        east: 0.38 * Math.cos(t * 0.28) + (faulted ? 0.72 : 0.12),
        heading: 1.8 * Math.sin(t * 0.15) + (faulted ? 2.1 : 0),
        lfNorth: drift * 0.88,
        lfEast: faulted ? 0.68 : 0.15,
        lfHeading: 1.1,
        requestedX: faulted ? 620 : 280,
        actualX: faulted ? 595 : 276,
        requestedY: faulted ? 480 : 190,
        actualY: faulted ? 452 : 186,
        requestedYaw: 4.5,
        actualYaw: 4.3,
        roll: 0.75 * Math.sin(t * 0.45),
        pitch: 0.55 * Math.cos(t * 0.42),
        heave: 0.32 * Math.sin(t * 0.5),
        power: faulted ? 27.6 : 16.4,
        waterSpeed: 0.9,
        groundSpeed: 0.18,
      },
    };
  });
}

const DEMO_CRUISE_MODEL: FrozenVesselStudentModel = {
  id: 'tour-model-cruise-roll',
  scopeKey: 'tour:readonly',
  label: '邮轮横摇二阶阻尼模型（导览）',
  channel: 'fin-to-roll',
  createdAtMs: 1700000000000,
  serverId: null,
  contentHash: '9a8b7c6d5e4f3a2b1c0d',
  payload: {
    experimentKey: 'cruise-course',
    lineageKey: 'cruise-fin-to-roll',
    structure: { kind: 'roll_oscillator', natural_freq_rad_s: 0.42, damping: 0.35, control_gain: 0.28 },
    ioContract: { inputChannel: 'fin_deg', outputChannel: 'roll_deg', inputUnit: 'deg', outputUnit: 'deg' },
    operatingPoint: { speedMps: 8, rollInertiaKgM2: 3200000000 },
    identification: { algorithm: 'demo-lsq', settings: {}, identifiedOk: true, residualRms: 0.38 },
    trainingRuns: [{ runRef: 'tour-run-6', startS: 0, endS: 120 }],
    validationRuns: [],
    sampleDt: 0.5,
  },
};

const DEMO_CONTAINER_MODEL: FrozenVesselStudentModel = {
  id: 'tour-model-container-fopdt',
  scopeKey: 'tour:readonly',
  label: '集装箱航速一阶惯性模型（导览）',
  channel: 'shaft-reference-to-speed',
  createdAtMs: 1700000001000,
  serverId: null,
  contentHash: '4f3e2d1c0b9a8f7e6d5c',
  payload: {
    experimentKey: 'container-course',
    lineageKey: 'container-shaft-to-speed',
    structure: { kind: 'fopdt', k: 0.125, t_s: 42.5, delay_s: 2.0 },
    ioContract: { inputChannel: 'shaft_ref', outputChannel: 'speed_mps', inputUnit: 'rpm', outputUnit: 'm/s' },
    operatingPoint: { loadingRatio: 0.6, speedMps: 8 },
    identification: { algorithm: 'demo-step', settings: {}, identifiedOk: true, residualRms: 0.22 },
    trainingRuns: [{ runRef: 'tour-run-3', startS: 0, endS: 180 }],
    validationRuns: [],
    sampleDt: 0.5,
  },
};

const DEMO_DRILLING_MODEL: FrozenVesselStudentModel = {
  id: 'tour-model-drilling-dp',
  scopeKey: 'tour:readonly',
  label: '981 低频三自由度模型（导览）',
  channel: 'dp-low-frequency',
  createdAtMs: 1700000002000,
  serverId: null,
  contentHash: '1c2d3e4f5a6b7c8d9e0f',
  payload: {
    experimentKey: 'drilling-course',
    lineageKey: 'drilling-dp-low-freq',
    structure: { kind: 'dp_low_freq3', a: [0.02, 0, 0, 0, 0.03, 0, 0, 0, 0.015], b: [0.08, 0, 0, 0, 0.07, 0, 0, 0, 0.04] },
    ioContract: { inputChannel: 'tau_kn', outputChannel: 'eta_m', inputUnit: 'kN', outputUnit: 'm' },
    operatingPoint: { draftM: 19 },
    identification: { algorithm: 'demo-mimo', settings: {}, identifiedOk: true, residualRms: 0.29 },
    trainingRuns: [{ runRef: 'tour-run-4', startS: 0, endS: 180 }],
    validationRuns: [],
    sampleDt: 0.5,
  },
};

function makeCruiseComparison(): VesselModelComparison {
  const timeS = Array.from({ length: 21 }, (_, i) => i * 10);
  const predicted = timeS.map((t) => 1.6 * Math.sin(t * 0.35) * Math.exp(-t / 140));
  const actual = timeS.map((t, idx) => predicted[idx] + (t >= 110 ? 1.45 + 0.55 * Math.sin(t * 0.5) : 0.18));
  return {
    id: 'tour-comp-cruise',
    scopeKey: 'tour:readonly',
    modelId: DEMO_CRUISE_MODEL.id,
    actuatorModelId: null,
    runId: 'tour-run-12',
    mode: 'hull_model',
    startS: 0,
    endS: 200,
    timeS,
    actual,
    predicted,
    measuredInput: timeS.map(() => 10),
    predictedInput: timeS.map(() => 10),
    metrics: { residual_rms: 0.94, max_error: 1.98 },
    createdAtMs: 1700000010000,
    serverId: null,
    purpose: 'validation',
    outputUnit: '°',
    outputChannel: 'roll_deg',
  };
}

const DEMO_REPORT_SECTIONS: VesselReportSections = {
  problem:
    '本实验以爱达·魔都号邮轮为对象，在双吊舱推进与减摇鳍耦合条件下建立了二阶线性横摇辨识模型，适用域限定为航速 8 m/s、有效波高 ≤ 1.5 m 与鳍角线性区 |α| < 22.5°。',
  identification:
    '第 6 步自由横摇与共振辨识得到自然频率 0.42 rad/s、阻尼比 0.35，参数可信度与模态对齐通过核查。',
  validation:
    '第 12 步验证残差 RMSE 0.38°；大舵角转艏时线性预测低于实测峰值约 1.9°，清晰界定了线性假设在非线性削顶与饱和区的失效边界。',
  comparison:
    '开启陷波滤波与双吊舱—减摇鳍协调方案后，窗口横摇均方根与 MSI 晕船率下降，同时减摇鳍伺服高频作动电能维持在 0.85 MJ 以内，避免了全航程满限幅饱和。',
  revision:
    '当航速降至 4 m/s 以下鳍升力下降，且 t=180s 左减摇鳍卡阻故障后单侧损失 50% 横摇控制力矩，需立即触发降速与大转弯半径降级修订策略以守住横摇 6° 安全边界。',
  conclusion:
    '在适用域内线性模型可有效指导阻尼调度与减摇控制，超域及执行器卡阻工况下需依托多目标约束与降级护栏维持舒适性与安全性（控灵仅用于异常拐点成因排查与量规自检）。',
};

const DEMO_RUNS: Step20RunSummary[] = [
  { id: 'tour-run-6', stepSequence: 6, lastTimeS: 180, stopReason: 'completed', createdAtMs: 1700000001000, faultOccurred: false },
  { id: 'tour-run-12', stepSequence: 12, lastTimeS: 240, stopReason: 'completed', createdAtMs: 1700000002000, faultOccurred: false },
  {
    id: 'tour-run-19',
    stepSequence: 19,
    lastTimeS: 300,
    stopReason: 'completed',
    createdAtMs: 1700000003000,
    faultOccurred: true,
    faultSummary: '含 t≥180s 左减摇鳍卡阻故障段验证',
  },
];

export const HIGHLIGHT_TOUR_NODES: readonly HighlightTourNode[] = [
  {
    id: 'node-mismatch',
    vesselId: 'cruise',
    stepSeq: 12,
    title: '三层隔离与线性失配阴影带',
    subtitle: '邮轮转艏耦合 · TruthPlant ➔ Observer ➔ StudentModel',
    focusFeature: '观察观测滤波与线性模型在转艏/波浪耦合区的 |Truth - StudentModel| 残差带扩张与原位问控灵',
    samples: makeCruiseSamples(false),
    readings: {
      prediction: '2.0',
      observation: '[实测 t=50.0s 峰值: 22.8°] 转艏过程横摇偶合峰值抬升',
      interpretation: '非线性横摇耦合与波频扰动导致线性低阶预测存在持续残差。',
    },
    models: [DEMO_CRUISE_MODEL],
    comparisons: [makeCruiseComparison()],
    runs: DEMO_RUNS,
  },
  {
    id: 'node-cruise',
    vesselId: 'cruise',
    stepSeq: 19,
    title: '邮轮多目标 HUD 与左鳍冻结故障',
    subtitle: 'MSI 晕船率 ↔ 鳍磨损积分 · t=180s 左鳍冻结',
    focusFeature: '体验 3D 双吊舱/减摇鳍矢量、t=180s 左鳍卡阻警示红以及第 19 步纯画布手绘解析叠合',
    samples: makeCruiseSamples(true),
    readings: {
      prediction: '3.0',
      observation: '[实测 t=190.0s 故障后横摇: 5.9°] 左减摇鳍卡阻于 -25° 限幅位置',
      interpretation: '左鳍冻结导致可用横摇力矩减半并伴随持续偏转力矩，需长半径低速转向应对。',
    },
    models: [DEMO_CRUISE_MODEL],
    comparisons: [makeCruiseComparison()],
    runs: DEMO_RUNS,
  },
  {
    id: 'node-container',
    vesselId: 'container',
    stepSeq: 18,
    title: '集装箱船准点 ↔ 立方油耗与 35° 满舵',
    subtitle: 'ETA 900s 约束 · SFOC 立方功率代理',
    focusFeature: '观察 6000m 航次双轴天平、35° 满舵饱和掉速告警与收益调度对比',
    samples: makeContainerSamples(),
    readings: {
      prediction: '9.2',
      observation: '[实测 t=90.0s 掉速谷底: 6.3 m/s] 35° 满舵触发横向阻力激增',
      interpretation: '满舵大角转向诱导显著航速跌落与轴功率上升，需提前段分配速度余量以守住 900s ETA。',
    },
    models: [DEMO_CONTAINER_MODEL],
    comparisons: [],
    runs: [
      { id: 'tour-container-run-18', stepSequence: 18, lastTimeS: 230, stopReason: 'completed', createdAtMs: 1700000004000, faultOccurred: false },
    ],
  },
  {
    id: 'node-drilling',
    vesselId: 'drilling',
    stepSeq: 19,
    title: '981 平台井口安全包络与 T2 断桨',
    subtitle: '1.0m/1.5m/2.5m(EDS) 警戒圈 · 8 推雷达图',
    focusFeature: '查看井口同心包络、立柱尾流禁区扇形、32MW 电网封顶与 t=180s T2 断桨 7 推重分配',
    samples: makeDrillingSamples(),
    readings: {
      prediction: '1.5',
      observation: '[实测 t=200.0s 偏位峰值: 2.3 m] T2 推力器断桨后功率升至 27.6 MW',
      interpretation: '其余 7 台全回转推进器规避邻柱尾流禁区完成推力重分配，暂未触发 2.5m EDS 紧急解脱。',
    },
    models: [DEMO_DRILLING_MODEL],
    comparisons: [],
    runs: [
      {
        id: 'tour-drilling-run-19',
        stepSequence: 19,
        lastTimeS: 230,
        stopReason: 'completed',
        createdAtMs: 1700000005000,
        faultOccurred: true,
        faultSummary: '含 t≥180s T2 推进器断桨故障重分配验证',
      },
    ],
  },
  {
    id: 'node-step20',
    vesselId: 'cruise',
    stepSeq: 20,
    title: '第 20 步实证胶囊与审计透视闭环',
    subtitle: '一键证据回填 · 四维量规预检 · 审计抽屉',
    focusFeature: '演示一键插入步 1–19 实测胶囊、四维量规高亮及顶部脱敏实验审计透视抽屉',
    samples: makeCruiseSamples(true),
    readings: { ...DEMO_REPORT_SECTIONS },
    models: [DEMO_CRUISE_MODEL],
    comparisons: [makeCruiseComparison()],
    runs: DEMO_RUNS,
  },
];

export function findHighlightTourNode(nodeId: string | null | undefined): HighlightTourNode | null {
  if (!nodeId) return null;
  return HIGHLIGHT_TOUR_NODES.find((item) => item.id === nodeId) ?? null;
}

export function defaultTourNodeForVessel(vesselId: string): HighlightTourNode {
  return (
    HIGHLIGHT_TOUR_NODES.find((item) => item.vesselId === vesselId) ?? HIGHLIGHT_TOUR_NODES[0]
  );
}
