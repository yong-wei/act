import type { ComparisonModeValue } from '@/lib/student-model-artifact-contract';
import type { VesselSessionFrame } from '@/lib/control-engine/vessel-session';
import type { VesselRunSummary } from '@/features/simulations/local-evidence-store';
import type { VesselRunEvidence } from '@/features/simulations/run-evidence';
import type { IdentificationChannel } from './student-analysis';

export type VesselCourseKey = 'destroyer' | 'container' | 'cruise' | 'drilling' | 'lng' | 'icebreaker' | 'dredger';
export type ModelKindValue = 'nomoto1' | 'nomoto2' | 'fopdt' | 'roll_oscillator' | 'dredge';

export interface CascadeActuatorSpec {
  channel: 'rudder-servo' | 'azimuth-servo';
  label: string;
  placeholder: string;
  emptyHint: string;
}

export interface VesselStepWorkbenchPolicy {
  courseKey: VesselCourseKey;
  stepSequence: number;
  allowedChannels: IdentificationChannel[];
  defaultChannel: IdentificationChannel | 'dp-low-frequency';
  allowedKinds: ModelKindValue[];
  defaultKind: ModelKindValue;
  allowedModesForChannel: (channel: IdentificationChannel | undefined) => ComparisonModeValue[];
  cascadeActuator: CascadeActuatorSpec | null;
  showIdentify: boolean;
  showValidate: boolean;
  showFreeDecaySelector: boolean;
  requireFreeDecayRun: boolean;
  showRunEvaluation: boolean;
  showComfortReadout: boolean;
  showRollSpectrum: boolean;
  showLiquidSpectrum: boolean;
  showIceContact: boolean;
  showVoyageTradeoff: boolean;
  emptyModelHint: string;
  emptyRunHint: string;
  stepFocusNote: string;
}

export const WORKBENCH_CHANNEL_LABELS: Record<IdentificationChannel, string> = {
  'rudder-to-yaw': '实际舵角 → 转艏速率',
  'rudder-servo': '舵指令 → 实际舵角',
  'azimuth-to-yaw': '双吊舱等效偏转 → 转艏速率',
  'azimuth-servo': '等效偏转指令 → 实际偏转',
  'shaft-to-speed': '实际轴速 → 对水航速',
  'shaft-reference-to-speed': '轴速参考 → 对水航速',
  'fin-to-roll': '实际差动鳍角 → 横摇姿态估计',
  'winch-speed-to-sway': '实际绞车速度 → 横移速度',
  'winch-reference-to-sway': '绞车指令 → 横移速度',
};

export const WORKBENCH_KIND_LABELS: Record<ModelKindValue, string> = {
  nomoto1: '一阶模型',
  nomoto2: '二阶模型',
  fopdt: '一阶惯性与时延',
  roll_oscillator: '二阶横摇振子',
  dredge: '一阶与二阶按共同残差择优',
};

export function defaultKindForChannel(channel: IdentificationChannel): ModelKindValue {
  if (channel.startsWith('winch-')) return 'dredge';
  if (channel === 'fin-to-roll') return 'roll_oscillator';
  if (channel.endsWith('-to-yaw')) return 'nomoto1';
  return 'fopdt';
}

export function measurementSpecForChannel(channel: IdentificationChannel): { signal: string; unit: string } {
  if (channel.startsWith('winch-')) return { signal: 'DredgerSwaySpeed', unit: 'm/s' };
  if (channel === 'fin-to-roll') return { signal: 'EstimatedRoll', unit: '°' };
  if (channel === 'azimuth-servo') return { signal: 'EquivalentAzimuth', unit: '°' };
  if (channel === 'rudder-servo') return { signal: 'SurfaceEncoder0', unit: '°' };
  if (channel.startsWith('shaft-')) return { signal: 'SpeedLog', unit: 'm/s' };
  return { signal: 'YawRate', unit: '°/s' };
}

