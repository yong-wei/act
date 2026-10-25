import { expectTimeSeconds, ILAB_STEP_BY_SEQ, type IlabStepDefinition } from './steps';
import { ILAB_DP_REFERENCE, ILAB_VESSELS, isIlabVesselId, type IlabVessel, type IlabVesselId } from './vessels';

export interface StepScore {
  seq: number;
  title: string;
  earnedPoints: number;
  maxPoints: number;
  evaluation: string;
  scoringModel: string;
  remarks: string;
}

export type ScoreOutcome =
  | { ok: true; score: StepScore }
  | { ok: false; message: string };

function text(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function num(payload: Record<string, unknown>, key: string): number | null {
  const value = payload[key];
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function near(actual: number, expected: number, ratio: number): boolean {
  return Math.abs(actual - expected) <= Math.max(Math.abs(expected) * ratio, 1e-4);
}

function samplesOf(payload: Record<string, unknown>): number[] | null {
  if (!Array.isArray(payload.samples)) return null;
  const samples = payload.samples.filter((item): item is number => typeof item === 'number' && Number.isFinite(item));
  if (samples.length !== payload.samples.length || samples.length < 10 || samples.length > 120) return null;
  return samples;
}

function measureSamples(samples: number[], target: number, sampleDtS: number): { overshootPct: number; settlingTimeS: number } | null {
  if (!(sampleDtS > 0 && sampleDtS <= 1)) return null;
  let extreme = samples[0] ?? 0;
  for (const value of samples) {
    if (Math.abs(value) > Math.abs(extreme)) extreme = value;
  }
  const overshootPct = target === 0 ? 0 : Math.max(0, (Math.abs(extreme) - Math.abs(target)) / Math.abs(target) * 100);
  let settlingIndex = -1;
  for (let index = 0; index < samples.length; index += 1) {
    if (samples.slice(index).every((value) => Math.abs(value - target) <= 2)) {
      settlingIndex = index;
      break;
    }
  }
  return {
    overshootPct,
    settlingTimeS: settlingIndex < 0 ? Number.POSITIVE_INFINITY : settlingIndex * sampleDtS,
  };
}

function outcome(definition: IlabStepDefinition, earned: number, evaluation: string, remarks: string): ScoreOutcome {
  const earnedPoints = Math.max(0, Math.min(definition.maxPoints, Math.round(earned)));
  return {
    ok: true,
    score: {
      seq: definition.seq,
      title: definition.title,
      earnedPoints,
      maxPoints: definition.maxPoints,
      evaluation,
      scoringModel: definition.scoringModel,
      remarks,
    },
  };
}

function invalid(message: string): ScoreOutcome {
  return { ok: false, message };
}

function responseScore(definition: IlabStepDefinition, vessel: IlabVessel, payload: Record<string, unknown>, target: number, limitScale: number): ScoreOutcome {
  const samples = samplesOf(payload);
  const sampleDtS = num(payload, 'sampleDtS') ?? 1;
  if (!samples) return invalid('请提交 10 到 120 个采样点。');
  const measured = measureSamples(samples, target, sampleDtS);
  if (!measured) return invalid('采样时间间隔需要大于 0 且不超过 1 秒。');
  const overshootOk = measured.overshootPct <= vessel.overshootMaxPct + 0.05;
  const settlingOk = measured.settlingTimeS <= vessel.settlingTimeS * limitScale;
  const earned = overshootOk && settlingOk ? definition.maxPoints : 0;
  return outcome(
    definition,
    earned,
    earned > 0 ? '超调量与调节时间达到船型指标。' : '采样显示超调量或调节时间尚未达到船型指标。',
    `按采样计算：超调 ${measured.overshootPct.toFixed(1)}%，调节时间 ${Number.isFinite(measured.settlingTimeS) ? measured.settlingTimeS.toFixed(1) : '未进入'} 秒。指标为超调不超过 ${vessel.overshootMaxPct}% 、调节时间不超过 ${(vessel.settlingTimeS * limitScale).toFixed(0)} 秒。`,
  );
}

export function scoreIlabStep(
  vesselId: IlabVesselId | null,
  seq: number,
  payload: Record<string, unknown>,
): ScoreOutcome {
  const definition = ILAB_STEP_BY_SEQ.get(seq);
  if (!definition) return invalid('实验步骤不存在。');
  if (seq === 1) {
    const selected = text(payload.vesselId);
    if (!isIlabVesselId(selected)) return invalid('请选择 055型驱逐舰、雪龙2号或海洋石油981。');
    const vessel = ILAB_VESSELS[selected];
    const nomoto = vessel.nomoto
      ? `K=${vessel.nomoto.K}，T=${vessel.nomoto.T} 秒，参考航速 ${vessel.nomoto.speedMps} 米/秒。`
      : '该平台不使用 Nomoto 舵模型。';
    return outcome(
      definition,
      definition.maxPoints,
      `已读取${vessel.name}。`,
      `${vessel.name}，船长 ${vessel.lengthM} 米，型宽 ${vessel.beamM} 米，吃水 ${vessel.draftM} 米，排水量 ${vessel.displacementT} 吨。${nomoto}`,
    );
  }

  if (!vesselId || !ILAB_VESSELS[vesselId]) return invalid('请先完成场景选择。');
  const vessel = ILAB_VESSELS[vesselId];

  switch (seq) {
    case 2: {
      if (!vessel.nomoto) {
        if (text(payload.modelKind) !== 'semi-submersible-3dof') {
          return invalid('海洋石油981请确认三自由度动力定位模型。');
        }
        return outcome(definition, definition.maxPoints, '已确认动力定位模型。', '该船型没有传统舵 Nomoto 参数，模型类型选择正确。');
      }
      const k = num(payload, 'K');
      const t = num(payload, 'T');
      if (k === null || t === null || t <= 0) return invalid('请填写正的时间常数 T 和转向增益 K。');
      const full = near(k, vessel.nomoto.K, 0.15) && near(t, vessel.nomoto.T, 0.15);
      const half = near(k, vessel.nomoto.K, 0.3) && near(t, vessel.nomoto.T, 0.3);
      return outcome(
        definition,
        full ? definition.maxPoints : half ? definition.maxPoints / 2 : 0,
        full ? '初值与读取值一致。' : half ? '初值偏离读取值，仍在可修正范围。' : '初值偏离读取值过多。',
        `读取值为 K=${vessel.nomoto.K}，T=${vessel.nomoto.T} 秒。`,
      );
    }
    case 3: {
      const blocks = new Set(strings(payload.blocks));
      const required = vessel.actuator === 'thruster'
        ? ['hull', 'thruster-allocation', 'kinematics', 'disturbance']
        : ['hull', 'actuator', 'kinematics', 'disturbance'];
      const matched = required.filter((item) => blocks.has(item)).length;
      return outcome(
        definition,
        Math.round(definition.maxPoints * matched / required.length),
        matched === required.length ? '模型结构完整。' : '模型结构还缺模块。',
        `已勾选 ${matched}/${required.length} 个必需模块。`,
      );
    }
    case 4: {
      const actuator = text(payload.actuator);
      const angle = num(payload, 'maxRudderDeg');
      const rate = num(payload, 'maxRateDeg');
      if (angle === null || rate === null) return invalid('请填写转角上限和速率上限。');
      let passed = false;
      if (vessel.actuator === 'rudder' && vessel.nomoto) {
        passed = actuator === 'rudder' && angle >= 30 && angle <= 35 && rate >= 4 && rate <= 6;
      } else if (vessel.actuator === 'azipod') {
        passed = actuator === 'azipod' && angle === 0 && rate >= 10 && rate <= 14;
      } else if (vessel.dp) {
        passed = actuator === 'thruster' && angle === 0 && rate >= 12 && rate <= 18;
      }
      return outcome(definition, passed ? definition.maxPoints : 0, passed ? '执行器约束与船型一致。' : '执行器约束与船型读数不一致。', `该船型执行器为${vessel.actuator}。`);
    }
    case 5: {
      if (!vessel.nomoto) {
        const force = num(payload, 'environmentForceKn');
        const drift = num(payload, 'driftM');
        if (force === null || drift === null) return invalid('请填写环境力和位移漂移。');
        const passed = force > 0 && force <= 800 && drift > 0;
        return outcome(definition, passed ? definition.maxPoints : 0, passed ? '已记录无舵平台的漂移。' : '环境力或漂移读数不在平台推力范围内。', '海洋石油981单台推力上限 800 千牛，本步不使用舵角模型。');
      }
      const command = num(payload, 'commandDeg');
      const yawRate = num(payload, 'yawRateDeg');
      const headingChange = num(payload, 'headingChangeDeg');
      if (command === null || yawRate === null || headingChange === null) return invalid('请填写指令角、转艏角速度和航向变化。');
      if (command < 5 || command > 35) return invalid('开环指令角请取 5° 到 35°。');
      const expected = vessel.nomoto.K * command;
      const passed = near(yawRate, expected, 0.2) && Math.abs(headingChange) > 0;
      return outcome(definition, passed ? definition.maxPoints : 0, passed ? '开环稳态转艏角速度与参考模型一致。' : '开环读数与 K 乘以指令角不一致。', `参考稳态转艏角速度约为 ${expected.toFixed(3)} °/s。`);
    }
    case 6: {
      if (!vessel.nomoto) {
        const displacement = num(payload, 'displacementT');
        if (displacement === null) return invalid('请填写排水量。');
        const passed = near(displacement, vessel.displacementT, 0.05);
        return outcome(definition, passed ? definition.maxPoints : 0, passed ? '排水量与平台读数一致。' : '排水量与平台读数不一致。', `海洋石油981排水量为 ${vessel.displacementT} 吨。`);
      }
      const k = num(payload, 'correctedK');
      const t = num(payload, 'correctedT');
      if (k === null || t === null || t <= 0) return invalid('请填写修正后的 K 和 T。');
      const passed = near(k, vessel.nomoto.K, 0.1) && near(t, vessel.nomoto.T, 0.1);
      return outcome(definition, passed ? definition.maxPoints : 0, passed ? '修正后的参数与读取值一致。' : '修正后的参数仍偏离读取值。', `目标为 K=${vessel.nomoto.K}，T=${vessel.nomoto.T} 秒。`);
    }
    case 7:
      if (!vessel.nomoto) {
        return responseScore(definition, vessel, payload, 5, 1.5);
      }
      return responseScore(definition, vessel, payload, 10, 1.5);
    case 8: {
      const testedT = num(payload, 'testedT');
      const conclusion = text(payload.conclusion);
      if (testedT === null || testedT <= 0) return invalid('请填写一个正的考察时间常数。');
      const nominal = vessel.nomoto?.T ?? 45;
      const changed = Math.abs(testedT - nominal) >= 1;
      const passed = changed && conclusion === 'open-loop-stable-for-positive-T';
      return outcome(definition, passed ? definition.maxPoints : 0, passed ? '已记录开环稳定性观察。' : '请更换 T，并确认正 T 下开环转艏模态稳定。', `读取的时间常数是 ${nominal} 秒，开环极点为 -1/T。`);
    }
    case 9: {
      const low = num(payload, 'gainLow');
      const high = num(payload, 'gainHigh');
      if (low === null || high === null) return invalid('请填写增益上下界。');
      const kp = vessel.pid.kp;
      const passed = low >= 0 && low < high && low <= kp * 0.4 && high >= kp * 1.8 && high <= kp * 4;
      return outcome(definition, passed ? definition.maxPoints : 0, passed ? '增益区间覆盖默认比例增益的工作范围。' : '增益区间没有覆盖该船型的默认工作范围。', `默认比例增益为 ${kp}。`);
    }
    case 10: {
      const note = text(payload.note);
      if (note.length < 8) return invalid('请用至少 8 个字说明奈奎斯特图判断。');
      const passed = text(payload.nyquist) === 'does-not-encircle';
      return outcome(definition, passed ? definition.maxPoints : 0, passed ? '判断与稳定闭环一致。' : '当前默认校正不应包围负一实点。', '评分只看稳定性和说明是否完整。');
    }
    case 11: {
      const phase = num(payload, 'phaseMarginDeg');
      const gain = num(payload, 'gainMarginDb');
      if (phase === null || gain === null) return invalid('请填写相位裕度和幅值裕度。');
      const passed = phase >= 30 && phase <= 80 && gain >= 6 && gain <= 40;
      return outcome(definition, passed ? definition.maxPoints : 0, passed ? '两项裕度达到实验指标。' : '相位裕度或幅值裕度不在实验指标内。', '指标为相位裕度 30° 到 80°，幅值裕度 6 dB 到 40 dB。');
    }
    case 12: {
      const conclusion = text(payload.conclusion);
      if (conclusion.length < 12) return invalid('稳定性结论至少写 12 个字。');
      const passed = conclusion.includes('稳定') && (conclusion.includes('裕度') || conclusion.includes('极点'));
      return outcome(definition, passed ? definition.maxPoints : 0, passed ? '结论包含稳定性依据。' : '结论需要同时说明稳定，以及裕度或极点。', '本步不代写结论。');
    }
    case 13: {
      const scheme = text(payload.scheme);
      const reason = text(payload.reason);
      if (!['pid', 'lead', 'lag-lead'].includes(scheme)) return invalid('请选择校正方案。');
      if (reason.length < 8) return invalid('请用至少 8 个字说明方案理由。');
      return outcome(definition, definition.maxPoints, '已提交校正方案。', `方案为 ${scheme}。`);
    }
    case 14: {
      const kp = num(payload, 'kp');
      const ki = num(payload, 'ki');
      const kd = num(payload, 'kd');
      if (kp === null || ki === null || kd === null) return invalid('请填写三项 PID 增益。');
      const gainsOk = near(kp, vessel.pid.kp, 0.5) && near(ki, vessel.pid.ki, 0.5) && near(kd, vessel.pid.kd, 0.5);
      if (!vessel.nomoto) {
        return outcome(definition, gainsOk ? definition.maxPoints : 0, gainsOk ? '纵荡通道增益接近平台默认值。' : '纵荡通道增益偏离平台默认值。', `默认纵荡增益为 Kp=${vessel.pid.kp}，Ki=${vessel.pid.ki}，Kd=${vessel.pid.kd}。`);
      }
      const measured = responseScore(definition, vessel, payload, 10, 1.5);
      if (!measured.ok) return measured;
      const passed = gainsOk && measured.score.earnedPoints === definition.maxPoints;
      return outcome(definition, passed ? definition.maxPoints : 0, passed ? 'PID 与闭环采样都达到要求。' : 'PID 偏离默认值，或闭环采样未达标。', `${measured.score.remarks} 默认增益 Kp=${vessel.pid.kp}，Ki=${vessel.pid.ki}，Kd=${vessel.pid.kd}。`);
    }
    case 15: {
      const phase = num(payload, 'phaseMarginDeg');
      const kind = text(payload.compensatorType);
      if (phase === null) return invalid('请填写校正后的相位裕度。');
      const passed = (kind === 'lead' || kind === 'lag-lead') && phase >= 40;
      return outcome(definition, passed ? definition.maxPoints : 0, passed ? '串联校正后的相位裕度达标。' : '请使用超前类校正，并使相位裕度不低于 40°。', '本步核对校正后的相位裕度。');
    }
    case 16: {
      const error = num(payload, 'headingErrorDeg');
      const effort = num(payload, 'effortPct');
      if (error === null || effort === null) return invalid('请填写航向误差和执行器出力。');
      const passed = error <= vessel.headingToleranceDeg && effort >= 10 && effort <= 80;
      return outcome(definition, passed ? definition.maxPoints : 0, passed ? '精度与执行器负担同时可接受。' : '航向误差超限，或执行器出力不在 10% 到 80%。', `航向允差为 ${vessel.headingToleranceDeg}°。`);
    }
    case 17: {
      const seaState = num(payload, 'seaState');
      const error = num(payload, 'headingErrorDeg');
      if (seaState === null || error === null) return invalid('请填写海况等级和航向误差。');
      const passed = seaState >= 5 && seaState <= 9 && error <= vessel.headingToleranceDeg * 2;
      return outcome(definition, passed ? definition.maxPoints : 0, passed ? '高海况下的航向误差仍在放宽指标内。' : '海况未提高到 5 级，或航向误差超过允差的 2 倍。', `放宽后的航向允差为 ${vessel.headingToleranceDeg * 2}°。`);
    }
    case 18: {
      const error = num(payload, 'challengeErrorDeg');
      if (error === null || error < 0) return invalid('请填写挑战航向误差。');
      const passed = error <= vessel.headingToleranceDeg;
      return outcome(definition, passed ? definition.maxPoints : 0, passed ? '达到该船型已发布的航向允差。' : '航向误差大于该船型已发布的允差。', '本步不使用其他学生的成绩，也不生成名次。');
    }
    case 19: {
      const north = num(payload, 'targetNorthM');
      const east = num(payload, 'targetEastM');
      const current = num(payload, 'currentSpeedMps');
      const wind = num(payload, 'windSpeedMps');
      const dp = ILAB_DP_REFERENCE.dp;
      if (north === null || east === null || current === null || wind === null || !dp) return invalid('请填写目标船位、海流和风速。');
      const passed = Math.hypot(north, east) <= 50 && current >= 0 && current <= dp.maxCurrentMps && wind >= 0 && wind <= dp.maxWindMps;
      return outcome(definition, passed ? definition.maxPoints : 0, passed ? '动力定位任务落在作业限制内。' : '船位偏离超过 50 米，或环境条件超过海洋石油981的作业限制。', `海流上限 ${dp.maxCurrentMps} 米/秒，风速上限 ${dp.maxWindMps} 米/秒。`);
    }
    case 20: {
      const estimator = text(payload.estimator);
      const predicted = num(payload, 'predictedErrorM');
      if (predicted === null) return invalid('请填写预计定位误差。');
      const passed = text(payload.feedforward) === 'on' && (estimator === 'observer' || estimator === 'kalman') && predicted <= 1;
      return outcome(definition, passed ? definition.maxPoints : 0, passed ? '前馈和估计配置满足定位精度。' : '请启用前馈，选择估计器，并把预计误差控制在 1 米内。', '定位精度指标为 1 米。');
    }
    case 21: {
      const fault = text(payload.fault);
      const observation = text(payload.observation);
      const expected = fault === 'gyro' ? 'heading-drift' : fault === 'gps' || fault === 'wind-sensor' ? 'position-drift' : '';
      if (!expected) return invalid('请选择一种传感器故障。');
      const passed = observation === expected;
      return outcome(definition, passed ? definition.maxPoints : 0, passed ? '故障现象判断正确。' : '故障与观察到的漂移类型不对应。', '定位或风速传感器对应位置漂移，航向传感器对应航向漂移。');
    }
    case 22: {
      const strategy = text(payload.strategy);
      const residual = num(payload, 'residualErrorM');
      const dp = ILAB_DP_REFERENCE.dp;
      if (residual === null || !dp) return invalid('请填写残余偏差。');
      const limit = strategy === 'emergency-disconnect' ? dp.emergencyDisconnectM : strategy === 'safe-hold' || strategy === 'thrust-reallocation' ? dp.redAlertM : null;
      if (limit === null) return invalid('请选择失效安全策略。');
      const passed = residual >= 0 && residual <= limit;
      return outcome(definition, passed ? definition.maxPoints : 0, passed ? '残余偏差落在所选策略的告警阈值内。' : '残余偏差超过所选策略的告警阈值。', `安全保持和推力再分配的阈值是 ${dp.redAlertM} 米，紧急解脱是 ${dp.emergencyDisconnectM} 米。`);
    }
    case 23: {
      const reflection = text(payload.reflection);
      if (reflection.length < 20) return invalid('答辩反思至少写 20 个字。');
      return outcome(definition, 0, '待教师复核', '学生已提交反思。教师评价和互评尚未计入，平台不代填该分数。');
    }
    case 24: {
      const reflection = text(payload.reflection);
      if (reflection.length < 20) return invalid('报告反思至少写 20 个字。');
      return outcome(definition, definition.maxPoints, '报告已生成，教师复核未完成。', '得分按报告完整度计算。模型评阅只在真实调用成功时出现，教师复核尚未计入。');
    }
    default:
      return invalid('实验步骤不存在。');
  }
}

export function ilabExpectTime(seq: number): number {
  return expectTimeSeconds(seq);
}