export function defaultWindowForRun(run: VesselRunSummary): { startS: number; endS: number } {
  if (run.configuration.vessel === 'icebreaker-xuelong2' && run.stepSequence === 3) {
    return { startS: 0, endS: Math.min(120, run.lastTimeS) };
  }
  return { startS: Math.min(10, run.lastTimeS / 4), endS: run.lastTimeS };
}

export function extractContainerVoyageProps(run: VesselRunEvidence) {
  const last = run.trace.at(-1);
  let positionX = last?.truth.northM ?? 0;
  let fuelKg = last?.truth.fuelKg ?? 0;
  let voyage: VesselSessionFrame['containerVoyage'] | undefined;
  try {
    const checkpoint = JSON.parse(run.checkpoint) as {
      plant?: { state?: { position_ned?: number[]; actuator_states?: { fuel?: { fuel_kg?: number } } } };
      voyage_progress?: NonNullable<VesselSessionFrame['containerVoyage']>['progress'];
    };
    if (typeof checkpoint.plant?.state?.position_ned?.[0] === 'number') positionX = checkpoint.plant.state.position_ned[0];
    if (typeof checkpoint.plant?.state?.actuator_states?.fuel?.fuel_kg === 'number') {
      fuelKg = checkpoint.plant.state.actuator_states.fuel.fuel_kg;
    }
    if (checkpoint.voyage_progress) {
      voyage = {
        progress: checkpoint.voyage_progress,
        segmentIndex: 0,
        meanFinalHeadingErrorDeg: 0,
        rollWarning: false,
        eligibleForFuelComparison: false,
      };
    }
  } catch {
    // Lightweight test fixtures may omit checkpoint JSON.
  }
  const powerW = last?.truth.motorPowerW?.reduce((sum, item) => sum + item, 0) ?? 0;
  const speedMps = last?.truth.waterSpeedMps ?? run.configuration.initialWaterSpeedMps ?? 8;
  const rudderDeg = last?.truth.surfaceDeg?.[0] ?? 0;
  return { timeS: run.lastTimeS, positionX, speedMps, powerW, fuelKg, rudderDeg, voyage };
}

export function computeDredgerStep5Progress(
  runs: VesselRunSummary[],
  selectedRunId: string,
  models: Array<{ channel: string; payload: { trainingRuns: Array<{ runRef: string }> } }>,
) {
  const step5Runs = runs.filter((run) => run.stepSequence === 5);
  const targets = step5Runs.some((run) => run.id === selectedRunId)
    ? step5Runs.filter((run) => run.id === selectedRunId)
    : step5Runs;
  let hasJoint = false;
  let hasActual = false;
  for (const run of targets) {
    const j = models.some((m) => m.channel === 'winch-reference-to-sway'
      && m.payload.trainingRuns.some((w) => w.runRef === run.id));
    const a = models.some((m) => m.channel === 'winch-speed-to-sway'
      && m.payload.trainingRuns.some((w) => w.runRef === run.id));
    if (j && a) return { hasJoint: true, hasActual: true, done: 2 };
    if (Number(j) + Number(a) > Number(hasJoint) + Number(hasActual)) {
      hasJoint = j;
      hasActual = a;
    }
  }
  return { hasJoint, hasActual, done: Number(hasJoint) + Number(hasActual) };
}

export function comparisonModeLabel(mode: ComparisonModeValue, isJointChannel: boolean): string {
  if (mode === 'hull_model') return 'A · 实际执行器量测驱动船体模型';
  if (mode === 'command_to_output') return isJointChannel ? 'B · 指令驱动本人联合响应模型' : 'B · 指令经伺服模型驱动船体模型';
  return 'C · 学生模型独立闭环';
}

export function preferredRunSequenceForStep(courseKey: VesselCourseKey, seq: number): number {
  if (courseKey === 'destroyer' && seq === 4) return 3;
  if (courseKey === 'lng' && seq === 3) return 2;
  if (courseKey === 'icebreaker' && seq === 9) return 8;
  return seq > 0 ? seq : 0;
}

const DESTROYER_CASCADE: CascadeActuatorSpec = {
  channel: 'rudder-servo',
  label: '冻结的舵机模型',
  placeholder: '选择舵机模型',
  emptyHint:
    '尚未冻结舵机模型：请先在第 2 步完成 ±5° 舵角阶跃运行，并在评估页签选择「舵指令 → 实际舵角」冻结舵机模型后再运行指令级联对照。',
};

const ICEBREAKER_CASCADE: CascadeActuatorSpec = {
  channel: 'azimuth-servo',
  label: '冻结的吊舱伺服模型',
  placeholder: '选择吊舱伺服模型',
  emptyHint:
    '尚未冻结吊舱伺服模型：请先在第 2 步完成 ±3° 偏转阶跃运行，并在评估页签选择「等效偏转指令 → 实际偏转」冻结吊舱伺服模型，方可执行 B/C 级联对照。',
};

/** Resolve courseKey with fallback from defaultChannel (preserving explicit lng). */
export function resolveVesselCourseKey(
  courseKey?: VesselCourseKey,
  defaultChannel?: IdentificationChannel | 'dp-low-frequency',
): VesselCourseKey {
  if (courseKey) return courseKey;
  if (defaultChannel === 'fin-to-roll') return 'cruise';
  if (defaultChannel === 'azimuth-to-yaw' || defaultChannel === 'azimuth-servo') return 'icebreaker';
  if (defaultChannel?.startsWith('winch-')) return 'dredger';
  if (defaultChannel === 'dp-low-frequency') return 'drilling';
  if (defaultChannel?.startsWith('shaft-')) return 'container';
  return 'destroyer';
}

function focusNote(courseKey: VesselCourseKey, seq: number): string {
  const notes: Record<VesselCourseKey, Record<number, string>> = {
    destroyer: {
      1: '第 1 步通道认识：本步聚焦区分舵角指令、实际舵角、转艏速率与姿态通道，无需拟合。',
      2: '第 2 步评估目标：在 ±5° 舵角阶跃窗口辨识并冻结「舵指令 → 实际舵角」舵机模型。',
      3: '第 3 步阶跃采样：请先完成 +5° 舵阶跃运行，下一步（第 4 步）将在工作台辨识船体模型。',
      4: '第 4 步评估目标：读取第 3 步阶跃运行，剔除启动伺服段后辨识并冻结 8 m/s 船体模型。',
      5: '第 5 步评估目标：选用第 4 步已冻结模型，对 −3° 舵阶跃运行执行独立留出对照（禁止重拟合）。',
      6: '第 6 步评估目标：用已冻结小信号模型对照 +20° 大舵角运行，分析非线性饱和与耦合误差。',
      7: '第 7 步评估目标：分别在 4 m/s 与 12 m/s 阶跃运行上辨识并冻结不同航速船体模型。',
      8: '第 8 步特征分析：本步基于第 4 步已冻结模型分析极点与频域特征，无需重新拟合。',
      10: '第 10 步评估目标：配合已冻结船体与舵机模型运行 C 独立闭环对照，检验极点设计。',
      20: '第 20 步实验报告：本步无需重新辨识或对照，请在报告页签引用至少 4 次本人完整运行。',
    },
    container: {
      2: '第 2 步装载比较：本步仅对比不同装载下的真实物理参数，暂不辨识航速模型。',
      3: '第 3 步评估目标：选择有效阶跃窗口，辨识并冻结「轴速参考 → 对水航速」局部航速模型。',
      4: '第 4 步评估目标：用第 3 步已冻结模型对 −4% 阶跃运行执行独立对照（禁止重拟合）。',
      5: '第 5 步评估目标：先用原模型外推对比，再分别冻结 20% 与 90% 装载工作点模型。',
      6: '第 6 步评估目标：分别在 6 m/s 与 10 m/s 工作点阶跃运行上冻结局部航速模型。',
      7: '第 7 步评估目标：运行 C 独立闭环对照，检验本人设计的航速控制律与实船响应差距。',
      20: '第 20 步实验报告：本步无需重新辨识或对照，请在报告页签引用至少 5 次本人运行完成总结。',
    },
    lng: {
      2: '第 2 步小信号激励：请先完成 600 s 轴速小信号阶跃，下一步（第 3 步）将在本页辨识模型。',
      3: '第 3 步评估目标：读取第 2 步阶跃数据，辨识并冻结「轴速参考 → 对水航速」一阶惯性与纯时延模型。',
      4: '第 4 步评估目标：用第 3 步冻结模型对照 −4% 减速运行，检验小信号模型外推误差。',
      8: '第 8 步评估目标：对齐第 7 步冻结模型与靠泊实船响应，定位低速与大范围减速偏差。',
      12: '第 12 步评估目标：分别辨识并冻结 30%、70% 与 95% 液舱填充率下的局部航速模型。',
      20: '第 20 步实验报告：本步无需重新拟合或对照，请在报告页签引用至少 5 组本人运行完成报告。',
    },
    cruise: {
      2: '第 2 步评估目标：在横摇自由衰减窗口上辨识并冻结固有频率与阻尼比（本步不含鳍效能记录）。',
      3: '第 3 步评估目标：选择差动鳍脉冲运行并引用第 2 步自由衰减记录，联合冻结完整减摇鳍横摇模型。',
      4: '第 4 步评估目标：用第 3 步完整冻结模型在独立验证运行上执行 A 模式（实际鳍角）对照。',
      5: '频谱分析目标：计算所选窗口的横摇姿态、横摇角速度与波浪横摇力矩频谱并标示主峰。',
      15: '频谱与滤波权衡：对比所选窗口的横摇与波浪力矩频谱，核对陷波滤波前后性能变化。',
      20: '第 20 步实验报告：本步无需重新辨识或对照，请在报告页签引用至少 5 次本人运行与两客点指标。',
    },
    icebreaker: {
      2: '第 2 步评估目标：在 ±3° 偏转阶跃窗口辨识并冻结「等效偏转指令 → 实际偏转」吊舱伺服模型。',
      3: '第 3 步评估目标：辨识并冻结开阔水域「双吊舱等效偏转 → 转艏速率」航向局部模型。',
      4: '第 4 步评估目标：直接选用第 3 步冻结模型对 −2° 开水运行执行独立留出对照。',
      8: '冰接触证据分析：运行入冰记录并定位首次破冰接触时刻，核对六维接触载荷。',
      9: '冰接触证据分析：打开第 8 步含冰接触记录，展开压碎—弯折—滑移事件并核对力与功。',
      10: '第 10 步评估目标：使用开水冻结模型对照 0.60 m 冰区运行，定位模型失配时段与冰接触载荷。',
      11: '第 11 步评估目标：在冰区记录上划定互不重叠的训练窗与验证窗，辨识冰区模型并核对载荷。',
      20: '第 20 步实验报告：本步无需重新拟合或对照，请在报告页签引用至少 6 次本人运行。',
    },
    dredger: {
      5: '第 5 步评估目标：在同一次双向绞车阶跃运行上，分别冻结指令联合模型与实际绞车速度模型（共 2 通道）。',
      6: '第 6 步评估目标：用第 5 步冻结的两类模型在反向小横移运行上分别完成 A 量测与 B 指令对照。',
      10: '第 10 步评估目标：选取绞车指令联合模型执行 C 独立闭环对照，并核对砂层切削作业指标。',
      11: '第 11 步评估目标：先用砂层冻结模型对黏土运行做独立对照，再从固定模式黏土窗口重辨识模型。',
      20: '第 20 步实验报告：本步无需重新拟合或对照，请在报告页签引用至少 6 次本人运行。',
    },
    drilling: {
      3: '第 3 步采集目标：分别完成纯纵向、纯横向与纯艏摇三次物理激励，完成后前往第 4 步冻结模型。',
      4: '第 4 步评估目标：选入第 3 步三轴物理激励运行并冻结三通道低频模型，核对主通道与交叉耦合项。',
      5: '第 5 步评估目标：仅用已冻结三通道模型对照小位移独立运行（本步不可重拟合覆盖训练集）。',
      20: '第 20 步实验报告：核对已冻结三通道模型与独立对照计数，并在报告页签引用至少 6 次完整运行。',
    },
  };
  if (notes[courseKey][seq]) return notes[courseKey][seq];
  if (courseKey === 'destroyer' && seq >= 9 && seq <= 19) return '本步评估聚焦：核对闭环航向跟踪、调节时间、舵动作变差与物理细步安全指标。';
  if (courseKey === 'container' && seq >= 11 && seq <= 19) return '航次评估聚焦：结合 6000 m 航程进度、准点到达时间与立方功耗权衡卡片核对本步航次。';
  if (courseKey === 'lng' && [13, 14, 15, 18, 19].includes(seq)) return '晃荡频谱评估：选择本步运行及分析窗口，计算液舱纵/横向液面模态幅值频谱与峰值频率。';
  if (courseKey === 'cruise' && seq >= 6 && seq <= 19) return '舒适性评估聚焦：对比乘客位置加速度、晕船率代理、横摇均方根与减摇鳍伺服功耗。';
  if (courseKey === 'dredger' && seq >= 9 && seq <= 19) return '作业评价聚焦：核对末段切削横移与深度误差、实际移除产量、单位能耗与机构硬约束指标。';
  if (courseKey === 'drilling' && seq >= 6 && seq <= 19) return '定位评估聚焦：核对末 180 s 北/东/航向均方根、最大位置误差、总机械功与分配残差。';
  return '评估工作台：按本船教学流程依次完成物理激励采样、局部模型冻结与独立验证对照。';
}

/** Return strict per-vessel, per-step assessment workbench policy. */
export function getVesselWorkbenchPolicy(
  courseKey: VesselCourseKey,
  stepSequence?: number,
): VesselStepWorkbenchPolicy {
  const seq = typeof stepSequence === 'number' && Number.isFinite(stepSequence) && stepSequence > 0
    ? Math.trunc(stepSequence)
    : 0;
  const base = {
    courseKey,
    stepSequence: seq,
    cascadeActuator: null as CascadeActuatorSpec | null,
    showIdentify: false,
    showValidate: false,
    showFreeDecaySelector: false,
    requireFreeDecayRun: false,
    showRunEvaluation: false,
    showComfortReadout: false,
    showRollSpectrum: false,
    showLiquidSpectrum: false,
    showIceContact: false,
    showVoyageTradeoff: false,
    stepFocusNote: focusNote(courseKey, seq),
  };

  if (courseKey === 'destroyer') {
    const isServo = seq === 2;
    return {
      ...base,
      allowedChannels: !seq ? ['rudder-to-yaw', 'rudder-servo'] : isServo ? ['rudder-servo'] : ['rudder-to-yaw'],
      defaultChannel: isServo ? 'rudder-servo' : 'rudder-to-yaw',
      allowedKinds: !seq ? ['nomoto1', 'nomoto2', 'fopdt'] : isServo ? ['fopdt'] : ['nomoto1', 'nomoto2'],
      defaultKind: isServo ? 'fopdt' : 'nomoto1',
      allowedModesForChannel: (ch) => ch === 'rudder-servo' ? ['hull_model'] : ['hull_model', 'command_to_output', 'independent_closed_loop'],
      cascadeActuator: DESTROYER_CASCADE,
      showIdentify: !seq || isServo || seq === 4 || seq === 7,
      showValidate: !seq || seq === 5 || seq === 6 || seq === 10,
      showRunEvaluation: !seq || (seq >= 9 && seq <= 19),
      emptyModelHint: isServo
        ? '尚未冻结舵机模型：请先在第 2 步完成 ±5° 舵角阶跃运行并在本页冻结舵机模型；后续第 3 步完成阶跃后再于第 4 步冻结 8 m/s 船体模型（第 7 步冻结 4/12 m/s）。'
        : '尚未冻结船体模型：请先在第 3 步完成 +5° 舵角阶跃运行，并在第 4 步评估页签辨识并冻结 8 m/s 船体局部模型（第 7 步另需冻结 4/12 m/s 工况模型）。',
      emptyRunHint: seq === 2
        ? '暂无可用的第 2 步运行记录：请先完成 ±5° 舵角阶跃运行（120 s），再返回测量并冻结舵机模型。'
        : '暂无可用运行记录：请先在第 3 步完成 +5° 舵角阶跃运行后，进入第 4 步辨识并冻结 8 m/s 船体模型。',
    };
  }
  if (courseKey === 'container') {
    return {
      ...base,
      allowedChannels: ['shaft-reference-to-speed'],
      defaultChannel: 'shaft-reference-to-speed',
      allowedKinds: ['fopdt'],
      defaultKind: 'fopdt',
      allowedModesForChannel: () => ['command_to_output', 'independent_closed_loop'],
      showIdentify: !seq || [3, 5, 6].includes(seq),
      showValidate: !seq || [4, 5, 7].includes(seq),
      showVoyageTradeoff: !seq || (seq >= 11 && seq <= 19),
      emptyModelHint: '尚未冻结航速联合模型：集装箱船第 2 步仅比较装载物理参数；请在第 3 步（及第 5、6 步各工作点）完成阶跃运行后，在评估页签辨识并冻结「轴速参考 → 对水航速」局部模型。',
      emptyRunHint: '暂无可用运行记录：集装箱船第 2 步仅对比装载状态；请先在第 3 步（或当前步）完成 600 s 完整运行后再进行辨识或对照。',
    };
  }
  if (courseKey === 'lng') {
    return {
      ...base,
      allowedChannels: ['shaft-reference-to-speed'],
      defaultChannel: 'shaft-reference-to-speed',
      allowedKinds: ['fopdt'],
      defaultKind: 'fopdt',
      allowedModesForChannel: () => ['command_to_output', 'independent_closed_loop'],
      showIdentify: !seq || [3, 12].includes(seq),
      showValidate: !seq || [4, 8].includes(seq),
      showLiquidSpectrum: !seq || [13, 14, 15, 18, 19].includes(seq),
      emptyModelHint: '尚未冻结航速联合模型：请先在第 2 步完成轴速小信号阶跃运行，再在第 3 步评估页签辨识并冻结「轴速参考 → 对水航速」FOPDT 模型（第 12 步另需冻结 30%/70%/95% 填充率模型）。',
      emptyRunHint: '暂无可用运行记录：请先在第 2 步完成轴速小信号阶跃运行后进入第 3 步辨识，或先完成当前步完整运行。',
    };
  }
  if (courseKey === 'cruise') {
    return {
      ...base,
      allowedChannels: ['fin-to-roll'],
      defaultChannel: 'fin-to-roll',
      allowedKinds: ['roll_oscillator'],
      defaultKind: 'roll_oscillator',
      allowedModesForChannel: () => ['hull_model'],
      showIdentify: !seq || [2, 3].includes(seq),
      showFreeDecaySelector: !seq || seq === 3,
      requireFreeDecayRun: seq === 3,
      showValidate: !seq || seq === 4,
      showRollSpectrum: !seq || [5, 15].includes(seq),
      showComfortReadout: !seq || (seq >= 6 && seq <= 19),
      emptyModelHint: '尚未冻结完整减摇鳍横摇模型：请先在第 2 步运行并冻结横摇自由衰减模型（自然频率与阻尼比），再在第 3 步完成差动鳍脉冲运行并引用第 2 步记录联合冻结含控制效能的模型。',
      emptyRunHint: '暂无可用运行记录：请先完成第 2 步自由衰减（300 s）或当前步运行，再返回评估页签开展识别与对照。',
    };
  }
  if (courseKey === 'icebreaker') {
    const isServo = seq === 2;
    return {
      ...base,
      allowedChannels: !seq ? ['azimuth-to-yaw', 'azimuth-servo'] : isServo ? ['azimuth-servo'] : ['azimuth-to-yaw'],
      defaultChannel: isServo ? 'azimuth-servo' : 'azimuth-to-yaw',
      allowedKinds: !seq ? ['nomoto1', 'nomoto2', 'fopdt'] : isServo ? ['fopdt'] : ['nomoto1', 'nomoto2'],
      defaultKind: isServo ? 'fopdt' : 'nomoto1',
      allowedModesForChannel: (ch) => ch === 'azimuth-servo' ? ['hull_model'] : ['hull_model', 'command_to_output', 'independent_closed_loop'],
      cascadeActuator: ICEBREAKER_CASCADE,
      showIdentify: !seq || isServo || seq === 3 || seq === 11,
      showValidate: !seq || seq === 4 || seq === 10 || seq === 11,
      showIceContact: !seq || [8, 9, 10, 11].includes(seq),
      emptyModelHint: '请按序在第 2 步冻结「吊舱伺服模型」，再在第 3 步（开水）与第 11 步（冰区）冻结「双吊舱等效偏转 → 转艏速率」航向模型。',
      emptyRunHint: '暂无可用运行记录：请先完成当前步（或第 8 步入冰）完整运行后，再回到评估页签选窗辨识或对照。',
    };
  }
  if (courseKey === 'dredger') {
    return {
      ...base,
      allowedChannels: !seq || seq === 5 || seq === 6 ? ['winch-reference-to-sway', 'winch-speed-to-sway'] : ['winch-reference-to-sway'],
      defaultChannel: 'winch-reference-to-sway',
      allowedKinds: ['dredge'],
      defaultKind: 'dredge',
      allowedModesForChannel: (ch) => ch === 'winch-speed-to-sway' ? ['hull_model'] : ['command_to_output', 'independent_closed_loop'],
      showIdentify: !seq || seq === 5 || seq === 11,
      showValidate: !seq || seq === 6 || seq === 10 || seq === 11,
      showRunEvaluation: !seq || (seq >= 9 && seq <= 19),
      emptyModelHint: '尚未冻结横移模型：请先在第 5 步完成双向绞车阶跃运行，并在评估页签基于同一次运行分别冻结「绞车指令 → 横移速度」联合模型与「实际绞车速度 → 横移速度」模型（第 11 步另需冻结黏土联合模型）。',
      emptyRunHint: '暂无可用运行记录：请先在控制页签完成本步作业运行，再返回开展双通道横移辨识、对照或安全评价。',
    };
  }
  return {
    ...base,
    allowedChannels: [],
    defaultChannel: 'dp-low-frequency',
    allowedKinds: ['fopdt'],
    defaultKind: 'fopdt',
    allowedModesForChannel: () => ['hull_model'],
    showIdentify: !seq || seq === 4,
    showValidate: !seq || seq === 5,
    showRunEvaluation: !seq || (seq >= 6 && seq <= 19),
    emptyRunHint: '请先在第 3 步分别完成纯纵向、纯横向与纯艏摇三次激励运行，再进入第 4 步冻结三通道低频模型。',
    emptyModelHint: '尚未冻结三通道低频模型：请在第 4 步选入第 3 步三轴激励运行并点击「冻结本人三通道模型」，第 5 步即可开展独立小位移对照。',
  };
}
